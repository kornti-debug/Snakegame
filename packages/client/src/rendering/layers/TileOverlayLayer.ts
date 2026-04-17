import type { MemoryBoardState, MemoryTile, HintState } from '@snakegame/shared';
import { ARENA_WIDTH, ARENA_HEIGHT, MEMORY_CAPTURE_THRESHOLD } from '@snakegame/shared';

export class TileOverlayLayer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pulseTime = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = ARENA_WIDTH;
    this.canvas.height = ARENA_HEIGHT;
    this.ctx = this.canvas.getContext('2d')!;
  }

  render(board: MemoryBoardState, hints: HintState[], pulseBonus: boolean = false): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    this.pulseTime += 0.03;

    const hintedPairIds = new Set(hints.map(h => h.pairId));
    const neutralPairIds = new Set(
      board.pairs.filter(p => p.neutralized && !p.matched).map(p => p.pairId),
    );

    for (const tile of board.tiles) {
      const pair = board.pairs.find(p => p.pairId === tile.pairId);
      const isMatched = pair?.matched ?? false;
      const isNeutral = neutralPairIds.has(tile.pairId);
      const isHinted = hintedPairIds.has(tile.pairId);
      const isBonus = pair?.isBonus ?? false;

      if (isMatched) {
        this.drawMatchedTile(ctx, tile);
      } else if (isNeutral && tile.capturedBy) {
        this.drawNeutralizedTile(ctx, tile);
      } else if (tile.capturedBy) {
        this.drawCapturedTile(ctx, tile);
      } else {
        this.drawUncapturedTile(ctx, tile);
      }

      // Per-snake reveal breakdown bar (shows who is dominating the tile)
      if (!isMatched && tile.revealPercent > 3) {
        this.drawRevealBreakdown(ctx, tile);
      }

      // Hint effect: pulsing gold dashed border
      if (isHinted && !isMatched) {
        this.drawHintBorder(ctx, tile);
      }

      // Bonus pair: pulse the tile only during pre-reveal so players can
      // spot it before the mask drops. No visualization during gameplay.
      if (isBonus && !isMatched && pulseBonus) {
        this.drawBonusPulse(ctx, tile);
      }
    }
  }

  /** Pre-reveal only: a big pulsing gold halo + crown over the bonus-pair
   *  tiles so players can spot them during the 3s preview. Once the round
   *  starts this is no longer drawn and the bonus pair blends in. */
  private drawBonusPulse(ctx: CanvasRenderingContext2D, tile: MemoryTile): void {
    const { x, y, width, height } = tile;
    const pulse = 0.5 + Math.sin(this.pulseTime * 6) * 0.5;
    const cx = x + width / 2;
    const cy = y + height / 2;

    ctx.save();
    ctx.strokeStyle = '#e6c200';
    ctx.lineWidth = 2 + pulse * 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.roundRect(x - 2, y - 2, width + 4, height + 4, 14);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#ffd54a';
    ctx.font = `bold ${36 + pulse * 6}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♛', cx, y + 28);
    ctx.restore();
  }

  /** Matched pair: snake's color, brighter + thicker stroke */
  private drawMatchedTile(ctx: CanvasRenderingContext2D, tile: MemoryTile): void {
    const { x, y, width, height } = tile;
    const color = tile.capturedColor ?? '#44FF44';
    const brightColor = brighten(color, 1.4);

    ctx.save();
    ctx.strokeStyle = brightColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, width - 4, height - 4, 12);
    ctx.stroke();
    ctx.restore();

    // "MATCHED" label + symbol name in snake's color (outlined pill)
    ctx.save();
    const labelW = 120;
    const labelH = 40;
    const lx = x + width / 2 - labelW / 2;
    const ly = y + height - labelH - 6;
    ctx.strokeStyle = brightColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(lx, ly, labelW, labelH, 6);
    ctx.stroke();

    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = brightColor;
    ctx.fillText('MATCHED', x + width / 2, y + height - labelH + 4);

    ctx.font = 'bold 15px monospace';
    ctx.fillText(tile.symbolName.toUpperCase(), x + width / 2, y + height - 16);
    ctx.restore();
  }

  /** Split capture — pair cannot be matched */
  private drawNeutralizedTile(ctx: CanvasRenderingContext2D, tile: MemoryTile): void {
    const { x, y, width, height } = tile;
    const color = tile.capturedColor ?? '#8899aa';

    ctx.save();
    ctx.strokeStyle = '#a8b4c8';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, width - 4, height - 4, 12);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = color;
    ctx.fillText('SPLIT', x + width / 2, y + 6);
    ctx.restore();
  }

  /** Captured tile: snake's color border with glow */
  private drawCapturedTile(ctx: CanvasRenderingContext2D, tile: MemoryTile): void {
    const { x, y, width, height } = tile;
    const color = tile.capturedColor ?? '#FFFFFF';

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, width - 4, height - 4, 12);
    ctx.stroke();
    ctx.restore();

    // "CAPTURED" label (outline)
    ctx.save();
    const capW = 96;
    const capH = 22;
    const cx0 = x + width / 2 - capW / 2;
    const cy0 = y + 4;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cx0, cy0, capW, capH, 4);
    ctx.stroke();
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText('CAPTURED', x + width / 2, y + 16);
    ctx.restore();
  }

  /** Uncaptured tile: subtle card border + reveal percentage */
  private drawUncapturedTile(ctx: CanvasRenderingContext2D, tile: MemoryTile): void {
    const { x, y, width, height } = tile;

    ctx.save();
    ctx.strokeStyle = '#8a9cad';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, width - 2, height - 2, 12);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Per-snake reveal breakdown: horizontal stacked bar at the bottom of the tile.
   * Each snake's contribution is shown as a segment in their color.
   * A vertical marker shows the capture threshold.
   */
  private drawRevealBreakdown(ctx: CanvasRenderingContext2D, tile: MemoryTile): void {
    const { x, y, width, height, revealBySnake } = tile;
    const barH = 8;
    const barY = y + height - barH - 4;
    const barX = x + 8;
    const barW = width - 16;

    // Bar outline
    ctx.save();
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(barX - 1, barY - 1, barW + 2, barH + 2, 3);
    ctx.stroke();

    // Get total blocks in tile (approximate from percentage)
    const totalRevealed = Object.values(revealBySnake).reduce((sum, n) => sum + n, 0);
    if (totalRevealed === 0) {
      ctx.restore();
      return;
    }

    // Total blocks = totalRevealed / (revealPercent / 100)
    const totalBlocks = tile.revealPercent > 0 ? totalRevealed / (tile.revealPercent / 100) : 1;

    // Sort snakes by contribution (largest first)
    const entries = Object.entries(revealBySnake).sort((a, b) => b[1] - a[1]);

    // Draw stacked bar segments
    let offsetX = 0;
    for (const [_snakeId, count] of entries) {
      const segW = (count / totalBlocks) * barW;
      if (segW < 1) continue;

      // Look up snake color from the tile's state
      // We don't have snake colors here directly, but we can use the capturedColor
      // or derive from the snapshot. For now, use a color based on the snake entry order.
      const color = this.getSnakeColor(_snakeId, tile);
      ctx.fillStyle = color;
      ctx.fillRect(barX + offsetX, barY, segW, barH);
      offsetX += segW;
    }

    // Capture-threshold marker (see MEMORY_CAPTURE_THRESHOLD).
    const thresholdX = barX + barW * MEMORY_CAPTURE_THRESHOLD;
    ctx.strokeStyle = '#c8d4e8';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(thresholdX, barY - 2);
    ctx.lineTo(thresholdX, barY + barH + 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Percentage text to the right of the bar
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e8eef8';
    ctx.fillText(`${Math.floor(tile.revealPercent)}%`, x + width - 6, barY + barH / 2);

    ctx.restore();
  }

  /** Pulsing gold dashed border for hinted tiles */
  private drawHintBorder(ctx: CanvasRenderingContext2D, tile: MemoryTile): void {
    const { x, y, width, height } = tile;
    const pulse = Math.sin(this.pulseTime * 4) * 0.5 + 0.5;

    ctx.save();
    ctx.strokeStyle = '#e6c200';
    ctx.lineWidth = 3 + pulse * 2;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.roundRect(x - 1, y - 1, width + 2, height + 2, 14);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  /** Map snake IDs to colors. Uses tile capture info or falls back to hash-based color. */
  private snakeColorCache = new Map<string, string>();

  setSnakeColors(colors: Map<string, string>): void {
    this.snakeColorCache = colors;
  }

  private getSnakeColor(snakeId: string, tile: MemoryTile): string {
    // Check cache first
    const cached = this.snakeColorCache.get(snakeId);
    if (cached) return cached;

    // If this snake captured the tile, we know their color
    if (tile.capturedBy === snakeId && tile.capturedColor) {
      this.snakeColorCache.set(snakeId, tile.capturedColor);
      return tile.capturedColor;
    }

    // Fallback: generate a deterministic color from snakeId
    let hash = 0;
    for (let i = 0; i < snakeId.length; i++) {
      hash = ((hash << 5) - hash + snakeId.charCodeAt(i)) | 0;
    }
    const hue = Math.abs(hash) % 360;
    const color = `hsl(${hue}, 70%, 60%)`;
    this.snakeColorCache.set(snakeId, color);
    return color;
  }
}

/** Brighten a hex color by a factor (e.g. 1.3 = 30% brighter) */
function brighten(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const clamp = (n: number) => Math.min(255, Math.round(n * factor));
  return `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`;
}
