import type { InputProvider } from './InputProvider.js';
import type { InputState } from '@snakegame/shared';

export class InputManager {
  private providers: InputProvider[] = [];

  addProvider(provider: InputProvider): void {
    this.providers.push(provider);
  }

  removeProvider(id: string): void {
    const idx = this.providers.findIndex(p => p.id === id);
    if (idx >= 0) {
      this.providers[idx].destroy();
      this.providers.splice(idx, 1);
    }
  }

  poll(index: number): InputState | null {
    const provider = this.providers[index];
    if (!provider || !provider.isConnected()) return null;
    return provider.poll();
  }

  getProviderCount(): number {
    return this.providers.length;
  }

  destroy(): void {
    for (const p of this.providers) p.destroy();
    this.providers = [];
  }
}
