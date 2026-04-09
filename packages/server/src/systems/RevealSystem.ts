import type { Snake } from '../entities/Snake.js';
import type { RevealDelta } from '@snakegame/shared';
import {
  REVEAL_BLOCK_SIZE,
  REVEAL_GRID_WIDTH,
  REVEAL_GRID_HEIGHT,
} from '@snakegame/shared';

/** Tracks which block was revealed by which snake (index+1). */
export interface RevealBlockInfo {
  bx: number;
  by: number;
  snakeId: string;
}

export class RevealSystem {
  // Grid values: 0 = unrevealed, snakeIndex+1 = who revealed it
  private grid: Uint8Array;
  private totalBlocks: number;
  private revealedCount = 0;
  private revealCounts = new Map<string, number>(); // snakeId → count
  private pendingDelta: number[] = [];
  // Per-tick new blocks with snake attribution
  private pendingBlockInfos: RevealBlockInfo[] = [];
  // Stable snake index mapping for current round
  private snakeIndexMap = new Map<string, number>(); // snakeId → index+1

  constructor() {
    this.totalBlocks = REVEAL_GRID_WIDTH * REVEAL_GRID_HEIGHT;
    this.grid = new Uint8Array(this.totalBlocks);
  }

  reset(): void {
    this.grid.fill(0);
    this.revealedCount = 0;
    this.revealCounts.clear();
    this.pendingDelta = [];
    this.pendingBlockInfos = [];
    this.snakeIndexMap.clear();
  }

  /** Build stable snake→index mapping at round start */
  setSnakeIndexMap(snakes: Snake[]): void {
    this.snakeIndexMap.clear();
    for (let i = 0; i < snakes.length; i++) {
      this.snakeIndexMap.set(snakes[i].id, i + 1); // 1-based
    }
  }

  update(snakes: Snake[]): void {
    this.pendingBlockInfos = [];

    for (const snake of snakes) {
      if (!snake.alive) continue;

      const snakeIdx = this.snakeIndexMap.get(snake.id) ?? 1;
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
            this.grid[idx] = snakeIdx;
            this.revealedCount++;
            snakeNewBlocks++;
            this.pendingDelta.push(bx, by);
            this.pendingBlockInfos.push({ bx, by, snakeId: snake.id });
          }
        }
      }

      if (snakeNewBlocks > 0) {
        const current = this.revealCounts.get(snake.id) ?? 0;
        this.revealCounts.set(snake.id, current + snakeNewBlocks);
        snake.revealScore = current + snakeNewBlocks;
      }
    }
  }

  /** Reveal blocks at an arbitrary position, credited to a specific snake */
  revealAt(x: number, y: number, radius: number, snakeId: string): void {
    const snakeIdx = this.snakeIndexMap.get(snakeId) ?? 1;
    const brushBlocks = Math.ceil(radius / REVEAL_BLOCK_SIZE);
    const centerBX = Math.floor(x / REVEAL_BLOCK_SIZE);
    const centerBY = Math.floor(y / REVEAL_BLOCK_SIZE);
    const brushBlocksSq = brushBlocks * brushBlocks;

    let newBlocks = 0;

    for (let dy = -brushBlocks; dy <= brushBlocks; dy++) {
      for (let dx = -brushBlocks; dx <= brushBlocks; dx++) {
        if (dx * dx + dy * dy > brushBlocksSq) continue;

        const bx = centerBX + dx;
        const by = centerBY + dy;

        if (bx < 0 || bx >= REVEAL_GRID_WIDTH || by < 0 || by >= REVEAL_GRID_HEIGHT) continue;

        const idx = by * REVEAL_GRID_WIDTH + bx;
        if (this.grid[idx] === 0) {
          this.grid[idx] = snakeIdx;
          this.revealedCount++;
          newBlocks++;
          this.pendingDelta.push(bx, by);
          this.pendingBlockInfos.push({ bx, by, snakeId });
        }
      }
    }

    if (newBlocks > 0) {
      const current = this.revealCounts.get(snakeId) ?? 0;
      this.revealCounts.set(snakeId, current + newBlocks);
    }
  }

  /** Get blocks revealed this tick with snake attribution (read before flush) */
  getNewBlocksThisTick(): RevealBlockInfo[] {
    return this.pendingBlockInfos;
  }

  /** Expose the raw grid for per-tile calculations */
  getGrid(): Uint8Array {
    return this.grid;
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
