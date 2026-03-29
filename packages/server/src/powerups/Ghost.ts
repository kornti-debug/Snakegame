import type { PowerUpDefinition } from './PowerUpRegistry.js';
import { GHOST_DURATION } from '@snakegame/shared';

export const Ghost: PowerUpDefinition = {
  id: 'ghost',
  displayName: 'Ghost',
  spawnWeight: 5,
  duration: GHOST_DURATION,
  onApply(snake) {
    snake.ghosting = true;
  },
  onExpire(snake) {
    snake.ghosting = false;
  },
  renderHint: { color: '#aaaaff', shape: 'star' },
};
