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
  pairScore: number;
  revealRadius: number;
  ghosting: boolean;
  starred: boolean;
  swarmLeader: boolean;
  predator: boolean;
  team: number | null = null;
  playerIndex = 0;
  itemSlot: string | null = null;      // queued active powerup id (if any)
  activeEffect: string | null = null;  // currently-running active powerup id
  // Passive stacks — per-round counts that shape the baseline stats below.
  // Passives never expire within a round; reset on resetForRound().
  passiveStacks: Record<string, number> = {};
  // Baseline stats (after passives, before any active effect). Actives
  // read these, multiply, and restore them on expire — so passives are
  // never wiped by an active ending.
  baseSpeed: number;
  baseTurnRate: number;
  baseRevealRadius: number;
  effectDrain: Record<string, number> = {};
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
    this.pairScore = 0;
    this.revealRadius = REVEAL_BRUSH_RADIUS;
    this.baseSpeed = SNAKE_SPEED;
    this.baseTurnRate = SNAKE_TURN_RATE;
    this.baseRevealRadius = REVEAL_BRUSH_RADIUS;
    this.ghosting = false;
    this.starred = false;
    this.swarmLeader = false;
    this.predator = false;

    this.buildInitialPath(spawnPos, spawnAngle);
  }

  /** Recompute baseline stats from passive stacks. Call after every
   *  passive pickup and whenever you want to re-sync (e.g. after an
   *  active expires and restores the baseline). */
  recomputeBase(): void {
    const growth   = this.passiveStacks['growth']   ?? 0;
    const steering = this.passiveStacks['steering'] ?? 0;
    const speed    = this.passiveStacks['speed']    ?? 0;
    this.baseRevealRadius = REVEAL_BRUSH_RADIUS * (1 + growth * 0.20);
    this.baseTurnRate     = SNAKE_TURN_RATE * (1 + steering * 0.20);
    this.baseSpeed        = SNAKE_SPEED * (1 + speed * 0.10);
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

    // Trim path: keep enough length for all segments + generous buffer
    const neededLength = SNAKE_SEGMENT_SPACING * SNAKE_INITIAL_LENGTH * 2;
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

    let walkedDist = 0;
    let nextSegDist = SNAKE_SEGMENT_SPACING;

    for (let i = 0; i < this.path.length - 1 && this.segments.length < SNAKE_INITIAL_LENGTH; i++) {
      const dx = this.path[i + 1].x - this.path[i].x;
      const dy = this.path[i + 1].y - this.path[i].y;
      const edgeLen = Math.sqrt(dx * dx + dy * dy);
      if (edgeLen === 0) continue;

      const edgeStart = walkedDist;
      const edgeEnd = walkedDist + edgeLen;

      // Place all segments that fall within this edge
      while (nextSegDist <= edgeEnd && this.segments.length < SNAKE_INITIAL_LENGTH) {
        const t = (nextSegDist - edgeStart) / edgeLen;
        this.segments.push({
          x: this.path[i].x + dx * t,
          y: this.path[i].y + dy * t,
        });
        nextSegDist += SNAKE_SEGMENT_SPACING;
      }

      walkedDist = edgeEnd;
    }

    // Fill remaining segments at the tail if path is too short
    const last = this.path[this.path.length - 1];
    while (this.segments.length < SNAKE_INITIAL_LENGTH) {
      this.segments.push({ x: last.x, y: last.y });
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
      pairScore: this.pairScore,
      ghosting: this.ghosting,
      starred: this.starred,
      swarmLeader: this.swarmLeader,
      predator: this.predator,
      team: this.team,
      playerIndex: this.playerIndex,
      itemSlot: this.itemSlot,
      activeEffect: this.activeEffect,
      passiveStacks: this.passiveStacks,
      effectDrain: this.effectDrain,
    };
  }

  kill(): void {
    this.alive = false;
  }

  resetForRound(): void {
    this.revealScore = 0;
    this.pairScore = 0;
    this.passiveStacks = {};
    this.recomputeBase();
    this.revealRadius = this.baseRevealRadius;
    this.speed = this.baseSpeed;
    this.turnRate = this.baseTurnRate;
    this.starred = false;
    this.swarmLeader = false;
    this.predator = false;
    this.ghosting = false;
    this.itemSlot = null;
    this.activeEffect = null;
  }

  respawn(pos: Vector2D, angle: number): void {
    this.angle = angle;
    this.alive = true;
    this.turnDirection = 0;
    this.boosting = false;
    // Preserve passive stacks across death — respawn with the current
    // baseline rather than stock values.
    this.speed = this.baseSpeed;
    this.turnRate = this.baseTurnRate;
    this.revealRadius = this.baseRevealRadius;
    this.radius = SNAKE_RADIUS;
    this.ghosting = false;
    this.starred = false;
    this.swarmLeader = false;
    this.predator = false;

    this.buildInitialPath(pos, angle);
  }
}
