import type { GameSnapshot } from '@snakegame/shared';
import { ARENA_WIDTH, ARENA_HEIGHT } from '@snakegame/shared';

export class UILayer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = ARENA_WIDTH;
    this.canvas.height = ARENA_HEIGHT;
    this.ctx = this.canvas.getContext('2d')!;
  }

  render(snapshot: GameSnapshot): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Player scores (top-left)
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'left';

    let y = 34;
    for (const snake of snapshot.snakes) {
      const status = snake.alive ? '' : '  [DEAD]';

      // Shadow for readability
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText(`${snake.name}: ${snake.score}${status}`, 22, y + 1);

      ctx.fillStyle = snake.color;
      ctx.fillText(`${snake.name}: ${snake.score}${status}`, 20, y);
      y += 30;
    }

    // Reveal percentage (top-right)
    const pct = snapshot.revealPercentage.toFixed(1);
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(`Revealed: ${pct}%`, ARENA_WIDTH - 18, 35);
    ctx.fillStyle = '#fff';
    ctx.fillText(`Revealed: ${pct}%`, ARENA_WIDTH - 20, 34);
  }
}
