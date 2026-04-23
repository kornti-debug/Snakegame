import type { RoundPhase, RoundState } from '@snakegame/shared';
import { TUNING } from './config/tuning.js';

export class RoundManager {
  phase: RoundPhase = 'waiting';
  /** Upcoming round number during 'waiting', current round during 'playing',
   *  just-finished round during 'ended'. Starts at 1 for the first round. */
  roundNumber = 1;
  timeRemainingMs = TUNING.round.waitTimeMs;
  private phaseJustChanged = false;

  update(dt: number): RoundPhase | null {
    const dtMs = dt * 1000;
    this.phaseJustChanged = false;

    if (this.phase === 'waiting') {
      this.timeRemainingMs -= dtMs;
      if (this.timeRemainingMs <= 0) {
        this.startRound();
        return 'playing';
      }
      return null;
    }

    if (this.phase === 'ended') {
      this.timeRemainingMs -= dtMs;
      if (this.timeRemainingMs <= 0) {
        this.phase = 'waiting';
        this.timeRemainingMs = TUNING.round.waitTimeMs;
        this.roundNumber++;
        this.phaseJustChanged = true;
        return 'waiting';
      }
      return null;
    }

    // playing — no wall clock; GameRoom ends via pairs / decisive lead
    return null;
  }

  startRound(): void {
    // roundNumber is already set when we entered 'waiting' — don't bump again.
    this.phase = 'playing';
    this.timeRemainingMs = 0;
    this.phaseJustChanged = true;
  }

  endRound(): void {
    this.phase = 'ended';
    this.timeRemainingMs = TUNING.round.endDisplayMs;
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
