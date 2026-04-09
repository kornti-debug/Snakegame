import type { GameSnapshot, PowerUpState, ObstacleState, BoidState } from '@snakegame/shared';
import { ARENA_WIDTH, ARENA_HEIGHT, BOID_RADIUS } from '@snakegame/shared';
import { drawSnake } from '../SnakeRenderer.js';

const BOID_TRAIL_LENGTH = 5;    // segments per mini snake
const BOID_SEGMENT_SPACING = 6; // px between segments
const BOID_BODY_WIDTH = 4;      // line width for mini snake body

export class GameLayer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pulseTime = 0;

  // Trail history per boid: maps boid id → array of past positions
  private boidTrails = new Map<number, { x: number; y: number }[]>();

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

    // Boids (AI swarm) — update trails and render as mini snakes
    this.updateBoidTrails(snapshot.boids);
    for (const boid of snapshot.boids) {
      this.drawBoidSnake(ctx, boid);
    }

    // Snakes
    for (const snake of snapshot.snakes) {
      drawSnake(ctx, snake);
    }
  }

  private drawPowerUp(ctx: CanvasRenderingContext2D, pu: PowerUpState): void {
    const { x, y } = pu.position;
    const pulse = 1 + Math.sin(this.pulseTime * 3) * 0.15;
    const size = Math.round(24 * pulse);

    const iconMap: Record<string, string> = {
      'speed-boost': '⚡', 'wide-trail': '◎', 'ghost': '👻',
      'star': '⭐', 'swarm-leader': '🐟', 'predator': '🦈', 'growth': '🌱',
    };
    const icon = iconMap[pu.type] ?? '?';

    // Emoji with colored glow — no circle background
    ctx.save();
    ctx.shadowColor = pu.renderHint.color;
    ctx.shadowBlur = 16;
    ctx.font = `${size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, x, y);
    ctx.restore();
  }

  /** Update trail history for all boids */
  private updateBoidTrails(boids: BoidState[]): void {
    const activeBoidIds = new Set(boids.map(b => b.id));

    // Remove trails for dead boids
    for (const id of this.boidTrails.keys()) {
      if (!activeBoidIds.has(id)) this.boidTrails.delete(id);
    }

    // Push new position to front of each trail
    for (const boid of boids) {
      let trail = this.boidTrails.get(boid.id);
      if (!trail) {
        // Initialize trail behind the boid based on angle
        trail = [];
        for (let i = 0; i < BOID_TRAIL_LENGTH; i++) {
          trail.push({
            x: boid.x - Math.cos(boid.angle) * i * BOID_SEGMENT_SPACING,
            y: boid.y - Math.sin(boid.angle) * i * BOID_SEGMENT_SPACING,
          });
        }
        this.boidTrails.set(boid.id, trail);
      }

      // Prepend current position
      trail.unshift({ x: boid.x, y: boid.y });

      // Keep trail at fixed length
      while (trail.length > BOID_TRAIL_LENGTH * 3) {
        trail.pop();
      }
    }
  }

  /** Render a boid as a mini snake using its trail */
  private drawBoidSnake(ctx: CanvasRenderingContext2D, boid: BoidState): void {
    const trail = this.boidTrails.get(boid.id);
    if (!trail || trail.length < 2) return;

    const color = boid.leaderId ? '#88FFAA' : '#66CCDD';

    // Build segments at even spacing along the trail
    const segments: { x: number; y: number }[] = [trail[0]];
    let walked = 0;
    let nextDist = BOID_SEGMENT_SPACING;

    for (let i = 0; i < trail.length - 1 && segments.length < BOID_TRAIL_LENGTH; i++) {
      const dx = trail[i + 1].x - trail[i].x;
      const dy = trail[i + 1].y - trail[i].y;
      const edgeLen = Math.sqrt(dx * dx + dy * dy);
      if (edgeLen === 0) continue;

      const edgeStart = walked;
      const edgeEnd = walked + edgeLen;

      while (nextDist <= edgeEnd && segments.length < BOID_TRAIL_LENGTH) {
        const t = (nextDist - edgeStart) / edgeLen;
        segments.push({
          x: trail[i].x + dx * t,
          y: trail[i].y + dy * t,
        });
        nextDist += BOID_SEGMENT_SPACING;
      }

      walked = edgeEnd;
    }

    if (segments.length < 2) return;

    // Draw body as smooth curve (same style as player snakes, but thinner)
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = BOID_BODY_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.85;

    ctx.beginPath();
    ctx.moveTo(segments[0].x, segments[0].y);

    for (let i = 1; i < segments.length - 1; i++) {
      const midX = (segments[i].x + segments[i + 1].x) / 2;
      const midY = (segments[i].y + segments[i + 1].y) / 2;
      ctx.quadraticCurveTo(segments[i].x, segments[i].y, midX, midY);
    }

    const last = segments[segments.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();

    // Head: small circle
    const head = segments[0];
    const headR = BOID_BODY_WIDTH * 0.8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(head.x, head.y, headR, 0, Math.PI * 2);
    ctx.fill();

    // Tiny eye
    const eyeOffX = Math.cos(boid.angle) * headR * 0.4;
    const eyeOffY = Math.sin(boid.angle) * headR * 0.4;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(head.x + eyeOffX, head.y + eyeOffY, headR * 0.35, 0, Math.PI * 2);
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
