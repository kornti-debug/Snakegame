import type { InputState } from '@snakegame/shared';
import type { InputProvider } from '../InputProvider.js';
import type { LaneActivityScope, MidiHub } from './MidiHub.js';

const ACTIVITY_WINDOW_MS = 500;

export class MidiDeckProvider implements InputProvider {
  readonly type = 'midi';

  constructor(
    private hub: MidiHub,
    readonly laneId: number,
    readonly id: string,
    private activityScope: LaneActivityScope = 'mapped',
  ) {}

  isConnected(): boolean {
    return this.hub.isHardwarePresent();
  }

  poll(): InputState {
    const now = performance.now();
    this.hub.refreshJogStateForLane(this.laneId, now);
    const lane = this.hub.getLaneState(this.laneId);
    const map = this.hub.getLaneMap(this.laneId);
    if (!lane || !map) {
      return { turnDirection: 0, boost: false, activate: false };
    }
    const turn = lane.turn;
    const ti = map.turn?.type === 'cc-jog' && turn !== 0 ? lane.turnIntensity : undefined;
    return {
      turnDirection: turn,
      turnIntensity: ti,
      boost: false,
      activate: lane.activate,
      turbo: lane.turbo,
      brake: lane.brake,
    };
  }

  hasRecentActivity(): boolean {
    const now = performance.now();
    if (this.activityScope === 'device') {
      return now - this.hub.lastAnyDeviceActivityAt < ACTIVITY_WINDOW_MS;
    }
    const lane = this.hub.getLaneState(this.laneId);
    if (!lane) return false;
    return now - lane.lastMappedActivityAt < ACTIVITY_WINDOW_MS;
  }

  destroy(): void {
    this.hub.removeLane(this.laneId);
  }
}
