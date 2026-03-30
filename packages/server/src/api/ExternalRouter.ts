import { Router } from 'express';
import type { GameRoom } from '../GameRoom.js';
import { cellToPixel, isValidCell } from '@snakegame/shared';

export function createExternalRouter(room: GameRoom, apiKey: string): Router {
  const router = Router();

  // Auth middleware
  router.use((req, res, next) => {
    if (apiKey && req.headers['x-api-key'] !== apiKey) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }
    next();
  });

  // --- Game State ---

  router.get('/state', (_req, res) => {
    const snapshot = room.getSnapshot();
    res.json({
      gamePhase: snapshot.gamePhase,
      round: snapshot.round,
      revealPercentage: snapshot.revealPercentage,
      snakes: snapshot.snakes.map(s => ({
        id: s.id,
        name: s.name,
        color: s.color,
        alive: s.alive,
        revealScore: s.revealScore,
        score: s.score,
      })),
      playerCount: snapshot.snakes.length,
      lobbyPlayers: snapshot.lobbyPlayers,
    });
  });

  router.get('/reveal-percentage', (_req, res) => {
    res.json({ percentage: room.revealSystem.getRevealPercentage() });
  });

  // --- Image Management ---

  router.post('/image', (req, res) => {
    const { imageUrl, word, imageBase64 } = req.body;
    if (!word || typeof word !== 'string') {
      res.status(400).json({ error: 'word is required' });
      return;
    }
    const url = room.imageManager.setNextImage(imageUrl ?? null, word, imageBase64);
    res.json({ ok: true, imageUrl: url });
  });

  router.get('/image', (_req, res) => {
    res.json(room.imageManager.getCurrentState());
  });

  // --- Guess Submission ---

  router.post('/guess', (req, res) => {
    const { viewerName, guess } = req.body;
    if (!guess || typeof guess !== 'string') {
      res.status(400).json({ error: 'guess is required' });
      return;
    }

    const correct = room.imageManager.checkGuess(guess);
    if (correct) {
      room.handleCorrectGuess(viewerName ?? 'anonymous');
    }
    res.json({ correct, viewerName: viewerName ?? 'anonymous' });
  });

  // --- God Mode Actions ---

  router.post('/god/obstacle', (req, res) => {
    const { cell, durationMs } = req.body;
    if (!cell || !isValidCell(cell)) {
      res.status(400).json({ error: 'Invalid cell (A1-P9)' });
      return;
    }
    const pos = cellToPixel(cell)!;
    room.addObstacle(pos.x - 40, pos.y - 10, 80, 20, durationMs ?? 15000);
    res.json({ ok: true, cell, position: pos });
  });

  router.post('/god/powerup', (req, res) => {
    const { cell, type } = req.body;
    if (!cell || !isValidCell(cell)) {
      res.status(400).json({ error: 'Invalid cell (A1-P9)' });
      return;
    }
    if (!type || !['speed-boost', 'wide-trail', 'ghost'].includes(type)) {
      res.status(400).json({ error: 'Invalid type (speed-boost, wide-trail, ghost)' });
      return;
    }
    const pos = cellToPixel(cell)!;
    const success = room.spawnPowerUpAt(type, pos);
    res.json({ ok: success, cell, type, position: pos });
  });

  // --- Round Control ---

  router.post('/round/start', (_req, res) => {
    if (room.gamePhase === 'lobby') {
      room.startGame();
      res.json({ ok: true, action: 'game-started' });
    } else if (room.roundManager.phase !== 'playing') {
      room.roundManager.startRound();
      res.json({ ok: true, action: 'round-started' });
    } else {
      res.json({ ok: false, error: 'Round already in progress' });
    }
  });

  router.post('/round/end', (_req, res) => {
    room.roundManager.forceEndRound();
    res.json({ ok: true });
  });

  return router;
}
