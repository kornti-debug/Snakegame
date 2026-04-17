/**
 * Trauma-based screen shake (after Squirrel Eiserloh).
 *
 * Callers `add(amount)` to accumulate trauma in [0, 1]. Each frame, sample
 * `update(now)` to get a pixel offset; trauma decays linearly so shakes are
 * short and self-limiting. Squaring trauma before sampling makes small bumps
 * subtle and large ones dramatic.
 */
export class ScreenShake {
  private trauma = 0;
  private lastAt = 0;
  private maxOffset: number;
  private maxAngle: number;
  private decayPerSecond: number;

  constructor(opts?: { maxOffset?: number; maxAngle?: number; decayPerSecond?: number }) {
    this.maxOffset = opts?.maxOffset ?? 36;
    this.maxAngle = opts?.maxAngle ?? 0.04;
    this.decayPerSecond = opts?.decayPerSecond ?? 1.6;
  }

  add(amount: number): void {
    this.trauma = Math.min(1, this.trauma + Math.max(0, amount));
  }

  reset(): void {
    this.trauma = 0;
  }

  /** Returns current shake offset/rotation; advances internal decay. */
  update(now: number): { x: number; y: number; rot: number } {
    if (this.lastAt === 0) this.lastAt = now;
    const dt = Math.max(0, (now - this.lastAt) / 1000);
    this.lastAt = now;
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - this.decayPerSecond * dt);
    }
    if (this.trauma <= 0) return { x: 0, y: 0, rot: 0 };
    const t = this.trauma * this.trauma;
    return {
      x: this.maxOffset * t * (Math.random() * 2 - 1),
      y: this.maxOffset * t * (Math.random() * 2 - 1),
      rot: this.maxAngle * t * (Math.random() * 2 - 1),
    };
  }
}
