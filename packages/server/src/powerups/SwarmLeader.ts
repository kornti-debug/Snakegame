import type { PowerUpDefinition } from './PowerUpRegistry.js';
import { SWARM_LEADER_DURATION } from '@snakegame/shared';

export const SwarmLeader: PowerUpDefinition = {
  id: 'swarm-leader',
  displayName: 'Swarm Leader',
  spawnWeight: 4,
  duration: SWARM_LEADER_DURATION,
  kind: 'active',
  onApply(snake) {
    snake.swarmLeader = true;
  },
  onExpire(snake) {
    snake.swarmLeader = false;
  },
  renderHint: { color: '#44FFAA', shape: 'diamond' },
};
