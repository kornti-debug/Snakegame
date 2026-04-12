import { ARENA_WIDTH, ARENA_HEIGHT } from '@snakegame/shared';

/** Modal overlay used for the host pause dialog: paused state + options
 *  to resume or exit to the main menu. */
export class ConfirmDialogRenderer {
  private ctx: CanvasRenderingContext2D;
  private pulseTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  render(title: string = 'PAUSED'): void {
    const ctx = this.ctx;
    this.pulseTime += 0.04;

    // Darken background
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    const w = 780, h = 340;
    const x = (ARENA_WIDTH - w) / 2;
    const y = (ARENA_HEIGHT - h) / 2;

    ctx.fillStyle = '#1a1a2e';
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Title
    const titlePulse = 0.85 + Math.sin(this.pulseTime * 3) * 0.15;
    ctx.font = 'bold 56px monospace';
    ctx.fillStyle = `rgba(255, 215, 0, ${titlePulse})`;
    ctx.fillText(title, ARENA_WIDTH / 2, y + 90);

    // Options
    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = '#44ff44';
    ctx.fillText('[ R ]  Resume', ARENA_WIDTH / 2, y + 180);

    ctx.fillStyle = '#ff8844';
    ctx.fillText('[ Y ]  Exit to main menu', ARENA_WIDTH / 2, y + 225);

    ctx.font = '16px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText('(ESC or N also resumes)', ARENA_WIDTH / 2, y + 290);
  }
}
