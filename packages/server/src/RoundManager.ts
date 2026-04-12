import type { RoundPhase, RoundState } from '@snakegame/shared';
import { ROUND_DURATION_MEMORY, ROUND_WAIT_TIME, ROUND_END_DISPLAY_TIME } from '@snakegame/shared';

export class RoundManager {
  phase: RoundPhase = 'waiting';
  /** Upcoming round number during 'waiting', current round during 'playing',
   *  just-finished round during 'ended'. Starts at 1 for the first round. */
  roundNumber = 1;
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
          this.roundNumber++;
          this.phaseJustChanged = true;
          return 'waiting';
      }
    }

    return null; // no phase change
  }

  startRound(): void {
    // roundNumber is already set when we entered 'waiting' — don't bump again.
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
