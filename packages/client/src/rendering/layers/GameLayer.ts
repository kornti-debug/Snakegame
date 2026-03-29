import type { GameSnapshot } from '@snakegame/shared';
import { ARENA_WIDTH, ARENA_HEIGHT } from '@snakegame/shared';
import { drawSnake } from '../SnakeRenderer.js';

export class GameLayer {
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
    const { width, height } = snapshot.arena;

    ctx.clearRect(0, 0, width, height);

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, width - 4, height - 4);

    // Snakes
    for (const snake of snapshot.snakes) {
      drawSnake(ctx, snake);
    }
  }
}
