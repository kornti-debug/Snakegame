import type { Vector2D } from './types/game.js';

export function distance(a: Vector2D, b: Vector2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distanceSq(a: Vector2D, b: Vector2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpVec(a: Vector2D, b: Vector2D, t: number): Vector2D {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

export function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

export function headingToVector(angle: number): Vector2D {
  return { x: Math.cos(angle), y: Math.sin(angle) };
}
