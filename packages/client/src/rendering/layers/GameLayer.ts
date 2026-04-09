import type { GameSnapshot, PowerUpState, ObstacleState, BoidState } from '@snakegame/shared';
import { ARENA_WIDTH, ARENA_HEIGHT, BOID_RADIUS } from '@snakegame/shared';
import { drawSnake } from '../SnakeRenderer.js';

export class GameLayer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pulseTime = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = ARENA_WIDTH;
    this.canvas.height = ARENA_HEIGHT;
    this.ctx = this.canvas.getContext('2d')!;
  }

  render(snapshot: GameSnapshot): void {
    const ctx = this.ctx;
    const { width, height } = snapshot.arena;
    this.pulseTime += 0.05;

    ctx.clearRect(0, 0, width, height);

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, width - 4, height - 4);

    // Obstacles
    for (const obstacle of snapshot.obstacles) {
      this.drawObstacle(ctx, obstacle);
    }

    // Power-ups
    for (const powerUp of snapshot.powerUps) {
      this.drawPowerUp(ctx, powerUp);
    }

    // Boids (AI swarm)
    for (const boid of snapshot.boids) {
      this.drawBoid(ctx, boid);
    }

    // Snakes
    for (const snake of snapshot.snakes) {
      drawSnake(ctx, snake);
    }
  }

  private drawPowerUp(ctx: CanvasRenderingContext2D, pu: PowerUpState): void {
    const { x, y } = pu.position;
    const pulse = 1 + Math.sin(this.pulseTime * 3) * 0.15;
    const r = 16 * pulse;

    const iconMap: Record<string, string> = {
      'speed-boost': '⚡', 'wide-trail': '◎', 'ghost': '👻',
      'star': '⭐', 'swarm-leader': '🐟', 'predator': '🦈',
    };
    const icon = iconMap[pu.type] ?? '?';

    // Glowing circle background
    ctx.save();
    ctx.shadowColor = pu.renderHint.color;
    ctx.shadowBlur = 18;
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = pu.renderHint.color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // Emoji icon — large, centered, matching the legend
    ctx.font = `${Math.round(r * 1.4)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, x, y + 1);
    ctx.restore();
  }

  private drawBoid(ctx: CanvasRenderingContext2D, boid: BoidState): void {
    const { x, y, angle, leaderId } = boid;
    const r = BOID_RADIUS;

    // Color: teal-ish for wild, greenish for following a leader
    const color = leaderId ? '#88FFAA' : '#66CCDD';

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Fish-like body: pointed triangle
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(r * 1.8, 0);            // nose
    ctx.lineTo(-r * 1.2, -r * 1.0);    // top-left
    ctx.lineTo(-r * 0.5, 0);           // indent
    ctx.lineTo(-r * 1.2, r * 1.0);     // bottom-left
    ctx.closePath();
    ctx.fill();

    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(r * 0.6, -r * 0.2, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(r * 0.7, -r * 0.2, r * 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawObstacle(ctx: CanvasRenderingContext2D, obs: ObstacleState): void {
    ctx.fillStyle = 'rgba(255, 50, 50, 0.4)';
    ctx.strokeStyle = 'rgba(255, 50, 50, 0.8)';
    ctx.lineWidth = 2;
    ctx.fillRect(obs.position.x, obs.position.y, obs.width, obs.height);
    ctx.strokeRect(obs.position.x, obs.position.y, obs.width, obs.height);

    // Hazard stripes
    ctx.strokeStyle = 'rgba(255, 200, 0, 0.3)';
    ctx.lineWidth = 1;
    const step = 12;
    for (let i = -obs.height; i < obs.width; i += step) {
      ctx.beginPath();
      ctx.moveTo(obs.position.x + i, obs.position.y);
      ctx.lineTo(obs.position.x + i + obs.height, obs.position.y + obs.height);
      ctx.stroke();
    }
  }
}
