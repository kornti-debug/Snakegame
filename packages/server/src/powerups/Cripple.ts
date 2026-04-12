import type { PowerUpDefinition } from './PowerUpRegistry.js';

/** Bonus powerup: all OTHER snakes become slow and steer badly for 4s. */
export const Cripple: PowerUpDefinition = {
  id: 'cripple',
  displayName: 'Cripple',
  spawnWeight: 0,
  duration: 4000,
  kind: 'active',
  onApply(_self, others) {
    for (const o of others) {
      o.crippled = true;
      o.speed = o.baseSpeed * 0.45;
      o.turnRate = o.baseTurnRate * 0.3;
    }
  },
  onExpire(_self, others) {
    for (const o of others) {
      o.crippled = false;
      if (o.alive) {
        o.speed = o.baseSpeed;
        o.turnRate = o.baseTurnRate;
      }
    }
  },
  renderHint: { color: '#B088FF', shape: 'diamond' },
};
