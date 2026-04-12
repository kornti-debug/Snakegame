import type { LobbyPlayer, BoardPreset } from '@snakegame/shared';
import {
  ARENA_WIDTH, ARENA_HEIGHT, BOARD_PRESETS, MAX_PLAYERS, TEAM_COLORS,
} from '@snakegame/shared';
import { BackgroundBoids } from './BackgroundBoids.js';
import type { QrCache } from './QrCache.js';

const PRESET_ORDER: BoardPreset[] = ['small', 'medium', 'large', 'huge'];

// --- Layout constants ---
const LIST_W = 720;
const RIGHT_W = 360;
const COL_GAP = 40;
const BLOCK_W = LIST_W + COL_GAP + RIGHT_W;
const LIST_X = (ARENA_WIDTH - BLOCK_W) / 2;
const RIGHT_X = LIST_X + LIST_W + COL_GAP;

const SECTION_TOP = 170;
const LIST_ROW_H = 46;
const LIST_ROW_GAP = 4;

const CARD_BG = 'rgba(10, 12, 28, 0.72)';
const CARD_STROKE_STRONG = '#44aaff';
const CARD_STROKE = 'rgba(68, 170, 255, 0.4)';

// --- Click dispatch types ---
export type LobbyAction =
  | { type: 'pick-preset'; preset: BoardPreset }
  | { type: 'kick'; slot: number }
  | { type: 'start' };

interface HitZone {
  x: number; y: number; w: number; h: number;
  action: LobbyAction;
}

export class LobbyRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pulseTime = 0;
  private boids: BackgroundBoids;
  private qr?: QrCache;
  private hitZones: HitZone[] = [];

  constructor(canvas: HTMLCanvasElement, boids?: BackgroundBoids, qr?: QrCache) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.boids = boids ?? new BackgroundBoids();
    this.qr = qr;
  }

  /** Hit-test in arena coords. Returns the action of the topmost zone
   *  containing (x, y), or null if the click missed. */
  hit(x: number, y: number): LobbyAction | null {
    // Iterate in reverse so later-drawn zones win (not that they overlap today).
    for (let i = this.hitZones.length - 1; i >= 0; i--) {
      const z = this.hitZones[i];
      if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return z.action;
    }
    return null;
  }

  render(players: LobbyPlayer[], boardPreset: BoardPreset = 'medium'): void {
    const ctx = this.ctx;
    this.pulseTime += 0.03;
    this.hitZones = [];

    ctx.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    this.drawAnimatedGrid(ctx);
    this.boids.render(ctx);

    // Centered title
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const titlePulse = 1 + Math.sin(this.pulseTime * 2) * 0.02;
    ctx.save();
    ctx.translate(ARENA_WIDTH / 2, 90);
    ctx.scale(titlePulse, titlePulse);
    ctx.font = 'bold 64px monospace';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#44aaff';
    ctx.shadowBlur = 20;
    ctx.fillText('GAME LOBBY', 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.font = '20px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('Snake Memory  ·  scan QR to join, pick a board', ARENA_WIDTH / 2, 130);

    // Left: player list
    this.drawPlayerList(ctx, LIST_X, SECTION_TOP, LIST_W, players);

    // Right: QR + preset grid
    const qrCardH = 400;
    this.drawQrCard(ctx, RIGHT_X, SECTION_TOP, RIGHT_W, qrCardH);
    this.drawPresetGrid(ctx, RIGHT_X, SECTION_TOP + qrCardH + 18, RIGHT_W, 340, boardPreset);

    // Footer: start button — only enabled when all joined players are ready.
    const allReady = players.length >= 1 && players.every(p => p.ready);
    this.drawStartButton(ctx, allReady, players.length);

    ctx.font = '13px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.textAlign = 'center';
    ctx.fillText('ESC returns to main menu  ·  double-click for fullscreen', ARENA_WIDTH / 2, ARENA_HEIGHT - 24);
  }

  // --- Player list ---

  private drawPlayerList(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number,
    players: LobbyPlayer[],
  ): void {
    const header = 40;
    const body = MAX_PLAYERS * (LIST_ROW_H + LIST_ROW_GAP) - LIST_ROW_GAP;
    const pad = 18;
    const cardH = header + body + pad * 2;

    this.drawCardShell(ctx, x, y, w, cardH);

    // Header
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('PLAYERS', x + pad, y + pad + 20);

    ctx.font = '18px monospace';
    ctx.fillStyle = 'rgba(136, 221, 255, 0.7)';
    ctx.textAlign = 'right';
    ctx.fillText(`${players.length} / ${MAX_PLAYERS}`, x + w - pad, y + pad + 20);

    const sorted = [...players].sort((a, b) => a.index - b.index);
    const byIndex = new Map(sorted.map(p => [p.index, p]));
    const firstEmpty = Array.from({ length: MAX_PLAYERS }, (_, i) => i).find(i => !byIndex.has(i));

    const rowX = x + pad;
    const rowW = w - pad * 2;
    let rowY = y + pad + header;

    for (let i = 0; i < MAX_PLAYERS; i++) {
      const player = byIndex.get(i);
      if (player) {
        this.drawPlayerRow(ctx, rowX, rowY, rowW, LIST_ROW_H, player);
      } else {
        this.drawEmptyRow(ctx, rowX, rowY, rowW, LIST_ROW_H, i, i === firstEmpty);
      }
      rowY += LIST_ROW_H + LIST_ROW_GAP;
    }
  }

  private drawPlayerRow(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    player: LobbyPlayer,
  ): void {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.strokeStyle = player.color;
    ctx.lineWidth = 2;
    this.roundRect(ctx, x, y, w, h, 6);
    ctx.fill();
    ctx.stroke();

    const pad = 12;
    const cy = y + h / 2;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Slot #
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText(`${player.index + 1}`, x + pad, cy);

    // Snake head
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(x + pad + 34, cy, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + pad + 39, cy - 3, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x + pad + 40, cy - 3, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Name
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = player.color;
    ctx.fillText(player.name, x + pad + 58, cy);

    // Team dot (beside name)
    const nameWidth = ctx.measureText(player.name).width;
    if (player.team !== null && player.team >= 0 && player.team < TEAM_COLORS.length) {
      ctx.fillStyle = TEAM_COLORS[player.team];
      ctx.beginPath();
      ctx.arc(x + pad + 58 + nameWidth + 14, cy, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Kick X button (right edge)
    const kickSize = 28;
    const kickX = x + w - pad - kickSize;
    const kickY = cy - kickSize / 2;
    this.drawKickButton(ctx, kickX, kickY, kickSize);
    this.hitZones.push({
      x: kickX, y: kickY, w: kickSize, h: kickSize,
      action: { type: 'kick', slot: player.index },
    });

    // Kind badge (between name area and kick button)
    const badgeText = player.kind === 'phone' ? 'PHONE' : 'KEYBOARD';
    const badgeBg = player.kind === 'phone' ? 'rgba(136, 221, 255, 0.18)' : 'rgba(136, 255, 136, 0.18)';
    const badgeFg = player.kind === 'phone' ? '#88ddff' : '#88ff88';
    ctx.font = 'bold 12px monospace';
    const badgeW = ctx.measureText(badgeText).width + 14;
    const badgeH = 22;
    const badgeX = kickX - 14 - badgeW;
    ctx.fillStyle = badgeBg;
    this.roundRect(ctx, badgeX, cy - badgeH / 2, badgeW, badgeH, 4);
    ctx.fill();
    ctx.fillStyle = badgeFg;
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, badgeX + badgeW / 2, cy);

    // Ready tag (if ready) — sits before the badge
    if (player.ready) {
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#44ff44';
      ctx.textAlign = 'right';
      ctx.fillText('READY', badgeX - 10, cy);
    }
  }

  private drawKickButton(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 68, 68, 0.14)';
    ctx.strokeStyle = 'rgba(255, 120, 120, 0.55)';
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, x, y, size, size, 6);
    ctx.fill();
    ctx.stroke();

    // X mark
    ctx.strokeStyle = '#ff8888';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    const inset = 8;
    ctx.beginPath();
    ctx.moveTo(x + inset, y + inset);
    ctx.lineTo(x + size - inset, y + size - inset);
    ctx.moveTo(x + size - inset, y + inset);
    ctx.lineTo(x + inset, y + size - inset);
    ctx.stroke();
    ctx.restore();
  }

  private drawEmptyRow(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    index: number, isNext: boolean,
  ): void {
    ctx.strokeStyle = isNext ? 'rgba(68, 170, 255, 0.45)' : 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    this.roundRect(ctx, x, y, w, h, 6);
    ctx.stroke();
    ctx.setLineDash([]);

    const pad = 12;
    const cy = y + h / 2;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = isNext ? 'rgba(136, 221, 255, 0.6)' : 'rgba(255,255,255,0.2)';
    ctx.fillText(`${index + 1}`, x + pad, cy);

    if (isNext) {
      const pulse = 0.45 + Math.sin(this.pulseTime * 3) * 0.25;
      ctx.font = '16px monospace';
      ctx.fillStyle = `rgba(136, 221, 255, ${pulse})`;
      ctx.fillText('+  empty — scan the QR code to join', x + pad + 40, cy);
    } else {
      ctx.font = '14px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillText('— empty —', x + pad + 40, cy);
    }
  }

  // --- QR card ---

  private drawQrCard(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
  ): void {
    this.drawCardShell(ctx, x, y, w, h);

    const pad = 18;
    const headerH = 40;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText('SCAN TO JOIN', x + w / 2, y + pad + 22);

    ctx.font = '13px monospace';
    ctx.fillStyle = 'rgba(136, 221, 255, 0.7)';
    ctx.fillText('point your phone camera at the code', x + w / 2, y + pad + 42);

    const qrCanvas = this.qr?.getCanvas();
    const qrSize = Math.min(w - pad * 2 - 20, h - headerH - 80);
    const qrX = x + (w - qrSize) / 2;
    const qrY = y + pad + headerH + 18;

    ctx.fillStyle = '#fff';
    ctx.strokeStyle = CARD_STROKE;
    ctx.lineWidth = 2;
    this.roundRect(ctx, qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 8);
    ctx.fill();
    ctx.stroke();

    if (qrCanvas) {
      ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
    } else {
      ctx.fillStyle = '#888';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('QR…', qrX + qrSize / 2, qrY + qrSize / 2);
    }

    ctx.font = '11px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(this.qr?.url.replace(/^https?:\/\//, '') ?? '', x + w / 2, y + h - 14);
  }

  // --- Preset grid ---

  private drawPresetGrid(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    selected: BoardPreset,
  ): void {
    this.drawCardShell(ctx, x, y, w, h);

    const pad = 18;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText('BOARD SIZE', x + w / 2, y + pad + 22);

    ctx.font = '13px monospace';
    ctx.fillStyle = 'rgba(136, 221, 255, 0.7)';
    ctx.fillText('click a card to choose', x + w / 2, y + pad + 42);

    const gridX = x + pad;
    const gridY = y + pad + 60;
    const gridW = w - pad * 2;
    const gridH = h - pad - 60 - pad;
    const gap = 10;
    const cellW = (gridW - gap) / 2;
    const cellH = (gridH - gap) / 2;

    PRESET_ORDER.forEach((preset, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = gridX + col * (cellW + gap);
      const cy = gridY + row * (cellH + gap);
      this.drawPresetCard(ctx, cx, cy, cellW, cellH, preset, preset === selected);
      this.hitZones.push({ x: cx, y: cy, w: cellW, h: cellH, action: { type: 'pick-preset', preset } });
    });
  }

  private drawPresetCard(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    preset: BoardPreset, selected: boolean,
  ): void {
    const cfg = BOARD_PRESETS[preset];

    ctx.save();
    ctx.fillStyle = selected ? 'rgba(68, 255, 68, 0.10)' : 'rgba(255,255,255,0.04)';
    ctx.strokeStyle = selected ? '#44ff44' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = selected ? 2.5 : 1;
    if (selected) { ctx.shadowColor = '#44ff44'; ctx.shadowBlur = 10; }
    this.roundRect(ctx, x, y, w, h, 6);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = selected ? '#fff' : 'rgba(255,255,255,0.75)';
    ctx.fillText(preset.toUpperCase(), x + w / 2, y + 10);

    const prevX = x + 8;
    const prevY = y + 36;
    const prevW = w - 16;
    const prevH = h - 58;
    this.drawBoardPreview(ctx, prevX, prevY, prevW, prevH, cfg.cols, cfg.rows, selected);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = selected ? '#ccffcc' : 'rgba(255,255,255,0.5)';
    ctx.fillText(`${cfg.cols}×${cfg.rows} · ${cfg.pairCount} pairs`, x + w / 2, y + h - 6);
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
    const inner = cellSize * 0.8;
    const pad = (cellSize - inner) / 2;

    ctx.fillStyle = highlight ? 'rgba(136, 255, 136, 0.6)' : 'rgba(136, 180, 220, 0.35)';
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        ctx.fillRect(ox + col * cellSize + pad, oy + row * cellSize + pad, inner, inner);
      }
    }
  }

  // --- Start button ---

  private drawStartButton(ctx: CanvasRenderingContext2D, enabled: boolean, playerCount: number): void {
    const w = 380, h = 64;
    const x = (ARENA_WIDTH - w) / 2;
    const y = ARENA_HEIGHT - 120;

    const pulse = 0.85 + Math.sin(this.pulseTime * 4) * 0.15;
    ctx.save();
    if (enabled) {
      ctx.fillStyle = `rgba(68, 255, 68, ${0.14 * pulse})`;
      ctx.strokeStyle = `rgba(68, 255, 68, ${pulse})`;
      ctx.shadowColor = '#44ff44';
      ctx.shadowBlur = 14;
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    }
    ctx.lineWidth = 2.5;
    this.roundRect(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = enabled ? '#aaffaa' : 'rgba(255,255,255,0.35)';

    let label: string;
    if (playerCount === 0) label = 'WAITING FOR PLAYERS…';
    else if (!enabled) label = 'WAITING FOR ALL READY…';
    else label = 'START GAME';
    ctx.fillText(label, x + w / 2, y + h / 2);

    if (enabled) {
      ctx.font = '12px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText('(click or press Enter)', x + w / 2, y + h + 14);
      this.hitZones.push({ x, y, w, h, action: { type: 'start' } });
    }
  }

  // --- Shared helpers ---

  private drawCardShell(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
  ): void {
    ctx.save();
    ctx.fillStyle = CARD_BG;
    ctx.strokeStyle = CARD_STROKE_STRONG;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = 'rgba(68, 170, 255, 0.2)';
    ctx.shadowBlur = 16;
    this.roundRect(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();
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
