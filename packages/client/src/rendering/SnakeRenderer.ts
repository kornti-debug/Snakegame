import type { SnakeState } from '@snakegame/shared';
import { TEAM_COLORS } from '@snakegame/shared';

let animTime = 0;

export function drawSnake(ctx: CanvasRenderingContext2D, snake: SnakeState): void {
  const segments = snake.segments;
  if (segments.length < 2) return;

  animTime += 0.02;

  const baseAlpha = !snake.alive ? 0.3 : 1;
  const drain = snake.effectDrain ?? {};

  // Determine which effect is active and its drain
  const starDrain = drain['star'] ?? 0;
  const ghostDrain = drain['ghost'] ?? 0;
  const predatorDrain = drain['predator'] ?? 0;
  const swarmDrain = drain['swarm-leader'] ?? 0;
  const speedDrain = drain['speed-boost'] ?? 0;
  const wideDrain = drain['wide-trail'] ?? 0;

  // Draw body segment by segment for per-segment coloring
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = snake.radius * 2;

  for (let i = 0; i < segments.length - 1; i++) {
    // How far along the body (0 = head, 1 = tail)
    const t = i / (segments.length - 1);

    // Compute segment color and alpha based on active effects + drain
    const { color, alpha, glow } = getSegmentStyle(snake, t, baseAlpha, {
      starDrain, ghostDrain, predatorDrain, swarmDrain, speedDrain, wideDrain,
    });

    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;

    if (glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = 12;
    }

    // Draw this segment as a line
    const a = segments[i];
    const b = segments[i + 1];
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  // Draw head
  const headStyle = getSegmentStyle(snake, 0, baseAlpha, {
    starDrain, ghostDrain, predatorDrain, swarmDrain, speedDrain, wideDrain,
  });
  drawHead(ctx, snake, headStyle.color, headStyle.glow);

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

interface Drains {
  starDrain: number;
  ghostDrain: number;
  predatorDrain: number;
  swarmDrain: number;
  speedDrain: number;
  wideDrain: number;
}

/**
 * Per-segment visual style. Drain goes from head (keeps effect longest) to tail (loses first).
 * At drain=1.0 (full), entire snake has the effect.
 * At drain=0.5, only the front 50% of segments show the effect.
 * At drain=0.0, effect is gone.
 */
function getSegmentStyle(
  snake: SnakeState, t: number, baseAlpha: number, drains: Drains,
): { color: string; alpha: number; glow: string | null } {
  let color = snake.color;
  let alpha = baseAlpha;
  let glow: string | null = null;

  // Star: rainbow cycling, drains tail-to-head
  if (drains.starDrain > 0) {
    const effectT = drains.starDrain; // 1 = full, 0 = gone
    if (t < effectT) {
      // This segment is still in the effect zone
      const hue = (animTime * 200 + t * 360 + snake.segments[0].x) % 360;
      const sat = 100;
      const light = 55 + (1 - effectT) * 15; // gets slightly dimmer as it drains
      color = `hsl(${hue}, ${sat}%, ${light}%)`;
      glow = color;
    }
    // Segments beyond effectT keep normal color
    alpha = baseAlpha;
  }

  // Ghost: transparency, drains tail-to-head
  if (drains.ghostDrain > 0) {
    const effectT = drains.ghostDrain;
    if (t < effectT) {
      alpha = baseAlpha * 0.4; // ghosted segments are transparent
    }
    // Segments beyond effectT are solid (already normal alpha)
  }

  // Predator: red tint with angular look, drains tail-to-head
  if (drains.predatorDrain > 0) {
    const effectT = drains.predatorDrain;
    if (t < effectT) {
      color = blendColors(snake.color, '#FF2244', 0.6);
      glow = '#FF4466';
    }
  }

  // Swarm leader: green glow, drains tail-to-head
  if (drains.swarmDrain > 0) {
    const effectT = drains.swarmDrain;
    if (t < effectT) {
      color = blendColors(snake.color, '#44FFAA', 0.5);
      glow = '#44FFAA';
    }
  }

  // Speed boost: bright white shimmer, drains tail-to-head
  if (drains.speedDrain > 0) {
    const effectT = drains.speedDrain;
    if (t < effectT) {
      const shimmer = Math.sin(animTime * 8 + t * 10) * 0.3 + 0.7;
      color = blendColors(snake.color, '#FFFFFF', shimmer * 0.4);
    }
  }

  // Wide trail: golden tint, drains tail-to-head
  if (drains.wideDrain > 0) {
    const effectT = drains.wideDrain;
    if (t < effectT) {
      color = blendColors(snake.color, '#FFDD44', 0.4);
      glow = '#FFDD44';
    }
  }

  return { color, alpha, glow };
}

function drawHead(ctx: CanvasRenderingContext2D, snake: SnakeState, headColor: string, glow: string | null): void {
  const head = snake.segments[0];
  const r = snake.radius * 1.4;

  ctx.save();

  // Team halo — a ring in the team color just outside the head, drawn
  // first so the head circle sits cleanly on top. Skipped for solo snakes.
  if (snake.team !== null && snake.team >= 0 && snake.team < TEAM_COLORS.length) {
    const teamColor = TEAM_COLORS[snake.team];
    const haloR = r + 4;
    // Subtle outer glow
    ctx.save();
    ctx.shadowColor = teamColor;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = teamColor;
    ctx.lineWidth = 3;
    ctx.globalAlpha = snake.alive ? 0.95 : 0.4;
    ctx.beginPath();
    ctx.arc(head.x, head.y, haloR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 15;
  }

  // Head circle
  ctx.fillStyle = headColor;
  ctx.beginPath();
  ctx.arc(head.x, head.y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';

  // Predator: small fin spikes on head
  if (snake.predator && (snake.effectDrain?.['predator'] ?? 0) > 0) {
    const finAngle = snake.angle - Math.PI / 2;
    ctx.fillStyle = '#FF4466';
    ctx.globalAlpha = 0.7;
    for (const side of [-1, 1]) {
      const fx = head.x + Math.cos(finAngle) * r * 1.3 * side;
      const fy = head.y + Math.sin(finAngle) * r * 1.3 * side;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + Math.cos(snake.angle) * r * 0.8, fy + Math.sin(snake.angle) * r * 0.8);
      ctx.lineTo(fx + Math.cos(finAngle) * r * 0.5 * side, fy + Math.sin(finAngle) * r * 0.5 * side);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Eyes
  const eyeOffset = r * 0.5;
  const eyeR = r * 0.3;
  const perpAngle = snake.angle + Math.PI / 2;

  for (const side of [-1, 1]) {
    const ex = head.x + Math.cos(snake.angle) * eyeOffset * 0.5 +
               Math.cos(perpAngle) * eyeOffset * side;
    const ey = head.y + Math.sin(snake.angle) * eyeOffset * 0.5 +
               Math.sin(perpAngle) * eyeOffset * side;

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
    ctx.fill();

    // Pupil color based on effect
    const starActive = (snake.effectDrain?.['star'] ?? 0) > 0;
    const predActive = (snake.effectDrain?.['predator'] ?? 0) > 0;
    ctx.fillStyle = starActive ? '#FFD700' : predActive ? '#FF2244' : '#000';
    ctx.beginPath();
    ctx.arc(
      ex + Math.cos(snake.angle) * eyeR * 0.3,
      ey + Math.sin(snake.angle) * eyeR * 0.3,
      eyeR * 0.5, 0, Math.PI * 2,
    );
    ctx.fill();
  }

  ctx.restore();
}

/** Blend two hex colors. mix=0 → colorA, mix=1 → colorB */
function blendColors(a: string, b: string, mix: number): string {
  const ra = parseInt(a.slice(1, 3), 16), ga = parseInt(a.slice(3, 5), 16), ba = parseInt(a.slice(5, 7), 16);
  const rb = parseInt(b.slice(1, 3), 16), gb = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ra + (rb - ra) * mix);
  const g = Math.round(ga + (gb - ga) * mix);
  const bl = Math.round(ba + (bb - ba) * mix);
  return `rgb(${r},${g},${bl})`;
}
