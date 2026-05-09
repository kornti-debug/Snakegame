/**
 * Lightweight particle bursts for one-shot juice (eat-a-boid pop, etc.).
 * No layer canvas — particles are drawn directly on the main ctx each frame
 * after the game layer, so they sit visually on top of snakes/boids.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ageMs: number;
  lifeMs: number;
  size: number;
  color: string;
}

const GRAVITY_PX_PER_S2 = 0; // top-down — no gravity
const DRAG_PER_FRAME = 0.92;

export class Particles {
  private list: Particle[] = [];

  /** Spawn a small burst at (x, y). Used for eat-boid pops; ~6 specks
   *  fanning outward in the snake's color, ~600ms lifetime. */
  burst(x: number, y: number, color: string, count = 6): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 140;
      this.list.push({
        x, y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        ageMs: 0,
        lifeMs: 450 + Math.random() * 250,
        size: 3 + Math.random() * 3,
        color,
      });
    }
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.ageMs += dtMs;
      if (p.ageMs >= p.lifeMs) {
        this.list.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += GRAVITY_PX_PER_S2 * dt;
      p.vx *= DRAG_PER_FRAME;
      p.vy *= DRAG_PER_FRAME;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.list.length === 0) return;
    ctx.save();
    for (const p of this.list) {
      const t = p.ageMs / p.lifeMs;
      const alpha = 1 - t;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - t * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
