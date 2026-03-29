import type { Snake } from '../entities/Snake.js';
import { PowerUp } from '../entities/PowerUp.js';
import { PowerUpRegistry } from '../powerups/PowerUpRegistry.js';
import { SpeedBoost } from '../powerups/SpeedBoost.js';
import { WideTrail } from '../powerups/WideTrail.js';
import { Ghost } from '../powerups/Ghost.js';
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
          powerUp.collected = true;
          console.log(`[PowerUp] ${snake.name} collected ${powerUp.definition.id}, speed before=${snake.speed}`);
          powerUp.definition.onApply(snake);
          console.log(`[PowerUp] ${snake.name} speed after=${snake.speed}, segments=${snake.segments.length}`);

          if (powerUp.definition.duration > 0) {
            this.activeEffects.push({
              snakeId: snake.id,
              definitionId: powerUp.definition.id,
              remainingMs: powerUp.definition.duration,
            });
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
          def.onExpire(snake);
        }

        this.activeEffects.splice(i, 1);
      }
    }
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

  /** Force-expire all active effects on all snakes */
  expireAll(snakes: Snake[]): void {
    for (const effect of this.activeEffects) {
      const snake = snakes.find(s => s.id === effect.snakeId);
      const def = this.registry.get(effect.definitionId);
      if (snake && def) def.onExpire(snake);
    }
    this.activeEffects = [];
  }
}
