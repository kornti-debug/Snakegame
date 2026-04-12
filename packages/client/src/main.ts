import { createSocket } from './network/ClientSocket.js';
import { InterpolationBuffer } from './network/Interpolation.js';
import { Renderer } from './rendering/Renderer.js';
import { LobbyRenderer, type LobbyAction } from './rendering/LobbyRenderer.js';
import { MainMenuRenderer } from './rendering/MainMenuRenderer.js';
import { InstructionsRenderer } from './rendering/InstructionsRenderer.js';
import { ConfirmDialogRenderer } from './rendering/ConfirmDialogRenderer.js';
import { BackgroundBoids } from './rendering/BackgroundBoids.js';
import { QrCache } from './rendering/QrCache.js';
import type { GameSnapshot, BoardPreset } from '@snakegame/shared';
import { ARENA_WIDTH, ARENA_HEIGHT, DEFAULT_BOARD_PRESET } from '@snakegame/shared';

// Projector / host client. No local players — players join via phone QR.
// Host actions are mouse-driven (lobby) plus a few keys (Enter, ESC, pause).

const container = document.getElementById('game')!;

const mainCanvas = document.createElement('canvas');
mainCanvas.width = ARENA_WIDTH;
mainCanvas.height = ARENA_HEIGHT;
mainCanvas.style.width = '100%';
mainCanvas.style.height = '100%';
mainCanvas.style.objectFit = 'contain';
mainCanvas.style.background = '#000';
mainCanvas.style.cursor = 'default';
container.appendChild(mainCanvas);

const renderer = new Renderer(container, mainCanvas);
const bgBoids = new BackgroundBoids();
const phoneUrl = `${window.location.origin}/phone.html`;
const qrCache = new QrCache(phoneUrl);
const lobbyRenderer = new LobbyRenderer(mainCanvas, bgBoids, qrCache);
const mainMenuRenderer = new MainMenuRenderer(mainCanvas, bgBoids);
const instructionsRenderer = new InstructionsRenderer(mainCanvas);
const confirmRenderer = new ConfirmDialogRenderer(mainCanvas);
const buffer = new InterpolationBuffer();
const socket = createSocket();

type ClientScreen = 'main-menu' | 'instructions' | 'lobby' | 'ingame' | 'exit-confirm';
let clientScreen: ClientScreen = 'main-menu';
let latestSnapshot: GameSnapshot | null = null;
let boardPreset: BoardPreset = DEFAULT_BOARD_PRESET;

function setScreen(next: ClientScreen): void {
  if (next === clientScreen) return;
  if (next === 'main-menu') bgBoids.reset();
  if (next === 'ingame' && clientScreen !== 'exit-confirm') {
    renderer.resetRound();
  }
  clientScreen = next;
}

// --- Keyboard (host only: menu nav, start, pause) ---
window.addEventListener('keydown', (e) => {
  if (clientScreen === 'exit-confirm') {
    if (e.code === 'KeyY') {
      socket.emit('game:set-paused', false);
      socket.emit('lobby:return');
      setScreen('main-menu');
    } else if (e.code === 'KeyR' || e.code === 'KeyN' || e.code === 'Escape') {
      socket.emit('game:set-paused', false);
      setScreen('ingame');
    }
    return;
  }

  if (clientScreen === 'main-menu') {
    if (e.code === 'ArrowUp' || e.code === 'KeyW') mainMenuRenderer.move(-1);
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') mainMenuRenderer.move(1);
    else if (e.code === 'Enter') {
      const sel = mainMenuRenderer.selected;
      if (sel === 'play') setScreen('lobby');
      else if (sel === 'instructions') setScreen('instructions');
    }
    return;
  }

  if (clientScreen === 'instructions') {
    if (e.code === 'Escape' || e.code === 'Enter') setScreen('main-menu');
    return;
  }

  if (clientScreen === 'lobby') {
    if (e.code === 'Escape') {
      setScreen('main-menu');
      return;
    }
    if (e.code === 'Enter') {
      const playerCount = latestSnapshot?.lobbyPlayers.length ?? 0;
      if (playerCount >= 1) socket.emit('lobby:start-game');
    }
    return;
  }

  if (clientScreen === 'ingame') {
    if (e.code === 'Escape') {
      socket.emit('game:set-paused', true);
      setScreen('exit-confirm');
    }
    return;
  }
});

// --- Mouse (lobby host actions) ---
function canvasToArena(e: MouseEvent): { x: number; y: number } {
  const rect = mainCanvas.getBoundingClientRect();
  // The canvas is object-fit: contain inside its wrapper. Compute the actual
  // drawn rect inside the element (letterboxed) and map from there.
  const elAR = rect.width / rect.height;
  const arenaAR = ARENA_WIDTH / ARENA_HEIGHT;
  let drawW = rect.width, drawH = rect.height, offX = 0, offY = 0;
  if (elAR > arenaAR) {
    // pillarboxed
    drawW = rect.height * arenaAR;
    offX = (rect.width - drawW) / 2;
  } else {
    // letterboxed
    drawH = rect.width / arenaAR;
    offY = (rect.height - drawH) / 2;
  }
  const localX = e.clientX - rect.left - offX;
  const localY = e.clientY - rect.top - offY;
  return {
    x: (localX / drawW) * ARENA_WIDTH,
    y: (localY / drawH) * ARENA_HEIGHT,
  };
}

mainCanvas.addEventListener('click', (e) => {
  if (clientScreen !== 'lobby') return;
  const { x, y } = canvasToArena(e);
  const action: LobbyAction | null = lobbyRenderer.hit(x, y);
  if (!action) return;
  if (action.type === 'pick-preset') {
    boardPreset = action.preset;
    socket.emit('lobby:set-config', { preset: boardPreset });
  } else if (action.type === 'kick') {
    socket.emit('lobby:kick', action.slot);
  } else if (action.type === 'start') {
    const playerCount = latestSnapshot?.lobbyPlayers.length ?? 0;
    if (playerCount >= 1) socket.emit('lobby:start-game');
  }
});

// Change cursor over clickable zones for affordance.
mainCanvas.addEventListener('mousemove', (e) => {
  if (clientScreen !== 'lobby') {
    mainCanvas.style.cursor = 'default';
    return;
  }
  const { x, y } = canvasToArena(e);
  mainCanvas.style.cursor = lobbyRenderer.hit(x, y) ? 'pointer' : 'default';
});

// --- Socket ---
socket.on('connect', () => {
  console.log('[Client] Connected to server');
});

socket.on('game:snapshot', (snapshot: GameSnapshot) => {
  latestSnapshot = snapshot;

  if (snapshot.boardPreset) boardPreset = snapshot.boardPreset;

  if (snapshot.gamePhase === 'ingame') {
    buffer.push(snapshot);
    if (clientScreen !== 'ingame' && clientScreen !== 'exit-confirm') {
      setScreen('ingame');
    }
  } else if (snapshot.gamePhase === 'lobby') {
    if (clientScreen === 'ingame' || clientScreen === 'exit-confirm') {
      setScreen('main-menu');
    }
  }
});

socket.on('game:reveal-update', (delta) => {
  renderer.applyRevealDelta(delta);
});

socket.on('game:round-start', ({ roundNumber, tiles }) => {
  console.log(`[Game] Round ${roundNumber} starting with ${tiles?.length ?? 0} tiles`);
  renderer.resetRound();
  if (tiles && tiles.length > 0) {
    renderer.loadTileImages(tiles).catch(err => {
      console.warn('[Game] Failed to load tile images:', err);
    });
  }
});

socket.on('game:round-end', ({ roundNumber, winner, pairScores }) => {
  console.log(`[Game] Round ${roundNumber} ended`, pairScores);
  if (winner) {
    renderer.showWinner(winner.name, winner.score);
  }
});

// --- Game loop ---
function gameLoop(): void {
  if (clientScreen === 'main-menu') {
    mainMenuRenderer.render();
  } else if (clientScreen === 'instructions') {
    instructionsRenderer.render();
  } else if (clientScreen === 'lobby') {
    const lobbyPlayers = latestSnapshot?.lobbyPlayers ?? [];
    lobbyRenderer.render(lobbyPlayers, boardPreset);
  } else {
    // ingame or exit-confirm
    const snapshot = buffer.interpolate(Date.now());
    if (snapshot) renderer.render(snapshot);
    if (clientScreen === 'exit-confirm') {
      confirmRenderer.render('Exit to main menu?');
    }
  }
  requestAnimationFrame(gameLoop);
}

// --- Start ---
socket.connect();
requestAnimationFrame(gameLoop);

container.addEventListener('dblclick', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
});
