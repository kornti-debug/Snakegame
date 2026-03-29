import type { GameSnapshot } from '@snakegame/shared';
import { ARENA_WIDTH, ARENA_HEIGHT } from '@snakegame/shared';

export class UILayer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private winnerDisplay: { name: string; score: number } | null = null;
  private winnerTimer = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = ARENA_WIDTH;
    this.canvas.height = ARENA_HEIGHT;
    this.ctx = this.canvas.getContext('2d')!;
  }

  showWinner(name: string, score: number): void {
    this.winnerDisplay = { name, score };
    this.winnerTimer = 4000;
  }

  render(snapshot: GameSnapshot): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    const { round } = snapshot;

    // Round timer (top center)
    this.drawRoundInfo(ctx, round.phase, round.roundNumber, round.timeRemainingMs);

    // Player scores — reveal-based (top-left)
    this.drawScores(ctx, snapshot);

    // Reveal percentage (top-right)
    const pct = snapshot.revealPercentage.toFixed(1);
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'right';
    this.textWithShadow(ctx, `Revealed: ${pct}%`, ARENA_WIDTH - 20, 34, '#fff');

    // Winner overlay
    if (this.winnerTimer > 0) {
      this.drawWinnerOverlay(ctx);
      this.winnerTimer -= 16; // approximate per-frame
    } else {
      this.winnerDisplay = null;
    }

    // Waiting / ended overlay
    if (round.phase === 'waiting') {
      this.drawCenterMessage(ctx, `Round ${round.roundNumber + 1} starting in ${Math.ceil(round.timeRemainingMs / 1000)}...`);
    }
  }

  private drawRoundInfo(ctx: CanvasRenderingContext2D, phase: string, roundNum: number, timeMs: number): void {
    ctx.textAlign = 'center';

    if (phase === 'playing') {
      const secs = Math.ceil(timeMs / 1000);
      const min = Math.floor(secs / 60);
      const sec = secs % 60;
      const timeStr = `${min}:${sec.toString().padStart(2, '0')}`;

      ctx.font = 'bold 28px monospace';
      this.textWithShadow(ctx, `Round ${roundNum}  —  ${timeStr}`, ARENA_WIDTH / 2, 38, '#fff');
    } else if (phase === 'ended') {
      ctx.font = 'bold 28px monospace';
      this.textWithShadow(ctx, `Round ${roundNum} — Finished!`, ARENA_WIDTH / 2, 38, '#feca57');
    }
  }

  private drawScores(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot): void {
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'left';

    const { revealScores } = snapshot.round;

    // Sort snakes by reveal score descending
    const sorted = [...snapshot.snakes].sort((a, b) => {
      const sa = revealScores[a.id] ?? 0;
      const sb = revealScores[b.id] ?? 0;
      return sb - sa;
    });

    let y = 70;
    for (const snake of sorted) {
      const blocks = revealScores[snake.id] ?? 0;
      const status = snake.alive ? '' : '  [DEAD]';
      const ghostTag = snake.ghosting ? ' [GHOST]' : '';

      this.textWithShadow(ctx, `${snake.name}: ${blocks} blocks${status}${ghostTag}`, 20, y, snake.color);
      y += 28;
    }
  }

  private drawWinnerOverlay(ctx: CanvasRenderingContext2D): void {
    if (!this.winnerDisplay) return;

    // Semi-transparent background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    const boxW = 600;
    const boxH = 120;
    const boxX = (ARENA_WIDTH - boxW) / 2;
    const boxY = (ARENA_HEIGHT - boxH) / 2 - 50;
    ctx.fillRect(boxX, boxY, boxW, boxH);

    // Border
    ctx.strokeStyle = '#feca57';
    ctx.lineWidth = 3;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.textAlign = 'center';
    ctx.font = 'bold 36px monospace';
    this.textWithShadow(ctx, `${this.winnerDisplay.name} wins!`, ARENA_WIDTH / 2, boxY + 50, '#feca57');

    ctx.font = 'bold 22px monospace';
    this.textWithShadow(ctx, `${this.winnerDisplay.score} blocks revealed`, ARENA_WIDTH / 2, boxY + 90, '#fff');
  }

  private drawCenterMessage(ctx: CanvasRenderingContext2D, msg: string): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, ARENA_HEIGHT / 2 - 40, ARENA_WIDTH, 80);

    ctx.textAlign = 'center';
    ctx.font = 'bold 36px monospace';
    this.textWithShadow(ctx, msg, ARENA_WIDTH / 2, ARENA_HEIGHT / 2 + 12, '#fff');
  }

  private textWithShadow(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): void {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillText(text, x + 2, y + 2);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
}
