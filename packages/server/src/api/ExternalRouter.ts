import { Router } from 'express';
import type { GameRoom } from '../GameRoom.js';
import { cellToPixel, isValidCell } from '@snakegame/shared';
import type { SymbolDef } from '../systems/SymbolGenerator.js';

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
      memoryBoard: snapshot.memoryBoard,
      hints: snapshot.hints,
      snakes: snapshot.snakes.map(s => ({
        id: s.id,
        name: s.name,
        color: s.color,
        alive: s.alive,
        revealScore: s.revealScore,
        pairScore: s.pairScore,
        score: s.score,
      })),
      playerCount: snapshot.snakes.length,
      lobbyPlayers: snapshot.lobbyPlayers,
    });
  });

  router.get('/reveal-percentage', (_req, res) => {
    res.json({ percentage: room.revealSystem.getRevealPercentage() });
  });

  // --- Memory Board ---

  router.get('/memory/board', (_req, res) => {
    res.json(room.memoryBoardSystem.getBoardState());
  });

  // --- Tile Image Management ---

  router.post('/tiles', (req, res) => {
    const { tiles } = req.body;
    if (!Array.isArray(tiles) || tiles.length === 0) {
      res.status(400).json({ error: 'tiles array is required' });
      return;
    }
    const symbols: SymbolDef[] = tiles.map((t: any) => ({
      name: t.symbolName ?? t.name,
      imageUrl: t.imageUrl ?? '',
    }));
    room.setCustomSymbols(symbols);
    res.json({ ok: true, symbolCount: symbols.length });
  });

  // --- Legacy image/guess endpoints (kept for compatibility) ---

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

  router.post('/guess', (req, res) => {
    const { viewerName, guess } = req.body;
    if (!guess || typeof guess !== 'string') {
      res.status(400).json({ error: 'guess is required' });
      return;
    }
    // In memory mode, guess a symbol name
    const result = room.handleViewerGuess(viewerName ?? 'anonymous', guess);
    res.json({ correct: result.correct, creditsEarned: result.creditsEarned, viewerName: viewerName ?? 'anonymous' });
  });

  // --- Viewer / Credit Economy ---

  router.post('/viewer/join', (req, res) => {
    const { viewerName } = req.body;
    if (!viewerName || typeof viewerName !== 'string') {
      res.status(400).json({ error: 'viewerName is required' });
      return;
    }
    const snakes = room.getAllSnakes();
    const snakeIds = snakes.map(s => s.id);
    const snakeColors = new Map(snakes.map(s => [s.id, s.color]));
    const viewer = room.creditSystem.joinViewer(viewerName, snakeIds, snakeColors);
    res.json(viewer);
  });

  router.get('/viewer/:name', (req, res) => {
    const viewer = room.creditSystem.getViewer(req.params.name);
    if (!viewer) {
      res.status(404).json({ error: 'Viewer not found' });
      return;
    }
    res.json(viewer);
  });

  router.post('/viewer/action', (req, res) => {
    const { viewerName, action, params } = req.body;
    if (!viewerName || !action) {
      res.status(400).json({ error: 'viewerName and action required' });
      return;
    }

    switch (action) {
      case 'hint': {
        const result = room.handleHint(viewerName, params?.symbolName ?? '');
        const viewer = room.creditSystem.getViewer(viewerName);
        res.json({ ...result, creditsRemaining: viewer?.credits ?? 0 });
        break;
      }
      case 'powerup': {
        const { cell, type } = params ?? {};
        if (!cell || !type) {
          res.status(400).json({ error: 'params.cell and params.type required' });
          return;
        }
        if (!isValidCell(cell)) {
          res.status(400).json({ error: 'Invalid cell' });
          return;
        }
        const pos = cellToPixel(cell)!;
        if (!room.creditSystem.spendCredits(viewerName, 30)) {
          res.json({ ok: false, reason: 'Insufficient credits' });
          return;
        }
        room.spawnPowerUpAt(type, pos);
        const viewer = room.creditSystem.getViewer(viewerName);
        res.json({ ok: true, creditsRemaining: viewer?.credits ?? 0 });
        break;
      }
      case 'obstacle': {
        const { cell: obCell, durationMs } = params ?? {};
        if (!obCell) {
          res.status(400).json({ error: 'params.cell required' });
          return;
        }
        if (!isValidCell(obCell)) {
          res.status(400).json({ error: 'Invalid cell' });
          return;
        }
        const obPos = cellToPixel(obCell)!;
        if (!room.creditSystem.spendCredits(viewerName, 20)) {
          res.json({ ok: false, reason: 'Insufficient credits' });
          return;
        }
        room.addObstacle(obPos.x - 40, obPos.y - 10, 80, 20, durationMs ?? 15000);
        const viewer = room.creditSystem.getViewer(viewerName);
        res.json({ ok: true, creditsRemaining: viewer?.credits ?? 0 });
        break;
      }
      default:
        res.status(400).json({ error: `Unknown action: ${action}` });
    }
  });

  router.post('/viewer/guess', (req, res) => {
    const { viewerName, symbolName } = req.body;
    if (!viewerName || !symbolName) {
      res.status(400).json({ error: 'viewerName and symbolName required' });
      return;
    }
    const result = room.handleViewerGuess(viewerName, symbolName);
    const viewer = room.creditSystem.getViewer(viewerName);
    res.json({ ...result, creditsRemaining: viewer?.credits ?? 0 });
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
