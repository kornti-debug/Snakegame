import type { RevealDelta } from '@snakegame/shared';
import { ARENA_WIDTH, ARENA_HEIGHT, REVEAL_BLOCK_SIZE } from '@snakegame/shared';

export class RevealLayer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = ARENA_WIDTH;
    this.canvas.height = ARENA_HEIGHT;
    this.ctx = this.canvas.getContext('2d')!;
    this.fillMask();
  }

  /** Fill the entire canvas with the opaque cover (unrevealed “fog”). */
  fillMask(): void {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'source-over';
    // Solid slate: matches lobby/arena (#0a0a1a family), contrasts with tile outlines (#8a9cad) and UI greens.
    // Dark fog vs light tile backing in BackgroundLayer — strong hole edge.
    ctx.fillStyle = '#0b0d14';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  }

  /** Punch holes in the mask for newly revealed blocks */
  applyDelta(delta: RevealDelta): void {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(255,255,255,1)';

    const blocks = delta.blocks;
    for (let i = 0; i < blocks.length; i += 2) {
      const bx = blocks[i];
      const by = blocks[i + 1];
      const px = bx * REVEAL_BLOCK_SIZE;
      const py = by * REVEAL_BLOCK_SIZE;

      // Draw a circle for softer reveal edges
      ctx.beginPath();
      ctx.arc(
        px + REVEAL_BLOCK_SIZE / 2,
        py + REVEAL_BLOCK_SIZE / 2,
        REVEAL_BLOCK_SIZE * 1.2,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // Reset composite mode
    ctx.globalCompositeOperation = 'source-over';
  }

  reset(): void {
    this.fillMask();
  }
}
