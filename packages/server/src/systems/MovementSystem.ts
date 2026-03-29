import type { Snake } from '../entities/Snake.js';
import { ARENA_WIDTH, ARENA_HEIGHT } from '@snakegame/shared';

export class MovementSystem {
  update(snakes: Snake[], dt: number): void {
    for (const snake of snakes) {
      if (!snake.alive) continue;
      snake.update(dt);
      this.wrapBounds(snake);
    }
  }

  private wrapBounds(snake: Snake): void {
    const head = snake.segments[0];
    const r = snake.radius;

    // Wall collision: kill the snake if it goes out of bounds
    if (head.x - r < 0 || head.x + r > ARENA_WIDTH ||
        head.y - r < 0 || head.y + r > ARENA_HEIGHT) {
      snake.kill();
    }
  }
}
