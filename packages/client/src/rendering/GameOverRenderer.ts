import { ARENA_WIDTH, ARENA_HEIGHT } from '@snakegame/shared';

export type GameOverAction = 'restart' | 'main-menu';

interface HitZone {
  x: number; y: number; w: number; h: number;
  action: GameOverAction;
}

/** End-of-game modal popup. Drawn as an overlay on top of whatever the
 *  caller already rendered (the last in-game frame) — semi-transparent
 *  backdrop darkens the background, centered card shows the winner, two
 *  clickable buttons underneath. Keyboard shortcuts are bound in main.ts. */
export class GameOverRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pulseTime = 0;
  private hitZones: HitZone[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  hit(x: number, y: number): GameOverAction | null {
    for (let i = this.hitZones.length - 1; i >= 0; i--) {
      const z = this.hitZones[i];
      if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return z.action;
    }
    return null;
  }

  /** `winner` is null on a draw / game ended without a decisive winner. */
  render(winner: { name: string; color: string; score: number } | null): void {
    const ctx = this.ctx;
    this.pulseTime += 0.04;
    this.hitZones = [];

    // Dim whatever was drawn behind (the frozen game state).
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Modal card
    const cardW = 900;
    const cardH = 560;
    const cardX = (ARENA_WIDTH - cardW) / 2;
    const cardY = (ARENA_HEIGHT - cardH) / 2;

    ctx.fillStyle = '#141428';
    ctx.fillRect(cardX, cardY, cardW, cardH);

    // Pulsing winner-colored border (soft golden if draw).
    const borderColor = winner?.color ?? '#feca57';
    const pulse = 0.6 + Math.sin(this.pulseTime * 3) * 0.4;
    ctx.save();
    ctx.shadowColor = borderColor;
    ctx.shadowBlur = 24 + pulse * 24;
    ctx.lineWidth = 4;
    ctx.strokeStyle = borderColor;
    ctx.strokeRect(cardX, cardY, cardW, cardH);
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Eyebrow
    ctx.font = 'bold 26px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fillText('GAME OVER', ARENA_WIDTH / 2, cardY + 70);

    if (winner) {
      // Big winner name in the player's color with a soft glow.
      ctx.save();
      ctx.shadowColor = winner.color;
      ctx.shadowBlur = 26 + pulse * 20;
      ctx.font = 'bold 88px monospace';
      ctx.fillStyle = winner.color;
      ctx.fillText(winner.name.toUpperCase(), ARENA_WIDTH / 2, cardY + 200);
      ctx.restore();

      ctx.font = 'bold 36px monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText('WINS', ARENA_WIDTH / 2, cardY + 280);

      ctx.font = 'bold 24px monospace';
      ctx.fillStyle = 'rgba(255, 215, 0, 0.9)';
      const pairLabel = winner.score === 1 ? 'pair' : 'pairs';
      ctx.fillText(`${winner.score} ${pairLabel} matched`, ARENA_WIDTH / 2, cardY + 330);
    } else {
      ctx.font = 'bold 80px monospace';
      ctx.fillStyle = '#feca57';
      ctx.fillText('DRAW', ARENA_WIDTH / 2, cardY + 230);
      ctx.font = 'bold 24px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillText('No decisive winner', ARENA_WIDTH / 2, cardY + 300);
    }

    // Buttons row
    const btnW = 280;
    const btnH = 80;
    const gap = 40;
    const totalW = btnW * 2 + gap;
    const startX = (ARENA_WIDTH - totalW) / 2;
    const btnY = cardY + cardH - btnH - 50;

    this.drawButton(ctx, startX, btnY, btnW, btnH, 'RESTART', '#44ff44', 'restart');
    this.drawButton(ctx, startX + btnW + gap, btnY, btnW, btnH, 'MAIN MENU', '#ff8844', 'main-menu');

    // Keyboard hint under the buttons
    ctx.font = '16px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillText(
      'ENTER / R  restart   ·   ESC / M  main menu',
      ARENA_WIDTH / 2,
      cardY + cardH - 18,
    );
  }

  private drawButton(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    color: string,
    action: GameOverAction,
  ): void {
    this.hitZones.push({ x, y, w, h, action });

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(x, y, w, h);
    ctx.lineWidth = 3;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 34px monospace';
    ctx.fillStyle = color;
    ctx.fillText(label, x + w / 2, y + h / 2);
  }
}
