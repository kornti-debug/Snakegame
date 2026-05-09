import type { GameSnapshot, SnakeState, MemoryPair } from '@snakegame/shared';

export type SnapshotEvent =
  | { kind: 'death'; snakeId: string }
  | { kind: 'pickup'; snakeId: string; itemId: string }
  | { kind: 'activate'; snakeId: string; effectId: string }
  | { kind: 'effectEnd'; snakeId: string; effectId: string }
  | { kind: 'frozen'; snakeId: string }
  | { kind: 'shrunken'; snakeId: string }
  | { kind: 'crippled'; snakeId: string }
  | { kind: 'tileCaptured'; tileId: number; snakeId: string }
  | { kind: 'pairMatched'; pairId: number; isBonus: boolean; snakeId: string }
  | { kind: 'pairNeutralized'; pairId: number }
  | { kind: 'boidEaten'; snakeId: string; count: number; x: number; y: number; color: string };

/**
 * Diff two snapshots and emit a flat list of "things that just happened" we
 * want to react to (SFX / shake / etc.). All reasoning is local to the client
 * — the server doesn't broadcast event streams, just authoritative state.
 */
export function diffSnapshots(prev: GameSnapshot, next: GameSnapshot): SnapshotEvent[] {
  const events: SnapshotEvent[] = [];

  const prevSnakes = new Map(prev.snakes.map(s => [s.id, s]));
  for (const ns of next.snakes) {
    const ps = prevSnakes.get(ns.id);
    if (!ps) continue;
    diffSnake(ps, ns, events);
  }

  diffBoard(prev, next, events);

  return events;
}

function diffSnake(ps: SnakeState, ns: SnakeState, out: SnapshotEvent[]): void {
  if (ps.alive && !ns.alive) out.push({ kind: 'death', snakeId: ns.id });

  if (ns.itemSlot && ps.itemSlot !== ns.itemSlot) {
    out.push({ kind: 'pickup', snakeId: ns.id, itemId: ns.itemSlot });
  }

  if (ns.activeEffect && ps.activeEffect !== ns.activeEffect) {
    out.push({ kind: 'activate', snakeId: ns.id, effectId: ns.activeEffect });
  } else if (ps.activeEffect && !ns.activeEffect) {
    out.push({ kind: 'effectEnd', snakeId: ns.id, effectId: ps.activeEffect });
  }

  if (!ps.frozen && ns.frozen) out.push({ kind: 'frozen', snakeId: ns.id });
  if (!ps.shrunken && ns.shrunken) out.push({ kind: 'shrunken', snakeId: ns.id });
  if (!ps.crippled && ns.crippled) out.push({ kind: 'crippled', snakeId: ns.id });

  // Boid Battle: count went up = snake just ate one or more boids this tick.
  // Emit at the snake head — the consumed boids were within head-radius.
  if (ns.boidsEaten > ps.boidsEaten && ns.segments.length > 0) {
    out.push({
      kind: 'boidEaten',
      snakeId: ns.id,
      count: ns.boidsEaten - ps.boidsEaten,
      x: ns.segments[0].x,
      y: ns.segments[0].y,
      color: ns.color,
    });
  }
}

function diffBoard(prev: GameSnapshot, next: GameSnapshot, out: SnapshotEvent[]): void {
  const prevTiles = new Map(prev.memoryBoard.tiles.map(t => [t.tileId, t]));
  for (const nt of next.memoryBoard.tiles) {
    const pt = prevTiles.get(nt.tileId);
    if (!pt) continue;
    if (pt.capturedBy === null && nt.capturedBy !== null) {
      out.push({ kind: 'tileCaptured', tileId: nt.tileId, snakeId: nt.capturedBy });
    }
  }

  const prevPairs = new Map<number, MemoryPair>(prev.memoryBoard.pairs.map(p => [p.pairId, p]));
  for (const np of next.memoryBoard.pairs) {
    const pp = prevPairs.get(np.pairId);
    if (!pp) continue;
    if (!pp.matched && np.matched && np.matchedBy) {
      out.push({
        kind: 'pairMatched',
        pairId: np.pairId,
        isBonus: np.isBonus,
        snakeId: np.matchedBy,
      });
    }
    if (!pp.neutralized && np.neutralized) {
      out.push({ kind: 'pairNeutralized', pairId: np.pairId });
    }
  }
}
