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
  revealScore: number;
  ghosting: boolean;
}

export interface RevealDelta {
  /** Flat array of [blockX, blockY] pairs */
  blocks: number[];
}

export type GamePhase = 'lobby' | 'ingame';
export type RoundPhase = 'waiting' | 'playing' | 'ended';

export interface RoundState {
  phase: RoundPhase;
  roundNumber: number;
  timeRemainingMs: number;
  revealScores: Record<string, number>;
}

export interface PowerUpState {
  id: string;
  type: string;
  position: Vector2D;
  renderHint: { color: string; shape: string };
}

export interface ObstacleState {
  id: string;
  position: Vector2D;
  width: number;
  height: number;
}

export interface LobbyPlayer {
  index: number;
  name: string;
  color: string;
  ready: boolean;
}

export interface GameSnapshot {
  tick: number;
  timestamp: number;
  gamePhase: GamePhase;
  snakes: SnakeState[];
  arena: ArenaConfig;
  revealPercentage: number;
  round: RoundState;
  powerUps: PowerUpState[];
  obstacles: ObstacleState[];
  lobbyPlayers: LobbyPlayer[];
}

export interface ArenaConfig {
  width: number;
  height: number;
}
