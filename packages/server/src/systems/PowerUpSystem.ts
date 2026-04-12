import type { Snake } from '../entities/Snake.js';
import { PowerUp } from '../entities/PowerUp.js';
import { PowerUpRegistry } from '../powerups/PowerUpRegistry.js';
import { SpeedBoost } from '../powerups/SpeedBoost.js';
import { WideTrail } from '../powerups/WideTrail.js';
import { Ghost } from '../powerups/Ghost.js';
import { Star } from '../powerups/Star.js';
import { SwarmLeader } from '../powerups/SwarmLeader.js';
import { Predator } from '../powerups/Predator.js';
import { Growth } from '../powerups/Growth.js';
import { Steering } from '../powerups/Steering.js';
import { SpeedPassive } from '../powerups/SpeedPassive.js';
import { TimeFreeze } from '../powerups/TimeFreeze.js';
import { Lightning } from '../powerups/Lightning.js';
import { Cripple } from '../powerups/Cripple.js';
import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  POWERUP_SPAWN_INTERVAL,
  POWERUP_MAX_ACTIVE,
  POWERUP_COLLECT_RADIUS,
  distanceSq,
} from '@snakegame/shared';

interface ActiveEffect {
  snakeId: string;
  definitionId: string;
  remainingMs: number;
  durationMs: number;
}

export class PowerUpSystem {
  readonly registry = new PowerUpRegistry();
  private fieldPowerUps: PowerUp[] = [];
  private activeEffects: ActiveEffect[] = [];
  private spawnTimer = POWERUP_SPAWN_INTERVAL;

  constructor() {
    this.registry.register(SpeedBoost);
    this.registry.register(WideTrail);
    this.registry.register(Ghost);
    this.registry.register(Star);
    this.registry.register(SwarmLeader);
    this.registry.register(Predator);
    this.registry.register(Growth);
    this.registry.register(Steering);
    this.registry.register(SpeedPassive);
    this.registry.register(TimeFreeze);
    this.registry.register(Lightning);
    this.registry.register(Cripple);
  }

  update(snakes: Snake[], dt: number): void {
    const dtMs = dt * 1000;

    // Spawn timer
    this.spawnTimer -= dtMs;
    if (this.spawnTimer <= 0 && this.fieldPowerUps.length < POWERUP_MAX_ACTIVE) {
      this.spawnRandom();
      this.spawnTimer = POWERUP_SPAWN_INTERVAL;
    }

    // Check collection
    const collectRadiusSq = POWERUP_COLLECT_RADIUS * POWERUP_COLLECT_RADIUS;
    for (const powerUp of this.fieldPowerUps) {
      if (powerUp.collected) continue;

      for (const snake of snakes) {
        if (!snake.alive) continue;

        if (distanceSq(snake.segments[0], powerUp.position) < collectRadiusSq) {
          const def = powerUp.definition;
          if (def.kind === 'passive') {
            // Passive: apply instantly, stacks forever, no timer.
            powerUp.collected = true;
            def.onApply(snake, this.otherSnakes(snake, snakes));
          } else {
            // Active: only collect if this snake's slot is free. A full
            // slot means we can't pick up more — the powerup stays on the
            // field for someone else (or until you activate and free up).
            if (snake.itemSlot) continue;
            powerUp.collected = true;
            snake.itemSlot = def.id;
          }
          break;
        }
      }
    }

    // Remove collected power-ups
    this.fieldPowerUps = this.fieldPowerUps.filter(p => !p.collected);

    // Update active effects
    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      this.activeEffects[i].remainingMs -= dtMs;

      if (this.activeEffects[i].remainingMs <= 0) {
        const effect = this.activeEffects[i];
        const snake = snakes.find(s => s.id === effect.snakeId);
        const def = this.registry.get(effect.definitionId);

        if (snake && def) {
          def.onExpire(snake, this.otherSnakes(snake, snakes));
          if (snake.activeEffect === effect.definitionId) snake.activeEffect = null;
        }

        this.activeEffects.splice(i, 1);
      }
    }
  }

  private otherSnakes(self: Snake, snakes: Snake[]): Snake[] {
    return snakes.filter(s => s !== self && s.alive);
  }

  /** Player pressed the activate button. If they have a slotted active
   *  powerup, cancel any currently-running active effect on that snake
   *  (only one at a time per user's design) and start the slotted one. */
  activateSlot(snake: Snake, snakes: Snake[]): boolean {
    if (!snake.alive) return false;
    if (!snake.itemSlot) return false;
    const def = this.registry.get(snake.itemSlot);
    if (!def || def.kind !== 'active' || def.duration <= 0) {
      snake.itemSlot = null;
      return false;
    }

    const others = this.otherSnakes(snake, snakes);

    // Cancel current active effect (if any) on this snake.
    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const e = this.activeEffects[i];
      if (e.snakeId !== snake.id) continue;
      const prev = this.registry.get(e.definitionId);
      if (prev) prev.onExpire(snake, others);
      this.activeEffects.splice(i, 1);
    }

    // Start the slotted effect.
    def.onApply(snake, others);
    this.activeEffects.push({
      snakeId: snake.id,
      definitionId: def.id,
      remainingMs: def.duration,
      durationMs: def.duration,
    });
    snake.activeEffect = def.id;
    snake.itemSlot = null;
    return true;
  }

  private spawnRandom(): void {
    const margin = 100;
    const def = this.registry.getWeightedRandom();
    const position = {
      x: margin + Math.random() * (ARENA_WIDTH - margin * 2),
      y: margin + Math.random() * (ARENA_HEIGHT - margin * 2),
    };
    this.fieldPowerUps.push(new PowerUp(def, position));
  }

  getFieldPowerUps(): PowerUp[] {
    return this.fieldPowerUps;
  }

  reset(): void {
    this.fieldPowerUps = [];
    this.activeEffects = [];
    this.spawnTimer = POWERUP_SPAWN_INTERVAL;
  }

  /** Get drain fractions for a specific snake: effectId → 0..1 (1 = just started) */
  getEffectDrains(snakeId: string): Record<string, number> {
    const drains: Record<string, number> = {};
    for (const effect of this.activeEffects) {
      if (effect.snakeId !== snakeId) continue;
      const def = this.registry.get(effect.definitionId);
      if (!def || def.duration <= 0) continue;
      drains[effect.definitionId] = Math.max(0, Math.min(1, effect.remainingMs / def.duration));
    }
    return drains;
  }

  /** Force-expire all active effects on all snakes */
  expireAll(snakes: Snake[]): void {
    for (const effect of this.activeEffects) {
      const snake = snakes.find(s => s.id === effect.snakeId);
      const def = this.registry.get(effect.definitionId);
      if (snake && def) def.onExpire(snake, this.otherSnakes(snake, snakes));
      if (snake) snake.activeEffect = null;
    }
    this.activeEffects = [];
    // Also clear any queued item slots — new round = clean slate.
    for (const s of snakes) s.itemSlot = null;
  }
}
