import type { PowerUpDefinition } from './PowerUpRegistry.js';
import { SPEED_BOOST_MULTIPLIER, SPEED_BOOST_DURATION } from '@snakegame/shared';

export const SpeedBoost: PowerUpDefinition = {
  id: 'speed-boost',
  displayName: 'Speed Boost',
  spawnWeight: 10,
  duration: SPEED_BOOST_DURATION,
  kind: 'active',
  onApply(snake) {
    snake.speed = snake.baseSpeed * SPEED_BOOST_MULTIPLIER;
  },
  onExpire(snake) {
    snake.speed = snake.baseSpeed;
  },
  renderHint: { color: '#ffaa00', shape: 'circle' },
};
