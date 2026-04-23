import type { PowerUpDefinition } from './PowerUpRegistry.js';
import { TUNING } from '../config/tuning.js';

export const SwarmLeader: PowerUpDefinition = {
  id: 'swarm-leader',
  displayName: 'Swarm Leader',
  get spawnWeight() { return TUNING.powerups.swarmLeader.spawnWeight; },
  get duration()    { return TUNING.powerups.swarmLeader.durationMs; },
  kind: 'active',
  onApply(snake) {
    snake.swarmLeader = true;
  },
  onExpire(snake) {
    snake.swarmLeader = false;
  },
  renderHint: { color: '#44FFAA', shape: 'diamond' },
};
