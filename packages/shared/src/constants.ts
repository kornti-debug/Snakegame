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
