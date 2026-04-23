import type { PowerUpDefinition } from './PowerUpRegistry.js';
import { TUNING } from '../config/tuning.js';

export const WideTrail: PowerUpDefinition = {
  id: 'wide-trail',
  displayName: 'Wide Trail',
  get spawnWeight() { return TUNING.powerups.wideTrail.spawnWeight; },
  get duration()    { return TUNING.powerups.wideTrail.durationMs; },
  kind: 'active',
  onApply(snake) {
    snake.revealRadius = snake.baseRevealRadius * TUNING.powerups.wideTrail.multiplier;
  },
  onExpire(snake) {
    snake.revealRadius = snake.baseRevealRadius;
  },
  renderHint: { color: '#44ffaa', shape: 'diamond' },
};
