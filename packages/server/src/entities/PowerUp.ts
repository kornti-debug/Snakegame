import { v4 as uuid } from 'uuid';
import type { Vector2D, PowerUpState } from '@snakegame/shared';
import type { PowerUpDefinition } from '../powerups/PowerUpRegistry.js';

export class PowerUp {
  readonly id: string;
  readonly type: string;
  readonly position: Vector2D;
  readonly definition: PowerUpDefinition;
  collected = false;

  constructor(definition: PowerUpDefinition, position: Vector2D) {
    this.id = uuid();
    this.type = definition.id;
    this.definition = definition;
    this.position = position;
  }

  toState(): PowerUpState {
    return {
      id: this.id,
      type: this.type,
      position: this.position,
      renderHint: this.definition.renderHint,
    };
  }
}
