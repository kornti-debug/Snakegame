import type { Snake } from '../entities/Snake.js';
import type { RevealDelta } from '@snakegame/shared';
import {
  REVEAL_BLOCK_SIZE,
  REVEAL_GRID_WIDTH,
  REVEAL_GRID_HEIGHT,
  GROWTH_BLOCKS_PER_SEGMENT,
} from '@snakegame/shared';

export class RevealSystem {
  // Grid values: 0 = unrevealed, N = snakeIndex+1 (who revealed it)
  private grid: Uint8Array;
  private totalBlocks: number;
  private revealedCount = 0;
  private revealCounts = new Map<string, number>(); // snakeId → count
  private growthAccumulator = new Map<string, number>(); // tracks blocks since last growth
  private pendingDelta: number[] = [];

  constructor() {
    this.totalBlocks = REVEAL_GRID_WIDTH * REVEAL_GRID_HEIGHT;
    this.grid = new Uint8Array(this.totalBlocks);
  }

  reset(): void {
    this.grid.fill(0);
    this.revealedCount = 0;
    this.revealCounts.clear();
    this.growthAccumulator.clear();
    this.pendingDelta = [];
  }

  update(snakes: Snake[]): void {
    for (const snake of snakes) {
      if (!snake.alive) continue;

      const brushBlocks = Math.ceil(snake.revealRadius / REVEAL_BLOCK_SIZE);
      const head = snake.segments[0];
      const centerBX = Math.floor(head.x / REVEAL_BLOCK_SIZE);
      const centerBY = Math.floor(head.y / REVEAL_BLOCK_SIZE);
      const brushBlocksSq = brushBlocks * brushBlocks;

      let snakeNewBlocks = 0;

      for (let dy = -brushBlocks; dy <= brushBlocks; dy++) {
        for (let dx = -brushBlocks; dx <= brushBlocks; dx++) {
          if (dx * dx + dy * dy > brushBlocksSq) continue;

          const bx = centerBX + dx;
          const by = centerBY + dy;

          if (bx < 0 || bx >= REVEAL_GRID_WIDTH || by < 0 || by >= REVEAL_GRID_HEIGHT) continue;

          const idx = by * REVEAL_GRID_WIDTH + bx;
          if (this.grid[idx] === 0) {
            this.grid[idx] = 1; // mark as revealed
            this.revealedCount++;
            snakeNewBlocks++;
            this.pendingDelta.push(bx, by);
          }
        }
      }

      if (snakeNewBlocks > 0) {
        const current = this.revealCounts.get(snake.id) ?? 0;
        this.revealCounts.set(snake.id, current + snakeNewBlocks);
        snake.revealScore = current + snakeNewBlocks;

        // Permanent growth
        const accum = (this.growthAccumulator.get(snake.id) ?? 0) + snakeNewBlocks;
        const segmentsToAdd = Math.floor(accum / GROWTH_BLOCKS_PER_SEGMENT);
        if (segmentsToAdd > 0) {
          snake.grow(segmentsToAdd);
          this.growthAccumulator.set(snake.id, accum % GROWTH_BLOCKS_PER_SEGMENT);
        } else {
          this.growthAccumulator.set(snake.id, accum);
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

  getRevealScores(): Record<string, number> {
    const scores: Record<string, number> = {};
    for (const [id, count] of this.revealCounts) {
      scores[id] = count;
    }
    return scores;
  }
}
