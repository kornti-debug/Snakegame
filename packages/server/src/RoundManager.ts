import type { RoundPhase, RoundState } from '@snakegame/shared';
import { ROUND_DURATION_MEMORY, ROUND_WAIT_TIME, ROUND_END_DISPLAY_TIME } from '@snakegame/shared';

export class RoundManager {
  phase: RoundPhase = 'waiting';
  roundNumber = 0;
  timeRemainingMs = ROUND_WAIT_TIME;
  private phaseJustChanged = false;

  update(dt: number): RoundPhase | null {
    const dtMs = dt * 1000;
    this.phaseJustChanged = false;

    this.timeRemainingMs -= dtMs;

    if (this.timeRemainingMs <= 0) {
      switch (this.phase) {
        case 'waiting':
          this.startRound();
          return 'playing';
        case 'playing':
          this.endRound();
          return 'ended';
        case 'ended':
          this.phase = 'waiting';
          this.timeRemainingMs = ROUND_WAIT_TIME;
          this.phaseJustChanged = true;
          return 'waiting';
      }
    }

    return null; // no phase change
  }

  startRound(): void {
    this.roundNumber++;
    this.phase = 'playing';
    this.timeRemainingMs = ROUND_DURATION_MEMORY;
    this.phaseJustChanged = true;
  }

  endRound(): void {
    this.phase = 'ended';
    this.timeRemainingMs = ROUND_END_DISPLAY_TIME;
    this.phaseJustChanged = true;
  }

  /** Force end (all pairs matched, or other trigger) */
  forceEndRound(): void {
    if (this.phase === 'playing') {
      this.endRound();
    }
  }

  didPhaseJustChange(): boolean {
    return this.phaseJustChanged;
  }

  getRoundState(revealScores: Record<string, number>, pairScores: Record<string, number>): RoundState {
    return {
      phase: this.phase,
      roundNumber: this.roundNumber,
      timeRemainingMs: Math.max(0, this.timeRemainingMs),
      revealScores,
      pairScores,
    };
  }
}
