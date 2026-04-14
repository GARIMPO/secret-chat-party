import { useCallback, useEffect, useMemo, useRef } from "react";
import type { TouchEvent as ReactTouchEvent } from "react";
import type Ably from "ably";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Rocket } from "lucide-react";
import type {
  AsteroidState,
  AsteroidsBulletMessage,
  AsteroidsGameState,
  AsteroidsReadyMessage,
  AsteroidsRole,
  AsteroidsStateMessage,
  AsteroidsSyncMessage,
  BulletState,
  ShipState,
} from "./types";

interface GameCanvasProps {
  game: AsteroidsGameState;
  nickname: string;
  channel: Ably.RealtimeChannel | null;
  onClose: () => void;
}

const W = 600;
const H = 450;
const SHIP_SIZE = 12;
const BULLET_SPEED = 5.4;
const BULLET_LIFE = 70;
const SHOOT_COOLDOWN = 9;
const TURN_SPEED = 0.075;
const THRUST = 0.12;
const FRICTION = 0.992;
const MAX_ASTEROIDS = 8;
const START_ASTEROIDS = 5;
const SPAWN_INTERVAL = 110;
const WIN_SCORE = 200;
const MIN_SPLIT_SIZE = 24;
const STAR_FIELD = Array.from({ length: 60 }, (_, index) => ({
  x: (index * 137.5) % W,
  y: (index * 97.3) % H,
  size: index % 6 === 0 ? 2 : 1,
}));

const initialHostShip = (): ShipState => ({ x: W * 0.25, y: H / 2, angle: 0, vx: 0, vy: 0 });
const initialGuestShip = (): ShipState => ({ x: W * 0.75, y: H / 2, angle: Math.PI, vx: 0, vy: 0 });
const cloneShip = (ship: ShipState): ShipState => ({ ...ship });
const cloneBullet = (bullet: BulletState): BulletState => ({ ...bullet });
const cloneAsteroid = (asteroid: AsteroidState): AsteroidState => ({ ...asteroid });
const wrap = (value: number, max: number) => ((value % max) + max) % max;
const distanceSquared = (x1: number, y1: number, x2: number, y2: number) => {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy;
};

function getCanvasPalette() {
  if (typeof window === "undefined") {
    return {
      background: "hsl(222.2 84% 4.9%)",
      foreground: "hsl(210 40% 98%)",
      primary: "hsl(142.1 76.2% 36.3%)",
      accent: "hsl(24 94% 53%)",
      muted: "hsl(215.4 16.3% 46.9%)",
      border: "hsl(214.3 31.8% 91.4%)",
      panel: "hsl(217.2 32.6% 17.5%)",
    };
  }

  const styles = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;

  return {
    background: `hsl(${token("--background", "222.2 84% 4.9%")})`,
    foreground: `hsl(${token("--foreground", "210 40% 98%")})`,
    primary: `hsl(${token("--primary", "142.1 76.2% 36.3%")})`,
    accent: `hsl(${token("--accent", "24 94% 53%")})`,
    muted: `hsl(${token("--muted-foreground", "215.4 16.3% 46.9%")})`,
    border: `hsl(${token("--border", "214.3 31.8% 91.4%")})`,
    panel: `hsl(${token("--muted", "217.2 32.6% 17.5%")})`,
  };
}

export function AsteroidsGameCanvas({ game, nickname, channel, onClose }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isHost = game.host === nickname;
  const role: AsteroidsRole = isHost ? "host" : "guest";
  const palette = useMemo(() => getCanvasPalette(), []);

  const hostShip = useRef<ShipState>(initialHostShip());
  const guestShip = useRef<ShipState>(initialGuestShip());
  const bullets = useRef<BulletState[]>([]);
  const asteroids = useRef<AsteroidState[]>([]);
  const scores = useRef({ host: 0, guest: 0 });
  const readyRef = useRef({ host: false, guest: false });
  const keysRef = useRef<Set<string>>(new Set());
  const touchRef = useRef({ left: false, right: false, thrust: false, shoot: false });
  const frameCountRef = useRef(0);
  const nextAsteroidId = useRef(0);
  const nextBulletId = useRef(0);
  const lastShotFrameRef = useRef(-SHOOT_COOLDOWN);
  const startedRef = useRef(false);
  const hasRemoteSnapshotRef = useRef(isHost);
  const gameOverRef = useRef(false);
  const winnerRef = useRef("");
  const animationFrameRef = useRef<number>(0);

  const publish = useCallback(
    (name: string, data: unknown) => {
      if (!channel || channel.state === "detached" || channel.state === "failed") {
        return;
      }

      const maybePromise = channel.publish(name, data);
      if (maybePromise && typeof (maybePromise as Promise<unknown>).catch === "function") {
        void (maybePromise as Promise<unknown>).catch(() => {});
      }
    },
    [channel],
  );

  const spawnEdgeAsteroid = useCallback((): AsteroidState => {
    const edge = Math.floor(Math.random() * 4);
    let x = 0;
    let y = 0;

    if (edge === 0) {
      x = Math.random() * W;
      y = -30;
    } else if (edge === 1) {
      x = W + 30;
      y = Math.random() * H;
    } else if (edge === 2) {
      x = Math.random() * W;
      y = H + 30;
    } else {
      x = -30;
      y = Math.random() * H;
    }

    const targetX = W / 2 + (Math.random() - 0.5) * 200;
    const targetY = H / 2 + (Math.random() - 0.5) * 200;
    const speed = 0.5 + Math.random() * 1.2;
    const angle = Math.atan2(targetY - y, targetX - x);

    return {
      id: nextAsteroidId.current++,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 20 + Math.random() * 24,
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.08,
    };
  }, []);

  const splitAsteroid = useCallback((asteroid: AsteroidState): AsteroidState[] => {
    if (asteroid.size <= MIN_SPLIT_SIZE) {
      return [];
    }

    const baseAngle = Math.atan2(asteroid.vy, asteroid.vx);
    return [-0.65, 0.65].map((offset) => {
      const speed = Math.hypot(asteroid.vx, asteroid.vy) + 0.4;
      return {
        id: nextAsteroidId.current++,
        x: asteroid.x,
        y: asteroid.y,
        vx: Math.cos(baseAngle + offset) * speed,
        vy: Math.sin(baseAngle + offset) * speed,
        size: asteroid.size * 0.58,
        rotation: asteroid.rotation,
        spin: (Math.random() - 0.5) * 0.1,
      };
    });
  }, []);

  const broadcastState = useCallback(() => {
    publish("ast-state", {
      gameId: game.gameId,
      host: game.host,
      guest: game.guest,
      asteroids: asteroids.current.map(cloneAsteroid),
      bullets: bullets.current.map(cloneBullet),
      scores: { ...scores.current },
      hostShip: cloneShip(hostShip.current),
      guestShip: cloneShip(guestShip.current),
      ready: { ...readyRef.current },
      gameOver: gameOverRef.current,
      winner: winnerRef.current,
    } satisfies AsteroidsStateMessage);
  }, [game.gameId, game.guest, game.host, publish]);

  const ensureStarted = useCallback(() => {
    if (!readyRef.current.host || !readyRef.current.guest) {
      return;
    }

    if (!startedRef.current) {
      startedRef.current = true;
    }

    if (isHost && asteroids.current.length === 0) {
      asteroids.current = Array.from({ length: START_ASTEROIDS }, () => spawnEdgeAsteroid());
    }

    if (isHost) {
      broadcastState();
    }
  }, [broadcastState, isHost, spawnEdgeAsteroid]);

  useEffect(() => {
    hostShip.current = initialHostShip();
    guestShip.current = initialGuestShip();
    bullets.current = [];
    asteroids.current = [];
    scores.current = { host: 0, guest: 0 };
    readyRef.current = { host: false, guest: false };
    keysRef.current.clear();
    touchRef.current = { left: false, right: false, thrust: false, shoot: false };
    frameCountRef.current = 0;
    nextAsteroidId.current = 0;
    nextBulletId.current = 0;
    lastShotFrameRef.current = -SHOOT_COOLDOWN;
    startedRef.current = false;
    hasRemoteSnapshotRef.current = isHost;
    gameOverRef.current = false;
    winnerRef.current = "";
  }, [game.gameId, isHost]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", " ", "Spacebar"].includes(event.key)) {
        event.preventDefault();
      }
      keysRef.current.add(event.key);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      keysRef.current.delete(event.key);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (!channel) {
      return;
    }

    const handleReady = (message: Ably.Message) => {
      const data = message.data as AsteroidsReadyMessage;
      if (data.gameId !== game.gameId) {
        return;
      }

      readyRef.current = {
        ...readyRef.current,
        [data.role]: true,
      };

      ensureStarted();
    };

    const handleSync = (message: Ably.Message) => {
      const data = message.data as AsteroidsSyncMessage;
      if (data.gameId !== game.gameId || data.from === nickname) {
        return;
      }

      const targetShip = isHost ? guestShip.current : hostShip.current;
      targetShip.x = data.x;
      targetShip.y = data.y;
      targetShip.angle = data.angle;
      targetShip.vx = data.vx;
      targetShip.vy = data.vy;
    };

    const handleBullet = (message: Ably.Message) => {
      const data = message.data as AsteroidsBulletMessage;
      if (data.gameId !== game.gameId || data.owner === role) {
        return;
      }

      bullets.current.push({
        id: data.id,
        x: data.x,
        y: data.y,
        vx: data.vx,
        vy: data.vy,
        life: BULLET_LIFE,
        owner: data.owner,
      });
    };

    const handleState = (message: Ably.Message) => {
      const data = message.data as AsteroidsStateMessage;
      if (data.gameId !== game.gameId || isHost) {
        return;
      }

      asteroids.current = data.asteroids.map(cloneAsteroid);
      bullets.current = data.bullets.map(cloneBullet);
      scores.current = { ...data.scores };
      hostShip.current = cloneShip(data.hostShip);
      guestShip.current = cloneShip(data.guestShip);
      readyRef.current = { ...data.ready };
      startedRef.current = data.ready.host && data.ready.guest;
      hasRemoteSnapshotRef.current = true;
      gameOverRef.current = data.gameOver;
      winnerRef.current = data.winner;
    };

    channel.subscribe("ast-ready", handleReady);
    channel.subscribe("ast-sync", handleSync);
    channel.subscribe("ast-bullet", handleBullet);
    channel.subscribe("ast-state", handleState);

    readyRef.current = {
      ...readyRef.current,
      [role]: true,
    };

    publish("ast-ready", {
      gameId: game.gameId,
      host: game.host,
      guest: game.guest,
      from: nickname,
      role,
    } satisfies AsteroidsReadyMessage);

    ensureStarted();

    return () => {
      channel.unsubscribe("ast-ready", handleReady);
      channel.unsubscribe("ast-sync", handleSync);
      channel.unsubscribe("ast-bullet", handleBullet);
      channel.unsubscribe("ast-state", handleState);
    };
  }, [channel, ensureStarted, game.gameId, game.guest, game.host, isHost, nickname, publish, role]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const drawScene = (gameReady: boolean, waitingForSnapshot: boolean) => {
      context.fillStyle = palette.background;
      context.fillRect(0, 0, W, H);

      context.fillStyle = palette.panel;
      for (const star of STAR_FIELD) {
        context.fillRect(star.x, star.y, star.size, star.size);
      }

      context.lineWidth = 2;
      context.strokeStyle = palette.muted;
      for (const asteroid of asteroids.current) {
        context.save();
        context.translate(asteroid.x, asteroid.y);
        context.rotate(asteroid.rotation);
        context.beginPath();
        for (let index = 0; index < 8; index += 1) {
          const angle = (index / 8) * Math.PI * 2;
          const radius = asteroid.size * (0.82 + ((asteroid.id + index * 11) % 5) / 14);
          const px = Math.cos(angle) * radius;
          const py = Math.sin(angle) * radius;
          if (index === 0) {
            context.moveTo(px, py);
          } else {
            context.lineTo(px, py);
          }
        }
        context.closePath();
        context.stroke();
        context.restore();
      }

      for (const bullet of bullets.current) {
        context.fillStyle = bullet.owner === "host" ? palette.primary : palette.accent;
        context.beginPath();
        context.arc(bullet.x, bullet.y, 2.2, 0, Math.PI * 2);
        context.fill();
      }

      const drawShip = (ship: ShipState, color: string) => {
        context.save();
        context.translate(ship.x, ship.y);
        context.rotate(ship.angle);
        context.strokeStyle = color;
        context.beginPath();
        context.moveTo(SHIP_SIZE, 0);
        context.lineTo(-SHIP_SIZE * 0.75, -SHIP_SIZE * 0.62);
        context.lineTo(-SHIP_SIZE * 0.45, 0);
        context.lineTo(-SHIP_SIZE * 0.75, SHIP_SIZE * 0.62);
        context.closePath();
        context.stroke();
        context.restore();
      };

      drawShip(hostShip.current, palette.primary);
      drawShip(guestShip.current, palette.accent);

      context.font = "600 13px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
      context.textAlign = "left";
      context.fillStyle = palette.primary;
      context.fillText(`${game.host}: ${scores.current.host}`, 12, 22);

      context.textAlign = "right";
      context.fillStyle = palette.accent;
      context.fillText(`${game.guest}: ${scores.current.guest}`, W - 12, 22);

      context.textAlign = "center";
      context.fillStyle = palette.muted;
      context.font = "11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
      context.fillText("Meta: 200 pontos", W / 2, H - 12);

      const waitingMessage = !gameReady
        ? "Aguardando os dois jogadores abrirem o jogo..."
        : waitingForSnapshot
          ? "Sincronizando asteroides..."
          : "";

      if (waitingMessage) {
        context.fillStyle = palette.background.replace(")",
          " / 0.78)",
        );
        context.fillRect(0, 0, W, H);
        context.fillStyle = palette.foreground;
        context.font = "600 20px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
        context.fillText("Preparando partida", W / 2, H / 2 - 10);
        context.font = "12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
        context.fillStyle = palette.muted;
        context.fillText(waitingMessage, W / 2, H / 2 + 18);
      }

      if (gameOverRef.current) {
        context.fillStyle = palette.background.replace(")", " / 0.84)");
        context.fillRect(0, 0, W, H);
        context.fillStyle = palette.foreground;
        context.font = "700 28px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
        context.fillText("FIM DE JOGO", W / 2, H / 2 - 32);
        context.font = "600 18px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
        context.fillStyle = winnerRef.current === game.host ? palette.primary : palette.accent;
        context.fillText(`${winnerRef.current} venceu`, W / 2, H / 2 + 4);
        context.font = "12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
        context.fillStyle = palette.muted;
        context.fillText(`${game.host}: ${scores.current.host}  |  ${game.guest}: ${scores.current.guest}`, W / 2, H / 2 + 32);
      }
    };

    const loop = () => {
      frameCountRef.current += 1;
      const localShip = isHost ? hostShip.current : guestShip.current;
      const controls = keysRef.current;
      const touch = touchRef.current;
      const gameReady = readyRef.current.host && readyRef.current.guest;
      const waitingForSnapshot = !isHost && gameReady && !hasRemoteSnapshotRef.current;

      if (!gameOverRef.current) {
        if (controls.has("ArrowLeft") || controls.has("a") || controls.has("A") || touch.left) {
          localShip.angle -= TURN_SPEED;
        }
        if (controls.has("ArrowRight") || controls.has("d") || controls.has("D") || touch.right) {
          localShip.angle += TURN_SPEED;
        }
        if (controls.has("ArrowUp") || controls.has("w") || controls.has("W") || touch.thrust) {
          localShip.vx += Math.cos(localShip.angle) * THRUST;
          localShip.vy += Math.sin(localShip.angle) * THRUST;
        }

        localShip.vx *= FRICTION;
        localShip.vy *= FRICTION;
        localShip.x = wrap(localShip.x + localShip.vx, W);
        localShip.y = wrap(localShip.y + localShip.vy, H);

        const wantsToShoot =
          controls.has(" ") ||
          controls.has("Space") ||
          controls.has("Spacebar") ||
          touch.shoot;

        if (
          gameReady &&
          !waitingForSnapshot &&
          wantsToShoot &&
          frameCountRef.current - lastShotFrameRef.current >= SHOOT_COOLDOWN
        ) {
          lastShotFrameRef.current = frameCountRef.current;
          const bullet: BulletState = {
            id: nextBulletId.current++,
            x: localShip.x + Math.cos(localShip.angle) * SHIP_SIZE,
            y: localShip.y + Math.sin(localShip.angle) * SHIP_SIZE,
            vx: Math.cos(localShip.angle) * BULLET_SPEED + localShip.vx * 0.35,
            vy: Math.sin(localShip.angle) * BULLET_SPEED + localShip.vy * 0.35,
            life: BULLET_LIFE,
            owner: role,
          };

          bullets.current.push(bullet);
          publish("ast-bullet", {
            gameId: game.gameId,
            id: bullet.id,
            x: bullet.x,
            y: bullet.y,
            vx: bullet.vx,
            vy: bullet.vy,
            owner: bullet.owner,
          } satisfies AsteroidsBulletMessage);
        }

        bullets.current = bullets.current.filter((bullet) => {
          bullet.x += bullet.vx;
          bullet.y += bullet.vy;
          bullet.life -= 1;
          return bullet.life > 0 && bullet.x > -20 && bullet.x < W + 20 && bullet.y > -20 && bullet.y < H + 20;
        });

        if (isHost && gameReady) {
          if (frameCountRef.current % SPAWN_INTERVAL === 0 && asteroids.current.length < MAX_ASTEROIDS) {
            asteroids.current.push(spawnEdgeAsteroid());
          }

          for (const asteroid of asteroids.current) {
            asteroid.x += asteroid.vx;
            asteroid.y += asteroid.vy;
            asteroid.rotation += asteroid.spin;
          }

          asteroids.current = asteroids.current.filter(
            (asteroid) => asteroid.x > -70 && asteroid.x < W + 70 && asteroid.y > -70 && asteroid.y < H + 70,
          );

          const hitIds = new Set<number>();
          const destroyedAsteroids: AsteroidState[] = [];
          const remainingBullets: BulletState[] = [];

          for (const bullet of bullets.current) {
            let hitAsteroid: AsteroidState | null = null;

            for (const asteroid of asteroids.current) {
              if (hitIds.has(asteroid.id)) {
                continue;
              }

              if (distanceSquared(bullet.x, bullet.y, asteroid.x, asteroid.y) <= asteroid.size * asteroid.size) {
                hitAsteroid = asteroid;
                break;
              }
            }

            if (!hitAsteroid) {
              remainingBullets.push(bullet);
              continue;
            }

            hitIds.add(hitAsteroid.id);
            destroyedAsteroids.push(hitAsteroid);
            scores.current[bullet.owner] += hitAsteroid.size > MIN_SPLIT_SIZE ? 10 : 15;
          }

          if (hitIds.size > 0) {
            asteroids.current = asteroids.current.filter((asteroid) => !hitIds.has(asteroid.id));
            for (const asteroid of destroyedAsteroids) {
              asteroids.current.push(...splitAsteroid(asteroid));
            }
          }

          bullets.current = remainingBullets;

          if (scores.current.host >= WIN_SCORE || scores.current.guest >= WIN_SCORE) {
            gameOverRef.current = true;
            winnerRef.current = scores.current.host >= WIN_SCORE ? game.host : game.guest;
            broadcastState();
          }

          if (frameCountRef.current % 2 === 0) {
            broadcastState();
          }
        }

        if (frameCountRef.current % 2 === 0) {
          publish("ast-sync", {
            gameId: game.gameId,
            from: nickname,
            x: localShip.x,
            y: localShip.y,
            angle: localShip.angle,
            vx: localShip.vx,
            vy: localShip.vy,
          } satisfies AsteroidsSyncMessage);
        }
      }

      drawScene(gameReady, waitingForSnapshot);
      animationFrameRef.current = window.requestAnimationFrame(loop);
    };

    animationFrameRef.current = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(animationFrameRef.current);
  }, [broadcastState, game.gameId, game.guest, game.host, isHost, nickname, palette, publish, role, spawnEdgeAsteroid, splitAsteroid]);

  const updateTouches = (touches: ReactTouchEvent<HTMLCanvasElement>["touches"]) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const bounds = canvas.getBoundingClientRect();
    touchRef.current = { left: false, right: false, thrust: false, shoot: false };

    for (let index = 0; index < touches.length; index += 1) {
      const touch = touches[index];
      const relativeX = (touch.clientX - bounds.left) / bounds.width;
      const relativeY = (touch.clientY - bounds.top) / bounds.height;

      if (relativeX < 0.33) {
        touchRef.current.left = true;
      } else if (relativeX > 0.66) {
        touchRef.current.right = true;
      }

      if (relativeY < 0.5) {
        touchRef.current.thrust = true;
      } else {
        touchRef.current.shoot = true;
      }
    }
  };

  const handleTouchStart = (event: ReactTouchEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    updateTouches(event.touches);
  };

  const handleTouchMove = (event: ReactTouchEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    updateTouches(event.touches);
  };

  const handleTouchEnd = (event: ReactTouchEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    updateTouches(event.touches);
  };

  return (
    <Dialog open onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-[calc(100vw-2rem)] gap-3 overflow-hidden border-border bg-background p-3 sm:max-w-[720px] sm:p-4">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Rocket className="h-4 w-4 text-primary" /> Asteroides
          </h3>
          <p className="text-[11px] text-muted-foreground">
            A partida começa quando os dois jogadores abrirem o popup.
          </p>
        </div>

        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          tabIndex={0}
          aria-label="Campo de batalha do jogo Asteroides"
          className="w-full rounded-lg border border-border bg-background outline-none"
          style={{ aspectRatio: `${W}/${H}`, touchAction: "none" }}
          onPointerDown={() => canvasRef.current?.focus()}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        />

        <div className="space-y-1 text-center text-[11px] text-muted-foreground">
          <p>PC: A / D ou setas esquerda/direita para girar, W ou seta para cima para acelerar, espaço para atirar.</p>
          <p>Celular: toque no lado esquerdo/direito para girar, metade superior para acelerar e metade inferior para atirar.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
