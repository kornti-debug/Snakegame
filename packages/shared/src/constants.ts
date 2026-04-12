export const TICK_RATE = 30;
export const TICK_INTERVAL = 1000 / TICK_RATE;

export const ARENA_WIDTH = 1920;
export const ARENA_HEIGHT = 1080;

export const SNAKE_SPEED = 200;         // pixels per second
export const SNAKE_TURN_RATE = 3.5;     // radians per second
export const SNAKE_RADIUS = 8;          // collision/render radius
export const SNAKE_SEGMENT_SPACING = 12; // distance between segments
export const SNAKE_INITIAL_LENGTH = 20;  // number of segments at spawn

// Reveal system
export const REVEAL_BLOCK_SIZE = 4;   // pixels per block
export const REVEAL_GRID_WIDTH = Math.ceil(ARENA_WIDTH / REVEAL_BLOCK_SIZE);
export const REVEAL_GRID_HEIGHT = Math.ceil(ARENA_HEIGHT / REVEAL_BLOCK_SIZE);
export const REVEAL_BRUSH_RADIUS = 20; // pixels - how wide the snake reveals

// Round system
export const ROUND_DURATION = 90_000;       // ms - how long a round lasts
export const ROUND_WAIT_TIME = 5_000;       // ms - countdown before round starts
export const ROUND_END_DISPLAY_TIME = 4_000; // ms - show scoreboard after round

// Power-ups
export const POWERUP_SPAWN_INTERVAL = 8_000; // ms between spawns
export const POWERUP_MAX_ACTIVE = 3;          // max on field at once
export const POWERUP_COLLECT_RADIUS = 25;     // pixels
export const SPEED_BOOST_MULTIPLIER = 1.5;
export const SPEED_BOOST_DURATION = 5_000;
export const WIDE_TRAIL_MULTIPLIER = 2.5;
export const WIDE_TRAIL_DURATION = 5_000;
export const GHOST_DURATION = 3_000;

export const PLAYER_COLORS = [
  '#FF4444', // red
  '#44AAFF', // blue
  '#44FF44', // green
  '#FFAA44', // orange
  '#FF44FF', // magenta
  '#44FFFF', // cyan
  '#FFFF44', // yellow
  '#AA44FF', // purple
  '#FF8888', // pink
  '#88FF88', // mint
];

/** Upper bound on concurrent players in the lobby (keyboard + phone). */
export const MAX_PLAYERS = 10;

// Memory card game — legacy constants (kept for any code still importing directly).
// Prefer BoardConfig / BOARD_PRESETS below.
export const MEMORY_TILE_COLS = 2;          // grid cells per tile horizontally
export const MEMORY_TILE_ROWS = 2;          // grid cells per tile vertically
export const MEMORY_TILE_WIDTH = 240;
export const MEMORY_TILE_HEIGHT = 240;
export const MEMORY_TILE_GAP = 8;
export const MEMORY_BOARD_COLS = 5;
export const MEMORY_BOARD_ROWS = 4;
export const MEMORY_PAIR_COUNT = 10;
export const MEMORY_TILE_COUNT = 20;
export const MEMORY_CAPTURE_THRESHOLD = 0.9;

// Runtime-configurable board presets. Host picks one in the lobby.
export const BOARD_PRESETS = {
  small:  { cols: 4, rows: 3, pairCount: 6,  tileWidth: 240, tileHeight: 240, gap: 8, captureThreshold: 0.9 },
  medium: { cols: 5, rows: 4, pairCount: 10, tileWidth: 240, tileHeight: 240, gap: 8, captureThreshold: 0.9 },
  large:  { cols: 6, rows: 5, pairCount: 15, tileWidth: 200, tileHeight: 200, gap: 8, captureThreshold: 0.9 },
  huge:   { cols: 7, rows: 6, pairCount: 20, tileWidth: 160, tileHeight: 160, gap: 8, captureThreshold: 0.9 },
} as const;
export const DEFAULT_BOARD_PRESET = 'medium';
export const DEFAULT_BOARD_CONFIG = BOARD_PRESETS.medium;
export const HINT_DURATION = 8_000;         // ms hint highlight lasts
export const ROUND_DURATION_MEMORY = 120_000; // ms — longer rounds for memory

// Boid / AI swarm system
export const BOID_COUNT_INITIAL = 12;         // starting boids
export const BOID_SPAWN_INTERVAL = 15_000;    // ms between spawning new groups
export const BOID_SPAWN_GROUP_SIZE = 3;       // boids per spawn group
export const BOID_MAX_COUNT = 30;             // cap
export const BOID_SPEED = 120;                // pixels/sec (slower than snakes)
export const BOID_TURN_RATE = 4.0;            // radians/sec
export const BOID_RADIUS = 5;                 // collision radius
export const BOID_SEPARATION_RADIUS = 30;     // pixels
export const BOID_ALIGNMENT_RADIUS = 60;      // pixels
export const BOID_COHESION_RADIUS = 80;       // pixels
export const BOID_SEPARATION_WEIGHT = 1.8;
export const BOID_ALIGNMENT_WEIGHT = 1.0;
export const BOID_COHESION_WEIGHT = 1.0;
export const BOID_FEAR_RADIUS = 150;          // flee from snake heads
export const BOID_FEAR_WEIGHT = 2.5;
export const BOID_FOLLOW_RADIUS = 200;        // follow swarm leader
export const BOID_FOLLOW_WEIGHT = 2.0;
export const BOID_WALL_MARGIN = 40;           // turn away from walls
export const BOID_REVEAL_RADIUS = 8;          // small reveal brush (half of snake)

// Star powerup
export const STAR_DURATION = 5_000;           // ms invincibility
// Swarm leader / predator powerups
export const SWARM_LEADER_DURATION = 8_000;
export const PREDATOR_DURATION = 6_000;
export const PREDATOR_FEAR_RADIUS = 250;      // larger flee zone

// Twitch viewer credit economy
export const VIEWER_INITIAL_CREDITS = 100;
export const COST_POWERUP = 30;
export const COST_OBSTACLE = 20;
export const COST_HINT = 40;
export const REWARD_CORRECT_GUESS = 50;
