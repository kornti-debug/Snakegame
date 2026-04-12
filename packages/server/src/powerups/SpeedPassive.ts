import type { PowerUpDefinition } from './PowerUpRegistry.js';

/** Passive: +10% speed per stack. Persists until end of round. */
export const SpeedPassive: PowerUpDefinition = {
  id: 'speed',
  displayName: 'Speed+',
  spawnWeight: 4,
  duration: 0,
  kind: 'passive',
  onApply(snake) {
    snake.passiveStacks['speed'] = (snake.passiveStacks['speed'] ?? 0) + 1;
    snake.recomputeBase();
    // Update current speed only if no SpeedBoost is currently running.
    if (snake.activeEffect !== 'speed-boost') snake.speed = snake.baseSpeed;
  },
  onExpire() {},
  renderHint: { color: '#FFAA44', shape: 'circle' },
};
