import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Gamepad2 } from "lucide-react";
import type Ably from "ably";

const CANVAS_W = 480;
const CANVAS_H = 320;
const PADDLE_W = 10;
const PADDLE_H = 60;
const BALL_R = 8;
const PADDLE_SPEED = 6;
const BALL_SPEED = 4;
const WIN_SCORE = 5;

export interface PongInvite {
  id: string;
  from: string;
  to: string;
}

export interface PongAccept {
  id: string;
  from: string;
  to: string;
}

interface PongState {
  ballX: number;
  ballY: number;
  p1Y: number;
  p2Y: number;
  score1: number;
  score2: number;
}

/* ---- Invite Chooser ---- */
interface PongInviteChooserProps {
  open: boolean;
  onClose: () => void;
  onlineUsers: string[];
  nickname: string;
  onInvite: (target: string) => void;
}

export function PongInviteChooser({ open, onClose, onlineUsers, nickname, onInvite }: PongInviteChooserProps) {
  const others = onlineUsers.filter((u) => u !== nickname);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-primary" />
            Ping Pong
          </DialogTitle>
          <DialogDescription>Escolha um oponente para jogar!</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {others.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Ninguém online para jogar</p>
          )}
          {others.map((user) => (
            <button
              key={user}
              onClick={() => { onInvite(user); onClose(); }}
              className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-primary/10 transition-colors text-foreground"
            >
              🏓 {user}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---- Invite Received ---- */
interface PongInvitePopupProps {
  invite: PongInvite;
  onAccept: () => void;
  onDecline: () => void;
}

export function PongInvitePopup({ invite, onAccept, onDecline }: PongInvitePopupProps) {
  return (
    <Dialog open onOpenChange={() => onDecline()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-primary" />
            Desafio de Ping Pong!
          </DialogTitle>
          <DialogDescription>
            <strong>{invite.from}</strong> quer jogar Ping Pong com você!
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Button onClick={onAccept} className="flex-1">Aceitar</Button>
          <Button variant="outline" onClick={onDecline} className="flex-1">Recusar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---- Game Canvas ---- */
interface PongGameCanvasProps {
  channel: Ably.RealtimeChannel;
  gameId: string;
  nickname: string;
  opponent: string;
  isHost: boolean; // host = player 1 (left), guest = player 2 (right)
  onClose: () => void;
}

export function PongGameCanvas({ channel, gameId, nickname, opponent, isHost, onClose }: PongGameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    ballX: CANVAS_W / 2,
    ballY: CANVAS_H / 2,
    ballVX: BALL_SPEED * (Math.random() > 0.5 ? 1 : -1),
    ballVY: BALL_SPEED * (Math.random() > 0.5 ? 1 : -1),
    p1Y: CANVAS_H / 2 - PADDLE_H / 2,
    p2Y: CANVAS_H / 2 - PADDLE_H / 2,
    score1: 0,
    score2: 0,
    gameOver: false,
  });
  const keysRef = useRef<Set<string>>(new Set());
  const animRef = useRef<number>(0);
  const [score, setScore] = useState({ s1: 0, s2: 0 });
  const [winner, setWinner] = useState<string | null>(null);

  // Remote paddle update
  useEffect(() => {
    const subName = `pong-paddle-${gameId}`;
    const handler = (msg: Ably.Message) => {
      const data = msg.data as { player: string; y: number };
      if (data.player === nickname) return;
      if (isHost) {
        stateRef.current.p2Y = data.y;
      } else {
        stateRef.current.p1Y = data.y;
      }
    };
    channel.subscribe(subName, handler);

    // Host syncs ball state
    if (!isHost) {
      const ballHandler = (msg: Ably.Message) => {
        const data = msg.data as PongState;
        const s = stateRef.current;
        s.ballX = data.ballX;
        s.ballY = data.ballY;
        s.score1 = data.score1;
        s.score2 = data.score2;
        s.p1Y = data.p1Y;
        setScore({ s1: data.score1, s2: data.score2 });
      };
      channel.subscribe(`pong-ball-${gameId}`, ballHandler);
      return () => {
        channel.unsubscribe(subName, handler);
        channel.unsubscribe(`pong-ball-${gameId}`, ballHandler);
      };
    }

    return () => { channel.unsubscribe(subName, handler); };
  }, [channel, gameId, nickname, isHost]);

  // Game over listener
  useEffect(() => {
    const handler = (msg: Ably.Message) => {
      const data = msg.data as { winner: string };
      setWinner(data.winner);
      stateRef.current.gameOver = true;
    };
    channel.subscribe(`pong-over-${gameId}`, handler);
    return () => { channel.unsubscribe(`pong-over-${gameId}`, handler); };
  }, [channel, gameId]);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "w", "s"].includes(e.key)) {
        e.preventDefault();
        keysRef.current.add(e.key);
      }
    };
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Touch/mouse controls - handle both move and touch
  const handlePointerEvent = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleY = CANVAS_H / rect.height;
    const y = (e.clientY - rect.top) * scaleY - PADDLE_H / 2;
    const clamped = Math.max(0, Math.min(CANVAS_H - PADDLE_H, y));
    if (isHost) {
      stateRef.current.p1Y = clamped;
    } else {
      stateRef.current.p2Y = clamped;
    }
    channel.publish(`pong-paddle-${gameId}`, { player: nickname, y: clamped });
  }, [channel, gameId, nickname, isHost]);

  // Capture pointer on down for mobile
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    handlePointerEvent(e);
  }, [handlePointerEvent]);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let syncCounter = 0;

    const loop = () => {
      const s = stateRef.current;
      if (s.gameOver) {
        drawState(ctx, s);
        return;
      }

      // Move my paddle via keyboard
      const keys = keysRef.current;
      const myPaddle = isHost ? "p1Y" : "p2Y";
      if (keys.has("ArrowUp") || keys.has("w")) {
        s[myPaddle] = Math.max(0, s[myPaddle] - PADDLE_SPEED);
      }
      if (keys.has("ArrowDown") || keys.has("s")) {
        s[myPaddle] = Math.min(CANVAS_H - PADDLE_H, s[myPaddle] + PADDLE_SPEED);
      }

      // Send paddle position
      if (keys.has("ArrowUp") || keys.has("ArrowDown") || keys.has("w") || keys.has("s")) {
        channel.publish(`pong-paddle-${gameId}`, { player: nickname, y: s[myPaddle] });
      }

      // Only host runs ball physics
      if (isHost) {
        s.ballX += s.ballVX;
        s.ballY += s.ballVY;

        // Top/bottom bounce
        if (s.ballY - BALL_R <= 0 || s.ballY + BALL_R >= CANVAS_H) {
          s.ballVY = -s.ballVY;
          s.ballY = Math.max(BALL_R, Math.min(CANVAS_H - BALL_R, s.ballY));
        }

        // Left paddle collision
        if (
          s.ballX - BALL_R <= PADDLE_W + 10 &&
          s.ballY >= s.p1Y &&
          s.ballY <= s.p1Y + PADDLE_H &&
          s.ballVX < 0
        ) {
          s.ballVX = -s.ballVX * 1.05;
          s.ballX = PADDLE_W + 10 + BALL_R;
        }

        // Right paddle collision
        if (
          s.ballX + BALL_R >= CANVAS_W - PADDLE_W - 10 &&
          s.ballY >= s.p2Y &&
          s.ballY <= s.p2Y + PADDLE_H &&
          s.ballVX > 0
        ) {
          s.ballVX = -s.ballVX * 1.05;
          s.ballX = CANVAS_W - PADDLE_W - 10 - BALL_R;
        }

        // Score
        if (s.ballX < 0) {
          s.score2++;
          setScore({ s1: s.score1, s2: s.score2 });
          resetBall(s);
        } else if (s.ballX > CANVAS_W) {
          s.score1++;
          setScore({ s1: s.score1, s2: s.score2 });
          resetBall(s);
        }

        // Win check
        if (s.score1 >= WIN_SCORE || s.score2 >= WIN_SCORE) {
          const w = s.score1 >= WIN_SCORE ? nickname : opponent;
          setWinner(w);
          s.gameOver = true;
          channel.publish(`pong-over-${gameId}`, { winner: w });
        }

        // Sync ball to guest
        syncCounter++;
        if (syncCounter % 3 === 0) {
          channel.publish(`pong-ball-${gameId}`, {
            ballX: s.ballX,
            ballY: s.ballY,
            p1Y: s.p1Y,
            score1: s.score1,
            score2: s.score2,
          });
        }
      }

      drawState(ctx, s);
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [channel, gameId, isHost, nickname, opponent]);

  function resetBall(s: typeof stateRef.current) {
    s.ballX = CANVAS_W / 2;
    s.ballY = CANVAS_H / 2;
    s.ballVX = BALL_SPEED * (Math.random() > 0.5 ? 1 : -1);
    s.ballVY = BALL_SPEED * (Math.random() > 0.5 ? 1 : -1);
  }

  function drawState(ctx: CanvasRenderingContext2D, s: typeof stateRef.current) {
    // Background
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Center line
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CANVAS_W / 2, 0);
    ctx.lineTo(CANVAS_W / 2, CANVAS_H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Paddles
    ctx.fillStyle = "#16db93";
    ctx.fillRect(10, s.p1Y, PADDLE_W, PADDLE_H);
    ctx.fillStyle = "#ef476f";
    ctx.fillRect(CANVAS_W - PADDLE_W - 10, s.p2Y, PADDLE_W, PADDLE_H);

    // Ball
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.arc(s.ballX, s.ballY, BALL_R, 0, Math.PI * 2);
    ctx.fill();

    // Scores
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "bold 32px monospace";
    ctx.textAlign = "center";
    ctx.fillText(String(s.score1), CANVAS_W / 4, 40);
    ctx.fillText(String(s.score2), (CANVAS_W * 3) / 4, 40);
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg sm:max-w-xl p-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Gamepad2 className="h-4 w-4 text-primary" />
            🏓 {isHost ? nickname : opponent} vs {isHost ? opponent : nickname}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Use ↑↓ ou toque/arraste para mover. Primeiro a {WIN_SCORE} pontos vence!
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center justify-between w-full max-w-[480px] px-2 text-xs font-semibold">
            <span className="text-[#16db93]">{isHost ? nickname : opponent}: {score.s1}</span>
            <span className="text-[#ef476f]">{isHost ? opponent : nickname}: {score.s2}</span>
          </div>
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="rounded-lg border border-border w-full max-w-[480px] cursor-pointer"
            style={{ aspectRatio: `${CANVAS_W}/${CANVAS_H}`, touchAction: 'none' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerEvent}
          />
          {winner && (
            <div className="text-center animate-scale-in">
              <p className="text-xl font-bold text-primary">
                🏆 {winner} venceu!
              </p>
              <Button onClick={onClose} variant="outline" size="sm" className="mt-2">
                Fechar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
