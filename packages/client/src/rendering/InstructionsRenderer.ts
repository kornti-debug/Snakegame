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

    this.drawSection(ctx, leftX, topY, colW, 'SNAKE MEMORY', [
      'Reveal hidden symbols on the board.',
      'Each symbol appears on TWO tiles.',
      'Capture 80% of a tile to claim it,',
      'then both tiles of a pair with the',
      '  SAME snake to match it.',
      'Most matched pairs when the round',
      'ends wins. Power-ups + bonus pair',
      'spice things up.',
    ]);

    this.drawSection(ctx, rightX, topY, colW, 'BOID BATTLE', [
      'Two-player duel on the DDJ deck.',
      'No tiles, no power-ups — just',
      '  hunt the boids.',
      'Eat boids by touching them with',
      '  your head. Most eaten wins.',
      'Last snake alive wins outright.',
      '90 seconds. Whichever comes first.',
    ]);

    this.drawSection(ctx, leftX, topY + 360, colW, 'CONTROLS', [
      'Phone:    scan the lobby QR.',
      '          Tap & hold L / R to steer.',
      'DDJ-400:  spin jog to steer.',
      '          PLAY = brake + activate.',
      '          CUE  = turbo (held).',
      'Keyboard: WASD or Arrows to steer.',
      'Host:     ENTER start, ESC pause.',
    ]);

    this.drawSection(ctx, rightX, topY + 360, colW, 'THREATS', [
      'Walls   — hit them and you die.',
      'Snakes  — colliding with another',
      '          snake kills you.',
      'Boids   — touching one kills you',
      '          (Memory mode). In Boid',
      '          Battle they are FOOD.',
      'Tip:    use Ghost / Star to survive',
      '          heavy traffic in Memory.',
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
    // Section box (outline only)
    ctx.strokeStyle = '#5a8ec4';
    ctx.lineWidth = 2;
    const h = 50 + lines.length * 32 + 20;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    // Title
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = '#44aaff';
    ctx.fillText(title, x + 24, y + 16);

    // Lines
    ctx.font = '20px monospace';
    ctx.fillStyle = '#dce4f0';
    lines.forEach((line, i) => {
      ctx.fillText(line, x + 24, y + 60 + i * 32);
    });
  }
}
