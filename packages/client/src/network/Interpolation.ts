import type { GameSnapshot, BoidState } from '@snakegame/shared';
import { lerpVec, lerp, TICK_INTERVAL } from '@snakegame/shared';

export class InterpolationBuffer {
  private snapshots: GameSnapshot[] = [];

  push(snapshot: GameSnapshot): void {
    this.snapshots.push(snapshot);
    // Keep only last 3 snapshots
    if (this.snapshots.length > 3) {
      this.snapshots.shift();
    }
  }

  interpolate(renderTime: number): GameSnapshot | null {
    if (this.snapshots.length < 2) {
      return this.snapshots[0] ?? null;
    }

    const prev = this.snapshots[this.snapshots.length - 2];
    const curr = this.snapshots[this.snapshots.length - 1];

    const elapsed = renderTime - prev.timestamp;
    const duration = curr.timestamp - prev.timestamp || TICK_INTERVAL;
    const t = Math.min(Math.max(elapsed / duration, 0), 1);

    // Interpolate snake positions
    const snakes = curr.snakes.map((currSnake) => {
      const prevSnake = prev.snakes.find(s => s.id === currSnake.id);
      if (!prevSnake) return currSnake;

      const segments = currSnake.segments.map((seg, i) => {
        const prevSeg = prevSnake.segments[i];
        if (!prevSeg) return seg;
        return lerpVec(prevSeg, seg, t);
      });

      return { ...currSnake, segments };
    });

    // Interpolate boid positions
    const boids = curr.boids.map((currBoid) => {
      const prevBoid = prev.boids.find(b => b.id === currBoid.id);
      if (!prevBoid) return currBoid;
      return {
        ...currBoid,
        x: lerp(prevBoid.x, currBoid.x, t),
        y: lerp(prevBoid.y, currBoid.y, t),
      };
    });

    return { ...curr, snakes, boids };
  }

  getLatest(): GameSnapshot | null {
    return this.snapshots[this.snapshots.length - 1] ?? null;
  }
}
