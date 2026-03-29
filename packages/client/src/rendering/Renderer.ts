import type { GameSnapshot, RevealDelta } from '@snakegame/shared';
import { ARENA_WIDTH, ARENA_HEIGHT } from '@snakegame/shared';
import { BackgroundLayer } from './layers/BackgroundLayer.js';
import { RevealLayer } from './layers/RevealLayer.js';
import { GameLayer } from './layers/GameLayer.js';
import { UILayer } from './layers/UILayer.js';

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private backgroundLayer: BackgroundLayer;
  private revealLayer: RevealLayer;
  private gameLayer: GameLayer;
  private uiLayer: UILayer;

  constructor(container: HTMLElement) {
    // Main visible canvas (composites all layers)
    this.canvas = document.createElement('canvas');
    this.canvas.width = ARENA_WIDTH;
    this.canvas.height = ARENA_HEIGHT;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.objectFit = 'contain';
    this.canvas.style.background = '#000';
    container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d')!;

    // Create offscreen layers
    this.backgroundLayer = new BackgroundLayer();
    this.revealLayer = new RevealLayer();
    this.gameLayer = new GameLayer();
    this.uiLayer = new UILayer();
  }

  applyRevealDelta(delta: RevealDelta): void {
    this.revealLayer.applyDelta(delta);
  }

  async loadImage(url: string): Promise<void> {
    await this.backgroundLayer.loadImage(url);
  }

  resetRound(): void {
    this.backgroundLayer.reset();
    this.revealLayer.reset();
  }

  render(snapshot: GameSnapshot): void {
    const ctx = this.ctx;

    // Clear main canvas
    ctx.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Layer 1: Background image (hidden picture)
    ctx.drawImage(this.backgroundLayer.canvas, 0, 0);

    // Layer 2: Reveal mask (covers the image, holes show through)
    ctx.drawImage(this.revealLayer.canvas, 0, 0);

    // Layer 3: Game objects (snakes, powerups)
    this.gameLayer.render(snapshot);
    ctx.drawImage(this.gameLayer.canvas, 0, 0);

    // Layer 4: UI (HUD, scores)
    this.uiLayer.render(snapshot);
    ctx.drawImage(this.uiLayer.canvas, 0, 0);
  }
}
