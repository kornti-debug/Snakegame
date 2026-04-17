export interface InputState {
  turnDirection: -1 | 0 | 1;
  /** 0..1 multiplier on turn rate (e.g. DJ platter spin speed). Omitted = full rate. */
  turnIntensity?: number;
  boost: boolean;
  /** Currently-pressed powerup-activate button. Slot polling edge-detects
   *  false→true and emits a one-shot input:activate event to the server. */
  activate: boolean;
  /** Held turbo button (DDJ hot-cue pad etc.). Server ramps `snake.speed` up
   *  while true, with a time limit + cooldown to prevent constant use. */
  turbo?: boolean;
  /** Held brake / "stop" button. Server zeros `snake.speed` for a short
   *  window on rising edge, with a cooldown between uses. */
  brake?: boolean;
}
