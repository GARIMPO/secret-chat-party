import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Rocket, X } from "lucide-react";

// ── Types ──
export interface AsteroidsInvite {
  gameId: string;
  from: string;
  to: string;
}

export interface AsteroidsGameState {
  gameId: string;
  host: string;
  guest: string;
}

interface Ship {
  x: number; y: number; angle: number; vx: number; vy: number;
}

interface Bullet {
  x: number; y: number; vx: number; vy: number; life: number; owner: "host" | "guest";
}

interface Asteroid {
  id: number; x: number; y: number; vx: number; vy: number; size: number;
}

// ── Invite Chooser ──
interface InviteChooserProps {
  open: boolean;
  onClose: () => void;
  onlineUsers: string[];
  nickname: string;
  onInvite: (target: string) => void;
}

export function AsteroidsInviteChooser({ open, onClose, onlineUsers, nickname, onInvite }: InviteChooserProps) {
  const others = onlineUsers.filter((u) => u !== nickname);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" /> Asteroides
          </DialogTitle>
          <DialogDescription>Escolha alguém para jogar</DialogDescription>
        </DialogHeader>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {others.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Ninguém online</p>}
          {others.map((u) => (
            <button
              key={u}
              onClick={() => { onInvite(u); onClose(); }}
              className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-muted transition-colors text-foreground"
            >
              {u}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Invite Popup ──
interface InvitePopupProps {
  invite: AsteroidsInvite;
  onAccept: () => void;
  onDecline: () => void;
}

export function AsteroidsInvitePopup({ invite, onAccept, onDecline }: InvitePopupProps) {
  return (
    <Dialog open onOpenChange={() => onDecline()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" /> Convite Asteroides
          </DialogTitle>
          <DialogDescription>
            <strong>{invite.from}</strong> quer jogar Asteroides com você!
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

// ── Game Canvas ──
interface GameCanvasProps {
  game: AsteroidsGameState;
  nickname: string;
  channel: any; // Ably channel
  onClose: () => void;
}

const W = 600, H = 450;
const SHIP_SIZE = 12;
const BULLET_SPEED = 5;
const BULLET_LIFE = 60;
const TURN_SPEED = 0.07;
const THRUST = 0.12;
const FRICTION = 0.99;
const MAX_ASTEROIDS = 8;
const SPAWN_INTERVAL = 120; // frames

export function AsteroidsGameCanvas({ game, nickname, channel, onClose }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isHost = game.host === nickname;
  const role = isHost ? "host" : "guest";

  // Game state refs
  const hostShip = useRef<Ship>({ x: W * 0.25, y: H / 2, angle: 0, vx: 0, vy: 0 });
  const guestShip = useRef<Ship>({ x: W * 0.75, y: H / 2, angle: Math.PI, vx: 0, vy: 0 });
  const bullets = useRef<Bullet[]>([]);
  const asteroids = useRef<Asteroid[]>([]);
  const scores = useRef({ host: 0, guest: 0 });
  const keys = useRef<Set<string>>(new Set());
  const frameCount = useRef(0);
  const nextAsteroidId = useRef(0);
  const gameOver = useRef(false);
  const winner = useRef<string>("");
  const [, forceRender] = useState(0);
  const animRef = useRef<number>(0);
  const lastSendRef = useRef(0);

  const myShip = useCallback(() => isHost ? hostShip.current : guestShip.current, [isHost]);
  const opShip = useCallback(() => isHost ? guestShip.current : hostShip.current, [isHost]);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => { keys.current.add(e.key); };
    const up = (e: KeyboardEvent) => { keys.current.delete(e.key); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // Touch controls
  const touchRef = useRef<{ left: boolean; right: boolean; thrust: boolean; shoot: boolean }>({
    left: false, right: false, thrust: false, shoot: false,
  });

  // Ably sync
  useEffect(() => {
    if (!channel) return;
    const handleSync = (msg: any) => {
      const d = msg.data;
      if (d.from === nickname) return;
      // Update opponent ship
      const op = opShip();
      op.x = d.x; op.y = d.y; op.angle = d.angle; op.vx = d.vx; op.vy = d.vy;
    };
    const handleBullet = (msg: any) => {
      const d = msg.data;
      if (d.owner === role) return;
      bullets.current.push({ x: d.x, y: d.y, vx: d.vx, vy: d.vy, life: BULLET_LIFE, owner: d.owner });
    };
    const handleAsteroids = (msg: any) => {
      if (isHost) return; // guest receives asteroid state from host
      asteroids.current = msg.data.asteroids;
      scores.current = msg.data.scores;
      if (msg.data.gameOver) {
        gameOver.current = true;
        winner.current = msg.data.winner;
        forceRender((v) => v + 1);
      }
    };

    channel.subscribe("ast-sync", handleSync);
    channel.subscribe("ast-bullet", handleBullet);
    channel.subscribe("ast-state", handleAsteroids);

    return () => {
      channel.unsubscribe("ast-sync", handleSync);
      channel.unsubscribe("ast-bullet", handleBullet);
      channel.unsubscribe("ast-state", handleAsteroids);
    };
  }, [channel, nickname, isHost, role, opShip]);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const spawnAsteroid = (): Asteroid => {
      const edge = Math.floor(Math.random() * 4);
      let x = 0, y = 0;
      if (edge === 0) { x = Math.random() * W; y = -20; }
      else if (edge === 1) { x = W + 20; y = Math.random() * H; }
      else if (edge === 2) { x = Math.random() * W; y = H + 20; }
      else { x = -20; y = Math.random() * H; }
      const speed = 0.5 + Math.random() * 1.5;
      const angle = Math.atan2(H / 2 - y + (Math.random() - 0.5) * 200, W / 2 - x + (Math.random() - 0.5) * 200);
      return {
        id: nextAsteroidId.current++,
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 20 + Math.random() * 25,
      };
    };

    const wrap = (v: number, max: number) => ((v % max) + max) % max;

    const loop = () => {
      if (gameOver.current) { animRef.current = requestAnimationFrame(loop); drawGameOver(ctx); return; }
      frameCount.current++;
      const k = keys.current;
      const t = touchRef.current;
      const ship = myShip();

      // Input
      if (k.has("ArrowLeft") || k.has("a") || k.has("A") || t.left) ship.angle -= TURN_SPEED;
      if (k.has("ArrowRight") || k.has("d") || k.has("D") || t.right) ship.angle += TURN_SPEED;
      if (k.has("ArrowUp") || k.has("w") || k.has("W") || t.thrust) {
        ship.vx += Math.cos(ship.angle) * THRUST;
        ship.vy += Math.sin(ship.angle) * THRUST;
      }
      if ((k.has(" ") || t.shoot) && frameCount.current % 8 === 0) {
        const b: Bullet = {
          x: ship.x + Math.cos(ship.angle) * SHIP_SIZE,
          y: ship.y + Math.sin(ship.angle) * SHIP_SIZE,
          vx: Math.cos(ship.angle) * BULLET_SPEED + ship.vx * 0.3,
          vy: Math.sin(ship.angle) * BULLET_SPEED + ship.vy * 0.3,
          life: BULLET_LIFE, owner: role,
        };
        bullets.current.push(b);
        channel?.publish("ast-bullet", { x: b.x, y: b.y, vx: b.vx, vy: b.vy, owner: role });
      }

      // Physics
      ship.vx *= FRICTION; ship.vy *= FRICTION;
      ship.x = wrap(ship.x + ship.vx, W);
      ship.y = wrap(ship.y + ship.vy, H);

      // Update bullets
      bullets.current = bullets.current.filter((b) => {
        b.x += b.vx; b.y += b.vy; b.life--;
        return b.life > 0 && b.x > -10 && b.x < W + 10 && b.y > -10 && b.y < H + 10;
      });

      // Host manages asteroids & collisions
      if (isHost) {
        if (frameCount.current % SPAWN_INTERVAL === 0 && asteroids.current.length < MAX_ASTEROIDS) {
          asteroids.current.push(spawnAsteroid());
        }
        // Move asteroids
        for (const a of asteroids.current) {
          a.x += a.vx; a.y += a.vy;
        }
        // Remove off-screen asteroids
        asteroids.current = asteroids.current.filter(
          (a) => a.x > -60 && a.x < W + 60 && a.y > -60 && a.y < H + 60
        );

        // Bullet-asteroid collision
        const hitIds = new Set<number>();
        bullets.current = bullets.current.filter((b) => {
          for (const a of asteroids.current) {
            const dx = b.x - a.x, dy = b.y - a.y;
            if (dx * dx + dy * dy < a.size * a.size) {
              hitIds.add(a.id);
              if (b.owner === "host") scores.current.host += 10;
              else scores.current.guest += 10;
              return false;
            }
          }
          return true;
        });
        if (hitIds.size > 0) {
          asteroids.current = asteroids.current.filter((a) => !hitIds.has(a.id));
          // Split large asteroids
          const toAdd: Asteroid[] = [];
          for (const a of [...asteroids.current]) {
            // already filtered
          }
          // Actually check original list for splits
        }

        // Check win
        if (scores.current.host >= 200 || scores.current.guest >= 200) {
          gameOver.current = true;
          winner.current = scores.current.host >= 200 ? game.host : game.guest;
          forceRender((v) => v + 1);
        }

        // Broadcast state every 3 frames
        if (frameCount.current % 3 === 0) {
          channel?.publish("ast-state", {
            asteroids: asteroids.current,
            scores: scores.current,
            gameOver: gameOver.current,
            winner: winner.current,
          });
        }
      }

      // Send my position
      if (frameCount.current % 2 === 0) {
        channel?.publish("ast-sync", {
          from: nickname,
          x: ship.x, y: ship.y, angle: ship.angle, vx: ship.vx, vy: ship.vy,
        });
      }

      // ── Draw ──
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      // Stars background
      ctx.fillStyle = "#333";
      for (let i = 0; i < 50; i++) {
        const sx = (i * 137.5) % W, sy = (i * 97.3) % H;
        ctx.fillRect(sx, sy, 1, 1);
      }

      // Draw asteroids
      ctx.strokeStyle = "#888";
      ctx.lineWidth = 1.5;
      for (const a of asteroids.current) {
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          const r = a.size * (0.8 + ((a.id * 7 + i * 13) % 5) / 15);
          const px = a.x + Math.cos(ang) * r;
          const py = a.y + Math.sin(ang) * r;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }

      // Draw bullets
      for (const b of bullets.current) {
        ctx.fillStyle = b.owner === "host" ? "#0f0" : "#f80";
        ctx.beginPath();
        ctx.arc(b.x, b.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw ships
      const drawShip = (s: Ship, color: string) => {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.angle);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(SHIP_SIZE, 0);
        ctx.lineTo(-SHIP_SIZE * 0.7, -SHIP_SIZE * 0.6);
        ctx.lineTo(-SHIP_SIZE * 0.4, 0);
        ctx.lineTo(-SHIP_SIZE * 0.7, SHIP_SIZE * 0.6);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      };

      drawShip(hostShip.current, "#0f0");
      drawShip(guestShip.current, "#f80");

      // HUD
      ctx.fillStyle = "#0f0";
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`${game.host}: ${scores.current.host}`, 10, 20);
      ctx.fillStyle = "#f80";
      ctx.textAlign = "right";
      ctx.fillText(`${game.guest}: ${scores.current.guest}`, W - 10, 20);

      ctx.fillStyle = "#555";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText("Meta: 200 pts | Setas/WASD = mover | Espaço = atirar", W / 2, H - 8);

      animRef.current = requestAnimationFrame(loop);
    };

    const drawGameOver = (ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 28px monospace";
      ctx.textAlign = "center";
      ctx.fillText("🏆 FIM DE JOGO!", W / 2, H / 2 - 40);
      ctx.font = "20px monospace";
      ctx.fillStyle = winner.current === game.host ? "#0f0" : "#f80";
      ctx.fillText(`${winner.current} venceu!`, W / 2, H / 2);
      ctx.fillStyle = "#888";
      ctx.font = "14px monospace";
      ctx.fillText(`${game.host}: ${scores.current.host}  |  ${game.guest}: ${scores.current.guest}`, W / 2, H / 2 + 35);
    };

    // Seed initial asteroids
    if (isHost) {
      for (let i = 0; i < 4; i++) asteroids.current.push(spawnAsteroid());
    }

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [isHost, channel, nickname, game, myShip, opShip, role]);

  // Touch zones: left 1/3 = turn left, right 1/3 = turn right, top half = thrust, bottom half = shoot
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    updateTouches(e.touches);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    updateTouches(e.touches);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    updateTouches(e.touches);
  };

  const updateTouches = (touches: React.TouchList) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const t = touchRef.current;
    t.left = false; t.right = false; t.thrust = false; t.shoot = false;
    for (let i = 0; i < touches.length; i++) {
      const tx = touches[i].clientX - rect.left;
      const ty = touches[i].clientY - rect.top;
      const relX = tx / rect.width;
      const relY = ty / rect.height;
      if (relX < 0.33) t.left = true;
      else if (relX > 0.66) t.right = true;
      if (relY < 0.5) t.thrust = true;
      else t.shoot = true;
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[640px] p-2 sm:p-4 bg-black border-primary/30">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-green-400 flex items-center gap-1">
            <Rocket className="h-4 w-4" /> Asteroides
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="w-full rounded border border-primary/20"
          style={{ touchAction: "none", aspectRatio: `${W}/${H}` }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
        <div className="text-[10px] text-muted-foreground text-center mt-1 space-y-0.5">
          <p>🖥️ PC: Setas/WASD = mover | Espaço = atirar</p>
          <p>📱 Celular: Toque esquerdo/direito = girar | Topo = acelerar | Base = atirar</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
