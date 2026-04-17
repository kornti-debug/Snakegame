import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@snakegame/shared';

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Socket for the projector/host client. Uses the default origin so the
 *  Vite dev proxy (localhost:5173 → localhost:3000) works in development.
 *  The projector is always on the same machine as the server, so a tiny
 *  proxy hop is fine. */
export function createSocket(): TypedSocket {
  const socket: TypedSocket = io({
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
    randomizationFactor: 0.5,
    timeout: 10_000,
  });
  return socket;
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
