import type { PowerUpDefinition } from './PowerUpRegistry.js';
import { STAR_DURATION } from '@snakegame/shared';

export const Star: PowerUpDefinition = {
  id: 'star',
  displayName: 'Star',
  spawnWeight: 3, // rare
  duration: STAR_DURATION,
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
