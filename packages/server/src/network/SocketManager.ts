import { Server as HttpServer } from 'http';
import { Namespace, Server } from 'socket.io';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '@snakegame/shared';
import { cellToPixel, isValidCell } from '@snakegame/shared';
import type { GameRoom } from '../GameRoom.js';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export class SocketManager {
  readonly io: TypedServer;
  private tdNamespace: Namespace;
  private lastRevealMilestone = 0;

  constructor(httpServer: HttpServer, private room: GameRoom, apiKey: string = '') {
    this.io = new Server(httpServer, {
      cors: { origin: '*' },
    });

    // --- Game client namespace (default /) ---
    this.io.on('connection', (socket) => {
      console.log(`[Socket] Connected: ${socket.id}`);
      socket.data.playerIds = [];

      socket.on('player:join', ({ name, playerIndex }) => {
        if (this.room.gamePhase === 'lobby') {
          this.room.lobbyJoin(socket.id, playerIndex, name);
          console.log(`[Lobby] ${name} joined as Player ${playerIndex + 1}`);
        }
      });

      socket.on('player:leave', (playerIndex) => {
        this.room.playerLeave(socket.id, playerIndex);
      });

      socket.on('player:ready', (playerIndex) => {
        this.room.lobbySetReady(socket.id, playerIndex);
      });

      socket.on('player:set-color', (playerIndex, color) => {
        this.room.lobbySetColor(socket.id, playerIndex, color);
      });

      socket.on('player:set-name', (playerIndex, name) => {
        this.room.lobbySetName(socket.id, playerIndex, name);
      });

      socket.on('player:set-team', (playerIndex, team) => {
        this.room.lobbySetTeam(socket.id, playerIndex, team);
      });

      socket.on('lobby:start-game', () => {
        if (this.room.gamePhase === 'lobby') {
          this.room.startGame();
          console.log('[Game] Starting game!');
        }
      });

      socket.on('phone:join', ({ name }) => {
        const result = this.room.phoneJoin(socket.id, name?.trim() || `Phone ${socket.id.slice(0, 4)}`);
        if (!result) {
          socket.emit('phone:join-error', { reason: 'Lobby full or game in progress' });
          return;
        }
        socket.emit('phone:joined', { playerIndex: result.index, color: result.color });
        console.log(`[Phone] Joined as slot ${result.index + 1} (${socket.id.slice(0, 6)})`);
      });

      socket.on('lobby:set-config', ({ preset }) => {
        if (this.room.gamePhase !== 'lobby') return;
        if (preset !== 'small' && preset !== 'medium' && preset !== 'large' && preset !== 'huge') return;
        this.room.boardPreset = preset;
        console.log(`[Lobby] Board preset set to ${preset}`);
      });

      socket.on('lobby:kick', (slotIndex) => {
        if (this.room.isPhoneSocket(socket.id)) return; // phones can't kick
        if (typeof slotIndex !== 'number') return;
        const ok = this.room.kickSlot(slotIndex);
        if (ok) console.log(`[Lobby] Slot ${slotIndex + 1} kicked`);
      });

      socket.on('game:set-paused', (paused) => {
        if (this.room.isPhoneSocket(socket.id)) return; // phones can't pause
        this.room.setPaused(!!paused);
        console.log(`[Game] Paused = ${!!paused}`);
      });

      socket.on('lobby:return', () => {
        if (this.room.gamePhase === 'ingame') {
          this.room.returnToLobby();
          console.log('[Game] Returning to lobby');
        }
      });

      socket.on('input:turn', (playerIndex, direction) => {
        const snake = this.room.getSnake(socket.id, playerIndex);
        if (snake) snake.turnDirection = direction;
      });

      socket.on('input:boost', (playerIndex, active) => {
        const snake = this.room.getSnake(socket.id, playerIndex);
        if (snake) snake.boosting = active;
      });

      socket.on('input:activate', (playerIndex) => {
        const snake = this.room.getSnake(socket.id, playerIndex);
        if (snake) this.room.powerUpSystem.activateSlot(snake, this.room.getAllSnakes());
      });

      socket.on('disconnect', () => {
        console.log(`[Socket] Disconnected: ${socket.id}`);
        this.room.removeAllPlayers(socket.id);
      });
    });

    // --- Touch Designer namespace (/touchdesigner) ---
    this.tdNamespace = this.io.of('/touchdesigner');

    this.tdNamespace.use((socket, next) => {
      if (apiKey && socket.handshake.auth?.apiKey !== apiKey) {
        next(new Error('Invalid API key'));
      } else {
        next();
      }
    });

    this.tdNamespace.on('connection', (socket) => {
      console.log(`[TD] Connected: ${socket.id}`);

      socket.on('command:set-image', ({ imageUrl, word, imageBase64 }) => {
        this.room.imageManager.setNextImage(imageUrl ?? null, word, imageBase64);
        console.log(`[TD] Image queued: word="${word}"`);
      });

      socket.on('command:guess', ({ viewerName, guess }) => {
        const result = this.room.handleViewerGuess(viewerName ?? 'anonymous', guess);
        socket.emit('guess-result' as any, { correct: result.correct, viewerName, guess });
      });

      socket.on('command:god-obstacle', ({ cell, durationMs }) => {
        if (!isValidCell(cell)) return;
        const pos = cellToPixel(cell)!;
        this.room.addObstacle(pos.x - 40, pos.y - 10, 80, 20, durationMs ?? 15000);
        console.log(`[TD] Obstacle placed at ${cell}`);
      });

      socket.on('command:god-powerup', ({ cell, type }) => {
        if (!isValidCell(cell)) return;
        const pos = cellToPixel(cell)!;
        this.room.spawnPowerUpAt(type, pos);
        console.log(`[TD] Power-up ${type} spawned at ${cell}`);
      });

      socket.on('disconnect', () => {
        console.log(`[TD] Disconnected: ${socket.id}`);
      });
    });
  }

  broadcastSnapshot(): void {
    // Drain the pending-event queue. GameRoom.update no longer clears it
    // (so events pushed outside the tick, e.g. from startGame, aren't lost);
    // draining here on each broadcast keeps them one-shot as intended.
    const pending = this.room.pendingEvents;
    this.room.pendingEvents = [];
    for (const event of pending) {
      if (event.type === 'round-start') {
        this.io.emit('game:round-start', {
          roundNumber: event.roundNumber,
          imageUrl: '', // no single image in memory mode
          tiles: event.tiles,
        });
        this.tdNamespace.emit('event:round-start', {
          roundNumber: event.roundNumber,
          word: '', // memory mode doesn't use single word
          tiles: event.tiles,
        });
        this.lastRevealMilestone = 0;
      } else if (event.type === 'round-end') {
        this.io.emit('game:round-end', {
          roundNumber: event.roundNumber,
          winner: event.winner,
          scores: event.scores,
          pairScores: event.pairScores,
        });
        this.tdNamespace.emit('event:round-end', {
          roundNumber: event.roundNumber,
          winner: event.winner,
          scores: event.scores,
          pairScores: event.pairScores,
        });
      } else if (event.type === 'tile-captured') {
        this.io.emit('game:tile-captured', {
          tileId: event.tileId,
          capturedBy: event.capturedBy,
          capturedColor: event.capturedColor,
          symbolName: event.symbolName,
        });
        this.tdNamespace.emit('event:tile-captured' as any, {
          tileId: event.tileId,
          capturedBy: event.capturedBy,
          symbolName: event.symbolName,
        });
      } else if (event.type === 'pair-matched') {
        this.io.emit('game:pair-matched', {
          pairId: event.pairId,
          symbolName: event.symbolName,
          matchedBy: event.matchedBy,
          matchedByColor: event.matchedByColor,
        });
        this.tdNamespace.emit('event:pair-matched' as any, {
          pairId: event.pairId,
          symbolName: event.symbolName,
          matchedBy: event.matchedBy,
        });
      } else if (event.type === 'hint-active') {
        this.io.emit('game:hint-active', {
          pairId: event.pairId,
          symbolName: event.symbolName,
          tileIds: event.tileIds,
        });
      } else if (event.type === 'guess-correct') {
        this.tdNamespace.emit('event:guess-correct' as any, {
          viewerName: event.viewerName,
          word: event.word,
        });
      }
    }

    const snapshot = this.room.getSnapshot();
    this.io.emit('game:snapshot', snapshot);

    if (this.room.gamePhase === 'ingame') {
      const revealDelta = this.room.revealSystem.flushDelta();
      if (revealDelta) {
        this.io.emit('game:reveal-update', revealDelta);
      }

      // Reveal milestones for TD
      const pct = snapshot.revealPercentage;
      const milestones = [25, 50, 75, 90];
      for (const m of milestones) {
        if (pct >= m && this.lastRevealMilestone < m) {
          this.tdNamespace.emit('event:reveal-milestone' as any, { percentage: m });
          this.lastRevealMilestone = m;
        }
      }
    }
  }
}
