import type { PowerUpDefinition } from './PowerUpRegistry.js';
import { TUNING } from '../config/tuning.js';

export const Star: PowerUpDefinition = {
  id: 'star',
  displayName: 'Star',
  get spawnWeight() { return TUNING.powerups.star.spawnWeight; },
  get duration()    { return TUNING.powerups.star.durationMs; },
  kind: 'active',
  onApply(snake) {
    snake.starred = true;
    snake.ghosting = true; // also ghost while starred (immune to walls/snakes)
  },
  onExpire(snake) {
    snake.starred = false;
    snake.ghosting = false;
  },
  renderHint: { color: '#FFD700', shape: 'star' },
};
