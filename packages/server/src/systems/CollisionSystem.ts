import type { Snake } from '../entities/Snake.js';
import { distanceSq } from '@snakegame/shared';

export class CollisionSystem {
  update(snakes: Snake[]): void {
    const alive = snakes.filter(s => s.alive);

    for (const snake of alive) {
      const head = snake.segments[0];

      for (const other of alive) {
        // Skip self-head, but check self-body (skip first few segments to avoid instant self-kill)
        const startIdx = snake === other ? 10 : 0;
        const collisionDist = snake.radius + other.radius;
        const collisionDistSq = collisionDist * collisionDist;

        for (let i = startIdx; i < other.segments.length; i++) {
          if (distanceSq(head, other.segments[i]) < collisionDistSq) {
            snake.kill();
            if (other !== snake) {
              other.score += 1;
            }
            return; // snake is dead, stop checking
          }
        }
      }
    }
  }
}
