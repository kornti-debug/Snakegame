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

      socket.on('player:join', ({ name, playerIndex }) => {
        const snake = this.room.addPlayer(socket.id, playerIndex, name);
        socket.data.playerIds[playerIndex] = snake.id;
        console.log(`[Socket] Player joined: ${name} (index=${playerIndex}, id=${snake.id})`);
      });

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
          imageUrl: '', // placeholder — Touch Designer will provide images later
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

    const revealDelta = this.room.revealSystem.flushDelta();
    if (revealDelta) {
      this.io.emit('game:reveal-update', revealDelta);
    }
  }
}
