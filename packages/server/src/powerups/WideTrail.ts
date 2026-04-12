import type { PowerUpDefinition } from './PowerUpRegistry.js';
import { REVEAL_BRUSH_RADIUS, WIDE_TRAIL_MULTIPLIER, WIDE_TRAIL_DURATION } from '@snakegame/shared';

export const WideTrail: PowerUpDefinition = {
  id: 'wide-trail',
  displayName: 'Wide Trail',
  spawnWeight: 8,
  duration: WIDE_TRAIL_DURATION,
  kind: 'active',
  onApply(snake) {
    snake.revealRadius = REVEAL_BRUSH_RADIUS * WIDE_TRAIL_MULTIPLIER;
  },
  onExpire(snake) {
    snake.revealRadius = REVEAL_BRUSH_RADIUS;
  },
  renderHint: { color: '#44ffaa', shape: 'diamond' },
};
