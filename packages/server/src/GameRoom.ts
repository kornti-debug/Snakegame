import type { GameSnapshot } from '@snakegame/shared';
import { ARENA_WIDTH, ARENA_HEIGHT, PLAYER_COLORS } from '@snakegame/shared';
import { Snake } from './entities/Snake.js';
import { MovementSystem } from './systems/MovementSystem.js';
import { CollisionSystem } from './systems/CollisionSystem.js';

export class GameRoom {
  // Map<socketId, Map<playerIndex, Snake>>
  private players = new Map<string, Map<number, Snake>>();
  private tick = 0;
  private movementSystem = new MovementSystem();
  private collisionSystem = new CollisionSystem();
  private respawnTimers = new Map<string, number>(); // snakeId -> timer
  private colorCounter = 0;

  addPlayer(socketId: string, playerIndex: number, name: string): Snake {
    const color = PLAYER_COLORS[this.colorCounter % PLAYER_COLORS.length];
    this.colorCounter++;
    const { pos, angle } = this.getSpawnPoint();
    const snake = new Snake(name, color, pos, angle);

    if (!this.players.has(socketId)) {
      this.players.set(socketId, new Map());
    }
    this.players.get(socketId)!.set(playerIndex, snake);
    return snake;
  }

  getSnake(socketId: string, playerIndex: number): Snake | undefined {
    return this.players.get(socketId)?.get(playerIndex);
  }

  removeAllPlayers(socketId: string): void {
    const playerMap = this.players.get(socketId);
    if (playerMap) {
      for (const snake of playerMap.values()) {
        this.respawnTimers.delete(snake.id);
      }
    }
    this.players.delete(socketId);
  }

  private getAllSnakes(): Snake[] {
    const all: Snake[] = [];
    for (const playerMap of this.players.values()) {
      for (const snake of playerMap.values()) {
        all.push(snake);
      }
    }
    return all;
  }

  update(dt: number): void {
    this.tick++;
    const snakes = this.getAllSnakes();

    // Update respawn timers
    for (const [snakeId, timer] of this.respawnTimers) {
      const remaining = timer - dt;
      if (remaining <= 0) {
        const snake = snakes.find(s => s.id === snakeId);
        if (snake) {
          const { pos, angle } = this.getSpawnPoint();
          snake.respawn(pos, angle);
        }
        this.respawnTimers.delete(snakeId);
      } else {
        this.respawnTimers.set(snakeId, remaining);
      }
    }

    this.movementSystem.update(snakes, dt);
    this.collisionSystem.update(snakes);

    // Queue respawn for dead snakes
    for (const snake of snakes) {
      if (!snake.alive && !this.respawnTimers.has(snake.id)) {
        this.respawnTimers.set(snake.id, 2); // 2 seconds respawn
      }
    }
  }

  getSnapshot(): GameSnapshot {
    return {
      tick: this.tick,
      timestamp: Date.now(),
      snakes: this.getAllSnakes().map(s => s.toState()),
      arena: { width: ARENA_WIDTH, height: ARENA_HEIGHT },
    };
  }

  get snakeCount(): number {
    return this.getAllSnakes().length;
  }

  private getSpawnPoint(): { pos: { x: number; y: number }; angle: number } {
    const margin = 200;
    return {
      pos: {
        x: margin + Math.random() * (ARENA_WIDTH - margin * 2),
        y: margin + Math.random() * (ARENA_HEIGHT - margin * 2),
      },
      angle: Math.random() * Math.PI * 2,
    };
  }
}
