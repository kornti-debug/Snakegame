import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { GameRoom } from './GameRoom.js';
import { GameLoop } from './GameLoop.js';
import { SocketManager } from './network/SocketManager.js';
import { createExternalRouter } from './api/ExternalRouter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT) || 3000;
const API_KEY = process.env.API_KEY || '';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // allow base64 images

const httpServer = createServer(app);

// Upload directory for images
const uploadDir = path.resolve(__dirname, '..', 'uploads');
const room = new GameRoom(uploadDir);
const socketManager = new SocketManager(httpServer, room, API_KEY);

const gameLoop = new GameLoop((dt) => {
  room.update(dt);
  socketManager.broadcastSnapshot();
});

// Serve uploaded images
app.use('/uploads', express.static(uploadDir));

// External API for Touch Designer
app.use('/api/external', createExternalRouter(room, API_KEY));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', players: room.snakeCount });
});

httpServer.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
  if (API_KEY) {
    console.log(`[Server] API key required for /api/external`);
  } else {
    console.log(`[Server] No API key set — /api/external is open`);
  }
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
  setTimeout(() => process.exit(0), 2000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
