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

export type AsteroidsRole = "host" | "guest";

export interface ShipState {
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
}

export interface BulletState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  owner: AsteroidsRole;
}

export interface AsteroidState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
}

export interface AsteroidsReadyMessage extends AsteroidsGameState {
  from: string;
  role: AsteroidsRole;
}

export interface AsteroidsSyncMessage {
  gameId: string;
  from: string;
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
}

export interface AsteroidsBulletMessage {
  gameId: string;
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: AsteroidsRole;
}

export interface AsteroidsStateMessage extends AsteroidsGameState {
  asteroids: AsteroidState[];
  bullets: BulletState[];
  scores: {
    host: number;
    guest: number;
  };
  hostShip: ShipState;
  guestShip: ShipState;
  ready: {
    host: boolean;
    guest: boolean;
  };
  gameOver: boolean;
  winner: string;
}
