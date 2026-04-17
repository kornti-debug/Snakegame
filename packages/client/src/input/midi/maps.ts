/** Per-control binding (shared by MidiHub / providers). */
export type MidiMap = {
  turn?:
    | { type: 'cc-fader'; controller?: number; controllers?: number[]; channel?: number }
    | { type: 'cc-jog'; controller?: number; controllers?: number[]; channel?: number };
  activate?: { type: 'note'; note: number; channel?: number };
  /** Held-button "turbo" pad. Server applies a speed multiplier while
   *  down, with a time limit + cooldown to prevent infinite use. */
  turbo?: { type: 'note'; note: number; channel?: number };
  /** Held-button "brake / stop" pad. Server zeros speed for a short
   *  window, with a cooldown between uses. */
  brake?: { type: 'note'; note: number; channel?: number };
};

/**
 * DDJ-400 deck 1 (left). Pioneer / Mixxx "Channel1" = MIDI status 0xB* with
 * channel nibble **0** (often mis-labeled "channel 1" in docs).
 * Jog: platter vinyl on/off + outer ring use CC 0x22/0x23/0x21 (34/35/33).
 * Note 11 = PLAY/PAUSE (used as both activate and brake — pressing it fires
 * the queued powerup and applies the brake; in duel mode the brake is the
 * intended gameplay action). Note 12 = CUE, used as turbo.
 */
export const DDJ400_MAP: MidiMap = {
  turn: { type: 'cc-jog', controllers: [33, 34, 35], channel: 0 },
  activate: { type: 'note', note: 11, channel: 0 },
  turbo: { type: 'note', note: 12, channel: 0 },
  brake: { type: 'note', note: 11, channel: 0 },
};

/**
 * DDJ-400 deck 2 (right). Pioneer "Channel2" = MIDI channel nibble **1**
 * (status 0xB1…).
 */
export const DDJ400_DECK2_MAP: MidiMap = {
  turn: { type: 'cc-jog', controllers: [33, 34, 35], channel: 1 },
  activate: { type: 'note', note: 11, channel: 1 },
  turbo: { type: 'note', note: 12, channel: 1 },
  brake: { type: 'note', note: 11, channel: 1 },
};
