/**
 * BgmPlayer — looping background music with crossfade between tracks.
 *
 * Two persistent <audio> elements ride a fade target so swapping tracks
 * doesn't cut off mid-note. Like SfxEngine, all play/load is gated on a
 * user gesture (browsers block autoplay) — call `unlock()` from the same
 * gesture handler that unlocks the SFX engine.
 */

type Track = {
  src: string;
  el: HTMLAudioElement;
  /** Last gain we set on this track. Used during cross-fades. */
  gain: number;
};

const FADE_MS = 800;

export class BgmPlayer {
  private a: Track;
  private b: Track;
  /** Whichever of a/b is the "current" foreground track. */
  private active: Track;
  private idle: Track;
  private currentSrc: string | null = null;
  private fadeRaf: number | null = null;
  private fadeStart = 0;
  private fadeFromActive = 0;
  private fadeFromIdle = 0;
  private fadeToActive = 0;
  private fadeToIdle = 0;
  private unlocked = false;
  private muted = false;
  private volume = 0.5;

  constructor() {
    this.a = this.makeTrack();
    this.b = this.makeTrack();
    this.active = this.a;
    this.idle = this.b;
  }

  private makeTrack(): Track {
    const el = document.createElement('audio');
    el.loop = true;
    el.preload = 'auto';
    el.volume = 0;
    return { src: '', el, gain: 0 };
  }

  /** Must run from a user gesture so the browser permits playback. */
  unlock(): void {
    this.unlocked = true;
    // Start whichever track was queued before the gesture.
    if (this.currentSrc) this.play(this.currentSrc);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolume();
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyVolume();
  }

  private applyVolume(): void {
    const m = this.muted ? 0 : this.volume;
    this.active.el.volume = this.active.gain * m;
    this.idle.el.volume = this.idle.gain * m;
  }

  /**
   * Switch to `src`. If already playing it, no-op. If different, crossfade.
   * Calling before `unlock()` just records the desired track; playback
   * starts on the next `unlock()` call.
   */
  play(src: string): void {
    if (this.currentSrc === src && this.unlocked) return;
    this.currentSrc = src;
    if (!this.unlocked) return;

    // First-ever play: set up the active track and fade in from silence.
    if (this.active.src === '') {
      this.active.src = src;
      this.active.el.src = src;
      this.active.el.play().catch(() => {});
      this.startFade({ activeTo: 1, idleTo: 0 });
      return;
    }

    if (this.active.src === src) {
      // Same track, just rising volume (e.g. after stop()).
      this.startFade({ activeTo: 1, idleTo: 0 });
      return;
    }

    // Crossfade: idle becomes the new active, active fades out.
    [this.active, this.idle] = [this.idle, this.active];
    this.active.src = src;
    this.active.el.src = src;
    this.active.el.currentTime = 0;
    this.active.el.play().catch(() => {});
    this.startFade({ activeTo: 1, idleTo: 0 });
  }

  /** Fade everything to silence (without unloading). */
  stop(): void {
    this.currentSrc = null;
    this.startFade({ activeTo: 0, idleTo: 0 });
  }

  private startFade(target: { activeTo: number; idleTo: number }): void {
    this.fadeFromActive = this.active.gain;
    this.fadeFromIdle = this.idle.gain;
    this.fadeToActive = target.activeTo;
    this.fadeToIdle = target.idleTo;
    this.fadeStart = performance.now();
    if (this.fadeRaf === null) this.tickFade();
  }

  private tickFade = (): void => {
    const t = Math.min(1, (performance.now() - this.fadeStart) / FADE_MS);
    const ease = t * t * (3 - 2 * t); // smoothstep
    this.active.gain = this.fadeFromActive + (this.fadeToActive - this.fadeFromActive) * ease;
    this.idle.gain = this.fadeFromIdle + (this.fadeToIdle - this.fadeFromIdle) * ease;
    this.applyVolume();

    if (t >= 1) {
      this.fadeRaf = null;
      // If a track has faded fully out, pause it to release the decoder.
      if (this.idle.gain <= 0.001 && !this.idle.el.paused) this.idle.el.pause();
      if (this.active.gain <= 0.001 && !this.active.el.paused) this.active.el.pause();
      return;
    }
    this.fadeRaf = requestAnimationFrame(this.tickFade);
  };
}

export const bgm = new BgmPlayer();
