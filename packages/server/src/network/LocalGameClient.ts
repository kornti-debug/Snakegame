import type {
  ClientToServerEvents, GameClient, GameClientEvents,
} from '@snakegame/shared';
import { GameRoom } from '../GameRoom.js';
import { GameLoop } from '../GameLoop.js';
import { applyTuning } from '../config/tuning.js';
import { registerGameClient } from './GameConnection.js';

// The maps erase only the event signatures; the public boundary stays typed.
type Handler = (...args: any[]) => void;

/** One independent game per page, with the same rules as the Node host. */
export class LocalGameClient implements GameClient {
  readonly id = 'local-host';
  connected = false;
  private listeners = new Map<keyof GameClientEvents, Set<Handler>>();
  private commands = new Map<keyof ClientToServerEvents, Handler>();
  private room: GameRoom;
  private loop: GameLoop;

  constructor(tuning?: unknown) {
    if (tuning) applyTuning(tuning);
    this.room = new GameRoom();
    registerGameClient(this.room, {
      id: this.id,
      on: (event, handler) => { this.commands.set(event, handler); },
      emit: (event, ...args) => { this.deliver(event, ...args); },
    });
    this.loop = new GameLoop((dt) => {
      // Background tabs can delay timers by seconds. Avoid jumping through walls.
      this.room.update(Math.min(dt, 0.1));
      this.publish();
    });
  }

  on<E extends keyof GameClientEvents>(event: E, listener: GameClientEvents[E]): this {
    let handlers = this.listeners.get(event);
    if (!handlers) this.listeners.set(event, handlers = new Set());
    handlers.add(listener);
    return this;
  }

  emit<E extends keyof ClientToServerEvents>(event: E, ...args: Parameters<ClientToServerEvents[E]>): this {
    if (this.connected) this.commands.get(event)?.(...args);
    return this;
  }

  connect(): this {
    if (this.connected) return this;
    this.connected = true;
    queueMicrotask(() => {
      if (!this.connected) return;
      this.deliver('connect');
      this.publish();
      this.loop.start();
    });
    return this;
  }

  disconnect(): this {
    if (!this.connected) return this;
    this.connected = false;
    this.loop.stop();
    this.deliver('disconnect', 'local game disconnected');
    return this;
  }

  private deliver<E extends keyof GameClientEvents>(event: E, ...args: Parameters<GameClientEvents[E]>): void {
    // Network messages are detached snapshots. Match that behavior so old
    // interpolation frames cannot change when the simulation mutates state.
    const payload = structuredClone(args);
    for (const handler of this.listeners.get(event) ?? []) handler(...payload);
  }

  private publish(): void {
    const pending = this.room.pendingEvents;
    this.room.pendingEvents = [];
    for (const event of pending) {
      switch (event.type) {
        case 'round-start':
          this.deliver('game:round-start', {
            roundNumber: event.roundNumber, imageUrl: '', tiles: event.tiles,
          });
          break;
        case 'round-end':
          this.deliver('game:round-end', event);
          break;
        case 'tile-captured':
          this.deliver('game:tile-captured', event);
          break;
        case 'pair-matched':
          this.deliver('game:pair-matched', event);
          break;
        case 'hint-active':
          this.deliver('game:hint-active', event);
          break;
      }
    }
    this.deliver('game:snapshot', this.room.getSnapshot());
    if (this.room.gamePhase === 'ingame') {
      const delta = this.room.revealSystem.flushDelta();
      if (delta) this.deliver('game:reveal-update', delta);
    }
  }
}
