import type { MidiMap } from './maps.js';
import { DDJ400_DECK2_MAP, DDJ400_MAP } from './maps.js';

/** JSON file shape for `/ddj-midi.json` (optional). */
export type DdjMidiJsonDeck = {
  name?: string;
  turn?: MidiMap['turn'];
  activate?: MidiMap['activate'];
  turbo?: MidiMap['turbo'];
  brake?: MidiMap['brake'];
};

export type DdjMidiJsonFile = {
  midiInputNameIncludes?: string;
  debugMidi?: boolean;
  decks?: DdjMidiJsonDeck[];
};

export type ResolvedDdjMidiConfig = {
  midiInputNameIncludes: string;
  debugMidi: boolean;
  deck1: MidiMap;
  deck2: MidiMap;
};

function mergeDeck(base: MidiMap, patch?: DdjMidiJsonDeck): MidiMap {
  if (!patch) return { ...base };
  return {
    turn: patch.turn ?? base.turn,
    activate: patch.activate ?? base.activate,
    turbo: patch.turbo ?? base.turbo,
    brake: patch.brake ?? base.brake,
  };
}

const DEFAULT_CONFIG: ResolvedDdjMidiConfig = {
  /** Empty = listen to all MIDI inputs (same as pre-hub behavior). */
  midiInputNameIncludes: '',
  debugMidi: false,
  deck1: { ...DDJ400_MAP },
  deck2: { ...DDJ400_DECK2_MAP },
};

/**
 * Loads optional Vite-served `/ddj-midi.json` and merges onto defaults.
 * Never throws; falls back to defaults on failure.
 */
export async function loadDdjMidiConfig(): Promise<ResolvedDdjMidiConfig> {
  try {
    const res = await fetch('/ddj-midi.json', { cache: 'no-store' });
    if (!res.ok) return { ...DEFAULT_CONFIG, deck1: { ...DEFAULT_CONFIG.deck1 }, deck2: { ...DEFAULT_CONFIG.deck2 } };
    const raw = (await res.json()) as DdjMidiJsonFile;
    const d0 = raw.decks?.[0];
    const d1 = raw.decks?.[1];
    return {
      midiInputNameIncludes: typeof raw.midiInputNameIncludes === 'string'
        ? raw.midiInputNameIncludes
        : DEFAULT_CONFIG.midiInputNameIncludes,
      debugMidi: !!raw.debugMidi,
      deck1: mergeDeck(DDJ400_MAP, d0),
      deck2: mergeDeck(DDJ400_DECK2_MAP, d1),
    };
  } catch {
    return { ...DEFAULT_CONFIG, deck1: { ...DEFAULT_CONFIG.deck1 }, deck2: { ...DEFAULT_CONFIG.deck2 } };
  }
}
