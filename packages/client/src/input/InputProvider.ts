import type { InputState } from '@snakegame/shared';

export interface InputProvider {
  readonly id: string;
  readonly type: string;
  isConnected(): boolean;
  poll(): InputState;
  destroy(): void;
  /** Optional: return true if the device saw ANY input recently, even
   *  from controls that aren't wired to turn/boost. Used by the slot
   *  registration loop so unfamiliar devices (MIDI with an unknown
   *  mapping) can still be "touched to join". */
  hasRecentActivity?(): boolean;
}
