import { createSocket } from './network/ClientSocket.js';
import { InterpolationBuffer } from './network/Interpolation.js';
import { Renderer } from './rendering/Renderer.js';
import { LobbyRenderer, type LobbyAction } from './rendering/LobbyRenderer.js';
import { MainMenuRenderer } from './rendering/MainMenuRenderer.js';
import { InstructionsRenderer } from './rendering/InstructionsRenderer.js';
import { ConfirmDialogRenderer } from './rendering/ConfirmDialogRenderer.js';
import { BackgroundBoids } from './rendering/BackgroundBoids.js';
import { QrCache } from './rendering/QrCache.js';
import { KeyboardProvider } from './input/KeyboardProvider.js';
import { GamepadProvider } from './input/GamepadProvider.js';
import { MidiProvider } from './input/MidiProvider.js';
import type { InputProvider } from './input/InputProvider.js';
import type { GameSnapshot, BoardPreset } from '@snakegame/shared';
import { ARENA_WIDTH, ARENA_HEIGHT, DEFAULT_BOARD_PRESET } from '@snakegame/shared';

// Projector / host client. Local input devices (WASD, arrow keys,
// gamepad) self-register as lobby slots the moment they're used — no
// auto-join, no "ready" step. Phones keep using their own QR flow.

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

// --- Local input slots ---
// Each entry = one input device that has opted into a lobby slot by
// being used. Pressing A/D registers 'wasd', arrow keys register
// 'arrows', and moving/pressing the gamepad registers 'gamepad-0'.
// Slots are held until the host kicks them from the lobby UI, at which
// point the same device can re-register by being used again.
type Binding = 'wasd' | 'arrows' | 'gamepad-0' | 'midi-0';
type LocalSlot = {
  binding: Binding;
  name: string;
  provider: InputProvider;
  state: 'idle' | 'pending' | 'registered';
  playerIndex: number | null;
  lastTurn: -1 | 0 | 1;
  lastActivate: boolean;
};
const slots: Record<Binding, LocalSlot> = {
  'wasd':       makeSlot('wasd',       'Keyboard WASD',   new KeyboardProvider('wasd')),
  'arrows':     makeSlot('arrows',     'Keyboard Arrows', new KeyboardProvider('arrows')),
  'gamepad-0':  makeSlot('gamepad-0',  'Gamepad',         new GamepadProvider(0)),
  'midi-0':     makeSlot('midi-0',     'DDJ-400',         new MidiProvider()),
};
function makeSlot(binding: Binding, name: string, provider: InputProvider): LocalSlot {
  return { binding, name, provider, state: 'idle', playerIndex: null, lastTurn: 0, lastActivate: false };
}

/** Kick off registration for a binding once its device is used. Guards
 *  against double-emits — a second keystroke while we're waiting on the
 *  server is a no-op until the response arrives. */
function requestRegister(binding: Binding): void {
  const slot = slots[binding];
  if (slot.state !== 'idle') return;
  if (clientScreen !== 'lobby') return; // server rejects mid-game anyway
  slot.state = 'pending';
  socket.emit('host:join-local', { name: slot.name, binding });
}

function setScreen(next: ClientScreen): void {
  if (next === clientScreen) return;
  if (next === 'main-menu') bgBoids.reset();
  // Note: we intentionally do NOT call renderer.resetRound() when entering
  // 'ingame'. The server emits game:round-start whenever a new round begins
  // (including the very first one in startGame), and the handler below
  // resets the layers + loads the new tile images there. Calling
  // resetRound() here races with the async tile-image loads from
  // round-start and wipes them, leaving the projector black during
  // pre-reveal.
  clientScreen = next;
}

// --- Keyboard (host only: menu nav, start, pause, local-input opt-in) ---
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
      const players = latestSnapshot?.lobbyPlayers ?? [];
      if (players.length >= 1 && players.every(p => p.ready)) {
        socket.emit('lobby:start-game');
      }
      return;
    }
    // Opt-in: pressing a turn key while unregistered joins that binding
    // as a new lobby slot. The KeyboardProvider's own listeners also
    // catch this event, so by the time the snake exists the key is
    // already tracked and the next game-loop poll will emit the turn.
    if (e.code === 'KeyA' || e.code === 'KeyD') requestRegister('wasd');
    else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') requestRegister('arrows');
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
    const players = latestSnapshot?.lobbyPlayers ?? [];
    if (players.length >= 1 && players.every(p => p.ready)) {
      socket.emit('lobby:start-game');
    }
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

socket.on('host:joined', ({ playerIndex, binding }) => {
  const slot = binding ? slots[binding as Binding] : undefined;
  if (!slot) return;
  slot.state = 'registered';
  slot.playerIndex = playerIndex;
  slot.lastTurn = 0;
  slot.lastActivate = false;
  console.log(`[Client] ${slot.name} joined slot ${playerIndex + 1}`);
});

socket.on('host:join-error', ({ reason, binding }) => {
  const slot = binding ? slots[binding as Binding] : undefined;
  if (slot) slot.state = 'idle';
  console.log(`[Client] Host join declined: ${reason}`);
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

  // Reconcile local slots: if the host kicked one from the lobby UI, its
  // playerIndex disappears from lobbyPlayers — drop the registration so
  // the same device can re-join by being used again.
  const activeIndices = new Set(snapshot.lobbyPlayers.map(p => p.index));
  for (const slot of Object.values(slots)) {
    if (slot.state === 'registered' && slot.playerIndex !== null && !activeIndices.has(slot.playerIndex)) {
      slot.state = 'idle';
      slot.playerIndex = null;
      slot.lastTurn = 0;
      slot.lastActivate = false;
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

/** Poll every local slot. For unregistered slots, detect "use" (any
 *  turn or boost signal) and kick off registration. For registered
 *  slots, emit input:turn / input:boost on change. */
function pollLocalSlots(): void {
  for (const slot of Object.values(slots)) {
    if (!slot.provider.isConnected()) continue;
    const state = slot.provider.poll();
    // "Used" covers the normal case (mapped control is active). The
    // optional hasRecentActivity() hook also opts-in on ANY input —
    // useful for MIDI where the default mapping may not match the
    // user's specific hardware, so just touching the device joins.
    const used = state.turnDirection !== 0 || state.activate
              || (slot.provider.hasRecentActivity?.() ?? false);

    if (slot.state === 'idle') {
      if (used) requestRegister(slot.binding);
      continue;
    }
    if (slot.state !== 'registered' || slot.playerIndex === null) continue;

    if (state.turnDirection !== slot.lastTurn) {
      socket.emit('input:turn', slot.playerIndex, state.turnDirection);
      slot.lastTurn = state.turnDirection;
    }
    // Activate is edge-triggered: one emit on each rising edge (button
    // press), nothing while held or on release. Mirrors how the phone
    // slot-card tap emits a single input:activate.
    if (state.activate && !slot.lastActivate) {
      socket.emit('input:activate', slot.playerIndex);
    }
    slot.lastActivate = state.activate;
  }
}

// --- Game loop ---
function gameLoop(): void {
  pollLocalSlots();

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
