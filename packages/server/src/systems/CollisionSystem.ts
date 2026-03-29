import type { Snake } from '../entities/Snake.js';
import type { Obstacle } from '../entities/Obstacle.js';
import { distanceSq, SNAKE_SPEED, SNAKE_SEGMENT_SPACING } from '@snakegame/shared';

export class CollisionSystem {
  update(snakes: Snake[], obstacles: Obstacle[] = []): void {
    const alive = snakes.filter(s => s.alive);

    for (const snake of alive) {
      if (snake.ghosting) continue;

      const head = snake.segments[0];

      // Snake-vs-snake collisions
      for (const other of alive) {
        const isSelf = snake === other;

        if (isSelf) {
          // Self-collision: skip enough segments that the body has had time to
          // curve away. Use segment spacing to calculate how many segments fit
          // within a safe distance, then add a generous buffer.
          const safeDistance = snake.radius * 6;
          const skipBySpacing = Math.ceil(safeDistance / SNAKE_SEGMENT_SPACING);
          const speedFactor = snake.speed / SNAKE_SPEED;
          const startIdx = Math.ceil(skipBySpacing * speedFactor);

          // Self-collision uses a tighter radius (half) to avoid false positives
          const selfCollisionDist = snake.radius * 0.8;
          const selfCollisionDistSq = selfCollisionDist * selfCollisionDist;

          for (let i = startIdx; i < other.segments.length; i++) {
            if (distanceSq(head, other.segments[i]) < selfCollisionDistSq) {
              snake.kill();
              return;
            }
          }
        } else {
          // Other-snake collision: normal radius
          const collisionDist = snake.radius + other.radius;
          const collisionDistSq = collisionDist * collisionDist;

          for (let i = 0; i < other.segments.length; i++) {
            if (distanceSq(head, other.segments[i]) < collisionDistSq) {
              snake.kill();
              other.score += 1;
              return;
            }
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
