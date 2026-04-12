import type { GameSnapshot, GamePhase, LobbyPlayer, Vector2D, BoardPreset } from '@snakegame/shared';
import { ARENA_WIDTH, ARENA_HEIGHT, PLAYER_COLORS, MAX_PLAYERS, COST_POWERUP, COST_OBSTACLE, COST_HINT, REWARD_CORRECT_GUESS, BOID_REVEAL_RADIUS, BOARD_PRESETS, DEFAULT_BOARD_PRESET, cellToPixel, isValidCell } from '@snakegame/shared';
import { Snake } from './entities/Snake.js';
import { Obstacle } from './entities/Obstacle.js';
import { PowerUp } from './entities/PowerUp.js';
import { MovementSystem } from './systems/MovementSystem.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { RevealSystem } from './systems/RevealSystem.js';
import { PowerUpSystem } from './systems/PowerUpSystem.js';
import { MemoryBoardSystem } from './systems/MemoryBoardSystem.js';
import { BoidSystem } from './systems/BoidSystem.js';
import { CreditSystem } from './systems/CreditSystem.js';
import { RoundManager } from './RoundManager.js';
import { ImageManager } from './api/ImageManager.js';
import { getDefaultSymbols, type SymbolDef } from './systems/SymbolGenerator.js';

export class GameRoom {
  gamePhase: GamePhase = 'lobby';

  // Lobby state
  private lobbyPlayers = new Map<string, LobbyPlayer>(); // key: "socketId:playerIndex"

  // In-game state
  private players = new Map<string, Map<number, Snake>>();
  private tick = 0;
  private movementSystem = new MovementSystem();
  private collisionSystem = new CollisionSystem();
  readonly revealSystem = new RevealSystem();
  readonly powerUpSystem = new PowerUpSystem();
  readonly memoryBoardSystem = new MemoryBoardSystem();
  readonly boidSystem = new BoidSystem();
  readonly creditSystem = new CreditSystem();
  readonly roundManager = new RoundManager();
  readonly imageManager: ImageManager;
  obstacles: Obstacle[] = [];
  private respawnTimers = new Map<string, number>();

  // Custom tile symbols from TD (null = use defaults)
  private customSymbols: SymbolDef[] | null = null;

  // Board preset chosen in lobby (applied at round start)
  boardPreset: BoardPreset = DEFAULT_BOARD_PRESET;

  // Sockets that joined via phone QR — cannot pause/kick. Used to gate
  // host-only actions so only the projector (keyboard) client can control them.
  private phoneSockets = new Set<string>();

  paused = false;

  pendingEvents: GameEvent[] = [];

  constructor(uploadDir: string) {
    this.imageManager = new ImageManager(uploadDir);
  }

  // --- Lobby ---

  lobbyJoin(socketId: string, playerIndex: number, name: string, kind: 'keyboard' | 'phone' = 'keyboard'): void {
    const key = `${socketId}:${playerIndex}`;
    const colorIdx = this.lobbyPlayers.size % PLAYER_COLORS.length;
    this.lobbyPlayers.set(key, {
      index: playerIndex,
      name,
      color: PLAYER_COLORS[colorIdx],
      ready: false,
      kind,
    });
  }

  /** Allocate the lowest free global slot (0..MAX-1) for a phone client.
   *  Returns { index, color } or null if full. Registers the phone as
   *  a normal lobby player under its own socket. */
  phoneJoin(socketId: string, name: string = 'Phone', maxSlots: number = MAX_PLAYERS): { index: number; color: string } | null {
    if (this.gamePhase !== 'lobby') return null;
    const used = new Set<number>();
    for (const p of this.lobbyPlayers.values()) used.add(p.index);
    for (let i = 0; i < maxSlots; i++) {
      if (used.has(i)) continue;
      this.lobbyJoin(socketId, i, name, 'phone');
      this.phoneSockets.add(socketId);
      const joined = this.lobbyPlayers.get(`${socketId}:${i}`);
      return { index: i, color: joined?.color ?? PLAYER_COLORS[i % PLAYER_COLORS.length] };
    }
    return null;
  }

  isPhoneSocket(socketId: string): boolean {
    return this.phoneSockets.has(socketId);
  }

  /** Kick any player (by global slot index). Removes lobby entry + kills snake
   *  + drops any respawn timer. Returns true if a slot was kicked. */
  kickSlot(slotIndex: number): boolean {
    let kicked = false;
    for (const [key, p] of [...this.lobbyPlayers]) {
      if (p.index !== slotIndex) continue;
      const socketId = key.split(':')[0];
      this.lobbyPlayers.delete(key);
      this.phoneSockets.delete(socketId);
      const playerMap = this.players.get(socketId);
      if (playerMap) {
        const snake = playerMap.get(p.index);
        if (snake) {
          snake.alive = false;
          this.respawnTimers.delete(snake.id);
          playerMap.delete(p.index);
        }
        if (playerMap.size === 0) this.players.delete(socketId);
      }
      kicked = true;
    }
    return kicked;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  lobbyLeave(socketId: string, playerIndex: number): void {
    this.lobbyPlayers.delete(`${socketId}:${playerIndex}`);
  }

  /** Clean exit for a single player slot: removes lobby entry, phone mark,
   *  and (if a game is running) kills the snake + drops the respawn timer. */
  playerLeave(socketId: string, playerIndex: number): void {
    this.lobbyLeave(socketId, playerIndex);
    const playerMap = this.players.get(socketId);
    if (playerMap) {
      const snake = playerMap.get(playerIndex);
      if (snake) {
        snake.alive = false;
        this.respawnTimers.delete(snake.id);
        playerMap.delete(playerIndex);
      }
      if (playerMap.size === 0) this.players.delete(socketId);
    }
    // If this was the only slot this phone had, clear its phone mark.
    const stillHas = [...this.lobbyPlayers.keys()].some(k => k.startsWith(`${socketId}:`));
    if (!stillHas) this.phoneSockets.delete(socketId);
  }

  lobbyLeaveAll(socketId: string): void {
    for (const key of [...this.lobbyPlayers.keys()]) {
      if (key.startsWith(`${socketId}:`)) {
        this.lobbyPlayers.delete(key);
      }
    }
  }

  lobbySetReady(socketId: string, playerIndex: number): void {
    const p = this.lobbyPlayers.get(`${socketId}:${playerIndex}`);
    if (p) p.ready = !p.ready;
  }

  lobbySetColor(socketId: string, playerIndex: number, color: string): void {
    const p = this.lobbyPlayers.get(`${socketId}:${playerIndex}`);
    if (p) p.color = color;
  }

  lobbySetName(socketId: string, playerIndex: number, name: string): void {
    const p = this.lobbyPlayers.get(`${socketId}:${playerIndex}`);
    if (p) p.name = name;
  }

  getLobbyPlayers(): LobbyPlayer[] {
    return [...this.lobbyPlayers.values()];
  }

  startGame(): void {
    if (this.lobbyPlayers.size === 0) return;

    this.gamePhase = 'ingame';
    this.paused = false;
    this.players.clear();
    this.tick = 0;

    // Create snakes from lobby players — visible during countdown
    for (const [key, lobbyPlayer] of this.lobbyPlayers) {
      const socketId = key.split(':')[0];
      const { pos, angle } = this.getSpawnPoint();
      const snake = new Snake(lobbyPlayer.name, lobbyPlayer.color, pos, angle);

      if (!this.players.has(socketId)) {
        this.players.set(socketId, new Map());
      }
      this.players.get(socketId)!.set(lobbyPlayer.index, snake);
    }

    // Reset round manager to start fresh
    this.roundManager.phase = 'waiting';
    this.roundManager.roundNumber = 0;
    this.roundManager.timeRemainingMs = 3000; // shorter first wait
    this.revealSystem.reset();
    this.powerUpSystem.reset();
    this.memoryBoardSystem.reset();
    this.obstacles = [];
    this.respawnTimers.clear();

    // Initialize credit system with snake roster
    const snakes = this.getAllSnakes();
    const snakeIds = snakes.map(s => s.id);
    const snakeColors = new Map(snakes.map(s => [s.id, s.color]));
    this.creditSystem.resetTeamCounts(snakeIds);
    this.creditSystem.updateSnakeColors(snakeColors);
  }

  returnToLobby(): void {
    this.gamePhase = 'lobby';
    this.paused = false;
    this.players.clear();
    this.respawnTimers.clear();
    this.revealSystem.reset();
    this.powerUpSystem.reset();
    this.memoryBoardSystem.setConfig(BOARD_PRESETS[this.boardPreset]);
    this.memoryBoardSystem.reset();
    this.obstacles = [];
    // Keep lobby players as-is
    for (const p of this.lobbyPlayers.values()) {
      p.ready = false;
    }
  }

  // --- In-game ---

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
    this.phoneSockets.delete(socketId);
    this.lobbyLeaveAll(socketId);
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

    if (this.gamePhase !== 'ingame') return;
    // When paused, freeze everything — round timer, movement, reveals, respawns.
    if (this.paused) return;

    const snakes = this.getAllSnakes();

    // Round state machine
    const phaseChange = this.roundManager.update(dt);

    if (phaseChange === 'playing') {
      this.resetForNewRound(snakes);
      const symbols = this.customSymbols ?? getDefaultSymbols();
      this.memoryBoardSystem.setConfig(BOARD_PRESETS[this.boardPreset]);
      this.memoryBoardSystem.generateBoard(symbols);

      this.pendingEvents.push({
        type: 'round-start',
        roundNumber: this.roundManager.roundNumber,
        tiles: this.memoryBoardSystem.getTiles(),
      });
    }

    if (phaseChange === 'ended') {
      const pairScores = this.memoryBoardSystem.getPairScores();
      let winner: { id: string; name: string; score: number } | null = null;
      let maxScore = 0;
      for (const snake of snakes) {
        const score = pairScores[snake.id] ?? 0;
        if (score > maxScore) {
          maxScore = score;
          winner = { id: snake.id, name: snake.name, score };
        }
      }
      this.pendingEvents.push({
        type: 'round-end',
        roundNumber: this.roundManager.roundNumber,
        winner,
        scores: this.revealSystem.getRevealScores(),
        pairScores,
      });
    }

    if (this.roundManager.phase === 'playing') {
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
      this.powerUpSystem.update(snakes, dt);

      // Boid AI swarm update
      this.boidSystem.update(dt, snakes);

      // Boid-snake collision: boids kill snakes on touch (unless starred/ghosting)
      for (const snake of snakes) {
        if (this.boidSystem.checkSnakeBoidCollision(snake)) {
          snake.kill();
        }
      }

      // Reveal system: snake heads + boid reveals (all in one pass)
      this.revealSystem.update(snakes);

      // Boid reveals: boids following a swarm leader reveal for that leader's team
      for (const boid of this.boidSystem.getRevealableBoids()) {
        if (boid.leaderId) {
          this.revealSystem.revealAt(boid.x, boid.y, BOID_REVEAL_RADIUS, boid.leaderId);
        }
      }

      // Memory board: process ALL reveals once (snake + boid), check captures/matches
      this.memoryBoardSystem.update(this.revealSystem, snakes);

      // Convert memory board events to game events
      for (const evt of this.memoryBoardSystem.flushEvents()) {
        if (evt.type === 'tile-captured') {
          this.pendingEvents.push({
            type: 'tile-captured',
            tileId: evt.tileId!,
            symbolName: evt.symbolName,
            capturedBy: evt.snakeId,
            capturedColor: evt.snakeColor,
          });
        } else if (evt.type === 'pair-matched') {
          this.pendingEvents.push({
            type: 'pair-matched',
            pairId: evt.pairId!,
            symbolName: evt.symbolName,
            matchedBy: evt.snakeId,
            matchedByColor: evt.snakeColor,
          });
        }
      }

      // Check if all pairs matched → end round early
      if (this.memoryBoardSystem.isRoundComplete()) {
        this.roundManager.forceEndRound();
      }

      const dtMs = dt * 1000;
      for (const obstacle of this.obstacles) {
        obstacle.update(dtMs);
      }
      this.obstacles = this.obstacles.filter(o => !o.isExpired());

      for (const snake of snakes) {
        if (!snake.alive && !this.respawnTimers.has(snake.id)) {
          this.respawnTimers.set(snake.id, 2);
        }
      }
    }
  }

  private resetForNewRound(snakes: Snake[]): void {
    const isFirstRound = this.roundManager.roundNumber === 1;

    this.revealSystem.reset();
    this.revealSystem.setSnakeIndexMap(snakes);
    this.powerUpSystem.expireAll(snakes);
    this.powerUpSystem.reset();
    this.boidSystem.reset();
    this.boidSystem.spawnInitial();
    this.obstacles = [];
    this.respawnTimers.clear();

    for (const snake of snakes) {
      snake.resetForRound();
      if (!isFirstRound) {
        const { pos, angle } = this.getSpawnPoint();
        snake.respawn(pos, angle);
      } else {
        snake.alive = true;
      }
    }
  }

  getSnapshot(): GameSnapshot {
    const snakes = this.getAllSnakes();
    const revealScores = this.revealSystem.getRevealScores();
    const pairScores = this.memoryBoardSystem.getPairScores();

    // Update effect drain info on each snake before serializing
    for (const snake of snakes) {
      snake.effectDrain = this.powerUpSystem.getEffectDrains(snake.id);
    }

    return {
      tick: this.tick,
      timestamp: Date.now(),
      gamePhase: this.gamePhase,
      snakes: snakes.map(s => s.toState()),
      arena: { width: ARENA_WIDTH, height: ARENA_HEIGHT },
      revealPercentage: this.revealSystem.getRevealPercentage(),
      round: this.roundManager.getRoundState(revealScores, pairScores),
      powerUps: this.powerUpSystem.getFieldPowerUps().map(p => p.toState()),
      obstacles: this.obstacles.map(o => o.toState()),
      boids: this.boidSystem.getBoidStates(),
      lobbyPlayers: this.getLobbyPlayers(),
      memoryBoard: this.memoryBoardSystem.getBoardState(),
      hints: this.memoryBoardSystem.getHints(),
      boardPreset: this.boardPreset,
      paused: this.paused,
    };
  }

  addObstacle(x: number, y: number, width: number, height: number, durationMs: number): void {
    this.obstacles.push(new Obstacle({ x, y }, width, height, durationMs));
  }

  spawnPowerUpAt(type: string, position: Vector2D): boolean {
    const def = this.powerUpSystem.registry.get(type);
    if (!def) return false;
    const pu = new PowerUp(def, position);
    this.powerUpSystem.getFieldPowerUps().push(pu);
    return true;
  }

  /** Set custom tile symbols from Touch Designer */
  setCustomSymbols(symbols: SymbolDef[]): void {
    this.customSymbols = symbols;
  }

  /** Handle viewer symbol guess (for credit economy) */
  handleViewerGuess(viewerName: string, symbolName: string): { correct: boolean; creditsEarned: number } {
    const guessable = this.memoryBoardSystem.getGuessableSymbols();
    const correct = guessable.some(s => s.toLowerCase() === symbolName.trim().toLowerCase());
    let creditsEarned = 0;
    if (correct) {
      creditsEarned = REWARD_CORRECT_GUESS;
      this.creditSystem.earnCredits(viewerName, creditsEarned);
    }
    return { correct, creditsEarned };
  }

  /** Handle viewer hint request */
  handleHint(viewerName: string, symbolName: string): { ok: boolean; reason?: string } {
    if (!this.creditSystem.spendCredits(viewerName, COST_HINT)) {
      return { ok: false, reason: 'Insufficient credits' };
    }
    const activated = this.memoryBoardSystem.activateHint(symbolName);
    if (!activated) {
      // Refund
      this.creditSystem.earnCredits(viewerName, COST_HINT);
      return { ok: false, reason: 'Symbol not found or already matched/hinted' };
    }
    const pair = this.memoryBoardSystem.getBoardState().pairs.find(
      p => p.symbolName.toLowerCase() === symbolName.toLowerCase()
    );
    if (pair) {
      this.pendingEvents.push({
        type: 'hint-active',
        pairId: pair.pairId,
        symbolName: pair.symbolName,
        tileIds: pair.tileIds,
      });
    }
    return { ok: true };
  }

  /** Handle viewer powerup placement */
  handleViewerPowerUp(viewerName: string, cell: string, type: string): boolean {
    if (!this.creditSystem.spendCredits(viewerName, COST_POWERUP)) return false;
    if (!isValidCell(cell)) {
      this.creditSystem.earnCredits(viewerName, COST_POWERUP);
      return false;
    }
    const pos = cellToPixel(cell)!;
    return this.spawnPowerUpAt(type, pos);
  }

  /** Handle viewer obstacle placement */
  handleViewerObstacle(viewerName: string, cell: string, durationMs?: number): boolean {
    if (!this.creditSystem.spendCredits(viewerName, COST_OBSTACLE)) return false;
    if (!isValidCell(cell)) {
      this.creditSystem.earnCredits(viewerName, COST_OBSTACLE);
      return false;
    }
    const pos = cellToPixel(cell)!;
    this.addObstacle(pos.x - 40, pos.y - 10, 80, 20, durationMs ?? 15000);
    return true;
  }

  handleCorrectGuess(viewerName: string): void {
    if (this.roundManager.phase !== 'playing') return;
    this.pendingEvents.push({
      type: 'guess-correct',
      viewerName,
      word: '',
    });
    this.roundManager.forceEndRound();
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
  | { type: 'round-start'; roundNumber: number; tiles: import('@snakegame/shared').MemoryTile[] }
  | { type: 'round-end'; roundNumber: number; winner: { id: string; name: string; score: number } | null; scores: Record<string, number>; pairScores: Record<string, number> }
  | { type: 'tile-captured'; tileId: number; symbolName: string; capturedBy: string; capturedColor: string }
  | { type: 'pair-matched'; pairId: number; symbolName: string; matchedBy: string; matchedByColor: string }
  | { type: 'hint-active'; pairId: number; symbolName: string; tileIds: [number, number] }
  | { type: 'guess-correct'; viewerName: string; word: string };
