import { createSocket } from './network/ClientSocket.js';
import { InterpolationBuffer } from './network/Interpolation.js';
import { Renderer } from './rendering/Renderer.js';
import { LobbyRenderer } from './rendering/LobbyRenderer.js';
import { InputManager } from './input/InputManager.js';
import { KeyboardProvider } from './input/KeyboardProvider.js';
import type { GameSnapshot, GamePhase, LobbyPlayer } from '@snakegame/shared';
import { ARENA_WIDTH, ARENA_HEIGHT, PLAYER_COLORS } from '@snakegame/shared';

// --- Setup ---
const container = document.getElementById('game')!;

// Main canvas (shared between lobby and game)
const mainCanvas = document.createElement('canvas');
mainCanvas.width = ARENA_WIDTH;
mainCanvas.height = ARENA_HEIGHT;
mainCanvas.style.width = '100%';
mainCanvas.style.height = '100%';
mainCanvas.style.objectFit = 'contain';
mainCanvas.style.background = '#000';
container.appendChild(mainCanvas);

const renderer = new Renderer(container, mainCanvas);
const lobbyRenderer = new LobbyRenderer(mainCanvas);
const inputManager = new InputManager();
const buffer = new InterpolationBuffer();
const socket = createSocket();

let currentPhase: GamePhase = 'lobby';
let latestSnapshot: GameSnapshot | null = null;
const joinedPlayers = new Set<number>(); // track which players we've joined

// --- Lobby keyboard handling ---
const lobbyKeys = new Set<string>();

window.addEventListener('keydown', (e) => {
  lobbyKeys.add(e.code);

  if (currentPhase === 'lobby') {
    // Player 1 join: A or D
    if ((e.code === 'KeyA' || e.code === 'KeyD') && !joinedPlayers.has(0)) {
      joinedPlayers.add(0);
      socket.emit('player:join', { name: 'Player 1', playerIndex: 0 });
      inputManager.addProvider(new KeyboardProvider('wasd'));
    }
    // Player 2 join: Arrow keys
    if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && !joinedPlayers.has(1)) {
      joinedPlayers.add(1);
      socket.emit('player:join', { name: 'Player 2', playerIndex: 1 });
      inputManager.addProvider(new KeyboardProvider('arrows'));
    }

    // Color cycling (W/S for P1, Up/Down for P2)
    if (e.code === 'KeyW' && joinedPlayers.has(0)) {
      cycleColor(0, -1);
    }
    if (e.code === 'KeyS' && joinedPlayers.has(0)) {
      cycleColor(0, 1);
    }
    if (e.code === 'ArrowUp' && joinedPlayers.has(1)) {
      cycleColor(1, -1);
    }
    if (e.code === 'ArrowDown' && joinedPlayers.has(1)) {
      cycleColor(1, 1);
    }

    // Start game
    if (e.code === 'Enter' && joinedPlayers.size > 0) {
      socket.emit('lobby:start-game');
    }
  }

  // Return to lobby during game
  if (e.code === 'Escape' && currentPhase === 'ingame') {
    socket.emit('lobby:return');
  }
});

window.addEventListener('keyup', (e) => {
  lobbyKeys.delete(e.code);
});

let colorIndices = [0, 1]; // track color index per player
function cycleColor(playerIndex: number, dir: number): void {
  colorIndices[playerIndex] = (colorIndices[playerIndex] + dir + PLAYER_COLORS.length) % PLAYER_COLORS.length;
  socket.emit('player:set-color', playerIndex, PLAYER_COLORS[colorIndices[playerIndex]]);
}

// --- Socket ---
socket.on('connect', () => {
  console.log('[Client] Connected to server');
});

socket.on('game:snapshot', (snapshot: GameSnapshot) => {
  latestSnapshot = snapshot;
  currentPhase = snapshot.gamePhase;

  if (currentPhase === 'ingame') {
    buffer.push(snapshot);
  }
});

socket.on('game:reveal-update', (delta) => {
  renderer.applyRevealDelta(delta);
});

socket.on('game:player-died', ({ playerId, killerId }) => {
  console.log(`[Game] Player ${playerId} died${killerId ? ` (killed by ${killerId})` : ''}`);
});

socket.on('game:round-start', ({ roundNumber, imageUrl }) => {
  console.log(`[Game] Round ${roundNumber} starting`);
  renderer.resetRound();
  if (imageUrl) {
    renderer.loadImage(imageUrl).catch(err => {
      console.warn('[Game] Failed to load round image:', err);
    });
  }
});

socket.on('game:round-end', ({ roundNumber, winner, scores }) => {
  console.log(`[Game] Round ${roundNumber} ended`, scores);
  if (winner) {
    renderer.showWinner(winner.name, winner.score);
  }
});

// --- Input tracking ---
const lastTurnDirection: (-1 | 0 | 1)[] = [0, 0];

// --- Game Loop ---
function gameLoop(): void {
  if (currentPhase === 'lobby') {
    // Render lobby
    const lobbyPlayers = latestSnapshot?.lobbyPlayers ?? [];
    lobbyRenderer.render(lobbyPlayers);
  } else {
    // Send input
    for (let i = 0; i < joinedPlayers.size; i++) {
      const input = inputManager.poll(i);
      if (input && input.turnDirection !== lastTurnDirection[i]) {
        socket.emit('input:turn', i, input.turnDirection);
        lastTurnDirection[i] = input.turnDirection;
      }
    }

    // Interpolate and render
    const snapshot = buffer.interpolate(Date.now());
    if (snapshot) {
      renderer.render(snapshot);
    }
  }

  requestAnimationFrame(gameLoop);
}

// --- Start ---
socket.connect();
requestAnimationFrame(gameLoop);

// Fullscreen on double-click
container.addEventListener('dblclick', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
});
