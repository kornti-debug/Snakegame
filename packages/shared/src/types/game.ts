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
  pairScore: number;
  ghosting: boolean;
  starred: boolean;           // star powerup — invincible + kills on touch
  swarmLeader: boolean;       // boids follow this snake
  predator: boolean;          // boids flee with larger radius
  frozen: boolean;            // time-freeze victim
  shrunken: boolean;          // lightning victim (reduced radius)
  crippled: boolean;          // cripple victim (slow + bad steering)
  team: number | null;        // team index (see TEAM_COLORS); null = solo
  playerIndex: number;        // global lobby slot (0..MAX_PLAYERS-1)
  itemSlot: string | null;    // queued active powerup id (slot), ready to activate
  activeEffect: string | null;// id of the currently-running active effect (null if none)
  passiveStacks: Record<string, number>; // passive powerup id → stack count (this round)
  // Active effect drain: 1.0 = just started, 0.0 = expired. Null = no effect.
  effectDrain: Record<string, number>;  // effectId → remaining fraction (0..1)
  // True while the owning socket is in the disconnect grace window. The
  // snake keeps its place on the field but accepts no input; removed at
  // grace-expiry if the phone never reclaims.
  isDisconnected: boolean;
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
  pairScores: Record<string, number>;
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
  kind: 'keyboard' | 'phone';
  team: number | null; // 0..NUM_TEAMS-1 or null = solo / unassigned
  // Stable per-device ID for reclaiming the slot after a socket drop.
  // Set for phone joins (from localStorage); absent for local/keyboard.
  clientId?: string;
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
  boids: BoidState[];
  lobbyPlayers: LobbyPlayer[];
  memoryBoard: MemoryBoardState;
  hints: HintState[];
  boardPreset: BoardPreset;
  paused: boolean;
}

export interface BoidState {
  id: number;
  x: number;
  y: number;
  angle: number;              // heading in radians
  speed: number;
  leaderId: string | null;    // snakeId of swarm leader (null = wild)
}

export interface ArenaConfig {
  width: number;
  height: number;
}

// --- Memory Card Game Types ---

export interface MemoryTile {
  tileId: number;           // 0..19
  pairId: number;           // 0..9 (two tiles share a pairId)
  symbolName: string;       // e.g. "star", "heart" — for guessing/hints
  imageUrl: string;         // tile image URL or data URI
  x: number;                // pixel position (top-left)
  y: number;
  width: number;            // 240
  height: number;           // 240
  revealPercent: number;    // 0..100
  capturedBy: string | null;   // snakeId who revealed the most (>= 90%)
  capturedColor: string | null;
  revealBySnake: Record<string, number>; // snakeId → block count within this tile
}

export interface MemoryPair {
  pairId: number;
  symbolName: string;
  tileIds: [number, number];
  matched: boolean;            // true when both tiles captured by same snake
  matchedBy: string | null;    // snakeId that matched the pair
  isBonus: boolean;            // one pair per round grants an OP powerup when matched
}

export interface MemoryBoardState {
  tiles: MemoryTile[];
  pairs: MemoryPair[];
  pairScores: Record<string, number>; // snakeId → completed pairs count
}

export interface TwitchViewer {
  viewerName: string;
  teamSnakeId: string;
  teamColor: string;
  credits: number;
}

export type BoardPreset = 'small' | 'medium' | 'large' | 'huge';

export interface BoardConfig {
  cols: number;
  rows: number;
  pairCount: number;
  tileWidth: number;
  tileHeight: number;
  gap: number;
  captureThreshold: number;
}

export interface HintState {
  pairId: number;
  symbolName: string;
  tileIds: [number, number];
  expiresAtMs: number;         // server timestamp when hint expires
}
