import type { LobbyPlayer, BoardPreset } from '@snakegame/shared';
import { ARENA_WIDTH, ARENA_HEIGHT, BOARD_PRESETS } from '@snakegame/shared';
import { BackgroundBoids } from './BackgroundBoids.js';
import type { QrCache } from './QrCache.js';

const PRESET_ORDER: BoardPreset[] = ['small', 'medium', 'large', 'huge'];

export class LobbyRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pulseTime = 0;
  private boids: BackgroundBoids;
  private qr?: QrCache;

  constructor(canvas: HTMLCanvasElement, boids?: BackgroundBoids, qr?: QrCache) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.boids = boids ?? new BackgroundBoids();
    this.qr = qr;
  }

  render(players: LobbyPlayer[], boardPreset: BoardPreset = 'medium'): void {
    const ctx = this.ctx;
    this.pulseTime += 0.03;

    ctx.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    this.drawAnimatedGrid(ctx);
    this.boids.render(ctx);

    // Title
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const titlePulse = 1 + Math.sin(this.pulseTime * 2) * 0.02;
    ctx.save();
    ctx.translate(ARENA_WIDTH / 2, 90);
    ctx.scale(titlePulse, titlePulse);
    ctx.font = 'bold 56px monospace';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#44aaff';
    ctx.shadowBlur = 18;
    ctx.fillText('SNAKE MEMORY', 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.font = '20px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('Join and choose a board', ARENA_WIDTH / 2, 135);

    // --- Player slots ---
    const slotWidth = 320;
    const slotHeight = 240;
    const gap = 50;
    const maxSlots = 4;
    const totalWidth = maxSlots * slotWidth + (maxSlots - 1) * gap;
    const startX = (ARENA_WIDTH - totalWidth) / 2;
    const slotY = 180;

    for (let i = 0; i < maxSlots; i++) {
      const x = startX + i * (slotWidth + gap);
      const player = players.find(p => p.index === i);
      this.drawPlayerSlot(ctx, x, slotY, slotWidth, slotHeight, i, player);
    }

    // --- Board preset cards ---
    const cardsY = slotY + slotHeight + 40;
    this.drawPresetCards(ctx, cardsY, boardPreset);

    // --- Join + start hints ---
    const hintY = cardsY + 230;
    ctx.font = '18px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'center';
    ctx.fillText('P1: A/D join, W/S color  ·  P2: ←/→ join, ↑/↓ color  ·  1-4: pick board', ARENA_WIDTH / 2, hintY);

    if (players.length >= 1) {
      const startPulse = 0.7 + Math.sin(this.pulseTime * 4) * 0.3;
      ctx.font = 'bold 26px monospace';
      ctx.fillStyle = `rgba(68, 255, 68, ${startPulse})`;
      ctx.fillText('Press ENTER to start', ARENA_WIDTH / 2, hintY + 36);
    }

    // Escape hint
    ctx.font = '14px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText('ESC returns to main menu  ·  double-click for fullscreen', ARENA_WIDTH / 2, ARENA_HEIGHT - 30);

    // QR code (top-right) — scan with phone to join as a player
    if (this.qr) this.drawQrBlock(ctx);
  }

  private drawQrBlock(ctx: CanvasRenderingContext2D): void {
    const qr = this.qr!;
    const canvas = qr.getCanvas();
    const size = 200;
    const x = ARENA_WIDTH - size - 40;
    const y = 40;

    // White backing
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 8, y - 8, size + 16, size + 16 + 40);

    if (canvas) {
      ctx.drawImage(canvas, x, y, size, size);
    } else {
      ctx.fillStyle = '#888';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('QR…', x + size / 2, y + size / 2);
    }

    ctx.fillStyle = '#0a0a1a';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('SCAN TO JOIN', x + size / 2, y + size + 6);
    ctx.font = '10px monospace';
    ctx.fillStyle = '#444';
    ctx.fillText(qr.url.replace(/^https?:\/\//, ''), x + size / 2, y + size + 22);
  }

  private drawPresetCards(ctx: CanvasRenderingContext2D, y: number, selected: BoardPreset): void {
    const cardW = 280, cardH = 180, gap = 32;
    const totalW = PRESET_ORDER.length * cardW + (PRESET_ORDER.length - 1) * gap;
    const startX = (ARENA_WIDTH - totalW) / 2;

    PRESET_ORDER.forEach((preset, i) => {
      const x = startX + i * (cardW + gap);
      const isSel = preset === selected;
      this.drawPresetCard(ctx, x, y, cardW, cardH, preset, isSel, i + 1);
    });
  }

  private drawPresetCard(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    preset: BoardPreset, selected: boolean, keyNum: number,
  ): void {
    const cfg = BOARD_PRESETS[preset];
    const r = 10;

    // Card background
    ctx.save();
    ctx.fillStyle = selected ? 'rgba(68, 255, 68, 0.10)' : 'rgba(255,255,255,0.04)';
    ctx.strokeStyle = selected ? '#44ff44' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = selected ? 3 : 1;
    if (selected) {
      ctx.shadowColor = '#44ff44';
      ctx.shadowBlur = 12;
    }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Label (top)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = selected ? '#88ff88' : 'rgba(255,255,255,0.35)';
    ctx.fillText(`[${keyNum}]`, x + 14, y + 12);

    ctx.textAlign = 'right';
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = selected ? '#fff' : 'rgba(255,255,255,0.7)';
    ctx.fillText(preset.toUpperCase(), x + w - 14, y + 10);

    // Mini board preview — draw the actual grid at scale
    const previewArea = { x: x + 14, y: y + 44, w: w - 28, h: h - 74 };
    this.drawBoardPreview(ctx, previewArea.x, previewArea.y, previewArea.w, previewArea.h, cfg.cols, cfg.rows, selected);

    // Stats (bottom)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = selected ? '#ccffcc' : 'rgba(255,255,255,0.5)';
    ctx.fillText(`${cfg.cols}×${cfg.rows} · ${cfg.pairCount} pairs`, x + w / 2, y + h - 12);
  }

  private drawBoardPreview(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    cols: number, rows: number, highlight: boolean,
  ): void {
    // Cell size keeping aspect ratio
    const cellSize = Math.min(w / cols, h / rows);
    const gridW = cellSize * cols;
    const gridH = cellSize * rows;
    const ox = x + (w - gridW) / 2;
    const oy = y + (h - gridH) / 2;

    const inner = cellSize * 0.82;
    const pad = (cellSize - inner) / 2;

    ctx.fillStyle = highlight ? 'rgba(136, 255, 136, 0.65)' : 'rgba(136, 180, 220, 0.4)';
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        ctx.fillRect(ox + col * cellSize + pad, oy + row * cellSize + pad, inner, inner);
      }
    }
  }

  private drawPlayerSlot(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    index: number, player?: LobbyPlayer,
  ): void {
    ctx.fillStyle = player ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)';
    ctx.strokeStyle = player ? player.color : 'rgba(255,255,255,0.1)';
    ctx.lineWidth = player ? 3 : 1;

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
      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`PLAYER ${index + 1}`, cx, y + 28);

      // Snake head
      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.arc(cx, y + 78, 28, 0, Math.PI * 2);
      ctx.fill();
      for (const side of [-1, 1]) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx + side * 11, y + 72, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(cx + side * 11, y + 71, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.font = 'bold 22px monospace';
      ctx.fillStyle = player.color;
      ctx.fillText(player.name, cx, y + 140);

      ctx.font = '13px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillText('up/down to change color', cx, y + 165);

      if (player.ready) {
        ctx.font = 'bold 20px monospace';
        ctx.fillStyle = '#44ff44';
        ctx.fillText('READY', cx, y + 205);
      }
    } else {
      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.textAlign = 'center';
      ctx.fillText(`PLAYER ${index + 1}`, cx, y + 28);

      const pulse = 0.2 + Math.sin(this.pulseTime * 2 + index) * 0.1;
      ctx.font = '36px monospace';
      ctx.fillStyle = `rgba(255,255,255,${pulse})`;
      ctx.fillText('+', cx, y + h / 2);

      ctx.font = '14px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillText('press to join', cx, y + h / 2 + 32);
    }
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
