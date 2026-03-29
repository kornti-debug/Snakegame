import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '@snakegame/shared';
import type { GameRoom } from '../GameRoom.js';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export class SocketManager {
  readonly io: TypedServer;

  constructor(httpServer: HttpServer, private room: GameRoom) {
    this.io = new Server(httpServer, {
      cors: { origin: '*' },
    });

    this.io.on('connection', (socket) => {
      console.log(`[Socket] Connected: ${socket.id}`);
      socket.data.playerIds = [];

      // --- Lobby events ---
      socket.on('player:join', ({ name, playerIndex }) => {
        if (this.room.gamePhase === 'lobby') {
          this.room.lobbyJoin(socket.id, playerIndex, name);
          console.log(`[Lobby] ${name} joined as Player ${playerIndex + 1}`);
        }
      });

      socket.on('player:leave', (playerIndex) => {
        this.room.lobbyLeave(socket.id, playerIndex);
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

      socket.on('lobby:start-game', () => {
        if (this.room.gamePhase === 'lobby') {
          this.room.startGame();
          console.log('[Game] Starting game!');
        }
      });

      socket.on('lobby:return', () => {
        if (this.room.gamePhase === 'ingame') {
          this.room.returnToLobby();
          console.log('[Game] Returning to lobby');
        }
      });

      // --- In-game input ---
      socket.on('input:turn', (playerIndex, direction) => {
        const snake = this.room.getSnake(socket.id, playerIndex);
        if (snake) snake.turnDirection = direction;
      });

      socket.on('input:boost', (playerIndex, active) => {
        const snake = this.room.getSnake(socket.id, playerIndex);
        if (snake) snake.boosting = active;
      });

      socket.on('disconnect', () => {
        console.log(`[Socket] Disconnected: ${socket.id}`);
        this.room.removeAllPlayers(socket.id);
      });
    });
  }

  broadcastSnapshot(): void {
    // Emit pending game events
    for (const event of this.room.pendingEvents) {
      if (event.type === 'round-start') {
        this.io.emit('game:round-start', {
          roundNumber: event.roundNumber,
          imageUrl: '',
        });
      } else if (event.type === 'round-end') {
        this.io.emit('game:round-end', {
          roundNumber: event.roundNumber,
          winner: event.winner,
          scores: event.scores,
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
    }
  }
}
