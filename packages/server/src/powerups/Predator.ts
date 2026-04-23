import type { PowerUpDefinition } from './PowerUpRegistry.js';
import { TUNING } from '../config/tuning.js';

export const Predator: PowerUpDefinition = {
  id: 'predator',
  displayName: 'Predator',
  get spawnWeight() { return TUNING.powerups.predator.spawnWeight; },
  get duration()    { return TUNING.powerups.predator.durationMs; },
  kind: 'active',
  onApply(snake) {
    snake.predator = true;
  },
  onExpire(snake) {
    snake.predator = false;
  },
  renderHint: { color: '#FF4466', shape: 'circle' },
};
