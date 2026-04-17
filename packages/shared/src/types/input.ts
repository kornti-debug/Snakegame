export interface InputState {
  turnDirection: -1 | 0 | 1;
  boost: boolean;
  /** Currently-pressed powerup-activate button. Slot polling edge-detects
   *  false→true and emits a one-shot input:activate event to the server. */
  activate: boolean;
}
