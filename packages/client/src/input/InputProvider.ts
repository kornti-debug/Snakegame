import type { InputState } from '@snakegame/shared';

export interface InputProvider {
  readonly id: string;
  readonly type: string;
  isConnected(): boolean;
  poll(): InputState;
  destroy(): void;
}
