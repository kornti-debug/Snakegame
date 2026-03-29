import type { GameSnapshot } from '@snakegame/shared';
import { ARENA_WIDTH, ARENA_HEIGHT, PLAYER_COLORS } from '@snakegame/shared';
import { Snake } from './entities/Snake.js';
import { Obstacle } from './entities/Obstacle.js';
import { MovementSystem } from './systems/MovementSystem.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { RevealSystem } from './systems/RevealSystem.js';
import { PowerUpSystem } from './systems/PowerUpSystem.js';
import { RoundManager } from './RoundManager.js';

export class GameRoom {
  private players = new Map<string, Map<number, Snake>>();
  private tick = 0;
  private movementSystem = new MovementSystem();
  private collisionSystem = new CollisionSystem();
  readonly revealSystem = new RevealSystem();
  readonly powerUpSystem = new PowerUpSystem();
  readonly roundManager = new RoundManager();
  obstacles: Obstacle[] = [];
  private respawnTimers = new Map<string, number>();
  private colorCounter = 0;

  // Events emitted during update (consumed by SocketManager)
  pendingEvents: GameEvent[] = [];

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

  getAllSnakes(): Snake[] {
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
    this.pendingEvents = [];
    const snakes = this.getAllSnakes();

    // Round state machine
    const phaseChange = this.roundManager.update(dt);

    if (phaseChange === 'playing') {
      // New round started — reset everything
      this.resetForNewRound(snakes);
      this.pendingEvents.push({
        type: 'round-start',
        roundNumber: this.roundManager.roundNumber,
      });
    }

    if (phaseChange === 'ended') {
      // Round just ended — determine winner
      const revealScores = this.revealSystem.getRevealScores();
      let winner: { id: string; name: string; score: number } | null = null;
      let maxScore = 0;
      for (const snake of snakes) {
        const score = revealScores[snake.id] ?? 0;
        if (score > maxScore) {
          maxScore = score;
          winner = { id: snake.id, name: snake.name, score };
        }
      }
      this.pendingEvents.push({
        type: 'round-end',
        roundNumber: this.roundManager.roundNumber,
        winner,
        scores: revealScores,
      });
    }

    // Only run gameplay during playing phase
    if (this.roundManager.phase === 'playing') {
      // Respawn timers
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
      this.collisionSystem.update(snakes, this.obstacles);
      this.revealSystem.update(snakes);
      this.powerUpSystem.update(snakes, dt);

      // Update obstacles
      const dtMs = dt * 1000;
      for (const obstacle of this.obstacles) {
        obstacle.update(dtMs);
      }
      this.obstacles = this.obstacles.filter(o => !o.isExpired());

      // Queue respawn for dead snakes
      for (const snake of snakes) {
        if (!snake.alive && !this.respawnTimers.has(snake.id)) {
          this.respawnTimers.set(snake.id, 2);
        }
      }
    }
  }

  private resetForNewRound(snakes: Snake[]): void {
    this.revealSystem.reset();
    this.powerUpSystem.expireAll(snakes);
    this.powerUpSystem.reset();
    this.obstacles = [];
    this.respawnTimers.clear();

    for (const snake of snakes) {
      snake.resetForRound();
      const { pos, angle } = this.getSpawnPoint();
      snake.respawn(pos, angle);
    }
  }

  getSnapshot(): GameSnapshot {
    const snakes = this.getAllSnakes();
    const revealScores = this.revealSystem.getRevealScores();

    return {
      tick: this.tick,
      timestamp: Date.now(),
      snakes: snakes.map(s => s.toState()),
      arena: { width: ARENA_WIDTH, height: ARENA_HEIGHT },
      revealPercentage: this.revealSystem.getRevealPercentage(),
      round: this.roundManager.getRoundState(revealScores),
      powerUps: this.powerUpSystem.getFieldPowerUps().map(p => p.toState()),
      obstacles: this.obstacles.map(o => o.toState()),
    };
  }

  addObstacle(x: number, y: number, width: number, height: number, durationMs: number): void {
    this.obstacles.push(new Obstacle({ x, y }, width, height, durationMs));
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

export type GameEvent =
  | { type: 'round-start'; roundNumber: number }
  | { type: 'round-end'; roundNumber: number; winner: { id: string; name: string; score: number } | null; scores: Record<string, number> };
