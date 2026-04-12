import { ARENA_WIDTH, ARENA_HEIGHT } from '@snakegame/shared';
import { BackgroundBoids } from './BackgroundBoids.js';

export type MenuEntry = 'play' | 'instructions';

const ENTRIES: { id: MenuEntry; label: string }[] = [
  { id: 'play', label: 'PLAY' },
  { id: 'instructions', label: 'INSTRUCTIONS' },
];

export class MainMenuRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pulseTime = 0;
  private selection = 0;
  private boids: BackgroundBoids;

  constructor(canvas: HTMLCanvasElement, boids?: BackgroundBoids) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.boids = boids ?? new BackgroundBoids();
  }

  get selected(): MenuEntry { return ENTRIES[this.selection].id; }

  move(dir: -1 | 1): void {
    this.selection = (this.selection + dir + ENTRIES.length) % ENTRIES.length;
  }

  render(): void {
    const ctx = this.ctx;
    this.pulseTime += 0.03;

    ctx.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    this.drawAnimatedGrid(ctx);

    // Ambient flocking boids behind everything
    this.boids.render(ctx);

    // Title
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const titlePulse = 1 + Math.sin(this.pulseTime * 2) * 0.02;
    ctx.save();
    ctx.translate(ARENA_WIDTH / 2, 260);
    ctx.scale(titlePulse, titlePulse);
    ctx.font = 'bold 110px monospace';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#44aaff';
    ctx.shadowBlur = 30;
    ctx.fillText('SNAKE MEMORY', 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.font = '26px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('Reveal, capture, match the pairs', ARENA_WIDTH / 2, 340);

    // Menu entries
    const startY = 520;
    const spacing = 90;
    ENTRIES.forEach((entry, i) => {
      const y = startY + i * spacing;
      const isSel = i === this.selection;
      const pulse = 0.7 + Math.sin(this.pulseTime * 4) * 0.3;

      ctx.font = 'bold 48px monospace';
      if (isSel) {
        ctx.fillStyle = `rgba(68, 255, 68, ${pulse})`;
        ctx.fillText(`> ${entry.label} <`, ARENA_WIDTH / 2, y);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText(entry.label, ARENA_WIDTH / 2, y);
      }
    });

    // Footer hint
    ctx.font = '18px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('↑ / ↓  select   ·   ENTER  confirm   ·   double-click  fullscreen', ARENA_WIDTH / 2, ARENA_HEIGHT - 60);
  }

  private drawAnimatedGrid(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = 'rgba(68, 170, 255, 0.04)';
    ctx.lineWidth = 1;
    const step = 40;
    const offset = (this.pulseTime * 10) % step;
    for (let x = -step + offset; x <= ARENA_WIDTH + step; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ARENA_HEIGHT); ctx.stroke();
    }
    for (let y = -step + offset; y <= ARENA_HEIGHT + step; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ARENA_WIDTH, y); ctx.stroke();
    }
  }
}
