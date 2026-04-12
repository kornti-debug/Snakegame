import type { PowerUpDefinition } from './PowerUpRegistry.js';

export const Growth: PowerUpDefinition = {
  id: 'growth',
  displayName: 'Growth',
  spawnWeight: 3,
  duration: 0,
  kind: 'passive',
  onApply(snake) {
    // +20% reveal radius per stack, persists until end of round.
    snake.passiveStacks['growth'] = (snake.passiveStacks['growth'] ?? 0) + 1;
    snake.recomputeBase();
    // If no active WideTrail is running, mirror the new baseline now.
    if (snake.activeEffect !== 'wide-trail') snake.revealRadius = snake.baseRevealRadius;
  },
  onExpire() {},
  renderHint: { color: '#44FF88', shape: 'circle' },
};
