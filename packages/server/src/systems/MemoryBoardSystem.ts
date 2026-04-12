import type { MemoryTile, MemoryPair, MemoryBoardState, HintState, BoardConfig } from '@snakegame/shared';
import type { Snake } from '../entities/Snake.js';
import type { RevealSystem } from './RevealSystem.js';
import type { SymbolDef } from './SymbolGenerator.js';
import {
  REVEAL_BLOCK_SIZE,
  REVEAL_GRID_WIDTH,
  REVEAL_GRID_HEIGHT,
  DEFAULT_BOARD_CONFIG,
  HINT_DURATION,
} from '@snakegame/shared';
import { generateTileSlots } from '@snakegame/shared';

export interface MemoryBoardEvent {
  type: 'tile-captured' | 'pair-matched';
  tileId?: number;
  pairId?: number;
  symbolName: string;
  snakeId: string;
  snakeColor: string;
}

export class MemoryBoardSystem {
  private tiles: MemoryTile[] = [];
  private pairs: MemoryPair[] = [];
  private pairScores = new Map<string, number>(); // snakeId → matched pair count
  private hints: HintState[] = [];
  private pendingEvents: MemoryBoardEvent[] = [];
  private config: BoardConfig = DEFAULT_BOARD_CONFIG;

  setConfig(cfg: BoardConfig): void {
    this.config = cfg;
  }

  /** Clear all board state — used when starting a fresh game session so the
   *  waiting-phase snapshot doesn't carry stale tiles / progress bars. */
  reset(): void {
    this.tiles = [];
    this.pairs = [];
    this.pairScores.clear();
    this.hints = [];
    this.pendingEvents = [];
    this.tileSnakeReveals = [];
    this.tileRevealedCounts = [];
    this.tileBlockCounts = [];
    // blockToTile is rebuilt at generateBoard; keep it a valid empty buffer
    // in case update() is called with no board yet.
    this.blockToTile = new Uint8Array(REVEAL_GRID_WIDTH * REVEAL_GRID_HEIGHT);
  }

  // Lookup table: reveal grid block → tileId+1 (0 = no tile)
  private blockToTile!: Uint8Array;
  // Per-tile total block count (for percentage calculation)
  private tileBlockCounts: number[] = [];
  // Per-tile, per-snake reveal counts
  private tileSnakeReveals: Map<string, number>[] = []; // tileId → Map<snakeId, count>
  // Per-tile total revealed blocks
  private tileRevealedCounts: number[] = [];

  generateBoard(symbols: SymbolDef[]): void {
    this.tiles = [];
    this.pairs = [];
    this.pairScores.clear();
    this.hints = [];
    this.pendingEvents = [];

    const cfg = this.config;
    const pairCount = cfg.pairCount;
    const tileCount = pairCount * 2;

    // Get tile slot positions sized by config (will have >= tileCount slots)
    const slots = generateTileSlots(cfg);

    // Shuffle slots for random placement
    const shuffledSlots = [...slots];
    for (let i = shuffledSlots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledSlots[i], shuffledSlots[j]] = [shuffledSlots[j], shuffledSlots[i]];
    }

    // Ensure we have enough symbols (repeat if needed)
    const usedSymbols: SymbolDef[] = [];
    for (let i = 0; i < pairCount; i++) {
      usedSymbols.push(symbols[i % symbols.length]);
    }

    // Create tiles: 2 tiles per pair
    let tileId = 0;
    for (let pairId = 0; pairId < pairCount; pairId++) {
      const symbol = usedSymbols[pairId];
      const tileA = tileId++;
      const tileB = tileId++;

      const posA = shuffledSlots[tileA];
      const posB = shuffledSlots[tileB];

      this.tiles.push({
        tileId: tileA,
        pairId,
        symbolName: symbol.name,
        imageUrl: symbol.imageUrl,
        x: posA.x,
        y: posA.y,
        width: cfg.tileWidth,
        height: cfg.tileHeight,
        revealPercent: 0,
        capturedBy: null,
        capturedColor: null,
        revealBySnake: {},
      });

      this.tiles.push({
        tileId: tileB,
        pairId,
        symbolName: symbol.name,
        imageUrl: symbol.imageUrl,
        x: posB.x,
        y: posB.y,
        width: cfg.tileWidth,
        height: cfg.tileHeight,
        revealPercent: 0,
        capturedBy: null,
        capturedColor: null,
        revealBySnake: {},
      });

      this.pairs.push({
        pairId,
        symbolName: symbol.name,
        tileIds: [tileA, tileB],
        matched: false,
        matchedBy: null,
        isBonus: false,
      });
    }

    // Elect one random pair as the bonus pair for this round. Matching it
    // awards a random OP powerup to the matcher's item slot.
    if (this.pairs.length > 0) {
      const bonusIdx = Math.floor(Math.random() * this.pairs.length);
      this.pairs[bonusIdx].isBonus = true;
    }

    // Build block-to-tile lookup table
    this.buildLookupTable();

    // Initialize per-tile counters
    this.tileSnakeReveals = this.tiles.map(() => new Map<string, number>());
    this.tileRevealedCounts = new Array(tileCount).fill(0);
  }

  private buildLookupTable(): void {
    this.blockToTile = new Uint8Array(REVEAL_GRID_WIDTH * REVEAL_GRID_HEIGHT);
    this.tileBlockCounts = new Array(this.tiles.length).fill(0);

    for (const tile of this.tiles) {
      // Convert pixel bounds to block bounds
      const bxStart = Math.floor(tile.x / REVEAL_BLOCK_SIZE);
      const byStart = Math.floor(tile.y / REVEAL_BLOCK_SIZE);
      const bxEnd = Math.floor((tile.x + tile.width) / REVEAL_BLOCK_SIZE);
      const byEnd = Math.floor((tile.y + tile.height) / REVEAL_BLOCK_SIZE);

      let blockCount = 0;
      for (let by = byStart; by < byEnd; by++) {
        for (let bx = bxStart; bx < bxEnd; bx++) {
          if (bx >= 0 && bx < REVEAL_GRID_WIDTH && by >= 0 && by < REVEAL_GRID_HEIGHT) {
            this.blockToTile[by * REVEAL_GRID_WIDTH + bx] = tile.tileId + 1; // 1-based
            blockCount++;
          }
        }
      }
      this.tileBlockCounts[tile.tileId] = blockCount;
    }
  }

  /** Process newly revealed blocks and check for captures/matches */
  update(revealSystem: RevealSystem, snakes: Snake[]): void {
    this.pendingEvents = [];
    const newBlocks = revealSystem.getNewBlocksThisTick();

    // Attribute new blocks to tiles
    for (const { bx, by, snakeId } of newBlocks) {
      const idx = by * REVEAL_GRID_WIDTH + bx;
      const tileMarker = this.blockToTile[idx];
      if (tileMarker === 0) continue; // not on a tile

      const tileId = tileMarker - 1;
      this.tileRevealedCounts[tileId]++;

      const snakeMap = this.tileSnakeReveals[tileId];
      snakeMap.set(snakeId, (snakeMap.get(snakeId) ?? 0) + 1);
    }

    // Check captures
    for (const tile of this.tiles) {
      if (tile.capturedBy !== null) continue; // already captured
      if (this.tileBlockCounts[tile.tileId] === 0) continue;

      const revealed = this.tileRevealedCounts[tile.tileId];
      const percent = revealed / this.tileBlockCounts[tile.tileId];
      tile.revealPercent = percent * 100;

      // Update per-snake breakdown for snapshot
      const snakeMap = this.tileSnakeReveals[tile.tileId];
      tile.revealBySnake = {};
      for (const [sid, count] of snakeMap) {
        tile.revealBySnake[sid] = count;
      }

      if (percent < this.config.captureThreshold) continue;

      // Find who revealed the most blocks in this tile
      let maxSnakeId: string | null = null;
      let maxCount = 0;
      for (const [sid, count] of snakeMap) {
        if (count > maxCount) {
          maxCount = count;
          maxSnakeId = sid;
        }
      }

      if (!maxSnakeId) continue;

      const snake = snakes.find(s => s.id === maxSnakeId);
      tile.capturedBy = maxSnakeId;
      tile.capturedColor = snake?.color ?? '#FFFFFF';

      this.pendingEvents.push({
        type: 'tile-captured',
        tileId: tile.tileId,
        symbolName: tile.symbolName,
        snakeId: maxSnakeId,
        snakeColor: tile.capturedColor,
      });

      // Check if this completes a pair
      this.checkPairMatch(tile.pairId, snakes);
    }

    // Update hint timers
    const now = Date.now();
    this.hints = this.hints.filter(h => h.expiresAtMs > now);
  }

  private checkPairMatch(pairId: number, snakes: Snake[]): void {
    const pair = this.pairs[pairId];
    if (pair.matched) return;

    const tileA = this.tiles[pair.tileIds[0]];
    const tileB = this.tiles[pair.tileIds[1]];

    if (!tileA.capturedBy || !tileB.capturedBy) return;

    // Both tiles must be captured by the SAME snake for a match
    if (tileA.capturedBy !== tileB.capturedBy) return;

    pair.matched = true;
    pair.matchedBy = tileA.capturedBy;

    // Award point
    const current = this.pairScores.get(pair.matchedBy) ?? 0;
    this.pairScores.set(pair.matchedBy, current + 1);

    // Update snake's pairScore
    const snake = snakes.find(s => s.id === pair.matchedBy);
    if (snake) {
      snake.pairScore = current + 1;

      // Bonus pair reward: queue a random OP powerup into the matcher's
      // slot (overrides any pending item — the bonus beats the no-overwrite
      // rule). The player still has to activate it to fire.
      if (pair.isBonus) {
        const bonusIds = ['time-freeze', 'lightning', 'cripple'];
        snake.itemSlot = bonusIds[Math.floor(Math.random() * bonusIds.length)];
      }
    }

    this.pendingEvents.push({
      type: 'pair-matched',
      pairId,
      symbolName: pair.symbolName,
      snakeId: pair.matchedBy,
      snakeColor: snake?.color ?? '#FFFFFF',
    });
  }

  activateHint(symbolName: string): boolean {
    const pair = this.pairs.find(p => p.symbolName.toLowerCase() === symbolName.toLowerCase());
    if (!pair || pair.matched) return false;

    // Don't duplicate active hints for the same pair
    if (this.hints.some(h => h.pairId === pair.pairId)) return false;

    this.hints.push({
      pairId: pair.pairId,
      symbolName: pair.symbolName,
      tileIds: pair.tileIds,
      expiresAtMs: Date.now() + HINT_DURATION,
    });
    return true;
  }

  isRoundComplete(): boolean {
    return this.pairs.length > 0 && this.pairs.every(p => p.matched);
  }

  flushEvents(): MemoryBoardEvent[] {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  getBoardState(): MemoryBoardState {
    const pairScores: Record<string, number> = {};
    for (const [id, count] of this.pairScores) {
      pairScores[id] = count;
    }
    return {
      tiles: this.tiles,
      pairs: this.pairs,
      pairScores,
    };
  }

  getPairScores(): Record<string, number> {
    const scores: Record<string, number> = {};
    for (const [id, count] of this.pairScores) {
      scores[id] = count;
    }
    return scores;
  }

  getHints(): HintState[] {
    return this.hints;
  }

  /** Get all unmatched symbol names (for guessing) */
  getGuessableSymbols(): string[] {
    return this.pairs.filter(p => !p.matched).map(p => p.symbolName);
  }

  getTiles(): MemoryTile[] {
    return this.tiles;
  }
}
