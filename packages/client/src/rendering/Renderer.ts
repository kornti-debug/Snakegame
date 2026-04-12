import type { GameSnapshot, RevealDelta, MemoryTile } from '@snakegame/shared';
import { ARENA_WIDTH, ARENA_HEIGHT } from '@snakegame/shared';
import { BackgroundLayer } from './layers/BackgroundLayer.js';
import { RevealLayer } from './layers/RevealLayer.js';
import { TileOverlayLayer } from './layers/TileOverlayLayer.js';
import { GameLayer } from './layers/GameLayer.js';
import { UILayer } from './layers/UILayer.js';

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private backgroundLayer: BackgroundLayer;
  private revealLayer: RevealLayer;
  private tileOverlayLayer: TileOverlayLayer;
  private gameLayer: GameLayer;
  private uiLayer: UILayer;

  constructor(container: HTMLElement, canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = this.canvas.getContext('2d')!;

    // Create offscreen layers
    this.backgroundLayer = new BackgroundLayer();
    this.revealLayer = new RevealLayer();
    this.tileOverlayLayer = new TileOverlayLayer();
    this.gameLayer = new GameLayer();
    this.uiLayer = new UILayer();
  }

  applyRevealDelta(delta: RevealDelta): void {
    this.revealLayer.applyDelta(delta);
  }

  async loadTileImages(tiles: MemoryTile[]): Promise<void> {
    await this.backgroundLayer.loadTileImages(tiles);
  }

  async loadImage(url: string): Promise<void> {
    await this.backgroundLayer.loadImage(url);
  }

  resetRound(): void {
    this.backgroundLayer.reset();
    this.revealLayer.reset();
  }

  showWinner(name: string, score: number): void {
    this.uiLayer.showWinner(name, score);
  }

  render(snapshot: GameSnapshot): void {
    const ctx = this.ctx;

    // Clear main canvas
    ctx.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Layer 1: Background (tile images)
    ctx.drawImage(this.backgroundLayer.canvas, 0, 0);

    // Layer 2: Reveal mask (covers tiles, holes show through).
    // Skipped during the pre-round 'waiting' phase so players get a brief
    // look at all tile positions + the bonus pair before the round starts.
    const preReveal = snapshot.round.phase === 'waiting';
    if (!preReveal) {
      ctx.drawImage(this.revealLayer.canvas, 0, 0);
    }

    // Layer 3: Tile overlay (borders, capture states, hints)
    // Update snake color cache from snapshot
    const colorMap = new Map(snapshot.snakes.map(s => [s.id, s.color]));
    this.tileOverlayLayer.setSnakeColors(colorMap);
    this.tileOverlayLayer.render(snapshot.memoryBoard, snapshot.hints);
    ctx.drawImage(this.tileOverlayLayer.canvas, 0, 0);

    // Layer 4: Game objects (snakes, powerups, obstacles)
    this.gameLayer.render(snapshot);
    ctx.drawImage(this.gameLayer.canvas, 0, 0);

    // Layer 5: UI (HUD, scores)
    this.uiLayer.render(snapshot);
    ctx.drawImage(this.uiLayer.canvas, 0, 0);
  }
}
