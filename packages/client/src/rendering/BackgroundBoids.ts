import { ARENA_WIDTH, ARENA_HEIGHT } from '@snakegame/shared';

interface BgBoid {
  x: number; y: number;
  vx: number; vy: number;
  trail: { x: number; y: number }[];
}

// Self-contained boid flocking for use in menu / lobby background.
// Not connected to the server — just ambient visuals.
export class BackgroundBoids {
  private boids: BgBoid[] = [];
  private lastFrame = performance.now();

  constructor(count = 28) {
    for (let i = 0; i < count; i++) {
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
        const dx = o.x - b.x, dy = o.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < SEP_R * SEP_R) {
          sepX -= dx; sepY -= dy; sepN++;
        }
        if (d2 < ALI_R * ALI_R) {
          aliX += o.vx; aliY += o.vy; aliN++;
        }
        if (d2 < COH_R * COH_R) {
          cohX += o.x; cohY += o.y; cohN++;
        }
      }

      if (sepN) { sepX /= sepN; sepY /= sepN; }
      if (aliN) { aliX = aliX / aliN - b.vx; aliY = aliY / aliN - b.vy; }
      if (cohN) { cohX = cohX / cohN - b.x; cohY = cohY / cohN - b.y; }

      b.vx += (sepX * 0.08 + aliX * 0.04 + cohX * 0.01) * dt * 60;
      b.vy += (sepY * 0.08 + aliY * 0.04 + cohY * 0.01) * dt * 60;

      // Soft wall turn
      const margin = 80;
      if (b.x < margin) b.vx += 30 * dt * 60;
      if (b.x > ARENA_WIDTH - margin) b.vx -= 30 * dt * 60;
      if (b.y < margin) b.vy += 30 * dt * 60;
      if (b.y > ARENA_HEIGHT - margin) b.vy -= 30 * dt * 60;

      // Clamp speed
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > MAX_SPEED) {
        b.vx = (b.vx / sp) * MAX_SPEED;
        b.vy = (b.vy / sp) * MAX_SPEED;
      } else if (sp < 20) {
        b.vx += (Math.random() - 0.5) * 20;
        b.vy += (Math.random() - 0.5) * 20;
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Hard wrap (shouldn't normally hit with soft walls)
      if (b.x < 0) b.x = 0; else if (b.x > ARENA_WIDTH) b.x = ARENA_WIDTH;
      if (b.y < 0) b.y = 0; else if (b.y > ARENA_HEIGHT) b.y = ARENA_HEIGHT;

      b.trail.unshift({ x: b.x, y: b.y });
      if (b.trail.length > 8) b.trail.pop();
    }
  }

  private draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const b of this.boids) {
      // Trail
      ctx.strokeStyle = 'rgba(102, 204, 221, 0.25)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < b.trail.length; i++) {
        const p = b.trail[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();

      // Head
      ctx.fillStyle = 'rgba(136, 220, 240, 0.7)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
