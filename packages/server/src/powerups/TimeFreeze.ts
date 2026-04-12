import type { PowerUpDefinition } from './PowerUpRegistry.js';

/** Bonus powerup: all OTHER snakes stop moving for 3 seconds. Obtained
 *  only from matching the bonus pair — spawnWeight 0 so it never lands
 *  as a normal field pickup. */
export const TimeFreeze: PowerUpDefinition = {
  id: 'time-freeze',
  displayName: 'Time Freeze',
  spawnWeight: 0,
  duration: 3000,
  kind: 'active',
  onApply(_self, others) {
    for (const o of others) {
      o.frozen = true;
      o.speed = 0;
    }
  },
  onExpire(_self, others) {
    for (const o of others) {
      o.frozen = false;
      // Restore to baseline. A loser who had their own active running
      // when frozen loses it — "stronger effect wins" is the design.
      if (o.alive) o.speed = o.baseSpeed;
    }
  },
  renderHint: { color: '#88E0FF', shape: 'star' },
};
