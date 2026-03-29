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

    // Start with a placeholder gradient
    this.drawPlaceholder();
  }

  loadImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.ctx.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
        // Draw image to cover the full canvas (cover mode)
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
    // Colorful gradient as placeholder
    const gradient = ctx.createLinearGradient(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    gradient.addColorStop(0, '#ff6b6b');
    gradient.addColorStop(0.25, '#feca57');
    gradient.addColorStop(0.5, '#48dbfb');
    gradient.addColorStop(0.75, '#ff9ff3');
    gradient.addColorStop(1, '#54a0ff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Add some text
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = 'bold 120px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HIDDEN IMAGE', ARENA_WIDTH / 2, ARENA_HEIGHT / 2);
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
