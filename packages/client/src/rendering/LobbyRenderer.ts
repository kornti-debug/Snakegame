import type { LobbyPlayer } from '@snakegame/shared';
import { ARENA_WIDTH, ARENA_HEIGHT, PLAYER_COLORS } from '@snakegame/shared';

export class LobbyRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pulseTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  render(players: LobbyPlayer[]): void {
    const ctx = this.ctx;
    this.pulseTime += 0.03;

    ctx.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Animated grid
    this.drawAnimatedGrid(ctx);

    // Title
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const titlePulse = 1 + Math.sin(this.pulseTime * 2) * 0.02;
    ctx.save();
    ctx.translate(ARENA_WIDTH / 2, 140);
    ctx.scale(titlePulse, titlePulse);
    ctx.font = 'bold 72px monospace';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#44aaff';
    ctx.shadowBlur = 20;
    ctx.fillText('SNAKE GAME', 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.font = '24px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('Reveal the hidden image!', ARENA_WIDTH / 2, 200);

    // Player slots
    const slotWidth = 350;
    const slotHeight = 280;
    const gap = 60;
    const maxSlots = 4;
    const totalWidth = maxSlots * slotWidth + (maxSlots - 1) * gap;
    const startX = (ARENA_WIDTH - totalWidth) / 2;
    const slotY = 300;

    for (let i = 0; i < maxSlots; i++) {
      const x = startX + i * (slotWidth + gap);
      const player = players.find(p => p.index === i);
      this.drawPlayerSlot(ctx, x, slotY, slotWidth, slotHeight, i, player);
    }

    // Instructions
    const instrY = slotY + slotHeight + 60;
    ctx.font = '20px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'center';
    ctx.fillText('Player 1: Press A or D to join  |  Player 2: Press ← or → to join', ARENA_WIDTH / 2, instrY);

    // Start button hint
    if (players.length >= 1) {
      const startPulse = 0.7 + Math.sin(this.pulseTime * 4) * 0.3;
      ctx.font = 'bold 28px monospace';
      ctx.fillStyle = `rgba(68, 255, 68, ${startPulse})`;
      ctx.fillText('Press ENTER to start', ARENA_WIDTH / 2, instrY + 50);
    }

    // Escape hint
    ctx.font = '16px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText('Double-click for fullscreen  |  ESC to return to lobby during game', ARENA_WIDTH / 2, ARENA_HEIGHT - 40);
  }

  private drawPlayerSlot(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    index: number, player?: LobbyPlayer,
  ): void {
    // Slot background
    ctx.fillStyle = player ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)';
    ctx.strokeStyle = player ? player.color : 'rgba(255,255,255,0.1)';
    ctx.lineWidth = player ? 3 : 1;

    // Rounded rect
    const r = 12;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const cx = x + w / 2;

    if (player) {
      // Player number
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'center';
      ctx.fillText(`PLAYER ${index + 1}`, cx, y + 30);

      // Snake preview (colored circle)
      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.arc(cx, y + 90, 30, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      for (const side of [-1, 1]) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx + side * 12, y + 83, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(cx + side * 12, y + 82, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Name
      ctx.font = 'bold 26px monospace';
      ctx.fillStyle = player.color;
      ctx.fillText(player.name, cx, y + 150);

      // Color hint
      ctx.font = '14px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillText('Press up/down to change color', cx, y + 180);

      // Ready state
      if (player.ready) {
        ctx.font = 'bold 22px monospace';
        ctx.fillStyle = '#44ff44';
        ctx.fillText('READY', cx, y + 230);
      } else {
        ctx.font = '18px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText('Press Space to ready', cx, y + 230);
      }
    } else {
      // Empty slot
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.textAlign = 'center';
      ctx.fillText(`PLAYER ${index + 1}`, cx, y + 30);

      const pulse = 0.2 + Math.sin(this.pulseTime * 2 + index) * 0.1;
      ctx.font = '40px monospace';
      ctx.fillStyle = `rgba(255,255,255,${pulse})`;
      ctx.fillText('+', cx, y + h / 2);

      ctx.font = '16px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillText('Press to join', cx, y + h / 2 + 40);
    }
  }

  private drawAnimatedGrid(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = 'rgba(68, 170, 255, 0.04)';
    ctx.lineWidth = 1;
    const step = 40;
    const offset = (this.pulseTime * 10) % step;

    for (let x = -step + offset; x <= ARENA_WIDTH + step; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ARENA_HEIGHT);
      ctx.stroke();
    }
    for (let y = -step + offset; y <= ARENA_HEIGHT + step; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(ARENA_WIDTH, y);
      ctx.stroke();
    }
  }
}
