import type { Snake } from '../entities/Snake.js';

export type PowerUpKind = 'active' | 'passive';

export interface PowerUpDefinition {
  id: string;
  displayName: string;
  /** 0 = never spawns on the field (e.g. bonus-pair rewards). */
  spawnWeight: number;
  duration: number; // ms, 0 = instant
  /** 'active' powerups queue into the snake's item slot and must be
   *  manually activated. 'passive' powerups apply instantly on pickup and
   *  stack forever (no expiry timer). */
  kind: PowerUpKind;
  /** Apply the effect. `others` is the list of OTHER living snakes at the
   *  moment of apply — broadcast powerups (freeze, lightning, cripple)
   *  use it to debuff opponents. Self-only powerups ignore it. */
  onApply(snake: Snake, others: Snake[]): void;
  onExpire(snake: Snake, others: Snake[]): void;
  renderHint: { color: string; shape: string };
}

export class PowerUpRegistry {
  private definitions = new Map<string, PowerUpDefinition>();

  register(def: PowerUpDefinition): void {
    this.definitions.set(def.id, def);
  }

  get(id: string): PowerUpDefinition | undefined {
    return this.definitions.get(id);
  }

  getWeightedRandom(): PowerUpDefinition {
    const defs = [...this.definitions.values()];
    const totalWeight = defs.reduce((sum, d) => sum + d.spawnWeight, 0);
    let roll = Math.random() * totalWeight;

    for (const def of defs) {
      roll -= def.spawnWeight;
      if (roll <= 0) return def;
    }

    return defs[defs.length - 1];
  }
}
