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

export interface RevealDelta {
  /** Flat array of [blockX, blockY] pairs */
  blocks: number[];
}

export interface GameSnapshot {
  tick: number;
  timestamp: number;
  snakes: SnakeState[];
  arena: ArenaConfig;
  revealPercentage: number;
}

export interface ArenaConfig {
  width: number;
  height: number;
}
