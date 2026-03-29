import { TICK_INTERVAL } from '@snakegame/shared';

export class GameLoop {
  private running = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastTime = 0;

  constructor(private onTick: (dt: number) => void) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();

    this.intervalId = setInterval(() => {
      const now = performance.now();
      const dt = (now - this.lastTime) / 1000; // seconds
      this.lastTime = now;
      this.onTick(dt);
    }, TICK_INTERVAL);
  }

  stop(): void {
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
