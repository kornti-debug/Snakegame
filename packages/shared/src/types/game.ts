export interface Vector2D {
  x: number;
  y: number;
}

export interface SnakeState {
  id: string;
  segments: Vector2D[];
  angle: number;
  speed: number;
  turnRate: number;
  radius: number;
  alive: boolean;
  color: string;
  name: string;
  score: number;
}

export interface GameSnapshot {
  tick: number;
  timestamp: number;
  snakes: SnakeState[];
  arena: ArenaConfig;
}

export interface ArenaConfig {
  width: number;
  height: number;
}
