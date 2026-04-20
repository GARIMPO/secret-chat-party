import { useEffect, useRef, useState, useCallback } from "react";
import type Ably from "ably";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Gamepad2, X } from "lucide-react";
import { toast } from "sonner";

/**
 * Multiplayer Ping Pong (Atari-style) com Ably.
 *
 * Sincronização otimizada:
 *  - Host envia estado da bola a 33Hz (cada 30ms): [x, y, vX, vY, p1, p2, t].
 *  - Guest aplica LERP (interpolação) entre posição atual e a recebida.
 *  - Guest faz predição (dead reckoning) usando vX/vY entre pacotes.
 *  - Eventos críticos (ponto, vitória) são publicados imediatamente.
 *  - Rastro visual da bola (trail) suaviza percepção de jitter.
 */

const CANV_WIDTH = 600;
const CANV_HEIGHT = 360;
const PADDLE_WIDTH = 10;
const PADDLE_HEIGHT = 70;
const BALL_SIZE = 10;
const WIN_SCORE = 20;
const BALL_SYNC_MS = 30;
const PADDLE_SYNC_MS = 30;
const BASE_BALL_SPEED_X = 240;
const BASE_BALL_SPEED_Y = 180;
const SPEED_STEP = 30;
const MAX_BALL_SPEED = 720;
const PADDLE_SPEED = 360;
const BASE_LERP_FACTOR = 0.14;
const MAX_LERP_FACTOR = 0.4;
const CORRECTION_DISTANCE = 96;
const TRAIL_LENGTH = 8;
const MAX_BOUNCE_ANGLE = Math.PI / 3;

type BallState = {
  ballX: number;
  ballY: number;
  vX: number;
  vY: number;
};

const clampNumber = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const getInitialVelocity = () => ({
  vX: BASE_BALL_SPEED_X * (Math.random() > 0.5 ? 1 : -1),
  vY: BASE_BALL_SPEED_Y * (Math.random() > 0.5 ? 1 : -1),
});

const applyVerticalBounce = (state: Pick<BallState, "ballY" | "vY">) => {
  const maxY = CANV_HEIGHT - BALL_SIZE;
  while (state.ballY < 0 || state.ballY > maxY) {
    if (state.ballY < 0) {
      state.ballY = -state.ballY;
      state.vY = Math.abs(state.vY);
    } else {
      state.ballY = maxY - (state.ballY - maxY);
      state.vY = -Math.abs(state.vY);
    }
  }
};

const advanceBall = (state: BallState, deltaSeconds: number) => {
  state.ballX += state.vX * deltaSeconds;
  state.ballY += state.vY * deltaSeconds;
  applyVerticalBounce(state);
};

const getBounceVelocity = (state: BallState, paddleY: number, direction: 1 | -1) => {
  const impact = clampNumber(
    (state.ballY + BALL_SIZE / 2 - (paddleY + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2),
    -1,
    1,
  );
  const nextSpeed = clampNumber(
    Math.hypot(state.vX, state.vY) + SPEED_STEP,
    Math.hypot(BASE_BALL_SPEED_X, BASE_BALL_SPEED_Y),
    MAX_BALL_SPEED,
  );
  const angle = impact * MAX_BOUNCE_ANGLE;

  return {
    vX: Math.cos(angle) * nextSpeed * direction,
    vY: Math.sin(angle) * nextSpeed,
  };
};

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

  // Estado autoritativo (host) ou local renderizado (guest)
  const stateRef = useRef({
    p1Y: CANV_HEIGHT / 2 - PADDLE_HEIGHT / 2,
    p2Y: CANV_HEIGHT / 2 - PADDLE_HEIGHT / 2,
    ballX: CANV_WIDTH / 2,
    ballY: CANV_HEIGHT / 2,
    vX: 4,
    vY: 3,
  });

  // Alvo recebido do host (para LERP no guest)
  const targetRef = useRef({
    ballX: CANV_WIDTH / 2,
    ballY: CANV_HEIGHT / 2,
    vX: 4,
    vY: 3,
    lastRecvTs: 0, // performance.now()
  });

  // Trail da bola
  const trailRef = useRef<Array<{ x: number; y: number }>>([]);

  const keysRef = useRef<{ w: boolean; s: boolean }>({ w: false, s: false });
  const winnerRef = useRef<string | null>(null);
  const scoreRef = useRef({ p1: 0, p2: 0 });

  // Reset on open
  useEffect(() => {
    if (!open) return;
    const { vX: initVx, vY: initVy } = getInitialVelocity();
    stateRef.current = {
      p1Y: CANV_HEIGHT / 2 - PADDLE_HEIGHT / 2,
      p2Y: CANV_HEIGHT / 2 - PADDLE_HEIGHT / 2,
      ballX: CANV_WIDTH / 2,
      ballY: CANV_HEIGHT / 2,
      vX: initVx,
      vY: initVy,
    };
    targetRef.current = {
      ballX: CANV_WIDTH / 2,
      ballY: CANV_HEIGHT / 2,
      vX: initVx,
      vY: initVy,
      lastRecvTs: 0,
    };
    trailRef.current = [];
    setScore({ p1: 0, p2: 0 });
    scoreRef.current = { p1: 0, p2: 0 };
    setWinner(null);
    winnerRef.current = null;
    setGuestReady(false);
  }, [open, matchId]);

  // Ably subscriptions
  useEffect(() => {
    if (!open || !channel) return;

    const onBall = (msg: Ably.Message) => {
      const d = msg.data as {
        m: string;
        x: number;
        y: number;
        vx: number;
        vy: number;
        p1: number;
        p2: number;
      };
      if (d.m !== matchId) return;
      if (isHost) return; // host é autoritativo
      const isFirstPacket = targetRef.current.lastRecvTs === 0;
      // Atualiza alvo para LERP + velocidade para predição
      targetRef.current.ballX = d.x;
      targetRef.current.ballY = d.y;
      targetRef.current.vX = d.vx;
      targetRef.current.vY = d.vy;
      targetRef.current.lastRecvTs = performance.now();
      if (isFirstPacket) {
        stateRef.current.ballX = d.x;
        stateRef.current.ballY = d.y;
        stateRef.current.vX = d.vx;
        stateRef.current.vY = d.vy;
      }
      // Placar é canônico do host
      if (d.p1 !== scoreRef.current.p1 || d.p2 !== scoreRef.current.p2) {
        scoreRef.current = { p1: d.p1, p2: d.p2 };
        setScore({ p1: d.p1, p2: d.p2 });
      }
    };
    const onPaddle = (msg: Ably.Message) => {
      const data = msg.data as { y: number; r: "host" | "guest"; m: string };
      if (data.m !== matchId) return;
      if (data.r === "host" && !isHost) stateRef.current.p1Y = data.y;
      if (data.r === "guest" && isHost) stateRef.current.p2Y = data.y;
    };
    const onReady = (msg: Ably.Message) => {
      const data = msg.data as { matchId: string; role: string };
      if (data.matchId !== matchId) return;
      if (data.role === "guest") setGuestReady(true);
    };
    const onScore = (msg: Ably.Message) => {
      const d = msg.data as { m: string; p1: number; p2: number };
      if (d.m !== matchId) return;
      if (isHost) return;
      scoreRef.current = { p1: d.p1, p2: d.p2 };
      setScore({ p1: d.p1, p2: d.p2 });
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
    channel.subscribe("pong-score", onScore);
    channel.subscribe("pong-win", onWin);

    channel.publish("pong-ready", { matchId, role });
    if (isHost) setGuestReady(false);

    return () => {
      channel.unsubscribe("pong-ball", onBall);
      channel.unsubscribe("pong-paddle", onPaddle);
      channel.unsubscribe("pong-ready", onReady);
      channel.unsubscribe("pong-score", onScore);
      channel.unsubscribe("pong-win", onWin);
    };
  }, [open, channel, matchId, isHost, role]);

  // Keyboard
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

  // Game loop — independente do recebimento de mensagens
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let lastBallSync = 0;
    let lastPaddleSync = 0;
    let lastFrameTs = performance.now();

    const reset = (dir: number) => {
      const { vY } = getInitialVelocity();
      stateRef.current.ballX = CANV_WIDTH / 2;
      stateRef.current.ballY = CANV_HEIGHT / 2;
      stateRef.current.vX = BASE_BALL_SPEED_X * dir;
      stateRef.current.vY = vY;
      trailRef.current = [];
    };

    const loop = (ts: number) => {
      const s = stateRef.current;
      const dt = Math.min(50, ts - lastFrameTs);
      lastFrameTs = ts;
      const deltaSeconds = dt / 1000;

      // Controles próprios (raquete local)
      const myKeySpeed = PADDLE_SPEED * deltaSeconds;
      if (isHost) {
        if (keysRef.current.w) s.p1Y = Math.max(0, s.p1Y - myKeySpeed);
        if (keysRef.current.s) s.p1Y = Math.min(CANV_HEIGHT - PADDLE_HEIGHT, s.p1Y + myKeySpeed);
      } else {
        if (keysRef.current.w) s.p2Y = Math.max(0, s.p2Y - myKeySpeed);
        if (keysRef.current.s) s.p2Y = Math.min(CANV_HEIGHT - PADDLE_HEIGHT, s.p2Y + myKeySpeed);
      }

      // ===== HOST: física autoritativa =====
      if (isHost && guestReady && !winnerRef.current) {
        advanceBall(s, deltaSeconds);

        let paddleHit = false;
        // P1 (left)
        if (
          s.ballX <= PADDLE_WIDTH &&
          s.ballX + BALL_SIZE >= 0 &&
          s.ballY + BALL_SIZE >= s.p1Y &&
          s.ballY <= s.p1Y + PADDLE_HEIGHT &&
          s.vX < 0
        ) {
          s.ballX = PADDLE_WIDTH;
          const bounce = getBounceVelocity(s, s.p1Y, 1);
          s.vX = bounce.vX;
          s.vY = bounce.vY;
          paddleHit = true;
        }
        // P2 (right)
        if (
          s.ballX + BALL_SIZE >= CANV_WIDTH - PADDLE_WIDTH &&
          s.ballY + BALL_SIZE >= s.p2Y &&
          s.ballY <= s.p2Y + PADDLE_HEIGHT &&
          s.vX > 0
        ) {
          s.ballX = CANV_WIDTH - PADDLE_WIDTH - BALL_SIZE;
          const bounce = getBounceVelocity(s, s.p2Y, -1);
          s.vX = bounce.vX;
          s.vY = bounce.vY;
          paddleHit = true;
        }

        // Ponto
        let scored = false;
        let { p1, p2 } = scoreRef.current;
        if (s.ballX < -BALL_SIZE) {
          p2 += 1; scored = true; reset(1);
        } else if (s.ballX > CANV_WIDTH) {
          p1 += 1; scored = true; reset(-1);
        }
        if (scored) {
          scoreRef.current = { p1, p2 };
          setScore({ p1, p2 });
          // Evento crítico — envio imediato
          channel?.publish("pong-score", { m: matchId, p1, p2 });
          // Snapshot imediato da bola (reset)
          channel?.publish("pong-ball", {
            m: matchId, x: s.ballX, y: s.ballY, vx: s.vX, vy: s.vY, p1, p2,
          });
          lastBallSync = ts;
          if (p1 >= WIN_SCORE || p2 >= WIN_SCORE) {
            const w = p1 >= WIN_SCORE ? hostNickname : guestNickname;
            winnerRef.current = w;
            setWinner(w);
            channel?.publish("pong-win", { matchId, winner: w });
          }
        }

        // Snapshot imediato em rebatida (evita placar/trajetória dessincronizada)
        if (paddleHit) {
          channel?.publish("pong-ball", {
            m: matchId, x: s.ballX, y: s.ballY, vx: s.vX, vy: s.vY,
            p1: scoreRef.current.p1, p2: scoreRef.current.p2,
          });
          lastBallSync = ts;
        }

        // Throttle 30ms (~33Hz)
        if (ts - lastBallSync >= BALL_SYNC_MS) {
          lastBallSync = ts;
          channel?.publish("pong-ball", {
            m: matchId, x: s.ballX, y: s.ballY, vx: s.vX, vy: s.vY,
            p1: scoreRef.current.p1, p2: scoreRef.current.p2,
          });
        }
      }

      // ===== GUEST: predição + LERP =====
      if (!isHost && !winnerRef.current) {
        advanceBall(s, deltaSeconds);

        const t = targetRef.current;
        if (t.lastRecvTs > 0) {
          const predictedBall = {
            ballX: t.ballX,
            ballY: t.ballY,
            vX: t.vX,
            vY: t.vY,
          };
          advanceBall(predictedBall, Math.max(0, (ts - t.lastRecvTs) / 1000));

          const diffX = predictedBall.ballX - s.ballX;
          const diffY = predictedBall.ballY - s.ballY;
          const distance = Math.hypot(diffX, diffY);
          const lerpFactor =
            BASE_LERP_FACTOR +
            (MAX_LERP_FACTOR - BASE_LERP_FACTOR) * clampNumber(distance / CORRECTION_DISTANCE, 0, 1);

          s.ballX += diffX * lerpFactor;
          s.ballY += diffY * lerpFactor;
          s.vX += (predictedBall.vX - s.vX) * Math.min(lerpFactor, 0.18);
          s.vY += (predictedBall.vY - s.vY) * Math.min(lerpFactor, 0.18);
          applyVerticalBounce(s);
        }
      }

      // Trail
      trailRef.current.push({ x: s.ballX, y: s.ballY });
      if (trailRef.current.length > TRAIL_LENGTH) trailRef.current.shift();

      // Envio de raquete (throttle 30ms)
      if (ts - lastPaddleSync >= PADDLE_SYNC_MS) {
        lastPaddleSync = ts;
        channel?.publish("pong-paddle", {
          m: matchId,
          r: role,
          y: isHost ? s.p1Y : s.p2Y,
        });
      }

      // ===== Draw =====
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, CANV_WIDTH, CANV_HEIGHT);

      // Linha central
      ctx.strokeStyle = "#FFF";
      ctx.setLineDash([6, 10]);
      ctx.beginPath();
      ctx.moveTo(CANV_WIDTH / 2, 0);
      ctx.lineTo(CANV_WIDTH / 2, CANV_HEIGHT);
      ctx.stroke();
      ctx.setLineDash([]);

      // Raquetes
      ctx.fillStyle = "#FFF";
      ctx.fillRect(0, s.p1Y, PADDLE_WIDTH, PADDLE_HEIGHT);
      ctx.fillRect(CANV_WIDTH - PADDLE_WIDTH, s.p2Y, PADDLE_WIDTH, PADDLE_HEIGHT);

      // Trail (desenhado antes da bola, alpha crescente)
      const trail = trailRef.current;
      for (let i = 0; i < trail.length - 1; i++) {
        const a = (i + 1) / trail.length;
        ctx.fillStyle = `rgba(255,255,255,${a * 0.35})`;
        const sz = BALL_SIZE * (0.5 + 0.5 * a);
        ctx.fillRect(trail[i].x, trail[i].y, sz, sz);
      }

      // Bola
      ctx.fillStyle = "#FFF";
      ctx.fillRect(s.ballX, s.ballY, BALL_SIZE, BALL_SIZE);

      // Placar
      const displayScore = scoreRef.current;
      ctx.fillStyle = "#FFF";
      ctx.font = "bold 36px monospace";
      ctx.textAlign = "center";
      ctx.fillText(String(displayScore.p1), CANV_WIDTH / 2 - 40, 44);
      ctx.fillText(String(displayScore.p2), CANV_WIDTH / 2 + 40, 44);

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [open, isHost, channel, matchId, role, guestReady, hostNickname, guestNickname]);

  // Pointer (mouse + touch)
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

export function notifyInviteSent(target: string) {
  toast.success(`Convite de Ping Pong enviado para ${target}`);
}
