import type { Vector2D, BoardConfig } from './types/game.js';
import {
  ARENA_WIDTH, ARENA_HEIGHT,
  DEFAULT_BOARD_CONFIG,
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

/** Get the pixel top-left position for a tile slot given a board config */
export function tileSlotToPixel(col: number, row: number, cfg: BoardConfig = DEFAULT_BOARD_CONFIG): Vector2D {
  const stepX = cfg.tileWidth + cfg.gap;
  const stepY = cfg.tileHeight + cfg.gap;
  const totalWidth = cfg.cols * stepX - cfg.gap;
  const totalHeight = cfg.rows * stepY - cfg.gap;
  const offsetX = (ARENA_WIDTH - totalWidth) / 2;
  const offsetY = (ARENA_HEIGHT - totalHeight) / 2;
  return {
    x: offsetX + col * stepX,
    y: offsetY + row * stepY,
  };
}

/** Generate all tile slot positions for the given config (row-major). */
export function generateTileSlots(cfg: BoardConfig = DEFAULT_BOARD_CONFIG): Vector2D[] {
  const slots: Vector2D[] = [];
  for (let row = 0; row < cfg.rows; row++) {
    for (let col = 0; col < cfg.cols; col++) {
      slots.push(tileSlotToPixel(col, row, cfg));
    }
  }
  return slots;
}
