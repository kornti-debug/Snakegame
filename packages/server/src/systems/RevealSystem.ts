import type { Snake } from '../entities/Snake.js';
import type { RevealDelta } from '@snakegame/shared';
import {
  REVEAL_BLOCK_SIZE,
  REVEAL_GRID_WIDTH,
  REVEAL_GRID_HEIGHT,
  REVEAL_BRUSH_RADIUS,
} from '@snakegame/shared';

export class RevealSystem {
  private grid: Uint8Array;
  private totalBlocks: number;
  private revealedCount = 0;
  private pendingDelta: number[] = [];

  constructor() {
    this.totalBlocks = REVEAL_GRID_WIDTH * REVEAL_GRID_HEIGHT;
    this.grid = new Uint8Array(this.totalBlocks);
  }

  reset(): void {
    this.grid.fill(0);
    this.revealedCount = 0;
    this.pendingDelta = [];
  }

  update(snakes: Snake[]): void {
    const brushBlocks = Math.ceil(REVEAL_BRUSH_RADIUS / REVEAL_BLOCK_SIZE);

    for (const snake of snakes) {
      if (!snake.alive) continue;

      const head = snake.segments[0];
      const centerBX = Math.floor(head.x / REVEAL_BLOCK_SIZE);
      const centerBY = Math.floor(head.y / REVEAL_BLOCK_SIZE);

      for (let dy = -brushBlocks; dy <= brushBlocks; dy++) {
        for (let dx = -brushBlocks; dx <= brushBlocks; dx++) {
          // Circle check
          if (dx * dx + dy * dy > brushBlocks * brushBlocks) continue;

          const bx = centerBX + dx;
          const by = centerBY + dy;

          if (bx < 0 || bx >= REVEAL_GRID_WIDTH || by < 0 || by >= REVEAL_GRID_HEIGHT) continue;

          const idx = by * REVEAL_GRID_WIDTH + bx;
          if (this.grid[idx] === 0) {
            this.grid[idx] = 1;
            this.revealedCount++;
            this.pendingDelta.push(bx, by);
          }
        }
      }
    }
  }

  flushDelta(): RevealDelta | null {
    if (this.pendingDelta.length === 0) return null;
    const delta: RevealDelta = { blocks: this.pendingDelta };
    this.pendingDelta = [];
    return delta;
  }

  getRevealPercentage(): number {
    return (this.revealedCount / this.totalBlocks) * 100;
  }
}
