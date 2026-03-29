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
} from '@snakegame/shared';

export class Snake {
  readonly id: string;
  segments: Vector2D[];
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

    // Build initial segments behind the head
    const dir = headingToVector(spawnAngle + Math.PI); // opposite of heading
    this.segments = [];
    for (let i = 0; i < SNAKE_INITIAL_LENGTH; i++) {
      this.segments.push({
        x: spawnPos.x + dir.x * i * SNAKE_SEGMENT_SPACING,
        y: spawnPos.y + dir.y * i * SNAKE_SEGMENT_SPACING,
      });
    }
  }

  update(dt: number): void {
    if (!this.alive) return;

    // Turn
    this.angle += this.turnDirection * this.turnRate * dt;

    // Move head forward
    const dir = headingToVector(this.angle);
    const moveDistance = this.speed * dt;
    const head = this.segments[0];
    const newHead: Vector2D = {
      x: head.x + dir.x * moveDistance,
      y: head.y + dir.y * moveDistance,
    };

    // Shift segments: each follows the one ahead
    for (let i = this.segments.length - 1; i > 0; i--) {
      const target = this.segments[i - 1];
      const current = this.segments[i];
      const dx = target.x - current.x;
      const dy = target.y - current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > SNAKE_SEGMENT_SPACING) {
        const ratio = SNAKE_SEGMENT_SPACING / dist;
        this.segments[i] = {
          x: target.x - dx * ratio,
          y: target.y - dy * ratio,
        };
      }
    }

    this.segments[0] = newHead;
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

    const dir = headingToVector(angle + Math.PI);
    this.segments = [];
    for (let i = 0; i < SNAKE_INITIAL_LENGTH; i++) {
      this.segments.push({
        x: pos.x + dir.x * i * SNAKE_SEGMENT_SPACING,
        y: pos.y + dir.y * i * SNAKE_SEGMENT_SPACING,
      });
    }
  }
}
