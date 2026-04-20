import { useEffect, useRef, useState, useCallback } from "react";
import type Ably from "ably";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Gamepad2, X } from "lucide-react";
import { toast } from "sonner";

/**
 * Multiplayer Ping Pong (Atari-style) integrated with Ably.
 *
 * Flow:
 *  - User picks an opponent from online users → publishes "pong-invite".
 *  - Opponent receives popup → accepts → publishes "pong-accept".
 *  - Both open the game canvas. The inviter is HOST, the invitee is GUEST.
 *  - HOST runs physics + broadcasts ball state. Both broadcast paddle Y.
 *
 * Controls:
 *  - Desktop: mouse move over canvas, or W/S keys.
 *  - Mobile: touch/drag on canvas.
 */

const CANV_WIDTH = 600;
const CANV_HEIGHT = 360;
const PADDLE_WIDTH = 10;
const PADDLE_HEIGHT = 70;
const BALL_SIZE = 10;
const WIN_SCORE = 7;

export interface PongInvite {
  id: string;
  from: string;
  to: string;
  matchId: string;
}

export interface PongAccept {
  matchId: string;
  from: string;
  to: string;
  accepted: boolean;
}

// ===================== INVITE CHOOSER =====================

export function PongInviteChooser({
  open,
  onClose,
  onlineUsers,
  myNickname,
  onSendInvite,
}: {
  open: boolean;
  onClose: () => void;
  onlineUsers: string[];
  myNickname: string;
  onSendInvite: (target: string) => void;
}) {
  const candidates = onlineUsers.filter((u) => u !== myNickname);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold">Convidar para Ping Pong</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Escolha um jogador online para desafiar.
          </p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {candidates.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                Nenhum outro jogador online.
              </p>
            )}
            {candidates.map((u) => (
              <button
                key={u}
                onClick={() => {
                  onSendInvite(u);
                  onClose();
                }}
                className="w-full text-left text-sm px-3 py-2 rounded-md bg-muted hover:bg-primary/15 transition-colors"
              >
                🎮 {u}
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===================== INVITE POPUP (receiver) =====================

export function PongInvitePopup({
  invite,
  onAccept,
  onDecline,
}: {
  invite: PongInvite | null;
  onAccept: () => void;
  onDecline: () => void;
}) {
  if (!invite) return null;
  return (
    <Dialog open={!!invite} onOpenChange={(o) => !o && onDecline()}>
      <DialogContent className="max-w-sm">
        <div className="flex flex-col gap-4 items-center text-center">
          <Gamepad2 className="h-10 w-10 text-primary" />
          <h3 className="text-lg font-semibold">Convite para Ping Pong</h3>
          <p className="text-sm text-muted-foreground">
            <strong>{invite.from}</strong> quer jogar Ping Pong com você!
          </p>
          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1" onClick={onDecline}>
              Recusar
            </Button>
            <Button className="flex-1" onClick={onAccept}>
              Aceitar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===================== GAME CANVAS =====================

interface BallState {
  x: number;
  y: number;
  scoreP1: number;
  scoreP2: number;
}

export function PongGameCanvas({
  open,
  matchId,
  channel,
  myNickname,
  hostNickname,
  guestNickname,
  onClose,
}: {
  open: boolean;
  matchId: string;
  channel: Ably.RealtimeChannel | null;
  myNickname: string;
  hostNickname: string;
  guestNickname: string;
  onClose: () => void;
}) {
  const isHost = myNickname === hostNickname;
  const role: "host" | "guest" = isHost ? "host" : "guest";

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState({ p1: 0, p2: 0 });
  const [winner, setWinner] = useState<string | null>(null);
  const [guestReady, setGuestReady] = useState(false);

  const stateRef = useRef({
    p1Y: CANV_HEIGHT / 2 - PADDLE_HEIGHT / 2,
    p2Y: CANV_HEIGHT / 2 - PADDLE_HEIGHT / 2,
    ballX: CANV_WIDTH / 2,
    ballY: CANV_HEIGHT / 2,
    vX: 4,
    vY: 3,
  });
  const keysRef = useRef<{ w: boolean; s: boolean }>({ w: false, s: false });
  const winnerRef = useRef<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    stateRef.current = {
      p1Y: CANV_HEIGHT / 2 - PADDLE_HEIGHT / 2,
      p2Y: CANV_HEIGHT / 2 - PADDLE_HEIGHT / 2,
      ballX: CANV_WIDTH / 2,
      ballY: CANV_HEIGHT / 2,
      vX: 4 * (Math.random() > 0.5 ? 1 : -1),
      vY: 3 * (Math.random() > 0.5 ? 1 : -1),
    };
    setScore({ p1: 0, p2: 0 });
    setWinner(null);
    winnerRef.current = null;
    setGuestReady(false);
  }, [open, matchId]);

  // Ably subscriptions
  useEffect(() => {
    if (!open || !channel) return;

    const onBall = (msg: Ably.Message) => {
      const data = msg.data as BallState & { matchId: string };
      if (data.matchId !== matchId) return;
      if (isHost) return; // host is authoritative
      stateRef.current.ballX = data.x;
      stateRef.current.ballY = data.y;
      setScore({ p1: data.scoreP1, p2: data.scoreP2 });
    };
    const onPaddle = (msg: Ably.Message) => {
      const data = msg.data as { y: number; role: "host" | "guest"; matchId: string };
      if (data.matchId !== matchId) return;
      if (data.role === "host" && !isHost) stateRef.current.p1Y = data.y;
      if (data.role === "guest" && isHost) stateRef.current.p2Y = data.y;
    };
    const onReady = (msg: Ably.Message) => {
      const data = msg.data as { matchId: string; role: string };
      if (data.matchId !== matchId) return;
      if (data.role === "guest") setGuestReady(true);
    };
    const onWin = (msg: Ably.Message) => {
      const data = msg.data as { matchId: string; winner: string };
      if (data.matchId !== matchId) return;
      winnerRef.current = data.winner;
      setWinner(data.winner);
    };

    channel.subscribe("pong-ball", onBall);
    channel.subscribe("pong-paddle", onPaddle);
    channel.subscribe("pong-ready", onReady);
    channel.subscribe("pong-win", onWin);

    // Announce readiness
    channel.publish("pong-ready", { matchId, role });
    if (isHost) setGuestReady(false); // wait for guest

    return () => {
      channel.unsubscribe("pong-ball", onBall);
      channel.unsubscribe("pong-paddle", onPaddle);
      channel.unsubscribe("pong-ready", onReady);
      channel.unsubscribe("pong-win", onWin);
    };
  }, [open, channel, matchId, isHost, role]);

  // Keyboard controls
  useEffect(() => {
    if (!open) return;
    const onDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "w") keysRef.current.w = true;
      if (k === "s") keysRef.current.s = true;
    };
    const onUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "w") keysRef.current.w = false;
      if (k === "s") keysRef.current.s = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [open]);

  // Game loop
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let lastSync = 0;

    const reset = (dir: number) => {
      stateRef.current.ballX = CANV_WIDTH / 2;
      stateRef.current.ballY = CANV_HEIGHT / 2;
      stateRef.current.vX = 4 * dir;
      stateRef.current.vY = 3 * (Math.random() > 0.5 ? 1 : -1);
    };

    const loop = (ts: number) => {
      const s = stateRef.current;

      // Apply keyboard for own paddle
      const myKeySpeed = 6;
      if (isHost) {
        if (keysRef.current.w) s.p1Y = Math.max(0, s.p1Y - myKeySpeed);
        if (keysRef.current.s) s.p1Y = Math.min(CANV_HEIGHT - PADDLE_HEIGHT, s.p1Y + myKeySpeed);
      } else {
        if (keysRef.current.w) s.p2Y = Math.max(0, s.p2Y - myKeySpeed);
        if (keysRef.current.s) s.p2Y = Math.min(CANV_HEIGHT - PADDLE_HEIGHT, s.p2Y + myKeySpeed);
      }

      // Host physics
      if (isHost && guestReady && !winnerRef.current) {
        s.ballX += s.vX;
        s.ballY += s.vY;

        if (s.ballY <= 0) { s.ballY = 0; s.vY *= -1; }
        if (s.ballY >= CANV_HEIGHT - BALL_SIZE) { s.ballY = CANV_HEIGHT - BALL_SIZE; s.vY *= -1; }

        // P1 paddle (left)
        if (
          s.ballX <= PADDLE_WIDTH &&
          s.ballY + BALL_SIZE >= s.p1Y &&
          s.ballY <= s.p1Y + PADDLE_HEIGHT &&
          s.vX < 0
        ) {
          const newSpeed = Math.min(Math.abs(s.vX) + 0.5, 14);
          s.vX = newSpeed;
          const rel = (s.ballY - (s.p1Y + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
          s.vY = rel * 5;
        }
        // P2 paddle (right)
        if (
          s.ballX + BALL_SIZE >= CANV_WIDTH - PADDLE_WIDTH &&
          s.ballY + BALL_SIZE >= s.p2Y &&
          s.ballY <= s.p2Y + PADDLE_HEIGHT &&
          s.vX > 0
        ) {
          const newSpeed = Math.min(Math.abs(s.vX) + 0.5, 14);
          s.vX = -newSpeed;
          const rel = (s.ballY - (s.p2Y + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
          s.vY = rel * 5;
        }

        // Scoring
        let scored = false;
        let p1 = score.p1, p2 = score.p2;
        if (s.ballX < -BALL_SIZE) {
          p2 += 1;
          scored = true;
          reset(1);
        } else if (s.ballX > CANV_WIDTH) {
          p1 += 1;
          scored = true;
          reset(-1);
        }
        if (scored) {
          setScore({ p1, p2 });
          if (p1 >= WIN_SCORE || p2 >= WIN_SCORE) {
            const w = p1 >= WIN_SCORE ? hostNickname : guestNickname;
            winnerRef.current = w;
            setWinner(w);
            channel?.publish("pong-win", { matchId, winner: w });
          }
        }

        // Broadcast ball state ~30fps
        if (ts - lastSync > 33) {
          lastSync = ts;
          channel?.publish("pong-ball", {
            matchId,
            x: s.ballX,
            y: s.ballY,
            scoreP1: p1,
            scoreP2: p2,
          });
        }
      }

      // Always broadcast my paddle (throttled to ~30fps via timestamp)
      if (ts - (loop as any)._lastPaddle > 33) {
        (loop as any)._lastPaddle = ts;
        channel?.publish("pong-paddle", {
          matchId,
          role,
          y: isHost ? s.p1Y : s.p2Y,
        });
      }

      // Draw
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, CANV_WIDTH, CANV_HEIGHT);

      // Center dashed line
      ctx.strokeStyle = "#FFF";
      ctx.setLineDash([6, 10]);
      ctx.beginPath();
      ctx.moveTo(CANV_WIDTH / 2, 0);
      ctx.lineTo(CANV_WIDTH / 2, CANV_HEIGHT);
      ctx.stroke();
      ctx.setLineDash([]);

      // Paddles
      ctx.fillStyle = "#FFF";
      ctx.fillRect(0, s.p1Y, PADDLE_WIDTH, PADDLE_HEIGHT);
      ctx.fillRect(CANV_WIDTH - PADDLE_WIDTH, s.p2Y, PADDLE_WIDTH, PADDLE_HEIGHT);

      // Ball
      ctx.fillRect(s.ballX, s.ballY, BALL_SIZE, BALL_SIZE);

      // Scores
      ctx.fillStyle = "#FFF";
      ctx.font = "bold 36px monospace";
      ctx.textAlign = "center";
      ctx.fillText(String(score.p1), CANV_WIDTH / 2 - 40, 44);
      ctx.fillText(String(score.p2), CANV_WIDTH / 2 + 40, 44);

      raf = requestAnimationFrame(loop);
    };
    (loop as any)._lastPaddle = 0;
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [open, isHost, channel, matchId, score.p1, score.p2, role, guestReady, hostNickname, guestNickname]);

  // Pointer (mouse + touch) controls
  const movePaddleTo = useCallback((clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = CANV_HEIGHT / rect.height;
    const localY = (clientY - rect.top) * scale;
    const target = Math.max(0, Math.min(CANV_HEIGHT - PADDLE_HEIGHT, localY - PADDLE_HEIGHT / 2));
    if (isHost) stateRef.current.p1Y = target;
    else stateRef.current.p2Y = target;
  }, [isHost]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl p-3 sm:p-4 bg-zinc-900 border-zinc-700">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs sm:text-sm font-mono text-white">
            <span className="text-primary">{hostNickname}</span> vs{" "}
            <span className="text-primary">{guestNickname}</span>
            <span className="ml-2 text-muted-foreground">
              (você: {isHost ? "esquerda" : "direita"})
            </span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-white" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="relative w-full" style={{ aspectRatio: `${CANV_WIDTH}/${CANV_HEIGHT}` }}>
          <canvas
            ref={canvasRef}
            width={CANV_WIDTH}
            height={CANV_HEIGHT}
            className="absolute inset-0 w-full h-full border-2 border-white touch-none select-none cursor-none"
            onMouseMove={(e) => movePaddleTo(e.clientY)}
            onTouchStart={(e) => {
              const t = e.touches[0];
              if (t) movePaddleTo(t.clientY);
            }}
            onTouchMove={(e) => {
              e.preventDefault();
              const t = e.touches[0];
              if (t) movePaddleTo(t.clientY);
            }}
          />

          {!guestReady && isHost && !winner && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white font-mono text-sm">
              Aguardando oponente...
            </div>
          )}

          {winner && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white font-mono gap-3">
              <div className="text-2xl">🏆 {winner} venceu!</div>
              <div className="text-base">{score.p1} : {score.p2}</div>
              <Button onClick={onClose}>Fechar</Button>
            </div>
          )}
        </div>

        <div className="mt-2 text-[10px] sm:text-xs text-muted-foreground font-mono text-center">
          PC: mouse ou W/S • Mobile: arraste o dedo no canvas • Primeiro a {WIN_SCORE} vence
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper to show toast on send/accept
export function notifyInviteSent(target: string) {
  toast.success(`Convite de Ping Pong enviado para ${target}`);
}
