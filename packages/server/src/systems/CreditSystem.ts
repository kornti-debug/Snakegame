import type { TwitchViewer } from '@snakegame/shared';
import { VIEWER_INITIAL_CREDITS } from '@snakegame/shared';

export class CreditSystem {
  private viewers = new Map<string, TwitchViewer>();
  // Track team sizes for round-robin assignment
  private teamCounts = new Map<string, number>(); // snakeId → viewer count

  /** Register a viewer and assign to a snake team */
  joinViewer(viewerName: string, snakeIds: string[], snakeColors: Map<string, string>): TwitchViewer {
    // Check if already joined
    const existing = this.viewers.get(viewerName);
    if (existing) return existing;

    // Find snake with fewest viewers
    let bestSnakeId = snakeIds[0] ?? '';
    let minCount = Infinity;
    for (const sid of snakeIds) {
      const count = this.teamCounts.get(sid) ?? 0;
      if (count < minCount) {
        minCount = count;
        bestSnakeId = sid;
      }
    }

    const viewer: TwitchViewer = {
      viewerName,
      teamSnakeId: bestSnakeId,
      teamColor: snakeColors.get(bestSnakeId) ?? '#FFFFFF',
      credits: VIEWER_INITIAL_CREDITS,
    };

    this.viewers.set(viewerName, viewer);
    this.teamCounts.set(bestSnakeId, (this.teamCounts.get(bestSnakeId) ?? 0) + 1);
    return viewer;
  }

  spendCredits(viewerName: string, amount: number): boolean {
    const viewer = this.viewers.get(viewerName);
    if (!viewer || viewer.credits < amount) return false;
    viewer.credits -= amount;
    return true;
  }

  earnCredits(viewerName: string, amount: number): number {
    const viewer = this.viewers.get(viewerName);
    if (!viewer) return 0;
    viewer.credits += amount;
    return viewer.credits;
  }

  getViewer(viewerName: string): TwitchViewer | undefined {
    return this.viewers.get(viewerName);
  }

  getAllViewers(): TwitchViewer[] {
    return [...this.viewers.values()];
  }

  /** Update team assignments when snakes change (e.g. new round) */
  updateSnakeColors(snakeColors: Map<string, string>): void {
    for (const viewer of this.viewers.values()) {
      const color = snakeColors.get(viewer.teamSnakeId);
      if (color) viewer.teamColor = color;
    }
  }

  /** Reset team counts (call when snake roster changes) */
  resetTeamCounts(snakeIds: string[]): void {
    this.teamCounts.clear();
    for (const sid of snakeIds) {
      this.teamCounts.set(sid, 0);
    }
    // Recount from existing viewers
    for (const viewer of this.viewers.values()) {
      if (this.teamCounts.has(viewer.teamSnakeId)) {
        this.teamCounts.set(
          viewer.teamSnakeId,
          (this.teamCounts.get(viewer.teamSnakeId) ?? 0) + 1
        );
      }
    }
  }
}
