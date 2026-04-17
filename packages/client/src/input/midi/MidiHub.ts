import type { MidiMap } from './maps.js';

function ccListForTurn(m: NonNullable<MidiMap['turn']>): number[] {
  if (m.controllers?.length) return [...m.controllers];
  if (m.controller !== undefined) return [m.controller];
  return [];
}

const MSG_NOTE_OFF = 0x80;
const MSG_NOTE_ON = 0x90;
const MSG_CC = 0xB0;

export type LaneActivityScope = 'mapped' | 'device';

/** Sliding window for jog pulse rate (L/R alternation still counts as “fast”). */
const JOG_INTENSITY_WINDOW_MS = 50;
/** No jog CC for this long → straighten (scratch stop). */
const JOG_SILENCE_RELEASE_MS = 100;
/** After last pulse, brief coast before intensity decays between slow pulses. */
const JOG_COAST_BEFORE_DECAY_MS = 26;

function intensityFromWindowPulseCount(n: number): number {
  if (n <= 0) return 0.22;
  // n=1 gentle nudge; ~7+ pulses in 50ms (incl. fast L/R) → full scratch
  return Math.min(1, 0.17 + (n - 1) * 0.14);
}

type LaneState = {
  map: MidiMap;
  turn: -1 | 0 | 1;
  activate: boolean;
  /** Held-button turbo pad state. */
  turbo: boolean;
  /** Held-button brake pad state. */
  brake: boolean;
  lastJogAt: number;
  /** Timestamps of jog CCs in the recent window (for pulse-rate intensity). */
  jogPulseTimes: number[];
  /** 0..1 from pulse count in JOG_INTENSITY_WINDOW_MS (direction-agnostic). */
  turnIntensity: number;
  /** Last time a message matched this lane's map (CC/note). */
  lastMappedActivityAt: number;
};

/**
 * Single Web MIDI attachment shared by all deck lanes. Multiple MidiDeckProvider
 * instances register lanes here so one DDJ-400 does not overwrite onmidimessage.
 */
export class MidiHub {
  private static inst: MidiHub | null = null;

  static shared(): MidiHub {
    if (!MidiHub.inst) MidiHub.inst = new MidiHub();
    return MidiHub.inst;
  }

  private access: MIDIAccess | null = null;
  private ready = false;
  private nextLaneId = 0;
  private readonly lanes = new Map<number, LaneState>();
  private inputNameIncludes = '';
  lastAnyDeviceActivityAt = 0;
  private debug = false;

  private onInputMessage = (e: Event): void => {
    const ev = e as MIDIMessageEvent;
    const port = ev.target as MIDIInput | null;
    const name = port?.name ?? '';
    const data = ev.data;
    if (!data || data.length < 2) return;
    if (this.inputNameIncludes && !name.includes(this.inputNameIncludes)) return;

    const now = performance.now();
    this.lastAnyDeviceActivityAt = now;
    this.dispatch(data, now);
  };

  private onStateChange = (e: Event): void => {
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

  setDebugMidi(on: boolean): void {
    this.debug = on;
  }

  setInputNameIncludes(fragment: string): void {
    this.inputNameIncludes = fragment.trim();
  }

  addLane(map: MidiMap): number {
    const id = this.nextLaneId++;
    this.lanes.set(id, {
      map,
      turn: 0,
      activate: false,
      turbo: false,
      brake: false,
      lastJogAt: 0,
      jogPulseTimes: [],
      turnIntensity: 1,
      lastMappedActivityAt: 0,
    });
    void this.ensureInit();
    return id;
  }

  setLaneMap(laneId: number, map: MidiMap): void {
    const lane = this.lanes.get(laneId);
    if (lane) lane.map = map;
  }

  removeLane(laneId: number): void {
    this.lanes.delete(laneId);
    if (this.lanes.size === 0) this.teardown();
  }

  isHardwarePresent(): boolean {
    return this.ready && !!this.access && this.access.inputs.size > 0;
  }

  getLaneState(laneId: number): LaneState | undefined {
    return this.lanes.get(laneId);
  }

  getLaneMap(laneId: number): MidiMap | undefined {
    return this.lanes.get(laneId)?.map;
  }

  /**
   * Call each frame for jog lanes: prune pulse window, recompute intensity from
   * pulse rate (50ms), decay between slow pulses, release turn after silence.
   */
  refreshJogStateForLane(laneId: number, now: number): void {
    const lane = this.lanes.get(laneId);
    if (!lane || lane.map.turn?.type !== 'cc-jog') return;

    lane.jogPulseTimes = lane.jogPulseTimes.filter(t => now - t <= JOG_INTENSITY_WINDOW_MS);
    const n = lane.jogPulseTimes.length;

    if (n > 0) {
      lane.turnIntensity = intensityFromWindowPulseCount(n);
      return;
    }

    if (lane.lastJogAt > 0 && now - lane.lastJogAt > JOG_SILENCE_RELEASE_MS) {
      lane.turn = 0;
      lane.turnIntensity = 1;
      lane.lastJogAt = 0;
      lane.jogPulseTimes = [];
      return;
    }

    if (lane.turn !== 0 && lane.lastJogAt > 0 && now - lane.lastJogAt > JOG_COAST_BEFORE_DECAY_MS) {
      lane.turnIntensity = Math.max(0.14, lane.turnIntensity * 0.86);
    }
  }

  private async ensureInit(): Promise<void> {
    if (this.access) return;
    if (typeof navigator === 'undefined' || !('requestMIDIAccess' in navigator)) {
      console.warn('[midi] Web MIDI API not available — MIDI disabled.');
      return;
    }
    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      if (this.lanes.size === 0) return;
      this.access = access;
    } catch (err) {
      console.warn('[midi] requestMIDIAccess rejected — MIDI disabled.', err);
      return;
    }
    this.attachAllInputs();
    this.access.onstatechange = this.onStateChange;
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

  private dispatch(data: Uint8Array, now: number): void {
    const status = data[0];
    const kind = status & 0xf0;
    const channel = status & 0x0f;

    if (kind === MSG_CC) {
      const controller = data[1];
      const value = data[2] ?? 0;
      if (this.debug) console.log(`[midi] CC  ch=${channel} ctrl=${controller} val=${value}`);
      for (const lane of this.lanes.values()) {
        const m = lane.map.turn;
        if (!m) continue;
        if (m.channel !== undefined && m.channel !== channel) continue;
        const ccList = ccListForTurn(m);
        if (!ccList.includes(controller)) continue;
        lane.lastMappedActivityAt = now;
        if (m.type === 'cc-fader') {
          if (value < 54) lane.turn = -1;
          else if (value > 73) lane.turn = 1;
          else lane.turn = 0;
          lane.turnIntensity = 1;
        } else {
          if (value > 64) lane.turn = 1;
          else if (value < 64) lane.turn = -1;
          lane.lastJogAt = now;
          lane.jogPulseTimes.push(now);
          if (lane.jogPulseTimes.length > 48) lane.jogPulseTimes.splice(0, lane.jogPulseTimes.length - 48);
          lane.jogPulseTimes = lane.jogPulseTimes.filter(t => now - t <= JOG_INTENSITY_WINDOW_MS);
          lane.turnIntensity = intensityFromWindowPulseCount(lane.jogPulseTimes.length);
        }
      }
    } else if (kind === MSG_NOTE_ON || kind === MSG_NOTE_OFF) {
      const note = data[1];
      const velocity = data[2] ?? 0;
      const isOn = kind === MSG_NOTE_ON && velocity > 0;
      if (this.debug) {
        console.log(`[midi] ${isOn ? 'NoteOn ' : 'NoteOff'} ch=${channel} note=${note}${isOn ? ` vel=${velocity}` : ''}`);
      }
      for (const lane of this.lanes.values()) {
        // Multiple bindings can fire on the same note (e.g. DDJ PLAY/PAUSE
        // is both `activate` and `brake`). Iterate every binding instead
        // of continuing on first hit.
        const a = lane.map.activate;
        if (a && a.note === note && (a.channel === undefined || a.channel === channel)) {
          lane.lastMappedActivityAt = now;
          lane.activate = isOn;
        }
        const t = lane.map.turbo;
        if (t && t.note === note && (t.channel === undefined || t.channel === channel)) {
          lane.lastMappedActivityAt = now;
          lane.turbo = isOn;
        }
        const b = lane.map.brake;
        if (b && b.note === note && (b.channel === undefined || b.channel === channel)) {
          lane.lastMappedActivityAt = now;
          lane.brake = isOn;
        }
      }
    }
  }

  private teardown(): void {
    if (this.access) {
      for (const input of this.access.inputs.values()) input.onmidimessage = null;
      this.access.onstatechange = null;
    }
    this.access = null;
    this.ready = false;
  }
}
