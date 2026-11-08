import { io, Socket } from 'socket.io-client';
import { LocalGameClient } from '@snakegame/server/browser';
import { LOCAL_GAME } from '../environment.js';
import type { ServerToClientEvents, ClientToServerEvents, GameClient } from '@snakegame/shared';

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Pages uses a local simulation. The network build connects same-origin,
 *  through Vite's proxy in development or to the Node host in production. */
export function createSocket(): GameClient {
  if (LOCAL_GAME) return new LocalGameClient(__GAME_TUNING__);
  const socket: TypedSocket = io({
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
    randomizationFactor: 0.5,
    timeout: 10_000,
  });
  // Socket.IO models reserved events with conditional types; the exposed
  // methods and event payloads are the same as our transport interface.
  return socket as unknown as GameClient;
}

/** Socket for the phone controller. Connects same-origin (the same port
 *  that served phone.html) so in dev it rides the Vite proxy — no extra
 *  firewall holes or hotspot NAT surprises to worry about on exhibition
 *  wifi. The `ECONNRESET` noise that shows up in Vite's log is a symptom
 *  of wifi blips, not the cause; resilience against those blips comes
 *  from the explicit reconnection config here + the server's disconnect
 *  grace window, not from choosing a different transport path. */
export function createPhoneSocket(): TypedSocket {
  const socket: TypedSocket = io({
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
    randomizationFactor: 0.5,
    timeout: 10_000,
    transports: ['websocket', 'polling'],
  });
  return socket;
}
