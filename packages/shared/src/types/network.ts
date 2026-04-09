import type { GameSnapshot, RevealDelta, MemoryTile } from './game.js';

export interface ServerToClientEvents {
  'game:snapshot': (snapshot: GameSnapshot) => void;
  'game:reveal-update': (delta: RevealDelta) => void;
  'game:player-died': (payload: { playerId: string; killerId: string | null }) => void;
  'game:round-start': (payload: {
    roundNumber: number;
    imageUrl: string;
    tiles: MemoryTile[];
  }) => void;
  'game:round-end': (payload: {
    roundNumber: number;
    winner: { id: string; name: string; score: number } | null;
    scores: Record<string, number>;
    pairScores: Record<string, number>;
  }) => void;
  'game:tile-captured': (payload: {
    tileId: number;
    capturedBy: string;
    capturedColor: string;
    symbolName: string;
  }) => void;
  'game:pair-matched': (payload: {
    pairId: number;
    symbolName: string;
    matchedBy: string;
    matchedByColor: string;
  }) => void;
  'game:hint-active': (payload: {
    pairId: number;
    symbolName: string;
    tileIds: [number, number];
  }) => void;
}

export interface ClientToServerEvents {
  'input:turn': (playerIndex: number, direction: -1 | 0 | 1) => void;
  'input:boost': (playerIndex: number, active: boolean) => void;
  'player:join': (payload: { name: string; playerIndex: number }) => void;
  'player:leave': (playerIndex: number) => void;
  'player:ready': (playerIndex: number) => void;
  'player:set-color': (playerIndex: number, color: string) => void;
  'player:set-name': (playerIndex: number, name: string) => void;
  'lobby:start-game': () => void;
  'lobby:return': () => void;
}

export interface InterServerEvents {}

export interface SocketData {
  playerIds: string[];
}
