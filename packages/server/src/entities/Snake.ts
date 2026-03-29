import { v4 as uuid } from 'uuid';
import type { Vector2D, SnakeState } from '@snakegame/shared';
import {
  SNAKE_SPEED,
  SNAKE_TURN_RATE,
  SNAKE_RADIUS,
  SNAKE_SEGMENT_SPACING,
  SNAKE_INITIAL_LENGTH,
  REVEAL_BRUSH_RADIUS,
  headingToVector,
  distance,
} from '@snakegame/shared';

export class Snake {
  readonly id: string;
  segments: Vector2D[] = [];
  angle: number;
  speed: number;
  turnRate: number;
  radius: number;
  alive: boolean;
  color: string;
  name: string;
  score: number;
  revealScore: number;
  revealRadius: number;
  ghosting: boolean;
  turnDirection: -1 | 0 | 1 = 0;
  boosting = false;

  // Path history: dense trail of head positions
  private path: Vector2D[] = [];
  private pathLength = 0; // total distance along path

  constructor(name: string, color: string, spawnPos: Vector2D, spawnAngle: number) {
    this.id = uuid();
    this.angle = spawnAngle;
    this.speed = SNAKE_SPEED;
    this.turnRate = SNAKE_TURN_RATE;
    this.radius = SNAKE_RADIUS;
    this.alive = true;
    this.color = color;
    this.name = name;
    this.score = 0;
    this.revealScore = 0;
    this.revealRadius = REVEAL_BRUSH_RADIUS;
    this.ghosting = false;

    this.buildInitialPath(spawnPos, spawnAngle);
  }

  private buildInitialPath(spawnPos: Vector2D, spawnAngle: number): void {
    const dir = headingToVector(spawnAngle + Math.PI);
    const totalPathLength = SNAKE_SEGMENT_SPACING * SNAKE_INITIAL_LENGTH;

    // Build dense path points (every 2px)
    this.path = [];
    const step = 2;
    const numPoints = Math.ceil(totalPathLength / step) + 1;
    for (let i = 0; i < numPoints; i++) {
      const d = i * step;
      this.path.push({
        x: spawnPos.x + dir.x * d,
        y: spawnPos.y + dir.y * d,
      });
    }
    this.pathLength = (numPoints - 1) * step;

    this.rebuildSegments();
  }

  update(dt: number): void {
    if (!this.alive) return;

    // Turn
    this.angle += this.turnDirection * this.turnRate * dt;

    // Move head forward
    const dir = headingToVector(this.angle);
    const moveDistance = this.speed * dt;
    const head = this.path[0];
    const newHead: Vector2D = {
      x: head.x + dir.x * moveDistance,
      y: head.y + dir.y * moveDistance,
    };

    // Prepend new head position to path
    this.path.unshift(newHead);
    this.pathLength += moveDistance;

    // Trim path: keep enough length for all segments
    const neededLength = SNAKE_SEGMENT_SPACING * SNAKE_INITIAL_LENGTH + 10;
    while (this.path.length > 2 && this.pathLength > neededLength) {
      const last = this.path[this.path.length - 1];
      const prev = this.path[this.path.length - 2];
      const segDist = distance(last, prev);
      this.path.pop();
      this.pathLength -= segDist;
    }

    this.rebuildSegments();
  }

  /** Place segments at evenly-spaced distances along the path */
  private rebuildSegments(): void {
    this.segments = [];

    if (this.path.length === 0) return;
    this.segments.push({ ...this.path[0] }); // head

    let distAccum = 0;
    let nextSegDist = SNAKE_SEGMENT_SPACING;
    let pathIdx = 0;

    for (let seg = 1; seg < SNAKE_INITIAL_LENGTH; seg++) {
      // Walk along path until we've traveled nextSegDist
      while (pathIdx < this.path.length - 1) {
        const segLen = distance(this.path[pathIdx], this.path[pathIdx + 1]);
        if (distAccum + segLen >= nextSegDist) {
          // Interpolate position along this path segment
          const remaining = nextSegDist - distAccum;
          const t = remaining / segLen;
          this.segments.push({
            x: this.path[pathIdx].x + (this.path[pathIdx + 1].x - this.path[pathIdx].x) * t,
            y: this.path[pathIdx].y + (this.path[pathIdx + 1].y - this.path[pathIdx].y) * t,
          });
          distAccum = nextSegDist;
          nextSegDist += SNAKE_SEGMENT_SPACING;
          break;
        }
        distAccum += segLen;
        pathIdx++;
      }

      // If we ran out of path, place segment at the last path point
      if (this.segments.length <= seg) {
        const last = this.path[this.path.length - 1];
        this.segments.push({ x: last.x, y: last.y });
      }
    }
  }

  toState(): SnakeState {
    return {
      id: this.id,
      segments: this.segments,
      angle: this.angle,
      speed: this.speed,
      turnRate: this.turnRate,
      radius: this.radius,
      alive: this.alive,
      color: this.color,
      name: this.name,
      score: this.score,
      revealScore: this.revealScore,
      ghosting: this.ghosting,
    };
  }

  kill(): void {
    this.alive = false;
  }

  resetForRound(): void {
    this.revealScore = 0;
    this.revealRadius = REVEAL_BRUSH_RADIUS;
    this.ghosting = false;
    this.speed = SNAKE_SPEED;
  }

  respawn(pos: Vector2D, angle: number): void {
    this.angle = angle;
    this.alive = true;
    this.turnDirection = 0;
    this.boosting = false;
    this.speed = SNAKE_SPEED;
    this.radius = SNAKE_RADIUS;
    this.revealRadius = REVEAL_BRUSH_RADIUS;
    this.ghosting = false;

    this.buildInitialPath(pos, angle);
  }
}
