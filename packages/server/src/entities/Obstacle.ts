import { v4 as uuid } from 'uuid';
import type { Vector2D, ObstacleState } from '@snakegame/shared';

export class Obstacle {
  readonly id: string;
  readonly position: Vector2D;
  readonly width: number;
  readonly height: number;
  remainingMs: number;

  constructor(position: Vector2D, width: number, height: number, durationMs: number) {
    this.id = uuid();
    this.position = position;
    this.width = width;
    this.height = height;
    this.remainingMs = durationMs;
  }

  update(dtMs: number): void {
    this.remainingMs -= dtMs;
  }

  isExpired(): boolean {
    return this.remainingMs <= 0;
  }

  containsPoint(point: Vector2D): boolean {
    return (
      point.x >= this.position.x &&
      point.x <= this.position.x + this.width &&
      point.y >= this.position.y &&
      point.y <= this.position.y + this.height
    );
  }

  toState(): ObstacleState {
    return {
      id: this.id,
      position: this.position,
      width: this.width,
      height: this.height,
    };
  }
}
