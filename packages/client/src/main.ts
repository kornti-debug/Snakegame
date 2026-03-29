import { createSocket } from './network/ClientSocket.js';
import { InterpolationBuffer } from './network/Interpolation.js';
import { Renderer } from './rendering/Renderer.js';
import { InputManager } from './input/InputManager.js';
import { KeyboardProvider } from './input/KeyboardProvider.js';
import type { GameSnapshot } from '@snakegame/shared';

// --- Setup ---
const container = document.getElementById('game')!;
const renderer = new Renderer(container);
const inputManager = new InputManager();
const buffer = new InterpolationBuffer();
const socket = createSocket();

// Player 1: WASD, Player 2: Arrows
inputManager.addProvider(new KeyboardProvider('wasd'));
inputManager.addProvider(new KeyboardProvider('arrows'));

const LOCAL_PLAYERS = 2;

// --- Socket ---
socket.on('connect', () => {
  console.log('[Client] Connected to server');
  for (let i = 0; i < LOCAL_PLAYERS; i++) {
    socket.emit('player:join', { name: `Player ${i + 1}`, playerIndex: i });
  }
});

socket.on('game:snapshot', (snapshot: GameSnapshot) => {
  buffer.push(snapshot);
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

// --- Input tracking ---
const lastTurnDirection: (-1 | 0 | 1)[] = [0, 0];

// --- Game Loop ---
function gameLoop(): void {
  // Send input for all local players (only on change)
  for (let i = 0; i < LOCAL_PLAYERS; i++) {
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
