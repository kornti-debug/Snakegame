import { createSocket } from './network/ClientSocket.js';
import { InterpolationBuffer } from './network/Interpolation.js';
import { Renderer } from './rendering/Renderer.js';
import { LobbyRenderer } from './rendering/LobbyRenderer.js';
import { MainMenuRenderer } from './rendering/MainMenuRenderer.js';
import { InstructionsRenderer } from './rendering/InstructionsRenderer.js';
import { ConfirmDialogRenderer } from './rendering/ConfirmDialogRenderer.js';
import { BackgroundBoids } from './rendering/BackgroundBoids.js';
import { QrCache } from './rendering/QrCache.js';
import { InputManager } from './input/InputManager.js';
import { KeyboardProvider } from './input/KeyboardProvider.js';
import type { GameSnapshot, BoardPreset } from '@snakegame/shared';
import { ARENA_WIDTH, ARENA_HEIGHT, PLAYER_COLORS, DEFAULT_BOARD_PRESET } from '@snakegame/shared';

// --- Setup ---
const container = document.getElementById('game')!;

const mainCanvas = document.createElement('canvas');
mainCanvas.width = ARENA_WIDTH;
mainCanvas.height = ARENA_HEIGHT;
mainCanvas.style.width = '100%';
mainCanvas.style.height = '100%';
mainCanvas.style.objectFit = 'contain';
mainCanvas.style.background = '#000';
container.appendChild(mainCanvas);

const renderer = new Renderer(container, mainCanvas);
const bgBoids = new BackgroundBoids(); // shared ambient swarm across menu + lobby
// Phone-join URL: same origin + /phone. For this to work the projector must
// be served from a LAN-reachable address (vite already listens on 0.0.0.0).
const phoneUrl = `${window.location.origin}/phone.html`;
const qrCache = new QrCache(phoneUrl);
const lobbyRenderer = new LobbyRenderer(mainCanvas, bgBoids, qrCache);
const mainMenuRenderer = new MainMenuRenderer(mainCanvas, bgBoids);
const instructionsRenderer = new InstructionsRenderer(mainCanvas);
const confirmRenderer = new ConfirmDialogRenderer(mainCanvas);
const inputManager = new InputManager();
const buffer = new InterpolationBuffer();
const socket = createSocket();

// Client-side screen machine. Server phase ('lobby' | 'ingame') drives only
// whether the game is actually running — the client overlays menus on top.
type ClientScreen = 'main-menu' | 'instructions' | 'lobby' | 'ingame' | 'exit-confirm';
let clientScreen: ClientScreen = 'main-menu';

function setScreen(next: ClientScreen): void {
  if (next === clientScreen) return;
  // Respawn the ambient swarm every time we arrive at the main menu so the
  // viewer sees the flock form up fresh instead of an already-settled swarm.
  if (next === 'main-menu') bgBoids.reset();
  clientScreen = next;
}
let latestSnapshot: GameSnapshot | null = null;
let boardPreset: BoardPreset = DEFAULT_BOARD_PRESET;
const joinedPlayers = new Set<number>();
const PRESETS: BoardPreset[] = ['small', 'medium', 'large', 'huge'];

// TODO(midi): register a MidiProvider alongside KeyboardProvider below.
// (Phone clients don't register here — they have their own socket and send
// input:turn directly. See packages/client/src/phone.ts.)

// --- Keyboard routing ---
window.addEventListener('keydown', (e) => {
  // Global: exit-confirm always wins
  if (clientScreen === 'exit-confirm') {
    if (e.code === 'KeyY') {
      socket.emit('lobby:return');
      setScreen('main-menu');
    } else if (e.code === 'KeyN' || e.code === 'Escape') {
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

    // Color cycling
    if (e.code === 'KeyW' && joinedPlayers.has(0)) cycleColor(0, -1);
    if (e.code === 'KeyS' && joinedPlayers.has(0)) cycleColor(0, 1);
    if (e.code === 'ArrowUp' && joinedPlayers.has(1)) cycleColor(1, -1);
    if (e.code === 'ArrowDown' && joinedPlayers.has(1)) cycleColor(1, 1);

    // Board preset: 1-4 picks a card directly; [ / ] still cycle as a fallback.
    const digitMap: Record<string, BoardPreset> = {
      Digit1: 'small', Digit2: 'medium', Digit3: 'large', Digit4: 'huge',
      Numpad1: 'small', Numpad2: 'medium', Numpad3: 'large', Numpad4: 'huge',
    };
    const pickedByDigit = digitMap[e.code];
    if (pickedByDigit) {
      boardPreset = pickedByDigit;
      socket.emit('lobby:set-config', { preset: boardPreset });
    } else if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
      const dir = e.code === 'BracketRight' ? 1 : -1;
      const idx = (PRESETS.indexOf(boardPreset) + dir + PRESETS.length) % PRESETS.length;
      boardPreset = PRESETS[idx];
      socket.emit('lobby:set-config', { preset: boardPreset });
    }

    if (e.code === 'Enter' && joinedPlayers.size > 0) {
      socket.emit('lobby:start-game');
    }
    return;
  }

  if (clientScreen === 'ingame') {
    if (e.code === 'Escape') {
      setScreen('exit-confirm');
    }
    return;
  }
});

let colorIndices = [0, 1];
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

  // Sync server board preset to client (server is authoritative once set)
  if (snapshot.boardPreset) boardPreset = snapshot.boardPreset;

  // Server state drives game screen transitions
  if (snapshot.gamePhase === 'ingame') {
    buffer.push(snapshot);
    if (clientScreen !== 'ingame' && clientScreen !== 'exit-confirm') {
      setScreen('ingame');
    }
  } else if (snapshot.gamePhase === 'lobby') {
    // Returned to lobby from game (e.g. after exit confirm)
    if (clientScreen === 'ingame' || clientScreen === 'exit-confirm') {
      setScreen('main-menu');
    }
  }
});

socket.on('game:reveal-update', (delta) => {
  renderer.applyRevealDelta(delta);
});

socket.on('game:player-died', ({ playerId, killerId }) => {
  console.log(`[Game] Player ${playerId} died${killerId ? ` (killed by ${killerId})` : ''}`);
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

socket.on('game:tile-captured', ({ tileId, capturedBy, symbolName }) => {
  console.log(`[Game] Tile ${tileId} (${symbolName}) captured by ${capturedBy}`);
});

socket.on('game:pair-matched', ({ pairId, symbolName, matchedBy }) => {
  console.log(`[Game] Pair ${pairId} (${symbolName}) matched by ${matchedBy}!`);
});

socket.on('game:hint-active', ({ pairId, symbolName }) => {
  console.log(`[Game] Hint active for pair ${pairId} (${symbolName})`);
});

const lastTurnDirection: (-1 | 0 | 1)[] = [0, 0];

function gameLoop(): void {
  if (clientScreen === 'main-menu') {
    mainMenuRenderer.render();
  } else if (clientScreen === 'instructions') {
    instructionsRenderer.render();
  } else if (clientScreen === 'lobby') {
    const lobbyPlayers = latestSnapshot?.lobbyPlayers ?? [];
    lobbyRenderer.render(lobbyPlayers, boardPreset);
  } else {
    // ingame or exit-confirm — both render the game, confirm overlays on top
    for (let i = 0; i < joinedPlayers.size; i++) {
      const input = inputManager.poll(i);
      if (input && input.turnDirection !== lastTurnDirection[i]) {
        socket.emit('input:turn', i, input.turnDirection);
        lastTurnDirection[i] = input.turnDirection;
      }
    }

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
