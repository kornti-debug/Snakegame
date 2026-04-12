import { ARENA_WIDTH, ARENA_HEIGHT } from '@snakegame/shared';

interface BgBoid {
  x: number; y: number;
  vx: number; vy: number;
  trail: { x: number; y: number }[];
}

const TRAIL_LENGTH = 10;    // segments per mini snake
const TRAIL_SPACING = 7;    // px between segments
const BODY_WIDTH = 3.5;

/** Self-contained ambient flocking boids for menu / lobby backgrounds.
 *  Independent from the server boid system.
 *  Wraps at edges (torus) so the swarm is continuous. Call reset() to respawn. */
export class BackgroundBoids {
  private boids: BgBoid[] = [];
  private lastFrame = performance.now();
  private readonly count: number;

  constructor(count = 28) {
    this.count = count;
    this.spawn();
  }

  /** Re-spawn all boids with fresh random positions. */
  reset(): void {
    this.spawn();
    this.lastFrame = performance.now();
  }

  private spawn(): void {
    this.boids = [];
    for (let i = 0; i < this.count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 40;
      this.boids.push({
        x: Math.random() * ARENA_WIDTH,
        y: Math.random() * ARENA_HEIGHT,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        trail: [],
      });
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    this.step(dt);
    this.draw(ctx);
  }

  private step(dt: number): void {
    const SEP_R = 40, ALI_R = 70, COH_R = 100;
    const MAX_SPEED = 140;

    for (const b of this.boids) {
      let sepX = 0, sepY = 0, aliX = 0, aliY = 0, cohX = 0, cohY = 0;
      let sepN = 0, aliN = 0, cohN = 0;

      for (const o of this.boids) {
        if (o === b) continue;
        // Wrap-aware distance (shortest delta across torus)
        let dx = o.x - b.x, dy = o.y - b.y;
        if (dx > ARENA_WIDTH / 2) dx -= ARENA_WIDTH;
        else if (dx < -ARENA_WIDTH / 2) dx += ARENA_WIDTH;
        if (dy > ARENA_HEIGHT / 2) dy -= ARENA_HEIGHT;
        else if (dy < -ARENA_HEIGHT / 2) dy += ARENA_HEIGHT;
        const d2 = dx * dx + dy * dy;
        if (d2 < SEP_R * SEP_R) {
          sepX -= dx; sepY -= dy; sepN++;
        }
        if (d2 < ALI_R * ALI_R) {
          aliX += o.vx; aliY += o.vy; aliN++;
        }
        if (d2 < COH_R * COH_R) {
          cohX += dx; cohY += dy; cohN++;
        }
      }

      if (sepN) { sepX /= sepN; sepY /= sepN; }
      if (aliN) { aliX = aliX / aliN - b.vx; aliY = aliY / aliN - b.vy; }
      if (cohN) { cohX /= cohN; cohY /= cohN; }

      b.vx += (sepX * 0.08 + aliX * 0.04 + cohX * 0.01) * dt * 60;
      b.vy += (sepY * 0.08 + aliY * 0.04 + cohY * 0.01) * dt * 60;

      // Clamp speed
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > MAX_SPEED) {
        b.vx = (b.vx / sp) * MAX_SPEED;
        b.vy = (b.vy / sp) * MAX_SPEED;
      } else if (sp < 20) {
        b.vx += (Math.random() - 0.5) * 20;
        b.vy += (Math.random() - 0.5) * 20;
      }

      const prevX = b.x, prevY = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Torus wrap — when wrapping, clear the trail so we don't draw a line
      // across the whole screen connecting pre-wrap to post-wrap position.
      let wrapped = false;
      if (b.x < 0) { b.x += ARENA_WIDTH; wrapped = true; }
      else if (b.x >= ARENA_WIDTH) { b.x -= ARENA_WIDTH; wrapped = true; }
      if (b.y < 0) { b.y += ARENA_HEIGHT; wrapped = true; }
      else if (b.y >= ARENA_HEIGHT) { b.y -= ARENA_HEIGHT; wrapped = true; }

      if (wrapped) b.trail = [];
      else b.trail.unshift({ x: prevX, y: prevY });

      while (b.trail.length > TRAIL_LENGTH * 2) b.trail.pop();
    }
  }

  private draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const b of this.boids) {
      // Build even-spaced segments along the trail (like the server boids)
      const segments: { x: number; y: number }[] = [{ x: b.x, y: b.y }];
      let walked = 0;
      let nextDist = TRAIL_SPACING;
      let prev = { x: b.x, y: b.y };
      for (let i = 0; i < b.trail.length && segments.length < TRAIL_LENGTH; i++) {
        const p = b.trail[i];
        const dx = p.x - prev.x, dy = p.y - prev.y;
        const edgeLen = Math.hypot(dx, dy);
        if (edgeLen === 0) { prev = p; continue; }
        const edgeStart = walked;
        const edgeEnd = walked + edgeLen;
        while (nextDist <= edgeEnd && segments.length < TRAIL_LENGTH) {
          const t = (nextDist - edgeStart) / edgeLen;
          segments.push({ x: prev.x + dx * t, y: prev.y + dy * t });
          nextDist += TRAIL_SPACING;
        }
        walked = edgeEnd;
        prev = p;
      }

      if (segments.length < 2) {
        // Just head
        ctx.fillStyle = 'rgba(136, 220, 240, 0.7)';
        ctx.beginPath();
        ctx.arc(b.x, b.y, BODY_WIDTH, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      // Body
      ctx.strokeStyle = 'rgba(102, 204, 221, 0.55)';
      ctx.lineWidth = BODY_WIDTH;
      ctx.beginPath();
      ctx.moveTo(segments[0].x, segments[0].y);
      for (let i = 1; i < segments.length; i++) {
        ctx.lineTo(segments[i].x, segments[i].y);
      }
      ctx.stroke();

      // Head
      ctx.fillStyle = 'rgba(160, 230, 245, 0.9)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, BODY_WIDTH * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
