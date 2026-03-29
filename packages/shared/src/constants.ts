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

// Snake growth
export const GROWTH_BLOCKS_PER_SEGMENT = 40; // reveal this many blocks to grow 1 segment

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
];
