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
    this.winnerTimer = 6000;
  }

  render(snapshot: GameSnapshot): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    const { round } = snapshot;
    const isBoidBattle = snapshot.gameMode === 'boid-battle';

    this.drawRoundInfo(ctx, round.phase, round.roundNumber, isBoidBattle);

    // Player scores (top-left). In boid-battle, show boidsEaten instead.
    if (isBoidBattle) {
      this.drawBoidBattleScores(ctx, snapshot);
    } else {
      this.drawScores(ctx, snapshot);
    }

    if (!isBoidBattle) {
      const pairs = snapshot.memoryBoard.pairs;
      const totalPairs = pairs.length;
      const matchedCount = pairs.filter(p => p.matched).length;
      const neutralCount = pairs.filter(p => p.neutralized).length;
      const pending = pairs.filter(p => !p.matched && !p.neutralized).length;
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'right';
      this.textWithShadow(
        ctx,
        `Pairs: ${matchedCount} won · ${neutralCount} split · ${pending} open / ${totalPairs}`,
        ARENA_WIDTH - 20,
        34,
        '#FFD700',
      );
    }

    // Powerup legend (bottom-right) — memory modes only.
    if (round.phase === 'playing' && !isBoidBattle) {
      this.drawPowerUpLegend(ctx);
    }

    // Winner overlay
    if (this.winnerTimer > 0) {
      this.drawWinnerOverlay(ctx);
      this.winnerTimer -= 16;
    } else {
      this.winnerDisplay = null;
    }

    // Pre-round countdown — only used at the start of the (single) round.
    if (round.phase === 'waiting') {
      const s = Math.ceil(round.timeRemainingMs / 1000);
      this.drawCenterMessage(ctx, `Starting in ${s}…`);
    }
  }

  private drawRoundInfo(ctx: CanvasRenderingContext2D, phase: string, _roundNum: number, isBoidBattle: boolean): void {
    ctx.textAlign = 'center';

    if (phase === 'playing') {
      ctx.font = 'bold 26px monospace';
      const msg = isBoidBattle ? `Eat the boids — last alive wins!` : `Win on pairs!`;
      this.textWithShadow(ctx, msg, ARENA_WIDTH / 2, 38, '#fff');
    } else if (phase === 'ended') {
      ctx.font = 'bold 28px monospace';
      this.textWithShadow(ctx, `Game over`, ARENA_WIDTH / 2, 38, '#feca57');
    }
  }

  private drawBoidBattleScores(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot): void {
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'left';
    const sorted = [...snapshot.snakes].sort((a, b) => b.boidsEaten - a.boidsEaten);
    let y = 70;
    for (const snake of sorted) {
      const status = snake.alive ? '' : '  [DEAD]';
      this.textWithShadow(
        ctx,
        `${snake.name}: ${snake.boidsEaten} eaten${status}`,
        20, y, snake.color,
      );
      y += 28;
    }
  }

  private drawScores(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot): void {
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'left';

    const { pairScores } = snapshot.round;

    // Sort snakes by pair score descending
    const sorted = [...snapshot.snakes].sort((a, b) => {
      const sa = pairScores[a.id] ?? 0;
      const sb = pairScores[b.id] ?? 0;
      return sb - sa;
    });

    let y = 70;
    for (const snake of sorted) {
      const pairs = pairScores[snake.id] ?? 0;
      const status = snake.alive ? '' : '  [DEAD]';
      const ghostTag = snake.ghosting ? ' [GHOST]' : '';

      this.textWithShadow(
        ctx,
        `${snake.name}: ${pairs} pair${pairs !== 1 ? 's' : ''}${status}${ghostTag}`,
        20, y, snake.color,
      );
      y += 28;
    }
  }

  private drawWinnerOverlay(ctx: CanvasRenderingContext2D): void {
    if (!this.winnerDisplay) return;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    const boxW = 600;
    const boxH = 120;
    const boxX = (ARENA_WIDTH - boxW) / 2;
    const boxY = (ARENA_HEIGHT - boxH) / 2 - 50;
    ctx.fillRect(boxX, boxY, boxW, boxH);

    ctx.strokeStyle = '#feca57';
    ctx.lineWidth = 3;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.textAlign = 'center';
    ctx.font = 'bold 36px monospace';
    this.textWithShadow(ctx, `${this.winnerDisplay.name} wins!`, ARENA_WIDTH / 2, boxY + 50, '#feca57');

    ctx.font = 'bold 22px monospace';
    this.textWithShadow(ctx, `${this.winnerDisplay.score} pairs matched`, ARENA_WIDTH / 2, boxY + 90, '#fff');
  }

  private drawCenterMessage(ctx: CanvasRenderingContext2D, msg: string): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, ARENA_HEIGHT / 2 - 40, ARENA_WIDTH, 80);

    ctx.textAlign = 'center';
    ctx.font = 'bold 36px monospace';
    this.textWithShadow(ctx, msg, ARENA_WIDTH / 2, ARENA_HEIGHT / 2 + 12, '#fff');
  }

  private drawPowerUpLegend(ctx: CanvasRenderingContext2D): void {
    const legend = [
      { icon: '⚡', color: '#ffaa00', name: 'Speed Boost' },
      { icon: '◎', color: '#44ff44', name: 'Wide Trail' },
      { icon: '👻', color: '#88aaff', name: 'Ghost Mode' },
      { icon: '⭐', color: '#FFD700', name: 'Star (kill!)' },
      { icon: '🐟', color: '#44FFAA', name: 'Swarm Leader' },
      { icon: '🦈', color: '#FF4466', name: 'Predator' },
      { icon: '🌱', color: '#44FF88', name: 'Growth (+20%)' },
    ];

    const x = ARENA_WIDTH - 170;
    let y = ARENA_HEIGHT - legend.length * 22 - 10;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.roundRect(x - 10, y - 16, 175, legend.length * 22 + 14, 6);
    ctx.fill();

    ctx.font = '13px monospace';
    ctx.textAlign = 'left';
    for (const item of legend) {
      this.textWithShadow(ctx, `${item.icon} ${item.name}`, x, y, item.color);
      y += 22;
    }
    ctx.restore();
  }

  private textWithShadow(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): void {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillText(text, x + 2, y + 2);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
}
