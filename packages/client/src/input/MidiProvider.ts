import type { InputState } from '@snakegame/shared';
import type { InputProvider } from './InputProvider.js';

// MIDI message helpers — see https://www.midi.org/specifications-old/item/table-1-summary-of-midi-message
// Status byte layout: top nibble = message type, bottom nibble = channel (0-15).
const MSG_NOTE_OFF = 0x80;
const MSG_NOTE_ON  = 0x90;
const MSG_CC       = 0xB0;

/** Per-control binding.
 *
 *  `turn` accepts two flavours of CC control:
 *   - `cc-fader`: absolute 0-127 position (e.g. crossfader). Deadband
 *     around 64 means "straight"; below/above flips to left/right.
 *   - `cc-jog`: rotary encoder sending pulses while spinning.
 *     Values above 64 are clockwise (right), below 64 counter-clockwise
 *     (left). The turn state decays back to 0 after JOG_DECAY_MS of
 *     silence because a stopped jog wheel stops sending messages.
 *
 *  `activate` is a note that triggers the powerup-activate pulse while
 *  the note is held (edge-detection to input:activate is done in the
 *  slot polling loop in main.ts).
 *
 *  `channel` is optional on both — undefined matches any channel. */
export type MidiMap = {
  turn?:
    | { type: 'cc-fader'; controller: number; channel?: number }
    | { type: 'cc-jog';   controller: number; channel?: number };
  activate?: { type: 'note'; note: number; channel?: number };
};

/** DDJ-400 defaults. Pull the real values from `?midi-debug=1` console
 *  output if they're off. */
export const DDJ400_MAP: MidiMap = {
  turn:     { type: 'cc-jog', controller: 34, channel: 1 }, // deck 1 jog platter
  activate: { type: 'note',   note: 11,       channel: 1 }, // deck 1 play/pause
};

export class MidiProvider implements InputProvider {
  readonly id: string;
  readonly type = 'midi';

  private access: MIDIAccess | null = null;
  private ready = false;
  private turn: -1 | 0 | 1 = 0;
  private activate = false;
  private debug: boolean;
  // Wall-clock of the last incoming MIDI message (any). Lets the slot
  // registration loop see "the user touched the device" even when the
  // mapped CC/note doesn't match their actual hardware yet.
  private lastMessageAt = 0;
  // Wall-clock of the last jog-wheel impulse. Used to decay `turn` back
  // to 0 once the user stops spinning.
  private lastJogAt = 0;
  private static readonly ACTIVITY_WINDOW_MS = 500;
  private static readonly JOG_DECAY_MS = 120;

  private onInputMessage = (e: Event): void => {
    const data = (e as MIDIMessageEvent).data;
    if (data) this.handleMessage(data);
  };

  constructor(private map: MidiMap = DDJ400_MAP, idSuffix = '0') {
    this.id = `midi-${idSuffix}`;
    this.debug = typeof window !== 'undefined'
      && window.location.search.includes('midi-debug');
    this.init();
  }

  private async init(): Promise<void> {
    if (typeof navigator === 'undefined' || !('requestMIDIAccess' in navigator)) {
      console.warn('[midi] Web MIDI API not available in this browser (Safari/Firefox<108?) — MIDI disabled.');
      return;
    }
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
    } catch (err) {
      console.warn('[midi] requestMIDIAccess rejected — MIDI disabled.', err);
      return;
    }
    this.attachAllInputs();
    // Handle devices being plugged in / unplugged during the session.
    this.access.onstatechange = (e) => {
      const port = (e as MIDIConnectionEvent).port;
      if (!port || port.type !== 'input') return;
      if (port.state === 'connected') {
        (port as MIDIInput).onmidimessage = this.onInputMessage;
        console.log(`[midi] Connected: ${port.name}`);
      } else {
        (port as MIDIInput).onmidimessage = null;
        console.log(`[midi] Disconnected: ${port.name}`);
      }
    };
    this.ready = true;
    const names = [...this.access.inputs.values()].map(i => i.name).filter(Boolean);
    console.log(`[midi] Ready — ${names.length} input(s): ${names.join(', ') || '(none)'}`);
  }

  private attachAllInputs(): void {
    if (!this.access) return;
    for (const input of this.access.inputs.values()) {
      input.onmidimessage = this.onInputMessage;
    }
  }

  private handleMessage(data: Uint8Array): void {
    if (data.length < 2) return;
    this.lastMessageAt = performance.now();
    const status  = data[0];
    const kind    = status & 0xF0;
    const channel = status & 0x0F;

    if (kind === MSG_CC) {
      const controller = data[1];
      const value      = data[2] ?? 0;
      if (this.debug) console.log(`[midi] CC  ch=${channel} ctrl=${controller} val=${value}`);
      if (this.map.turn
        && this.map.turn.controller === controller
        && (this.map.turn.channel === undefined || this.map.turn.channel === channel)
      ) {
        if (this.map.turn.type === 'cc-fader') {
          if (value < 54)      this.turn = -1;
          else if (value > 73) this.turn = 1;
          else                 this.turn = 0;
        } else {
          // cc-jog: each pulse just tells us a direction; decay back to
          // 0 when no further pulses arrive (see poll() and lastJogAt).
          if (value > 64)      this.turn = 1;
          else if (value < 64) this.turn = -1;
          this.lastJogAt = this.lastMessageAt;
        }
      }
    } else if (kind === MSG_NOTE_ON || kind === MSG_NOTE_OFF) {
      const note     = data[1];
      const velocity = data[2] ?? 0;
      const isOn     = kind === MSG_NOTE_ON && velocity > 0;
      if (this.debug) {
        console.log(`[midi] ${isOn ? 'NoteOn ' : 'NoteOff'} ch=${channel} note=${note}${isOn ? ` vel=${velocity}` : ''}`);
      }
      if (this.map.activate
        && this.map.activate.note === note
        && (this.map.activate.channel === undefined || this.map.activate.channel === channel)
      ) {
        this.activate = isOn;
      }
    }
  }

  isConnected(): boolean {
    return this.ready && !!this.access && this.access.inputs.size > 0;
  }

  poll(): InputState {
    // Decay jog-wheel turn once the wheel stops spinning.
    if (this.map.turn?.type === 'cc-jog'
      && this.turn !== 0
      && performance.now() - this.lastJogAt > MidiProvider.JOG_DECAY_MS
    ) {
      this.turn = 0;
    }
    return { turnDirection: this.turn, boost: false, activate: this.activate };
  }

  hasRecentActivity(): boolean {
    return performance.now() - this.lastMessageAt < MidiProvider.ACTIVITY_WINDOW_MS;
  }

  destroy(): void {
    if (this.access) {
      for (const input of this.access.inputs.values()) input.onmidimessage = null;
      this.access.onstatechange = null;
    }
    this.access = null;
    this.ready = false;
  }
}
