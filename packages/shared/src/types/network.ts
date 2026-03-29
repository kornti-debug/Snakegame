import type { GameSnapshot, RevealDelta } from './game.js';

export interface ServerToClientEvents {
  'game:snapshot': (snapshot: GameSnapshot) => void;
  'game:reveal-update': (delta: RevealDelta) => void;
  'game:player-died': (payload: { playerId: string; killerId: string | null }) => void;
  'game:round-start': (payload: { roundNumber: number; imageUrl: string }) => void;
  'game:round-end': (payload: {
    roundNumber: number;
    winner: { id: string; name: string; score: number } | null;
    scores: Record<string, number>;
  }) => void;
}

export interface ClientToServerEvents {
  'input:turn': (playerIndex: number, direction: -1 | 0 | 1) => void;
  'input:boost': (playerIndex: number, active: boolean) => void;
  'player:join': (payload: { name: string; playerIndex: number }) => void;
  'player:ready': () => void;
}

export interface InterServerEvents {}

export interface SocketData {
  playerIds: string[];
}
