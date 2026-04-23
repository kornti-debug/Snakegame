import type { PowerUpDefinition } from './PowerUpRegistry.js';
import { TUNING } from '../config/tuning.js';

export const Ghost: PowerUpDefinition = {
  id: 'ghost',
  displayName: 'Ghost',
  get spawnWeight() { return TUNING.powerups.ghost.spawnWeight; },
  get duration()    { return TUNING.powerups.ghost.durationMs; },
  kind: 'active',
  onApply(snake) {
    snake.ghosting = true;
  },
  onExpire(snake) {
    snake.ghosting = false;
  },
  renderHint: { color: '#aaaaff', shape: 'star' },
};
