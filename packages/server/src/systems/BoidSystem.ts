import type { Vector2D, BoidState } from '@snakegame/shared';
import {
  ARENA_WIDTH, ARENA_HEIGHT,
  BOID_SPEED, BOID_RADIUS,
  BOID_SEPARATION_RADIUS,
  BOID_FEAR_RADIUS, BOID_FEAR_WEIGHT,
  BOID_FOLLOW_RADIUS, BOID_FOLLOW_WEIGHT,
  BOID_WALL_MARGIN,
  BOID_COUNT_INITIAL, BOID_SPAWN_INTERVAL, BOID_SPAWN_GROUP_SIZE, BOID_MAX_COUNT,
  PREDATOR_FEAR_RADIUS,
  headingToVector, normalizeAngle,
} from '@snakegame/shared';
import type { Snake } from '../entities/Snake.js';

// Alpha boids: wander freely, drive the whole group
const ALPHA_TURN_RATE = 2.5;           // rad/s — smooth but decisive turns
const ALPHA_WANDER_STRENGTH = 3.0;     // strong forward drive
const ALPHA_WANDER_DRIFT = 0.8;        // how fast wander angle changes (rad/s)
const ALPHA_PAUSE_CHANCE = 0.003;      // chance per tick to pick a new random wander direction
const ALPHA_SPEED = BOID_SPEED * 1.05;

// Follower boids: follow their alpha, flock with each other
const FOLLOWER_TURN_RATE = 4.0;        // rad/s — responsive turning
const FOLLOWER_SEPARATION_WEIGHT = 2.0;
const FOLLOWER_ALIGNMENT_WEIGHT = 1.5;
const FOLLOWER_COHESION_WEIGHT = 0.3;  // low — alpha-follow is the main pull
const FOLLOWER_ALPHA_FOLLOW_WEIGHT = 2.5; // strong pull toward their alpha
const FOLLOWER_ALPHA_RANGE = 250;      // range to detect alpha
const FOLLOWER_FLOCK_RADIUS = 80;      // range for flocking with other followers
const FOLLOWER_WANDER_STRENGTH = 0.3;  // very light wander
const FOLLOWER_SPEED = BOID_SPEED;

interface Boid {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  leaderId: string | null;
  isAlpha: boolean;
  wanderAngle: number;
  alphaId: number;        // which alpha this follower is assigned to (-1 = none)
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
    const groupCount = 4;
    const perGroup = Math.ceil(BOID_COUNT_INITIAL / groupCount);
    const margin = 250;

    for (let g = 0; g < groupCount; g++) {
      const cx = margin + Math.random() * (ARENA_WIDTH - margin * 2);
      const cy = margin + Math.random() * (ARENA_HEIGHT - margin * 2);
      this.spawnGroup(cx, cy, perGroup);
    }
  }

  private spawnGroup(cx: number, cy: number, count: number): void {
    const groupAngle = Math.random() * Math.PI * 2;
    let alphaId = -1;

    for (let i = 0; i < count; i++) {
      if (this.boids.length >= BOID_MAX_COUNT) break;
      const isAlpha = i === 0;
      const boid: Boid = {
        id: this.nextId++,
        x: cx + (Math.random() - 0.5) * 60,
        y: cy + (Math.random() - 0.5) * 60,
        angle: groupAngle + (Math.random() - 0.5) * 0.5,
        speed: isAlpha ? ALPHA_SPEED : FOLLOWER_SPEED * (0.9 + Math.random() * 0.2),
        leaderId: null,
        isAlpha,
        wanderAngle: groupAngle,
        alphaId: -1,
      };
      if (isAlpha) alphaId = boid.id;
      this.boids.push(boid);
    }

    // Assign followers to this alpha
    for (const b of this.boids) {
      if (!b.isAlpha && b.alphaId === -1) {
        const alpha = this.boids.find(a => a.id === alphaId);
        if (alpha && dist(b, alpha) < FOLLOWER_ALPHA_RANGE) {
          b.alphaId = alphaId;
        }
      }
    }
  }

  update(dt: number, snakes: Snake[]): void {
    // Spawn new groups periodically
    this.spawnTimer += dt * 1000;
    if (this.spawnTimer >= BOID_SPAWN_INTERVAL && this.boids.length < BOID_MAX_COUNT) {
      this.spawnTimer = 0;
      const margin = 200;
      const cx = margin + Math.random() * (ARENA_WIDTH - margin * 2);
      const cy = margin + Math.random() * (ARENA_HEIGHT - margin * 2);
      this.spawnGroup(cx, cy, BOID_SPAWN_GROUP_SIZE);
    }

    const snakeHeads = snakes
      .filter(s => s.alive)
      .map(s => ({
        id: s.id,
        pos: s.segments[0],
        starred: s.starred,
        swarmLeader: s.swarmLeader,
        predator: s.predator,
      }));

    // Update swarm leader (powerup) assignments
    this.updateSwarmLeaderAssignments(snakeHeads);

    // Reassign orphaned followers to nearest alpha
    this.reassignOrphans();

    // Update each boid
    for (const boid of this.boids) {
      if (boid.isAlpha) {
        this.updateAlpha(boid, dt, snakeHeads);
      } else {
        this.updateFollower(boid, dt, snakeHeads);
      }
    }

    this.checkStarCollisions(snakeHeads);
  }

  private updateAlpha(boid: Boid, dt: number, snakeHeads: SnakeHead[]): void {
    // Alpha wander: smoothly drift the wander angle
    boid.wanderAngle += (Math.random() - 0.5) * ALPHA_WANDER_DRIFT * dt * 2;

    // Occasionally pick a completely new random direction (creates interesting paths)
    if (Math.random() < ALPHA_PAUSE_CHANCE) {
      boid.wanderAngle = Math.random() * Math.PI * 2;
    }

    // Steering = strong wander + wall avoidance + flee from snakes
    const steer: Vector2D = {
      x: Math.cos(boid.wanderAngle) * ALPHA_WANDER_STRENGTH,
      y: Math.sin(boid.wanderAngle) * ALPHA_WANDER_STRENGTH,
    };

    // Alphas also separate from other alphas (keeps groups distinct)
    for (const other of this.boids) {
      if (other.id === boid.id || !other.isAlpha) continue;
      const d = dist(boid, other);
      if (d > 0 && d < 150) {
        steer.x += (boid.x - other.x) / d * 1.0;
        steer.y += (boid.y - other.y) / d * 1.0;
      }
    }

    // Separation from close followers (don't pile up)
    for (const other of this.boids) {
      if (other.id === boid.id) continue;
      const d = dist(boid, other);
      if (d > 0 && d < BOID_SEPARATION_RADIUS) {
        steer.x += (boid.x - other.x) / d * 1.5;
        steer.y += (boid.y - other.y) / d * 1.5;
      }
    }

    this.applySnakeFlee(boid, steer, snakeHeads);
    this.applyWallAvoidance(boid, steer);
    this.applySteer(boid, steer, ALPHA_TURN_RATE, dt);
  }

  private updateFollower(boid: Boid, dt: number, snakeHeads: SnakeHead[]): void {
    const steer: Vector2D = { x: 0, y: 0 };

    // Find the alpha to follow (either assigned alpha or nearest one)
    const alpha = this.boids.find(b => b.id === boid.alphaId && b.isAlpha);

    if (alpha) {
      // Steer toward alpha
      const d = dist(boid, alpha);
      if (d > 30) {
        steer.x += (alpha.x - boid.x) / d * FOLLOWER_ALPHA_FOLLOW_WEIGHT;
        steer.y += (alpha.y - boid.y) / d * FOLLOWER_ALPHA_FOLLOW_WEIGHT;
      }

      // Also align with alpha's heading
      const alphaDir = headingToVector(alpha.angle);
      steer.x += alphaDir.x * FOLLOWER_ALIGNMENT_WEIGHT;
      steer.y += alphaDir.y * FOLLOWER_ALIGNMENT_WEIGHT;
    } else {
      // No alpha — wander on own (mild)
      boid.wanderAngle += (Math.random() - 0.5) * 2.0 * dt;
      steer.x += Math.cos(boid.wanderAngle) * 1.0;
      steer.y += Math.sin(boid.wanderAngle) * 1.0;
    }

    // Flock with nearby boids (separation + mild cohesion with non-alpha neighbors)
    let cohX = 0, cohY = 0, cohCount = 0;
    for (const other of this.boids) {
      if (other.id === boid.id) continue;
      const d = dist(boid, other);

      // Separation (don't overlap)
      if (d > 0 && d < BOID_SEPARATION_RADIUS) {
        steer.x += (boid.x - other.x) / d * FOLLOWER_SEPARATION_WEIGHT;
        steer.y += (boid.y - other.y) / d * FOLLOWER_SEPARATION_WEIGHT;
      }

      // Cohesion with nearby non-alpha boids
      if (!other.isAlpha && d > 0 && d < FOLLOWER_FLOCK_RADIUS) {
        cohX += other.x;
        cohY += other.y;
        cohCount++;
      }
    }

    if (cohCount > 0) {
      steer.x += (cohX / cohCount - boid.x) * FOLLOWER_COHESION_WEIGHT * 0.01;
      steer.y += (cohY / cohCount - boid.y) * FOLLOWER_COHESION_WEIGHT * 0.01;
    }

    // Gentle wander
    boid.wanderAngle += (Math.random() - 0.5) * 1.5 * dt;
    steer.x += Math.cos(boid.wanderAngle) * FOLLOWER_WANDER_STRENGTH;
    steer.y += Math.sin(boid.wanderAngle) * FOLLOWER_WANDER_STRENGTH;

    this.applySnakeFlee(boid, steer, snakeHeads);
    this.applyWallAvoidance(boid, steer);
    this.applySteer(boid, steer, FOLLOWER_TURN_RATE, dt);
  }

  private applySnakeFlee(boid: Boid, steer: Vector2D, snakeHeads: SnakeHead[]): void {
    for (const snake of snakeHeads) {
      const d = dist(boid, snake.pos);

      if (boid.leaderId === snake.id) {
        // Following swarm leader powerup
        if (d > 50) {
          steer.x += (snake.pos.x - boid.x) / d * BOID_FOLLOW_WEIGHT;
          steer.y += (snake.pos.y - boid.y) / d * BOID_FOLLOW_WEIGHT;
        } else if (d < 25) {
          steer.x += (boid.x - snake.pos.x) / d * 0.5;
          steer.y += (boid.y - snake.pos.y) / d * 0.5;
        }
      } else {
        const fearR = snake.predator ? PREDATOR_FEAR_RADIUS : BOID_FEAR_RADIUS;
        if (d > 0 && d < fearR) {
          const strength = (fearR - d) / fearR;
          steer.x += ((boid.x - snake.pos.x) / d) * strength * BOID_FEAR_WEIGHT;
          steer.y += ((boid.y - snake.pos.y) / d) * strength * BOID_FEAR_WEIGHT;
        }
      }
    }
  }

  private applyWallAvoidance(boid: Boid, steer: Vector2D): void {
    const m = BOID_WALL_MARGIN;
    const w = 4; // wall push strength
    if (boid.x < m) steer.x += (m - boid.x) / m * w;
    if (boid.x > ARENA_WIDTH - m) steer.x -= (boid.x - (ARENA_WIDTH - m)) / m * w;
    if (boid.y < m) steer.y += (m - boid.y) / m * w;
    if (boid.y > ARENA_HEIGHT - m) steer.y -= (boid.y - (ARENA_HEIGHT - m)) / m * w;
  }

  private applySteer(boid: Boid, steer: Vector2D, turnRate: number, dt: number): void {
    const mag = Math.sqrt(steer.x * steer.x + steer.y * steer.y);
    if (mag > 0.01) {
      const desiredAngle = Math.atan2(steer.y, steer.x);
      let angleDiff = normalizeAngle(desiredAngle - boid.angle);
      const maxTurn = turnRate * dt;
      angleDiff = Math.max(-maxTurn, Math.min(maxTurn, angleDiff));
      boid.angle = normalizeAngle(boid.angle + angleDiff);
    }

    const dir = headingToVector(boid.angle);
    boid.x += dir.x * boid.speed * dt;
    boid.y += dir.y * boid.speed * dt;

    // Wrap edges
    if (boid.x < 0) boid.x += ARENA_WIDTH;
    if (boid.x > ARENA_WIDTH) boid.x -= ARENA_WIDTH;
    if (boid.y < 0) boid.y += ARENA_HEIGHT;
    if (boid.y > ARENA_HEIGHT) boid.y -= ARENA_HEIGHT;
  }

  private updateSwarmLeaderAssignments(snakeHeads: SnakeHead[]): void {
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

  /** Assign orphaned followers (whose alpha was killed) to nearest alpha */
  private reassignOrphans(): void {
    const alphas = this.boids.filter(b => b.isAlpha);
    for (const boid of this.boids) {
      if (boid.isAlpha) continue;
      // Check if assigned alpha still exists
      if (boid.alphaId >= 0 && alphas.some(a => a.id === boid.alphaId)) continue;

      // Find nearest alpha
      let bestDist = FOLLOWER_ALPHA_RANGE;
      let bestAlpha = -1;
      for (const alpha of alphas) {
        const d = dist(boid, alpha);
        if (d < bestDist) { bestDist = d; bestAlpha = alpha.id; }
      }
      boid.alphaId = bestAlpha;
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
      id: b.id, x: b.x, y: b.y, angle: b.angle, speed: b.speed, leaderId: b.leaderId,
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
