import type { PowerUpDefinition } from './PowerUpRegistry.js';

/** Passive: +20% turn rate per stack. Tighter turns for the rest of the round. */
export const Steering: PowerUpDefinition = {
  id: 'steering',
  displayName: 'Steering',
  spawnWeight: 4,
  duration: 0,
  kind: 'passive',
  onApply(snake) {
    snake.passiveStacks['steering'] = (snake.passiveStacks['steering'] ?? 0) + 1;
    snake.recomputeBase();
    // No active effect touches turnRate, so we can safely mirror baseline.
    snake.turnRate = snake.baseTurnRate;
  },
  onExpire() {},
  renderHint: { color: '#88CCFF', shape: 'diamond' },
};
