import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { GameRoom } from './GameRoom.js';
import { GameLoop } from './GameLoop.js';
import { SocketManager } from './network/SocketManager.js';

const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const room = new GameRoom();
const socketManager = new SocketManager(httpServer, room);

const gameLoop = new GameLoop((dt) => {
  room.update(dt);
  socketManager.broadcastSnapshot();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', players: room.snakeCount });
});

httpServer.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
  gameLoop.start();
});

// Graceful shutdown
function shutdown() {
  console.log('\n[Server] Shutting down...');
  gameLoop.stop();
  socketManager.io.close();
  httpServer.close(() => {
    console.log('[Server] Closed.');
    process.exit(0);
  });
  // Force exit after 2s if something hangs
  setTimeout(() => process.exit(0), 2000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
