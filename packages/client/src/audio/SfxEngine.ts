/**
 * SfxEngine — procedural Web Audio sound effects. No assets, no deps.
 *
 * Lazy AudioContext: created on first `unlock()` (must be called from a user
 * gesture per the autoplay policy). All `play*` calls are no-ops until then.
 * Per-event throttling prevents bursts (e.g. multiple captures in one tick)
 * from clipping into a wall of noise.
 */

type EventName =
  | 'pickup'
  | 'activate'
  | 'match'
  | 'bonusMatch'
  | 'neutralized'
  | 'death'
  | 'tileCapture'
  | 'freeze'
  | 'lightning'
  | 'cripple'
  | 'roundStart'
  | 'roundEnd'
  | 'menuClick';

const THROTTLE_MS: Record<EventName, number> = {
  pickup: 40,
  activate: 60,
  match: 80,
  bonusMatch: 200,
  neutralized: 80,
  death: 90,
  tileCapture: 25,
  freeze: 200,
  lightning: 200,
  cripple: 200,
  roundStart: 500,
  roundEnd: 500,
  menuClick: 50,
};

export class SfxEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private lastAt: Partial<Record<EventName, number>> = {};
  private muted = false;

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  private allow(name: EventName): boolean {
    if (this.muted || !this.ctx || !this.master) return false;
    const now = this.ctx.currentTime * 1000;
    const last = this.lastAt[name] ?? -Infinity;
    if (now - last < THROTTLE_MS[name]) return false;
    this.lastAt[name] = now;
    return true;
  }

  // --- primitives ---------------------------------------------------------

  private tone(opts: {
    type: OscillatorType;
    freqStart: number;
    freqEnd?: number;
    duration: number;
    gain: number;
    attack?: number;
    delay?: number;
  }): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const t1 = t0 + opts.duration;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.freqStart, t0);
    if (opts.freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), t1);
    }
    const attack = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opts.gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  }

  private noise(opts: {
    duration: number;
    gain: number;
    filter?: { type: BiquadFilterType; freq: number; q?: number };
    delay?: number;
  }): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const t1 = t0 + opts.duration;
    const sampleRate = ctx.sampleRate;
    const len = Math.max(1, Math.floor(opts.duration * sampleRate));
    const buf = ctx.createBuffer(1, len, sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t1);
    let node: AudioNode = src;
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = opts.filter.type;
      f.frequency.value = opts.filter.freq;
      if (opts.filter.q !== undefined) f.Q.value = opts.filter.q;
      src.connect(f);
      node = f;
    }
    node.connect(g).connect(this.master);
    src.start(t0);
    src.stop(t1 + 0.02);
  }

  // --- named events -------------------------------------------------------

  pickup(): void {
    if (!this.allow('pickup')) return;
    this.tone({ type: 'triangle', freqStart: 660, freqEnd: 1320, duration: 0.09, gain: 0.18 });
    this.tone({ type: 'sine', freqStart: 990, freqEnd: 1760, duration: 0.07, gain: 0.10, delay: 0.02 });
  }

  activate(): void {
    if (!this.allow('activate')) return;
    this.tone({ type: 'sawtooth', freqStart: 220, freqEnd: 880, duration: 0.18, gain: 0.16 });
    this.tone({ type: 'square', freqStart: 440, freqEnd: 1320, duration: 0.16, gain: 0.08, delay: 0.02 });
  }

  /** Same-snake pair match — bright major chord stab. */
  match(): void {
    if (!this.allow('match')) return;
    const root = 523.25; // C5
    this.tone({ type: 'triangle', freqStart: root, duration: 0.32, gain: 0.16 });
    this.tone({ type: 'triangle', freqStart: root * 1.25, duration: 0.32, gain: 0.13, delay: 0.01 });
    this.tone({ type: 'triangle', freqStart: root * 1.5, duration: 0.34, gain: 0.13, delay: 0.02 });
    this.tone({ type: 'sine', freqStart: root * 2, duration: 0.20, gain: 0.10, delay: 0.04 });
  }

  /** Bonus pair match — fanfare. */
  bonusMatch(): void {
    if (!this.allow('bonusMatch')) return;
    const root = 523.25;
    const seq = [1, 1.25, 1.5, 2];
    seq.forEach((mult, i) => {
      this.tone({
        type: 'square',
        freqStart: root * mult,
        duration: 0.18,
        gain: 0.12,
        delay: i * 0.06,
      });
      this.tone({
        type: 'triangle',
        freqStart: root * mult * 2,
        duration: 0.18,
        gain: 0.08,
        delay: i * 0.06 + 0.005,
      });
    });
    this.tone({ type: 'sawtooth', freqStart: root * 0.5, freqEnd: root, duration: 0.5, gain: 0.10 });
    this.noise({ duration: 0.3, gain: 0.06, filter: { type: 'highpass', freq: 4000 } });
  }

  /** Pair both captured but split between snakes — sad dud. */
  neutralized(): void {
    if (!this.allow('neutralized')) return;
    this.tone({ type: 'sawtooth', freqStart: 330, freqEnd: 165, duration: 0.35, gain: 0.14 });
    this.tone({ type: 'sine', freqStart: 220, freqEnd: 110, duration: 0.45, gain: 0.10, delay: 0.05 });
  }

  death(): void {
    if (!this.allow('death')) return;
    this.tone({ type: 'sawtooth', freqStart: 440, freqEnd: 55, duration: 0.45, gain: 0.20 });
    this.tone({ type: 'square', freqStart: 220, freqEnd: 40, duration: 0.5, gain: 0.10, delay: 0.02 });
    this.noise({ duration: 0.25, gain: 0.10, filter: { type: 'lowpass', freq: 1800 } });
  }

  /** Single tile captured — short tick. */
  tileCapture(): void {
    if (!this.allow('tileCapture')) return;
    this.tone({ type: 'sine', freqStart: 1200, freqEnd: 1800, duration: 0.04, gain: 0.10 });
  }

  freeze(): void {
    if (!this.allow('freeze')) return;
    this.tone({ type: 'sine', freqStart: 1760, freqEnd: 220, duration: 0.6, gain: 0.16 });
    this.tone({ type: 'triangle', freqStart: 880, freqEnd: 110, duration: 0.6, gain: 0.10, delay: 0.02 });
    this.noise({ duration: 0.4, gain: 0.05, filter: { type: 'highpass', freq: 6000 } });
  }

  lightning(): void {
    if (!this.allow('lightning')) return;
    this.noise({ duration: 0.12, gain: 0.30, filter: { type: 'highpass', freq: 1500 } });
    this.tone({ type: 'sawtooth', freqStart: 1320, freqEnd: 80, duration: 0.18, gain: 0.18, delay: 0.01 });
    this.noise({ duration: 0.4, gain: 0.10, filter: { type: 'bandpass', freq: 800, q: 0.5 }, delay: 0.05 });
  }

  cripple(): void {
    if (!this.allow('cripple')) return;
    this.tone({ type: 'sawtooth', freqStart: 220, freqEnd: 70, duration: 0.5, gain: 0.18 });
    this.tone({ type: 'square', freqStart: 110, freqEnd: 55, duration: 0.55, gain: 0.10, delay: 0.03 });
  }

  roundStart(): void {
    if (!this.allow('roundStart')) return;
    this.tone({ type: 'square', freqStart: 220, freqEnd: 880, duration: 0.4, gain: 0.16 });
    this.tone({ type: 'triangle', freqStart: 440, freqEnd: 1760, duration: 0.4, gain: 0.10, delay: 0.04 });
  }

  roundEnd(): void {
    if (!this.allow('roundEnd')) return;
    const root = 523.25;
    [1, 1.25, 1.5].forEach((mult, i) => {
      this.tone({
        type: 'triangle',
        freqStart: root * mult,
        duration: 0.6 - i * 0.08,
        gain: 0.14,
        delay: i * 0.08,
      });
    });
    this.tone({ type: 'sine', freqStart: root * 2, duration: 0.5, gain: 0.10, delay: 0.16 });
  }

  menuClick(): void {
    if (!this.allow('menuClick')) return;
    this.tone({ type: 'square', freqStart: 880, duration: 0.04, gain: 0.10 });
  }
}

/** Module singleton — one AudioContext per page. */
export const sfx = new SfxEngine();
