import type { PowerUpDefinition } from './PowerUpRegistry.js';
import { PREDATOR_DURATION } from '@snakegame/shared';

export const Predator: PowerUpDefinition = {
  id: 'predator',
  displayName: 'Predator',
  spawnWeight: 5,
  duration: PREDATOR_DURATION,
  kind: 'active',
  onApply(snake) {
    snake.predator = true;
  },
  onExpire(snake) {
    snake.predator = false;
  },
  renderHint: { color: '#FF4466', shape: 'circle' },
};
