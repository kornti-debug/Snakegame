import type { PowerUpDefinition } from './PowerUpRegistry.js';
import { TUNING } from '../config/tuning.js';

export const SpeedBoost: PowerUpDefinition = {
  id: 'speed-boost',
  displayName: 'Speed Boost',
  get spawnWeight() { return TUNING.powerups.speedBoost.spawnWeight; },
  get duration()    { return TUNING.powerups.speedBoost.durationMs; },
  kind: 'active',
  onApply(snake) {
    snake.speed = snake.baseSpeed * TUNING.powerups.speedBoost.multiplier;
  },
  onExpire(snake) {
    snake.speed = snake.baseSpeed;
  },
  renderHint: { color: '#ffaa00', shape: 'circle' },
};
