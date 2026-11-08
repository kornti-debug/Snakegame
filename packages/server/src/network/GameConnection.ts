import type { ClientToServerEvents, ServerToClientEvents } from '@snakegame/shared';
import type { GameRoom } from '../GameRoom.js';

/** The small event interface shared by Socket.IO and the in-browser host. */
export interface GamePeer {
  readonly id: string;
  on<E extends keyof ClientToServerEvents>(event: E, handler: ClientToServerEvents[E]): void;
  emit<E extends keyof ServerToClientEvents>(event: E, ...args: Parameters<ServerToClientEvents[E]>): void;
}

export function registerGameClient(room: GameRoom, socket: GamePeer): void {
  socket.on('player:join', ({ name, playerIndex }) => {
    if (room.gamePhase === 'lobby') {
      room.lobbyJoin(socket.id, playerIndex, name);
      console.log(`[Lobby] ${name} joined as Player ${playerIndex + 1}`);
    }
  });

  socket.on('player:leave', (playerIndex) => {
    room.playerLeave(socket.id, playerIndex);
  });

  socket.on('player:ready', (playerIndex) => {
    room.lobbySetReady(socket.id, playerIndex);
  });

  socket.on('player:set-color', (playerIndex, color) => {
    room.lobbySetColor(socket.id, playerIndex, color);
  });

  socket.on('player:set-name', (playerIndex, name) => {
    room.lobbySetName(socket.id, playerIndex, name);
  });

  socket.on('player:set-team', (playerIndex, team) => {
    room.lobbySetTeam(socket.id, playerIndex, team);
  });

  socket.on('lobby:start-game', () => {
    if (room.gamePhase === 'lobby') {
      room.startGame();
      console.log('[Game] Starting game!');
    }
  });

  socket.on('phone:join', ({ name, clientId }) => {
    const result = room.phoneJoin(
      socket.id,
      name?.trim() || `Phone ${socket.id.slice(0, 4)}`,
      clientId,
    );
    if (!result) {
      socket.emit('phone:join-error', { reason: 'Lobby full or game in progress' });
      return;
    }
    socket.emit('phone:joined', { playerIndex: result.index, color: result.color });
    console.log(`[Phone] Joined as slot ${result.index + 1} (${socket.id.slice(0, 6)})`);
  });

  socket.on('phone:reclaim', ({ clientId }) => {
    if (!clientId) {
      socket.emit('phone:reclaim-result', { ok: false });
      return;
    }
    const result = room.reclaim(socket.id, clientId);
    if (!result) {
      socket.emit('phone:reclaim-result', { ok: false });
      return;
    }
    socket.emit('phone:reclaim-result', {
      ok: true,
      playerIndex: result.index,
      color: result.color,
    });
    console.log(`[Phone] Reclaimed slot ${result.index + 1} (${socket.id.slice(0, 6)})`);
  });

  socket.on('host:join-local', ({ name, binding }) => {
    if (room.gamePhase !== 'lobby') {
      socket.emit('host:join-error', { reason: 'Game already in progress', binding });
      return;
    }
    const result = room.localJoin(socket.id, name?.trim() || 'Host');
    if (!result) {
      socket.emit('host:join-error', { reason: 'Lobby full', binding });
      return;
    }
    socket.emit('host:joined', { playerIndex: result.index, color: result.color, binding });
    console.log(`[Host] Local player joined slot ${result.index + 1} via ${binding ?? 'host'} (${socket.id.slice(0, 6)})`);
  });

  socket.on('lobby:set-config', ({ preset }) => {
    if (room.gamePhase !== 'lobby') return;
    if (preset !== 'small' && preset !== 'medium' && preset !== 'large' && preset !== 'huge') return;
    room.boardPreset = preset;
    console.log(`[Lobby] Board preset set to ${preset}`);
  });

  socket.on('lobby:set-game-mode', (mode) => {
    if (room.gamePhase !== 'lobby') return;
    if (mode !== 'memory' && mode !== 'ddj-duel' && mode !== 'boid-battle') return;
    room.gameMode = mode;
    console.log(`[Lobby] Game mode set to ${mode}`);
  });

  socket.on('lobby:kick', (slotIndex) => {
    if (room.isPhoneSocket(socket.id)) return; // phones can't kick
    if (typeof slotIndex !== 'number') return;
    const ok = room.kickSlot(slotIndex);
    if (ok) console.log(`[Lobby] Slot ${slotIndex + 1} kicked`);
  });

  socket.on('game:set-paused', (paused) => {
    if (room.isPhoneSocket(socket.id)) return; // phones can't pause
    room.setPaused(!!paused);
    console.log(`[Game] Paused = ${!!paused}`);
  });

  socket.on('lobby:return', () => {
    if (room.gamePhase === 'ingame') {
      room.returnToLobby();
      console.log('[Game] Returning to lobby');
    }
  });

  socket.on('input:turn', (playerIndex, direction, turnIntensity) => {
    const snake = room.getSnake(socket.id, playerIndex);
    if (!snake) return;
    snake.turnDirection = direction;
    if (direction === 0) {
      snake.turnIntensity = 1;
      return;
    }
    if (typeof turnIntensity === 'number' && Number.isFinite(turnIntensity)) {
      snake.turnIntensity = Math.min(1, Math.max(0.08, turnIntensity));
    } else {
      snake.turnIntensity = 1;
    }
  });

  socket.on('input:boost', (playerIndex, active) => {
    const snake = room.getSnake(socket.id, playerIndex);
    if (snake) snake.boosting = active;
  });

  socket.on('input:activate', (playerIndex) => {
    const snake = room.getSnake(socket.id, playerIndex);
    if (snake) room.powerUpSystem.activateSlot(snake, room.getAllSnakes());
  });

  socket.on('input:turbo', (playerIndex, active) => {
    const snake = room.getSnake(socket.id, playerIndex);
    if (snake) snake.turboPressed = !!active;
  });

  socket.on('input:brake', (playerIndex, active) => {
    const snake = room.getSnake(socket.id, playerIndex);
    if (snake) snake.brakePressed = !!active;
  });
}
