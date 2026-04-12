import type { GameSnapshot, RevealDelta, MemoryTile } from '@snakegame/shared';
import { ARENA_WIDTH, ARENA_HEIGHT } from '@snakegame/shared';
import { BackgroundLayer } from './layers/BackgroundLayer.js';
import { RevealLayer } from './layers/RevealLayer.js';
import { TileOverlayLayer } from './layers/TileOverlayLayer.js';
import { GameLayer } from './layers/GameLayer.js';

/** Phone-side follow-cam renderer. Reuses the projector's layer classes
 *  to composite a full 1920×1080 arena frame into an offscreen buffer,
 *  then blits a camera-centered slice of that buffer to the visible canvas. */
export class PhoneArenaRenderer {
  private buffer: HTMLCanvasElement;
  private bctx: CanvasRenderingContext2D;
  private backgroundLayer = new BackgroundLayer();
  private revealLayer = new RevealLayer();
  private tileOverlayLayer = new TileOverlayLayer();
  private gameLayer = new GameLayer();

  constructor() {
    this.buffer = document.createElement('canvas');
    this.buffer.width = ARENA_WIDTH;
    this.buffer.height = ARENA_HEIGHT;
    this.bctx = this.buffer.getContext('2d')!;
  }

  async loadTileImages(tiles: MemoryTile[]): Promise<void> {
    await this.backgroundLayer.loadTileImages(tiles);
  }

  applyRevealDelta(delta: RevealDelta): void {
    this.revealLayer.applyDelta(delta);
  }

  resetRound(): void {
    this.backgroundLayer.reset();
    this.revealLayer.reset();
  }

  /** Render a frame. `viewW`/`viewH` control how many arena pixels are
   *  shown (larger = more zoomed out). `cameraX`/`Y` are the arena-space
   *  point that will appear at the center of the visible canvas. The
   *  camera is soft-clamped so you never see outside the arena. */
  render(
    snapshot: GameSnapshot,
    visible: HTMLCanvasElement,
    cameraX: number,
    cameraY: number,
    viewW: number,
    viewH: number,
  ): void {
    // Composite arena into offscreen buffer.
    const bctx = this.bctx;
    bctx.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    bctx.drawImage(this.backgroundLayer.canvas, 0, 0);
    // Skip the reveal mask during the pre-reveal phase so the player
    // sees the tiles + bonus pair before the round starts.
    if (snapshot.round.phase !== 'waiting') {
      bctx.drawImage(this.revealLayer.canvas, 0, 0);
    }

    const colorMap = new Map(snapshot.snakes.map(s => [s.id, s.color]));
    this.tileOverlayLayer.setSnakeColors(colorMap);
    const preReveal = snapshot.round.phase === 'waiting';
    this.tileOverlayLayer.render(snapshot.memoryBoard, snapshot.hints, preReveal);
    bctx.drawImage(this.tileOverlayLayer.canvas, 0, 0);

    this.gameLayer.render(snapshot);
    bctx.drawImage(this.gameLayer.canvas, 0, 0);

    // Clamp the camera so the view never slides past the arena edges.
    const halfW = viewW / 2;
    const halfH = viewH / 2;
    const cx = Math.max(halfW, Math.min(ARENA_WIDTH - halfW, cameraX));
    const cy = Math.max(halfH, Math.min(ARENA_HEIGHT - halfH, cameraY));

    // Blit camera window to visible canvas.
    const vctx = visible.getContext('2d')!;
    vctx.fillStyle = '#000';
    vctx.fillRect(0, 0, visible.width, visible.height);
    vctx.imageSmoothingEnabled = true;
    vctx.drawImage(
      this.buffer,
      cx - halfW, cy - halfH, viewW, viewH,
      0, 0, visible.width, visible.height,
    );
  }
}
