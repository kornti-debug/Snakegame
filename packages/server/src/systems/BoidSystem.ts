/**
 * Boid flocking system based on Craig Reynolds' algorithm.
 * Uses the velocity + steering force model (not angle-based).
 *
 * Three rules: separation, alignment, cohesion.
 * Plus: flee from player snakes, follow swarm leaders, wall avoidance.
 */
import type { Vector2D, BoidState } from '@snakegame/shared';
import {
  ARENA_WIDTH, ARENA_HEIGHT,
  BOID_SPEED, BOID_RADIUS,
  BOID_FEAR_RADIUS, BOID_FEAR_WEIGHT,
  BOID_FOLLOW_RADIUS, BOID_FOLLOW_WEIGHT,
  BOID_WALL_MARGIN,
  BOID_COUNT_INITIAL, BOID_SPAWN_INTERVAL, BOID_SPAWN_GROUP_SIZE, BOID_MAX_COUNT,
  PREDATOR_FEAR_RADIUS,
} from '@snakegame/shared';
import type { Snake } from '../entities/Snake.js';

// Classic boids parameters (Nature of Code style)
const MAX_SPEED = BOID_SPEED;           // px/sec max velocity
const MAX_FORCE = BOID_SPEED * 0.03;    // steering force cap — small = smooth turns

const SEPARATION_RADIUS = 35;           // push away from very close neighbors
const ALIGNMENT_RADIUS = 70;            // align heading with nearby flock
const COHESION_RADIUS = 90;             // steer toward center of nearby flock

const SEPARATION_WEIGHT = 1.8;
const ALIGNMENT_WEIGHT = 1.2;
const COHESION_WEIGHT = 1.0;

interface Boid {
  id: number;
  x: number;
  y: number;
  vx: number;                // velocity-based, not angle-based
  vy: number;
  leaderId: string | null;   // swarm leader powerup
}

export class BoidSystem {
  private boids: Boid[] = [];
  private nextId = 0;
  private spawnTimer = 0;

  reset(): void {
    this.boids = [];
    this.nextId = 0;
    this.spawnTimer = 0;
  }

  spawnInitial(): void {
    // Spawn in a few groups spread across the arena
    const groups = 4;
    const perGroup = Math.ceil(BOID_COUNT_INITIAL / groups);
    const margin = 300;
    for (let g = 0; g < groups; g++) {
      const cx = margin + Math.random() * (ARENA_WIDTH - margin * 2);
      const cy = margin + Math.random() * (ARENA_HEIGHT - margin * 2);
      // Give each group a shared initial heading
      const angle = Math.random() * Math.PI * 2;
      this.spawnGroup(cx, cy, perGroup, angle);
    }
  }

  private spawnGroup(cx: number, cy: number, count: number, heading: number): void {
    const speed = MAX_SPEED * (0.7 + Math.random() * 0.3);
    for (let i = 0; i < count; i++) {
      if (this.boids.length >= BOID_MAX_COUNT) break;
      // Slight variation in position and heading
      const a = heading + (Math.random() - 0.5) * 0.6;
      const s = speed * (0.85 + Math.random() * 0.3);
      this.boids.push({
        id: this.nextId++,
        x: cx + (Math.random() - 0.5) * 80,
        y: cy + (Math.random() - 0.5) * 80,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        leaderId: null,
      });
    }
  }

  update(dt: number, snakes: Snake[]): void {
    // Periodic spawning
    this.spawnTimer += dt * 1000;
    if (this.spawnTimer >= BOID_SPAWN_INTERVAL && this.boids.length < BOID_MAX_COUNT) {
      this.spawnTimer = 0;
      const margin = 200;
      const cx = margin + Math.random() * (ARENA_WIDTH - margin * 2);
      const cy = margin + Math.random() * (ARENA_HEIGHT - margin * 2);
      const angle = Math.random() * Math.PI * 2;
      this.spawnGroup(cx, cy, BOID_SPAWN_GROUP_SIZE, angle);
    }

    const snakeHeads = snakes.filter(s => s.alive).map(s => ({
      id: s.id, pos: s.segments[0], starred: s.starred,
      swarmLeader: s.swarmLeader, predator: s.predator,
    }));

    this.updateSwarmLeaders(snakeHeads);

    // Compute steering for each boid
    for (const boid of this.boids) {
      const acc = this.computeAcceleration(boid, snakeHeads);

      // Apply acceleration to velocity
      boid.vx += acc.x * dt;
      boid.vy += acc.y * dt;

      // Clamp to max speed (but also enforce a minimum so they always move)
      const speed = Math.sqrt(boid.vx * boid.vx + boid.vy * boid.vy);
      if (speed > MAX_SPEED) {
        boid.vx = (boid.vx / speed) * MAX_SPEED;
        boid.vy = (boid.vy / speed) * MAX_SPEED;
      } else if (speed < MAX_SPEED * 0.5 && speed > 0) {
        // Enforce minimum speed — boids always move
        boid.vx = (boid.vx / speed) * MAX_SPEED * 0.5;
        boid.vy = (boid.vy / speed) * MAX_SPEED * 0.5;
      }

      // Update position
      boid.x += boid.vx * dt;
      boid.y += boid.vy * dt;

      // Wrap edges
      if (boid.x < 0) boid.x += ARENA_WIDTH;
      if (boid.x > ARENA_WIDTH) boid.x -= ARENA_WIDTH;
      if (boid.y < 0) boid.y += ARENA_HEIGHT;
      if (boid.y > ARENA_HEIGHT) boid.y -= ARENA_HEIGHT;
    }

    this.checkStarCollisions(snakeHeads);
  }

  private computeAcceleration(boid: Boid, snakeHeads: SnakeHead[]): Vector2D {
    // --- Classic boids: separation, alignment, cohesion ---
    const sep = this.separate(boid);
    const ali = this.align(boid);
    const coh = this.cohere(boid);

    // Weighted sum of steering forces
    const acc: Vector2D = {
      x: sep.x * SEPARATION_WEIGHT + ali.x * ALIGNMENT_WEIGHT + coh.x * COHESION_WEIGHT,
      y: sep.y * SEPARATION_WEIGHT + ali.y * ALIGNMENT_WEIGHT + coh.y * COHESION_WEIGHT,
    };

    // --- Snake interaction ---
    for (const snake of snakeHeads) {
      const d = dist(boid, snake.pos);

      if (boid.leaderId === snake.id) {
        // Follow swarm leader powerup
        if (d > 50) {
          const desired = normalize2({ x: snake.pos.x - boid.x, y: snake.pos.y - boid.y }, MAX_SPEED);
          const steer = limit2({ x: desired.x - boid.vx, y: desired.y - boid.vy }, MAX_FORCE * 2);
          acc.x += steer.x * BOID_FOLLOW_WEIGHT;
          acc.y += steer.y * BOID_FOLLOW_WEIGHT;
        }
      } else {
        // Flee from player snakes
        const fearR = snake.predator ? PREDATOR_FEAR_RADIUS : BOID_FEAR_RADIUS;
        if (d > 0 && d < fearR) {
          const strength = (fearR - d) / fearR;
          const away = normalize2({ x: boid.x - snake.pos.x, y: boid.y - snake.pos.y }, MAX_SPEED);
          const steer = limit2({ x: away.x - boid.vx, y: away.y - boid.vy }, MAX_FORCE * 3);
          acc.x += steer.x * BOID_FEAR_WEIGHT * strength;
          acc.y += steer.y * BOID_FEAR_WEIGHT * strength;
        }
      }
    }

    // --- Wall avoidance ---
    const m = BOID_WALL_MARGIN;
    const wallForce = MAX_FORCE * 5;
    if (boid.x < m) acc.x += (m - boid.x) / m * wallForce;
    if (boid.x > ARENA_WIDTH - m) acc.x -= (boid.x - (ARENA_WIDTH - m)) / m * wallForce;
    if (boid.y < m) acc.y += (m - boid.y) / m * wallForce;
    if (boid.y > ARENA_HEIGHT - m) acc.y -= (boid.y - (ARENA_HEIGHT - m)) / m * wallForce;

    return acc;
  }

  /** Separation: steer away from close neighbors */
  private separate(boid: Boid): Vector2D {
    let steerX = 0, steerY = 0, count = 0;
    for (const other of this.boids) {
      const d = dist(boid, other);
      if (d > 0 && d < SEPARATION_RADIUS) {
        // Weighted by inverse distance (closer = stronger push)
        steerX += (boid.x - other.x) / (d * d);
        steerY += (boid.y - other.y) / (d * d);
        count++;
      }
    }
    if (count === 0) return { x: 0, y: 0 };
    steerX /= count;
    steerY /= count;
    // Scale to desired velocity, then compute steering force
    const desired = normalize2({ x: steerX, y: steerY }, MAX_SPEED);
    return limit2({ x: desired.x - boid.vx, y: desired.y - boid.vy }, MAX_FORCE);
  }

  /** Alignment: steer toward average velocity of neighbors */
  private align(boid: Boid): Vector2D {
    let avgVx = 0, avgVy = 0, count = 0;
    for (const other of this.boids) {
      const d = dist(boid, other);
      if (d > 0 && d < ALIGNMENT_RADIUS) {
        avgVx += other.vx;
        avgVy += other.vy;
        count++;
      }
    }
    if (count === 0) return { x: 0, y: 0 };
    avgVx /= count;
    avgVy /= count;
    const desired = normalize2({ x: avgVx, y: avgVy }, MAX_SPEED);
    return limit2({ x: desired.x - boid.vx, y: desired.y - boid.vy }, MAX_FORCE);
  }

  /** Cohesion: steer toward center of mass of neighbors */
  private cohere(boid: Boid): Vector2D {
    let cx = 0, cy = 0, count = 0;
    for (const other of this.boids) {
      const d = dist(boid, other);
      if (d > 0 && d < COHESION_RADIUS) {
        cx += other.x;
        cy += other.y;
        count++;
      }
    }
    if (count === 0) return { x: 0, y: 0 };
    cx /= count;
    cy /= count;
    const desired = normalize2({ x: cx - boid.x, y: cy - boid.y }, MAX_SPEED);
    return limit2({ x: desired.x - boid.vx, y: desired.y - boid.vy }, MAX_FORCE);
  }

  private updateSwarmLeaders(snakeHeads: SnakeHead[]): void {
    const leaders = snakeHeads.filter(s => s.swarmLeader);
    for (const boid of this.boids) {
      if (leaders.length === 0) { boid.leaderId = null; continue; }
      let bestDist = BOID_FOLLOW_RADIUS;
      let bestLeader: string | null = null;
      for (const leader of leaders) {
        const d = dist(boid, leader.pos);
        if (d < bestDist) { bestDist = d; bestLeader = leader.id; }
      }
      boid.leaderId = bestLeader;
    }
  }

  private checkStarCollisions(snakeHeads: SnakeHead[]): void {
    const starred = snakeHeads.filter(s => s.starred);
    if (starred.length === 0) return;
    this.boids = this.boids.filter(boid => {
      for (const snake of starred) {
        if (dist(boid, snake.pos) < BOID_RADIUS + 15) return false;
      }
      return true;
    });
  }

  checkSnakeBoidCollision(snake: Snake): boolean {
    if (!snake.alive || snake.starred || snake.ghosting) return false;
    const head = snake.segments[0];
    for (const boid of this.boids) {
      if (boid.leaderId === snake.id) continue;
      if (dist(head, boid) < BOID_RADIUS + snake.radius) return true;
    }
    return false;
  }

  getRevealableBoids(): { x: number; y: number; leaderId: string | null }[] {
    return this.boids.map(b => ({ x: b.x, y: b.y, leaderId: b.leaderId }));
  }

  getBoidStates(): BoidState[] {
    return this.boids.map(b => ({
      id: b.id,
      x: b.x,
      y: b.y,
      angle: Math.atan2(b.vy, b.vx),
      speed: Math.sqrt(b.vx * b.vx + b.vy * b.vy),
      leaderId: b.leaderId,
    }));
  }

  getBoidCount(): number {
    return this.boids.length;
  }
}

type SnakeHead = { id: string; pos: Vector2D; starred: boolean; swarmLeader: boolean; predator: boolean };

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function normalize2(v: Vector2D, len: number): Vector2D {
  const mag = Math.sqrt(v.x * v.x + v.y * v.y);
  if (mag === 0) return { x: 0, y: 0 };
  return { x: (v.x / mag) * len, y: (v.y / mag) * len };
}

function limit2(v: Vector2D, max: number): Vector2D {
  const mag = Math.sqrt(v.x * v.x + v.y * v.y);
  if (mag <= max) return v;
  return { x: (v.x / mag) * max, y: (v.y / mag) * max };
}
