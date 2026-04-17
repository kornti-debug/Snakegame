import { v4 as uuid } from 'uuid';
import type { Vector2D, SnakeState } from '@snakegame/shared';
import {
  SNAKE_SPEED,
  SNAKE_TURN_RATE,
  SNAKE_RADIUS,
  SNAKE_SEGMENT_SPACING,
  SNAKE_INITIAL_LENGTH,
  REVEAL_BRUSH_RADIUS,
  TURBO_MULTIPLIER,
  TURBO_MAX_MS,
  TURBO_COOLDOWN_MS,
  BRAKE_DURATION_MS,
  BRAKE_COOLDOWN_MS,
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
  // Debuffs inflicted by OP bonus powerups (time-freeze / lightning / cripple).
  frozen = false;
  shrunken = false;
  crippled = false;
  team: number | null = null;
  playerIndex = 0;
  isDisconnected = false;              // owning socket is in grace window
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
  /** Client-driven turn rate scale (e.g. MIDI jog speed). 1 = full turnRate. */
  turnIntensity = 1;
  boosting = false;

  // ---- Turbo / brake pads (DDJ hot-cues etc.) ----
  /** Live state of the player's turbo pad. Client emits edges via
   *  `input:turbo`. The `updateTurboBrake` tick consumes this. */
  turboPressed = false;
  /** Held duration of the current turbo burst (ms). Forced release at
   *  TURBO_MAX_MS regardless of user input. */
  turboHeldMs = 0;
  /** Cooldown remaining (ms) before turbo can be re-engaged. */
  turboCooldownMs = 0;
  /** Computed per-tick: true iff the speed multiplier should apply this tick. */
  turboActive = false;

  brakePressed = false;
  /** While brake is engaged, counts down from BRAKE_DURATION_MS → 0. */
  brakeRemainingMs = 0;
  brakeCooldownMs = 0;
  /** Computed per-tick: true iff speed should be zero this tick. */
  brakeActive = false;

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

  /** Advance the turbo/brake state machines. Call once per server tick,
   *  before `update()` — the computed `turboActive` / `brakeActive` flags
   *  feed into `update()`'s movement distance calculation. */
  updateTurboBrake(dtMs: number): void {
    // --- Brake ---
    if (this.brakeActive) {
      this.brakeRemainingMs -= dtMs;
      if (this.brakeRemainingMs <= 0) {
        this.brakeActive = false;
        this.brakeRemainingMs = 0;
        this.brakeCooldownMs = BRAKE_COOLDOWN_MS;
      }
    } else if (this.brakeCooldownMs > 0) {
      this.brakeCooldownMs = Math.max(0, this.brakeCooldownMs - dtMs);
    } else if (this.brakePressed) {
      this.brakeActive = true;
      this.brakeRemainingMs = BRAKE_DURATION_MS;
    }

    // --- Turbo ---
    if (this.turboCooldownMs > 0) {
      this.turboCooldownMs = Math.max(0, this.turboCooldownMs - dtMs);
      this.turboActive = false;
    } else if (this.turboPressed) {
      this.turboActive = true;
      this.turboHeldMs += dtMs;
      if (this.turboHeldMs >= TURBO_MAX_MS) {
        this.turboActive = false;
        this.turboCooldownMs = TURBO_COOLDOWN_MS;
        this.turboHeldMs = 0;
      }
    } else {
      if (this.turboHeldMs > 0) {
        // Released before max — small cooldown to discourage mashing.
        this.turboCooldownMs = TURBO_COOLDOWN_MS;
        this.turboHeldMs = 0;
      }
      this.turboActive = false;
    }
  }

  /** Effective forward speed for this tick, with turbo/brake applied on top
   *  of whatever powerups have set `snake.speed` to. */
  getEffectiveSpeed(): number {
    if (this.brakeActive) return 0;
    if (this.turboActive) return this.speed * TURBO_MULTIPLIER;
    return this.speed;
  }

  update(dt: number): void {
    if (!this.alive) return;

    // Turn (turnIntensity from MIDI jog speed etc.; 1 when absent). Turning
    // is intentionally still allowed while braked — players can aim during
    // the stop window.
    this.angle += this.turnDirection * this.turnRate * this.turnIntensity * dt;

    // Move head forward
    const dir = headingToVector(this.angle);
    const moveDistance = this.getEffectiveSpeed() * dt;
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
      frozen: this.frozen,
      shrunken: this.shrunken,
      crippled: this.crippled,
      team: this.team,
      playerIndex: this.playerIndex,
      itemSlot: this.itemSlot,
      activeEffect: this.activeEffect,
      passiveStacks: this.passiveStacks,
      effectDrain: this.effectDrain,
      isDisconnected: this.isDisconnected,
    };
  }

  kill(): void {
    this.alive = false;
    this.resetTurboBrake();
  }

  private resetTurboBrake(): void {
    this.turboPressed = false;
    this.turboActive = false;
    this.turboHeldMs = 0;
    this.turboCooldownMs = 0;
    this.brakePressed = false;
    this.brakeActive = false;
    this.brakeRemainingMs = 0;
    this.brakeCooldownMs = 0;
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
    this.frozen = false;
    this.shrunken = false;
    this.crippled = false;
    this.itemSlot = null;
    this.activeEffect = null;
    this.turnDirection = 0;
    this.turnIntensity = 1;
    this.resetTurboBrake();
  }

  respawn(pos: Vector2D, angle: number): void {
    this.angle = angle;
    this.alive = true;
    this.turnDirection = 0;
    this.turnIntensity = 1;
    this.boosting = false;
    this.resetTurboBrake();
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
    this.frozen = false;
    this.shrunken = false;
    this.crippled = false;

    this.buildInitialPath(pos, angle);
  }
}
