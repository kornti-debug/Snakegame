import type { GameSnapshot } from '@snakegame/shared';
import { ARENA_WIDTH, ARENA_HEIGHT } from '@snakegame/shared';
import { drawSnake } from './SnakeRenderer.js';

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = ARENA_WIDTH;
    this.canvas.height = ARENA_HEIGHT;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.objectFit = 'contain';
    this.canvas.style.background = '#111';
    container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d')!;
  }

  render(snapshot: GameSnapshot): void {
    const ctx = this.ctx;
    const { width, height } = snapshot.arena;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // Grid
    this.drawGrid(ctx, width, height);

    // Border
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, width - 4, height - 4);

    // Snakes
    for (const snake of snapshot.snakes) {
      drawSnake(ctx, snake);
    }

    // HUD
    this.drawHUD(ctx, snapshot);
  }

  private drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = 0; x <= w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  private drawHUD(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot): void {
    ctx.font = '20px monospace';
    ctx.textAlign = 'left';

    let y = 30;
    for (const snake of snapshot.snakes) {
      const status = snake.alive ? '' : ' [DEAD]';
      ctx.fillStyle = snake.color;
      ctx.fillText(`${snake.name}: ${snake.score}${status}`, 20, y);
      y += 28;
    }
  }
}
