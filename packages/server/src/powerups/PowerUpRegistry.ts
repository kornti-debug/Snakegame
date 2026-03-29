import type { Snake } from '../entities/Snake.js';

export interface PowerUpDefinition {
  id: string;
  displayName: string;
  spawnWeight: number;
  duration: number; // ms, 0 = instant
  onApply(snake: Snake): void;
  onExpire(snake: Snake): void;
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
