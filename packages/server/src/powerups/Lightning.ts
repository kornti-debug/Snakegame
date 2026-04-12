import type { PowerUpDefinition } from './PowerUpRegistry.js';
import { SNAKE_RADIUS } from '@snakegame/shared';

/** Bonus powerup: all OTHER snakes shrink for 5 seconds. Smaller hitbox
 *  means they also hit less with their heads — more dodging, less capture. */
export const Lightning: PowerUpDefinition = {
  id: 'lightning',
  displayName: 'Lightning',
  spawnWeight: 0,
  duration: 5000,
  kind: 'active',
  onApply(_self, others) {
    for (const o of others) {
      o.shrunken = true;
      o.radius = SNAKE_RADIUS * 0.5;
    }
  },
  onExpire(_self, others) {
    for (const o of others) {
      o.shrunken = false;
      o.radius = SNAKE_RADIUS;
    }
  },
  renderHint: { color: '#FFDD00', shape: 'star' },
};
