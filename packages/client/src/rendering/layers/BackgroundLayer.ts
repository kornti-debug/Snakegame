import type { MemoryTile } from '@snakegame/shared';
import { ARENA_WIDTH, ARENA_HEIGHT } from '@snakegame/shared';

export class BackgroundLayer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private imageLoaded = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = ARENA_WIDTH;
    this.canvas.height = ARENA_HEIGHT;
    this.ctx = this.canvas.getContext('2d')!;

    this.drawPlaceholder();
  }

  /** Load tile images for memory mode */
  async loadTileImages(tiles: MemoryTile[]): Promise<void> {
    this.ctx.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Dark background for non-tile areas
    this.ctx.fillStyle = '#0a0a1a';
    this.ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Load and draw each tile image
    const loadPromises = tiles.map(tile => this.loadAndDrawTile(tile));
    await Promise.allSettled(loadPromises);

    this.imageLoaded = true;
  }

  private loadAndDrawTile(tile: MemoryTile): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Draw image scaled to cover the tile area
        const scale = Math.max(tile.width / img.width, tile.height / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = tile.x + (tile.width - w) / 2;
        const y = tile.y + (tile.height - h) / 2;

        // Clip to tile bounds
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.roundRect(tile.x, tile.y, tile.width, tile.height, 12);
        this.ctx.clip();
        this.ctx.drawImage(img, x, y, w, h);
        this.ctx.restore();

        resolve();
      };
      img.onerror = () => {
        // Draw fallback colored rectangle with symbol name
        this.ctx.save();
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.beginPath();
        this.ctx.roundRect(tile.x, tile.y, tile.width, tile.height, 12);
        this.ctx.fill();
        this.ctx.fillStyle = '#666';
        this.ctx.font = 'bold 24px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(tile.symbolName, tile.x + tile.width / 2, tile.y + tile.height / 2);
        this.ctx.restore();
        resolve();
      };
      img.src = tile.imageUrl;
    });
  }

  /** Legacy: load a single image covering the full arena */
  loadImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.ctx.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
        const scale = Math.max(ARENA_WIDTH / img.width, ARENA_HEIGHT / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (ARENA_WIDTH - w) / 2;
        const y = (ARENA_HEIGHT - h) / 2;
        this.ctx.drawImage(img, x, y, w, h);
        this.imageLoaded = true;
        resolve();
      };
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  }

  private drawPlaceholder(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = 'bold 80px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MEMORY GAME', ARENA_WIDTH / 2, ARENA_HEIGHT / 2);
    this.imageLoaded = true;
  }

  reset(): void {
    this.imageLoaded = false;
    this.drawPlaceholder();
  }

  isReady(): boolean {
    return this.imageLoaded;
  }
}
