import { MidiHub } from './midi/MidiHub.js';
import { MidiDeckProvider } from './midi/MidiDeckProvider.js';
import type { MidiMap } from './midi/maps.js';
import { DDJ400_MAP } from './midi/maps.js';

export type { MidiMap } from './midi/maps.js';
export { DDJ400_MAP, DDJ400_DECK2_MAP } from './midi/maps.js';

/**
 * Single-deck MIDI (lobby slot `midi-0`). Uses shared {@link MidiHub} with
 * `activityScope: device` so any incoming MIDI can opt-in to join when
 * mappings are unknown.
 */
export class MidiProvider extends MidiDeckProvider {
  constructor(map: MidiMap = DDJ400_MAP, idSuffix = '0') {
    const hub = MidiHub.shared();
    const laneId = hub.addLane(map);
    super(hub, laneId, `midi-${idSuffix}`, 'device');
  }
}
