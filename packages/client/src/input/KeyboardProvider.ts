import type { InputState } from '@snakegame/shared';
import type { InputProvider } from './InputProvider.js';

interface KeyBindings {
  left: string;
  right: string;
  activate: string;
}

const PRESETS: Record<string, KeyBindings> = {
  wasd:   { left: 'KeyA',      right: 'KeyD',          activate: 'KeyW' },
  arrows: { left: 'ArrowLeft', right: 'ArrowRight',    activate: 'ArrowUp' },
};

export class KeyboardProvider implements InputProvider {
  readonly id: string;
  readonly type = 'keyboard';
  private keys = new Set<string>();
  private bindings: KeyBindings;

  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;

  constructor(preset: 'wasd' | 'arrows') {
    this.id = `keyboard-${preset}`;
    this.bindings = PRESETS[preset];

    this.onKeyDown = (e) => {
      this.keys.add(e.code);
    };
    this.onKeyUp = (e) => {
      this.keys.delete(e.code);
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  isConnected(): boolean {
    return true;
  }

  poll(): InputState {
    const left = this.keys.has(this.bindings.left);
    const right = this.keys.has(this.bindings.right);
    const activate = this.keys.has(this.bindings.activate);

    let turnDirection: -1 | 0 | 1 = 0;
    if (left && !right) turnDirection = -1;
    else if (right && !left) turnDirection = 1;

    return { turnDirection, boost: false, activate };
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}
