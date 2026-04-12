import type { PowerUpDefinition } from './PowerUpRegistry.js';
import { WIDE_TRAIL_MULTIPLIER, WIDE_TRAIL_DURATION } from '@snakegame/shared';

export const WideTrail: PowerUpDefinition = {
  id: 'wide-trail',
  displayName: 'Wide Trail',
  spawnWeight: 8,
  duration: WIDE_TRAIL_DURATION,
  kind: 'active',
  onApply(snake) {
    snake.revealRadius = snake.baseRevealRadius * WIDE_TRAIL_MULTIPLIER;
  },
  onExpire(snake) {
    snake.revealRadius = snake.baseRevealRadius;
  },
  renderHint: { color: '#44ffaa', shape: 'diamond' },
};
