import { ARENA_WIDTH, ARENA_HEIGHT } from '@snakegame/shared';

export class ConfirmDialogRenderer {
  private ctx: CanvasRenderingContext2D;
  private pulseTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  /** Draw modal overlay on top of whatever was just rendered. */
  render(message: string): void {
    const ctx = this.ctx;
    this.pulseTime += 0.04;

    // Darken background
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Dialog box
    const w = 720, h = 280;
    const x = (ARENA_WIDTH - w) / 2;
    const y = (ARENA_HEIGHT - h) / 2;

    ctx.fillStyle = '#1a1a2e';
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 3;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = 'bold 36px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(message, ARENA_WIDTH / 2, y + 100);

    const pulse = 0.7 + Math.sin(this.pulseTime * 5) * 0.3;
    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = `rgba(68, 255, 68, ${pulse})`;
    ctx.fillText('[ Y ]  Yes', ARENA_WIDTH / 2 - 120, y + 190);
    ctx.fillStyle = `rgba(255, 68, 68, ${pulse})`;
    ctx.fillText('[ N ]  No', ARENA_WIDTH / 2 + 120, y + 190);
  }
}
