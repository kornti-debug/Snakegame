import type { Snake } from '../entities/Snake.js';
import type { Obstacle } from '../entities/Obstacle.js';
import { distanceSq } from '@snakegame/shared';

export class CollisionSystem {
  update(snakes: Snake[], obstacles: Obstacle[] = []): void {
    const alive = snakes.filter(s => s.alive);

    for (const snake of alive) {
      if (snake.ghosting) continue; // ghost snakes can't collide

      const head = snake.segments[0];

      // Snake-vs-snake collisions
      for (const other of alive) {
        const startIdx = snake === other ? 10 : 0;
        const collisionDist = snake.radius + other.radius;
        const collisionDistSq = collisionDist * collisionDist;

        for (let i = startIdx; i < other.segments.length; i++) {
          if (distanceSq(head, other.segments[i]) < collisionDistSq) {
            snake.kill();
            if (other !== snake) {
              other.score += 1;
            }
            return;
          }
        }
      }

      // Snake-vs-obstacle collisions
      for (const obstacle of obstacles) {
        if (obstacle.containsPoint(head)) {
          snake.kill();
          return;
        }
      }
    }
  }
}
