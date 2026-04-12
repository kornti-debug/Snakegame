import { ARENA_WIDTH, ARENA_HEIGHT } from '@snakegame/shared';

export class InstructionsRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pulseTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  render(): void {
    const ctx = this.ctx;
    this.pulseTime += 0.02;

    ctx.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Title
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 64px monospace';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#44aaff';
    ctx.shadowBlur = 20;
    ctx.fillText('HOW TO PLAY', ARENA_WIDTH / 2, 100);
    ctx.shadowBlur = 0;

    // Two-column layout
    const colW = 780;
    const leftX = ARENA_WIDTH / 2 - colW - 40;
    const rightX = ARENA_WIDTH / 2 + 40;
    const topY = 200;

    this.drawSection(ctx, leftX, topY, colW, 'GOAL', [
      'Reveal hidden symbols on the board.',
      'Each symbol appears on TWO tiles.',
      'Capture 90% of a tile to claim it.',
      'Capture both tiles of a pair with the',
      '  SAME snake → you match the pair.',
      'Most matched pairs when the round',
      'ends wins.',
    ]);

    this.drawSection(ctx, rightX, topY, colW, 'CONTROLS', [
      'Players:  join by scanning the QR',
      '          code in the lobby with',
      '          your phone.',
      '          Pick name, color, team on',
      '          the phone. Tap-and-hold',
      '          left / right to steer.',
      'Host:     click presets / kick X.',
      '          ENTER to start, ESC to',
      '          pause or go back.',
    ]);

    this.drawSection(ctx, leftX, topY + 360, colW, 'POWER-UPS', [
      '●  Speed Boost   — move faster',
      '●  Wide Trail    — reveal wider area',
      '●  Ghost         — pass through snakes',
      '●  Star          — invincible, kills on touch',
      '●  Swarm Leader  — boids follow you',
      '●  Predator      — boids flee from you',
      '●  Growth        — permanent wider trail',
    ]);

    this.drawSection(ctx, rightX, topY + 360, colW, 'THREATS', [
      'Walls    — hit them and you die',
      'Snakes   — colliding with another',
      '           snake kills you',
      'Boids    — small AI creatures',
      '           touching them = death',
      'Obstacles — placed by viewers',
      'Tip: use Ghost / Star to survive',
      '     heavy traffic zones',
    ]);

    // Footer
    const pulse = 0.6 + Math.sin(this.pulseTime * 4) * 0.4;
    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = `rgba(255,255,255,${pulse})`;
    ctx.textAlign = 'center';
    ctx.fillText('Press ESC to return', ARENA_WIDTH / 2, ARENA_HEIGHT - 60);
  }

  private drawSection(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number,
    title: string, lines: string[],
  ): void {
    // Section box
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.strokeStyle = 'rgba(68,170,255,0.3)';
    ctx.lineWidth = 2;
    const h = 50 + lines.length * 32 + 20;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    // Title
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = '#44aaff';
    ctx.fillText(title, x + 24, y + 16);

    // Lines
    ctx.font = '20px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    lines.forEach((line, i) => {
      ctx.fillText(line, x + 24, y + 60 + i * 32);
    });
  }
}
