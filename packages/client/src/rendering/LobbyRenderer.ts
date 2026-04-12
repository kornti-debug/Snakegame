import type { LobbyPlayer, BoardPreset } from '@snakegame/shared';
import { ARENA_WIDTH, ARENA_HEIGHT, BOARD_PRESETS, MAX_PLAYERS } from '@snakegame/shared';
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
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const titlePulse = 1 + Math.sin(this.pulseTime * 2) * 0.02;
    ctx.save();
    ctx.translate(80, 110);
    ctx.scale(titlePulse, titlePulse);
    ctx.font = 'bold 56px monospace';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#44aaff';
    ctx.shadowBlur = 18;
    ctx.fillText('SNAKE MEMORY', 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.font = '20px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText('Join and play together', 80, 150);

    // QR code (top-right)
    if (this.qr) this.drawQrBlock(ctx);

    // Player list
    const listX = 80;
    const listY = 200;
    const listW = 900;
    this.drawPlayerList(ctx, listX, listY, listW, players);

    // Board preset cards (bottom area)
    const cardsY = 740;
    this.drawPresetCards(ctx, cardsY, boardPreset);

    // Hint lines
    const hintY = 960;
    ctx.font = '16px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'center';
    ctx.fillText(
      'P1: A/D join, W/S color  ·  P2: ←/→ join, ↑/↓ color  ·  phones join via QR  ·  1-4: pick board  ·  Shift+1-9/0: kick',
      ARENA_WIDTH / 2, hintY,
    );

    if (players.length >= 1) {
      const startPulse = 0.7 + Math.sin(this.pulseTime * 4) * 0.3;
      ctx.font = 'bold 26px monospace';
      ctx.fillStyle = `rgba(68, 255, 68, ${startPulse})`;
      ctx.fillText('Press ENTER to start', ARENA_WIDTH / 2, hintY + 34);
    } else {
      ctx.font = '16px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillText('Waiting for a player to join…', ARENA_WIDTH / 2, hintY + 34);
    }

    ctx.font = '13px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText('ESC returns to main menu  ·  double-click for fullscreen', ARENA_WIDTH / 2, ARENA_HEIGHT - 24);
  }

  private drawPlayerList(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number,
    players: LobbyPlayer[],
  ): void {
    // Header
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(`Players (${players.length}/${MAX_PLAYERS})`, x, y);

    const rowH = 48;
    const sorted = [...players].sort((a, b) => a.index - b.index);
    let cursorY = y + 30;

    for (const player of sorted) {
      this.drawPlayerRow(ctx, x, cursorY, w, rowH, player);
      cursorY += rowH + 6;
    }

    // One "next empty slot" hint row if there is room
    if (players.length < MAX_PLAYERS) {
      this.drawEmptyRow(ctx, x, cursorY, w, rowH, players.length);
    }
  }

  private drawPlayerRow(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    player: LobbyPlayer,
  ): void {
    // Row background
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.strokeStyle = player.color;
    ctx.lineWidth = 2;
    this.roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();

    const pad = 14;
    const cy = y + h / 2;

    // Slot number
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText(`${player.index + 1}`, x + pad, cy);

    // Snake head dot
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(x + pad + 44, cy, 13, 0, Math.PI * 2);
    ctx.fill();
    // little eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + pad + 49, cy - 3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x + pad + 50, cy - 3, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Name
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = player.color;
    ctx.fillText(player.name, x + pad + 76, cy);

    // Kind badge (right side)
    const badgeText = player.kind === 'phone' ? 'PHONE' : 'KEYBOARD';
    const badgeBg = player.kind === 'phone' ? 'rgba(136, 221, 255, 0.18)' : 'rgba(136, 255, 136, 0.18)';
    const badgeFg = player.kind === 'phone' ? '#88ddff' : '#88ff88';
    ctx.font = 'bold 13px monospace';
    const badgeW = ctx.measureText(badgeText).width + 16;
    const badgeX = x + w - pad - badgeW - 120;
    ctx.fillStyle = badgeBg;
    this.roundRect(ctx, badgeX, cy - 12, badgeW, 24, 4);
    ctx.fill();
    ctx.fillStyle = badgeFg;
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, badgeX + badgeW / 2, cy);

    // Ready state (far right)
    ctx.textAlign = 'right';
    if (player.ready) {
      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = '#44ff44';
      ctx.fillText('READY', x + w - pad, cy);
    } else {
      ctx.font = '14px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillText(`Shift+${((player.index + 1) % 10)} kick`, x + w - pad, cy);
    }
  }

  private drawEmptyRow(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    nextIndex: number,
  ): void {
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    this.roundRect(ctx, x, y, w, h, 8);
    ctx.stroke();
    ctx.setLineDash([]);

    const pulse = 0.25 + Math.sin(this.pulseTime * 2) * 0.1;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = `rgba(255,255,255,${pulse + 0.1})`;
    ctx.fillText(`${nextIndex + 1}`, x + 14, y + h / 2);

    ctx.font = '18px monospace';
    ctx.fillStyle = `rgba(255,255,255,${pulse})`;
    ctx.fillText('+  empty slot  —  press A / D  or  scan QR to join', x + 58, y + h / 2);
  }

  private drawPresetCards(ctx: CanvasRenderingContext2D, y: number, selected: BoardPreset): void {
    const cardW = 230, cardH = 150, gap = 28;
    const totalW = PRESET_ORDER.length * cardW + (PRESET_ORDER.length - 1) * gap;
    const startX = (ARENA_WIDTH - totalW) / 2;

    // Section label
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('Board size (press 1 – 4)', ARENA_WIDTH / 2, y - 14);

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

    ctx.save();
    ctx.fillStyle = selected ? 'rgba(68, 255, 68, 0.10)' : 'rgba(255,255,255,0.04)';
    ctx.strokeStyle = selected ? '#44ff44' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = selected ? 3 : 1;
    if (selected) { ctx.shadowColor = '#44ff44'; ctx.shadowBlur = 12; }
    this.roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = selected ? '#88ff88' : 'rgba(255,255,255,0.35)';
    ctx.fillText(`[${keyNum}]`, x + 10, y + 10);

    ctx.textAlign = 'right';
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = selected ? '#fff' : 'rgba(255,255,255,0.7)';
    ctx.fillText(preset.toUpperCase(), x + w - 10, y + 8);

    // Mini preview
    const previewArea = { x: x + 10, y: y + 36, w: w - 20, h: h - 62 };
    this.drawBoardPreview(ctx, previewArea.x, previewArea.y, previewArea.w, previewArea.h, cfg.cols, cfg.rows, selected);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = selected ? '#ccffcc' : 'rgba(255,255,255,0.5)';
    ctx.fillText(`${cfg.cols}×${cfg.rows} · ${cfg.pairCount} pairs`, x + w / 2, y + h - 8);
  }

  private drawBoardPreview(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    cols: number, rows: number, highlight: boolean,
  ): void {
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

  private drawQrBlock(ctx: CanvasRenderingContext2D): void {
    const qr = this.qr!;
    const canvas = qr.getCanvas();
    const size = 180;
    const x = ARENA_WIDTH - size - 40;
    const y = 40;

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
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('SCAN TO JOIN', x + size / 2, y + size + 6);
    ctx.font = '10px monospace';
    ctx.fillStyle = '#444';
    ctx.fillText(qr.url.replace(/^https?:\/\//, ''), x + size / 2, y + size + 22);
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

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
