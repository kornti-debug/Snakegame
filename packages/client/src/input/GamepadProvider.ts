import type { InputState } from '@snakegame/shared';
import type { InputProvider } from './InputProvider.js';

export class GamepadProvider implements InputProvider {
  readonly id: string;
  readonly type = 'gamepad';
  private gamepadIndex: number;
  private deadzone = 0.2;

  constructor(gamepadIndex: number) {
    this.id = `gamepad-${gamepadIndex}`;
    this.gamepadIndex = gamepadIndex;
  }

  isConnected(): boolean {
    const gp = navigator.getGamepads()[this.gamepadIndex];
    return gp !== null && gp.connected;
  }

  poll(): InputState {
    const gp = navigator.getGamepads()[this.gamepadIndex];
    if (!gp) return { turnDirection: 0, boost: false, activate: false };

    // Left stick X axis
    const x = gp.axes[0] ?? 0;

    let turnDirection: -1 | 0 | 1 = 0;
    if (x < -this.deadzone) turnDirection = -1;
    else if (x > this.deadzone) turnDirection = 1;

    // A-face button (Xbox A / PlayStation X) = powerup activate.
    const activate = gp.buttons[0]?.pressed ?? false;

    return { turnDirection, boost: false, activate };
  }

  destroy(): void {
    // No cleanup needed for Gamepad API
  }
}
