import type { PowerUpDefinition } from './PowerUpRegistry.js';

export const Growth: PowerUpDefinition = {
  id: 'growth',
  displayName: 'Growth',
  spawnWeight: 3, // rare — permanent effect
  duration: 0, // instant
  onApply(snake) {
    snake.revealRadius *= 1.2; // +20%, stacks
  },
  onExpire() {
    // No expiry — permanent
  },
  renderHint: { color: '#44FF88', shape: 'circle' },
};
