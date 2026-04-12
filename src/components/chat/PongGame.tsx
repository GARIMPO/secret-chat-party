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
const PADDLE_H = 64;
const PADDLE_MARGIN = 14;
const BALL_R = 8;
const PADDLE_SPEED = 360;
const BALL_SPEED_X = 280;
const BALL_SPEED_Y = 190;
const MAX_BALL_SPEED_X = 520;
const MAX_BALL_SPEED_Y = 360;
const WIN_SCORE = 5;
const STATE_SYNC_INTERVAL = 33;
const LAUNCH_ZONE_RADIUS = 54;

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
  roundActive: boolean;
  gameOver: boolean;
  winner: string | null;
}

interface PongRuntimeState extends PongState {
  ballVX: number;
  ballVY: number;
}

type PaddleKey = "p1Y" | "p2Y";

function clampPaddle(y: number) {
  return Math.max(0, Math.min(CANVAS_H - PADDLE_H, y));
}

function createInitialState(): PongRuntimeState {
  return {
    ballX: CANVAS_W / 2,
    ballY: CANVAS_H / 2,
    ballVX: 0,
    ballVY: 0,
    p1Y: CANVAS_H / 2 - PADDLE_H / 2,
    p2Y: CANVAS_H / 2 - PADDLE_H / 2,
    score1: 0,
    score2: 0,
    roundActive: false,
    gameOver: false,
    winner: null,
  };
}

function secureRandom(min: number, max: number) {
  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return min + (values[0] / 0xffffffff) * (max - min);
}

function secureSign(): -1 | 1 {
  return secureRandom(0, 1) >= 0.5 ? 1 : -1;
}

function readToken(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function resetBall(state: PongRuntimeState) {
  state.ballX = CANVAS_W / 2;
  state.ballY = CANVAS_H / 2;
  state.ballVX = 0;
  state.ballVY = 0;
  state.roundActive = false;
}

function launchBall(state: PongRuntimeState, direction: -1 | 1) {
  state.ballX = CANVAS_W / 2;
  state.ballY = CANVAS_H / 2;
  state.ballVX = direction * BALL_SPEED_X;
  state.ballVY = secureRandom(BALL_SPEED_Y * 0.55, BALL_SPEED_Y) * secureSign();
  state.roundActive = true;
}

function drawState(ctx: CanvasRenderingContext2D, state: PongRuntimeState) {
  const field = readToken("--foreground", "220 25% 10%");
  const line = readToken("--border", "220 14% 88%");
  const host = readToken("--primary", "160 60% 38%");
  const guest = readToken("--destructive", "0 72% 51%");
  const ball = readToken("--accent-foreground", "160 60% 28%");
  const text = readToken("--primary-foreground", "0 0% 100%");

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = `hsl(${field})`;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.setLineDash([8, 8]);
  ctx.strokeStyle = `hsl(${line} / 0.45)`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(CANVAS_W / 2, 0);
  ctx.lineTo(CANVAS_W / 2, CANVAS_H);
  ctx.stroke();
  ctx.setLineDash([]);

  if (!state.roundActive && !state.gameOver) {
    ctx.strokeStyle = `hsl(${ball} / 0.55)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CANVAS_W / 2, CANVAS_H / 2, LAUNCH_ZONE_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = `hsl(${host})`;
  ctx.fillRect(PADDLE_MARGIN, state.p1Y, PADDLE_W, PADDLE_H);

  ctx.fillStyle = `hsl(${guest})`;
  ctx.fillRect(CANVAS_W - PADDLE_MARGIN - PADDLE_W, state.p2Y, PADDLE_W, PADDLE_H);

  ctx.fillStyle = `hsl(${ball})`;
  ctx.beginPath();
  ctx.arc(state.ballX, state.ballY, BALL_R, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `hsl(${text} / 0.85)`;
  ctx.font = "bold 30px monospace";
  ctx.textAlign = "center";
  ctx.fillText(String(state.score1), CANVAS_W / 4, 40);
  ctx.fillText(String(state.score2), (CANVAS_W * 3) / 4, 40);
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
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
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
    <Dialog open onOpenChange={(nextOpen) => !nextOpen && onDecline()}>
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
  const stateRef = useRef<PongRuntimeState>(createInitialState());
  const keysRef = useRef<Set<string>>(new Set());
  const animRef = useRef<number>(0);
  const lastPublishedPaddleRef = useRef<number>(CANVAS_H / 2 - PADDLE_H / 2);
  const [score, setScore] = useState({ s1: 0, s2: 0 });
  const [winner, setWinner] = useState<string | null>(null);
  const [roundActive, setRoundActive] = useState(false);

  const paddleTopic = `pong-paddle-${gameId}`;
  const stateTopic = `pong-state-${gameId}`;
  const launchTopic = `pong-launch-${gameId}`;
  const syncTopic = `pong-sync-${gameId}`;
  const localPaddleKey: PaddleKey = isHost ? "p1Y" : "p2Y";
  const remotePaddleKey: PaddleKey = isHost ? "p2Y" : "p1Y";

  const publishState = useCallback(() => {
    const { ballX, ballY, p1Y, p2Y, score1, score2, roundActive: active, gameOver, winner: currentWinner } = stateRef.current;
    void channel.publish(stateTopic, {
      ballX,
      ballY,
      p1Y,
      p2Y,
      score1,
      score2,
      roundActive: active,
      gameOver,
      winner: currentWinner,
    } satisfies PongState);
  }, [channel, stateTopic]);

  const publishPaddle = useCallback((y: number) => {
    if (Math.abs(lastPublishedPaddleRef.current - y) < 1) return;
    lastPublishedPaddleRef.current = y;
    void channel.publish(paddleTopic, { player: nickname, y });
  }, [channel, nickname, paddleTopic]);

  const startRound = useCallback((requestedBy?: string) => {
    const state = stateRef.current;
    if (state.gameOver || state.roundActive) return;

    let direction: -1 | 1 = secureSign();
    if (requestedBy) {
      direction = requestedBy === opponent ? -1 : 1;
    }

    launchBall(state, direction);
    setRoundActive(true);
    setWinner(null);
    publishState();
  }, [opponent, publishState]);

  const requestLaunch = useCallback(() => {
    if (stateRef.current.gameOver || stateRef.current.roundActive) return;
    if (isHost) {
      startRound(nickname);
      return;
    }
    void channel.publish(launchTopic, { player: nickname });
  }, [channel, isHost, launchTopic, nickname, startRound]);

  useEffect(() => {
    const handler = (msg: Ably.Message) => {
      const data = msg.data as { player: string; y: number };
      if (data.player === nickname) return;
      stateRef.current[remotePaddleKey] = clampPaddle(data.y);
    };
    channel.subscribe(paddleTopic, handler);
    return () => {
      channel.unsubscribe(paddleTopic, handler);
    };
  }, [channel, nickname, paddleTopic, remotePaddleKey]);

  useEffect(() => {
    if (isHost) {
      const launchHandler = (msg: Ably.Message) => {
        const data = msg.data as { player: string };
        startRound(data.player);
      };

      const syncHandler = () => {
        publishState();
      };

      channel.subscribe(launchTopic, launchHandler);
      channel.subscribe(syncTopic, syncHandler);

      publishState();

      return () => {
        channel.unsubscribe(launchTopic, launchHandler);
        channel.unsubscribe(syncTopic, syncHandler);
      };
    }

    const stateHandler = (msg: Ably.Message) => {
      const data = msg.data as PongState;
      const state = stateRef.current;

      state.ballX = data.ballX;
      state.ballY = data.ballY;
      state.p1Y = data.p1Y;
      if (Math.abs(state.p2Y - data.p2Y) > PADDLE_H) {
        state.p2Y = data.p2Y;
      }
      state.score1 = data.score1;
      state.score2 = data.score2;
      state.roundActive = data.roundActive;
      state.gameOver = data.gameOver;
      state.winner = data.winner;

      setScore({ s1: data.score1, s2: data.score2 });
      setRoundActive(data.roundActive);
      setWinner(data.winner);
    };

    channel.subscribe(stateTopic, stateHandler);
    void channel.publish(syncTopic, { player: nickname });

    return () => {
      channel.unsubscribe(stateTopic, stateHandler);
    };
  }, [channel, isHost, launchTopic, nickname, publishState, startRound, stateTopic, syncTopic]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "w", "W", "s", "S", " "].includes(e.key)) {
        e.preventDefault();
        if (e.key === " ") {
          requestLaunch();
          return;
        }
        keysRef.current.add(e.key.toLowerCase());
      }
    };
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [requestLaunch]);

  const handlePointerEvent = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleY = CANVAS_H / rect.height;
    const y = clampPaddle((e.clientY - rect.top) * scaleY - PADDLE_H / 2);
    stateRef.current[localPaddleKey] = y;
    publishPaddle(y);
  }, [localPaddleKey, publishPaddle]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const distanceToBall = Math.hypot(x - CANVAS_W / 2, y - CANVAS_H / 2);

    if (!stateRef.current.roundActive && distanceToBall <= LAUNCH_ZONE_RADIUS) {
      requestLaunch();
    }

    handlePointerEvent(e);
  }, [handlePointerEvent, requestLaunch]);

  const handlePointerRelease = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let lastFrame = performance.now();
    let lastSync = 0;

    drawState(ctx, stateRef.current);

    const loop = (now: number) => {
      const state = stateRef.current;
      const delta = Math.min((now - lastFrame) / 1000, 0.033);
      lastFrame = now;

      const keys = keysRef.current;
      let paddleChanged = false;
      if (keys.has("arrowup") || keys.has("w")) {
        state[localPaddleKey] = clampPaddle(state[localPaddleKey] - PADDLE_SPEED * delta);
        paddleChanged = true;
      }
      if (keys.has("arrowdown") || keys.has("s")) {
        state[localPaddleKey] = clampPaddle(state[localPaddleKey] + PADDLE_SPEED * delta);
        paddleChanged = true;
      }

      if (paddleChanged) {
        publishPaddle(state[localPaddleKey]);
      }

      if (isHost && state.roundActive && !state.gameOver) {
        state.ballX += state.ballVX * delta;
        state.ballY += state.ballVY * delta;

        if (state.ballY - BALL_R <= 0 || state.ballY + BALL_R >= CANVAS_H) {
          state.ballVY = -state.ballVY;
          state.ballY = Math.max(BALL_R, Math.min(CANVAS_H - BALL_R, state.ballY));
        }

        if (
          state.ballX - BALL_R <= PADDLE_MARGIN + PADDLE_W &&
          state.ballY >= state.p1Y &&
          state.ballY <= state.p1Y + PADDLE_H &&
          state.ballVX < 0
        ) {
          const impact = ((state.ballY - state.p1Y) / PADDLE_H - 0.5) * 2;
          state.ballVX = Math.min(Math.abs(state.ballVX) * 1.04, MAX_BALL_SPEED_X);
          state.ballVY = Math.max(-MAX_BALL_SPEED_Y, Math.min(MAX_BALL_SPEED_Y, impact * MAX_BALL_SPEED_Y));
          state.ballX = PADDLE_MARGIN + PADDLE_W + BALL_R;
        }

        if (
          state.ballX + BALL_R >= CANVAS_W - PADDLE_MARGIN - PADDLE_W &&
          state.ballY >= state.p2Y &&
          state.ballY <= state.p2Y + PADDLE_H &&
          state.ballVX > 0
        ) {
          const impact = ((state.ballY - state.p2Y) / PADDLE_H - 0.5) * 2;
          state.ballVX = -Math.min(Math.abs(state.ballVX) * 1.04, MAX_BALL_SPEED_X);
          state.ballVY = Math.max(-MAX_BALL_SPEED_Y, Math.min(MAX_BALL_SPEED_Y, impact * MAX_BALL_SPEED_Y));
          state.ballX = CANVAS_W - PADDLE_MARGIN - PADDLE_W - BALL_R;
        }

        if (state.ballX < -BALL_R) {
          state.score2 += 1;
          setScore({ s1: state.score1, s2: state.score2 });
          resetBall(state);
          setRoundActive(false);
          publishState();
        } else if (state.ballX > CANVAS_W + BALL_R) {
          state.score1 += 1;
          setScore({ s1: state.score1, s2: state.score2 });
          resetBall(state);
          setRoundActive(false);
          publishState();
        }

        if (state.score1 >= WIN_SCORE || state.score2 >= WIN_SCORE) {
          const currentWinner = state.score1 >= WIN_SCORE ? nickname : opponent;
          state.gameOver = true;
          state.roundActive = false;
          state.winner = currentWinner;
          state.ballVX = 0;
          state.ballVY = 0;
          setWinner(currentWinner);
          setRoundActive(false);
          publishState();
        }

        if (now - lastSync >= STATE_SYNC_INTERVAL) {
          lastSync = now;
          publishState();
        }
      }

      drawState(ctx, state);
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [isHost, localPaddleKey, nickname, opponent, publishPaddle, publishState]);

  return (
    <Dialog open onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[560px] overflow-hidden p-3 sm:p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Gamepad2 className="h-4 w-4 text-primary" />
            🏓 {isHost ? nickname : opponent} vs {isHost ? opponent : nickname}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Computador: ↑↓ ou W/S e Barra de Espaço. Celular: arraste para mover e toque no centro para sacar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center justify-between w-full max-w-[480px] px-2 text-xs font-semibold">
            <span className="text-primary">{isHost ? nickname : opponent}: {score.s1}</span>
            <span className="text-destructive">{isHost ? opponent : nickname}: {score.s2}</span>
          </div>
          <div className="relative w-full max-w-[480px]">
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="block w-full cursor-pointer rounded-xl border border-border bg-foreground/95 shadow-lg shadow-primary/10"
              style={{ aspectRatio: `${CANVAS_W}/${CANVAS_H}`, touchAction: "none" }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerEvent}
              onPointerUp={handlePointerRelease}
              onPointerCancel={handlePointerRelease}
            />

            {!roundActive && !winner && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
                <div className="rounded-full border border-primary/35 bg-background/85 px-5 py-4 text-center shadow-lg backdrop-blur-sm">
                  <p className="text-sm font-semibold text-foreground">Toque na bolinha no centro para sacar</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">No computador, a Barra de Espaço também libera a bola.</p>
                </div>
              </div>
            )}
          </div>
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
