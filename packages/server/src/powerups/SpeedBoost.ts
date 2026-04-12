import type { PowerUpDefinition } from './PowerUpRegistry.js';
import { SNAKE_SPEED, SPEED_BOOST_MULTIPLIER, SPEED_BOOST_DURATION } from '@snakegame/shared';

export const SpeedBoost: PowerUpDefinition = {
  id: 'speed-boost',
  displayName: 'Speed Boost',
  spawnWeight: 10,
  duration: SPEED_BOOST_DURATION,
  kind: 'active',
  onApply(snake) {
    snake.speed = SNAKE_SPEED * SPEED_BOOST_MULTIPLIER;
  },
  onExpire(snake) {
    snake.speed = SNAKE_SPEED;
  },
  renderHint: { color: '#ffaa00', shape: 'circle' },
};
