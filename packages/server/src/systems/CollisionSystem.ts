import type { Snake } from '../entities/Snake.js';
import type { Obstacle } from '../entities/Obstacle.js';
import { distanceSq, SNAKE_SPEED, SNAKE_SEGMENT_SPACING } from '@snakegame/shared';

export class CollisionSystem {
  update(snakes: Snake[], obstacles: Obstacle[] = []): void {
    const alive = snakes.filter(s => s.alive);

    // Star kills: starred snakes kill other snakes on head-to-body contact
    for (const snake of alive) {
      if (!snake.starred) continue;
      const head = snake.segments[0];
      const killDist = snake.radius + 12;
      const killDistSq = killDist * killDist;

      for (const other of alive) {
        if (other === snake || !other.alive) continue;
        for (const seg of other.segments) {
          if (distanceSq(head, seg) < killDistSq) {
            other.kill();
            snake.score += 1;
            break;
          }
        }
      }
    }

    // Normal collisions
    for (const snake of alive) {
      if (!snake.alive) continue; // may have been star-killed above
      if (snake.ghosting) continue; // ghost + starred snakes skip normal collisions

      const head = snake.segments[0];

      // Snake-vs-snake collisions
      for (const other of alive) {
        if (!other.alive) continue;
        const isSelf = snake === other;

        if (isSelf) {
          const safeDistance = snake.radius * 6;
          const skipBySpacing = Math.ceil(safeDistance / SNAKE_SEGMENT_SPACING);
          const speedFactor = snake.speed / SNAKE_SPEED;
          const startIdx = Math.ceil(skipBySpacing * speedFactor);

          const selfCollisionDist = snake.radius * 0.8;
          const selfCollisionDistSq = selfCollisionDist * selfCollisionDist;

          for (let i = startIdx; i < other.segments.length; i++) {
            if (distanceSq(head, other.segments[i]) < selfCollisionDistSq) {
              snake.kill();
              break;
            }
          }
        } else {
          // Don't die from hitting a starred snake's body (they're invincible)
          if (other.starred) continue;

          const collisionDist = snake.radius + other.radius;
          const collisionDistSq = collisionDist * collisionDist;

          for (let i = 0; i < other.segments.length; i++) {
            if (distanceSq(head, other.segments[i]) < collisionDistSq) {
              snake.kill();
              other.score += 1;
              break;
            }
          }
        }

        if (!snake.alive) break;
      }

      if (!snake.alive) continue;

      // Snake-vs-obstacle collisions
      for (const obstacle of obstacles) {
        if (obstacle.containsPoint(head)) {
          snake.kill();
          break;
        }
      }
    }
  }
}
