import { ARENA_WIDTH, ARENA_HEIGHT } from '@snakegame/shared';
import type { RoundEndReason } from '@snakegame/shared';

export type GameOverAction = 'restart' | 'main-menu';

export type GameOverBanner = {
  winner: { name: string; color: string; score: number } | null;
  reason: RoundEndReason;
};

interface HitZone {
  x: number; y: number; w: number; h: number;
  action: GameOverAction;
}

const REASON_SUBTITLE: Record<RoundEndReason, string> = {
  'decisive-lead': 'Pair score can no longer be caught — round over!',
  'board-complete': 'Every pair has been matched — round over!',
  'viewer-guess': 'Stream / audience guess ended the round.',
  'admin': 'Host or external control ended the round.',
  'last-alive': 'Last snake standing wins!',
  'timer': 'Timer expired — most boids eaten wins!',
};

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

  /** `banner` is null only before the first round-end of a session — draws
   *  a minimal safe state. */
  render(banner: GameOverBanner | null): void {
    const b: GameOverBanner = banner ?? {
      winner: null,
      reason: 'board-complete',
    };
    const ctx = this.ctx;
    this.pulseTime += 0.04;
    this.hitZones = [];

    // Dim whatever was drawn behind (the frozen game state).
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Modal card
    const cardW = 920;
    const cardH = 600;
    const cardX = (ARENA_WIDTH - cardW) / 2;
    const cardY = (ARENA_HEIGHT - cardH) / 2;

    ctx.fillStyle = '#141428';
    ctx.fillRect(cardX, cardY, cardW, cardH);

    // Pulsing winner-colored border (soft golden if draw).
    const borderColor = b.winner?.color ?? '#feca57';
    const pulse = 0.6 + Math.sin(this.pulseTime * 3) * 0.4;
    ctx.save();
    ctx.shadowColor = borderColor;
    ctx.shadowBlur = 24 + pulse * 24;
    ctx.lineWidth = 5;
    ctx.strokeStyle = borderColor;
    ctx.strokeRect(cardX, cardY, cardW, cardH);
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Top: clear headline
    ctx.font = 'bold 34px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText('ROUND COMPLETE', ARENA_WIDTH / 2, cardY + 52);

    ctx.font = '20px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fillText(REASON_SUBTITLE[b.reason], ARENA_WIDTH / 2, cardY + 92);

    if (b.winner) {
      ctx.font = 'bold 28px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillText('WINNER', ARENA_WIDTH / 2, cardY + 150);

      // Big winner name in the player's color with a soft glow.
      ctx.save();
      ctx.shadowColor = b.winner.color;
      ctx.shadowBlur = 26 + pulse * 20;
      ctx.font = 'bold 86px monospace';
      ctx.fillStyle = b.winner.color;
      ctx.fillText(b.winner.name.toUpperCase(), ARENA_WIDTH / 2, cardY + 240);
      ctx.restore();

      ctx.font = 'bold 32px monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText('WINS', ARENA_WIDTH / 2, cardY + 318);

      ctx.font = 'bold 22px monospace';
      ctx.fillStyle = 'rgba(255, 215, 0, 0.95)';
      // Mode-specific scoring label — boid-battle counts boids, memory counts pairs.
      const isBoidBattle = b.reason === 'last-alive' || b.reason === 'timer';
      const label = isBoidBattle
        ? `${b.winner.score} ${b.winner.score === 1 ? 'boid' : 'boids'} eaten`
        : `${b.winner.score} ${b.winner.score === 1 ? 'pair' : 'pairs'} matched`;
      ctx.fillText(label, ARENA_WIDTH / 2, cardY + 368);
    } else {
      ctx.font = 'bold 72px monospace';
      ctx.fillStyle = '#feca57';
      ctx.fillText('DRAW', ARENA_WIDTH / 2, cardY + 260);
      ctx.font = 'bold 22px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.fillText('No single winner — tied at the top', ARENA_WIDTH / 2, cardY + 340);
    }

    // Buttons row
    const btnW = 280;
    const btnH = 80;
    const gap = 40;
    const totalW = btnW * 2 + gap;
    const startX = (ARENA_WIDTH - totalW) / 2;
    const btnY = cardY + cardH - btnH - 48;

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
