import type { Vector2D } from './types/game.js';
import {
  ARENA_WIDTH, ARENA_HEIGHT,
  MEMORY_BOARD_COLS, MEMORY_BOARD_ROWS,
  MEMORY_TILE_WIDTH, MEMORY_TILE_HEIGHT,
  MEMORY_TILE_GAP,
} from './constants.js';

// Grid: 16 columns (A-P) × 9 rows (1-9) = 144 cells
export const GRID_COLS = 16;
export const GRID_ROWS = 9;
export const GRID_CELL_WIDTH = ARENA_WIDTH / GRID_COLS;   // 120px
export const GRID_CELL_HEIGHT = ARENA_HEIGHT / GRID_ROWS;  // 120px

const COL_LETTERS = 'ABCDEFGHIJKLMNOP';

/** Convert grid cell name (e.g. "D5") to pixel center coordinates */
export function cellToPixel(cell: string): Vector2D | null {
  if (cell.length < 2 || cell.length > 3) return null;

  const col = COL_LETTERS.indexOf(cell[0].toUpperCase());
  const row = parseInt(cell.slice(1), 10) - 1;

  if (col < 0 || col >= GRID_COLS || isNaN(row) || row < 0 || row >= GRID_ROWS) return null;

  return {
    x: col * GRID_CELL_WIDTH + GRID_CELL_WIDTH / 2,
    y: row * GRID_CELL_HEIGHT + GRID_CELL_HEIGHT / 2,
  };
}

/** Convert pixel coordinates to grid cell name */
export function pixelToCell(x: number, y: number): string {
  const col = Math.floor(x / GRID_CELL_WIDTH);
  const row = Math.floor(y / GRID_CELL_HEIGHT);
  const clampedCol = Math.max(0, Math.min(GRID_COLS - 1, col));
  const clampedRow = Math.max(0, Math.min(GRID_ROWS - 1, row));
  return `${COL_LETTERS[clampedCol]}${clampedRow + 1}`;
}

/** Check if a cell name is valid */
export function isValidCell(cell: string): boolean {
  return cellToPixel(cell) !== null;
}

// --- Memory tile layout ---

/** Get the pixel top-left position for a tile slot (col 0..4, row 0..3) */
export function tileSlotToPixel(col: number, row: number): Vector2D {
  // Center the tile grid (with gaps) within the arena
  const stepX = MEMORY_TILE_WIDTH + MEMORY_TILE_GAP;
  const stepY = MEMORY_TILE_HEIGHT + MEMORY_TILE_GAP;
  const totalWidth = MEMORY_BOARD_COLS * stepX - MEMORY_TILE_GAP;
  const totalHeight = MEMORY_BOARD_ROWS * stepY - MEMORY_TILE_GAP;
  const offsetX = (ARENA_WIDTH - totalWidth) / 2;
  const offsetY = (ARENA_HEIGHT - totalHeight) / 2;
  return {
    x: offsetX + col * stepX,
    y: offsetY + row * stepY,
  };
}

/** Generate all 20 tile slot positions (5x4 grid, centered in arena) */
export function generateTileSlots(): Vector2D[] {
  const slots: Vector2D[] = [];
  for (let row = 0; row < MEMORY_BOARD_ROWS; row++) {
    for (let col = 0; col < MEMORY_BOARD_COLS; col++) {
      slots.push(tileSlotToPixel(col, row));
    }
  }
  return slots;
}
