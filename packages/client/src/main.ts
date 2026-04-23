import { createSocket } from './network/ClientSocket.js';
import { InterpolationBuffer } from './network/Interpolation.js';
import { Renderer } from './rendering/Renderer.js';
import { LobbyRenderer, type LobbyAction } from './rendering/LobbyRenderer.js';
import { MainMenuRenderer } from './rendering/MainMenuRenderer.js';
import { InstructionsRenderer } from './rendering/InstructionsRenderer.js';
import { ConfirmDialogRenderer } from './rendering/ConfirmDialogRenderer.js';
import { GameOverRenderer, type GameOverAction, type GameOverBanner } from './rendering/GameOverRenderer.js';
import { BackgroundBoids } from './rendering/BackgroundBoids.js';
import { QrCache } from './rendering/QrCache.js';
import { KeyboardProvider } from './input/KeyboardProvider.js';
import { GamepadProvider } from './input/GamepadProvider.js';
import { MidiProvider } from './input/MidiProvider.js';
import { MidiHub } from './input/midi/MidiHub.js';
import { MidiDeckProvider } from './input/midi/MidiDeckProvider.js';
import { loadDdjMidiConfig, type ResolvedDdjMidiConfig } from './input/midi/loadDdjMidiConfig.js';
import type { InputProvider } from './input/InputProvider.js';
import type { GameSnapshot, BoardPreset, RoundEndReason } from '@snakegame/shared';
import { ARENA_WIDTH, ARENA_HEIGHT, DEFAULT_BOARD_PRESET } from '@snakegame/shared';
import { sfx } from './audio/SfxEngine.js';
import { diffSnapshots, type SnapshotEvent } from './audio/SnapshotEvents.js';

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
const gameOverRenderer = new GameOverRenderer(mainCanvas);
const buffer = new InterpolationBuffer();
const socket = createSocket();

type ClientScreen = 'main-menu' | 'instructions' | 'lobby' | 'ingame' | 'exit-confirm' | 'game-over';
let clientScreen: ClientScreen = 'main-menu';
let latestSnapshot: GameSnapshot | null = null;
let prevSnapshotForEvents: GameSnapshot | null = null;
let boardPreset: BoardPreset = DEFAULT_BOARD_PRESET;

/** Winner + end reason from the most recent `game:round-end`. Drives the
 *  game-over modal. Cleared on restart / main menu. */
let lastGameOver: GameOverBanner | null = null;
let gameOverPending = false;
/** Last in-game snapshot, used as the frozen background behind the
 *  game-over modal after the server has already flipped back to lobby. */
let lastIngameSnapshot: GameSnapshot | null = null;

/**
 * Browser autoplay policy: AudioContext stays suspended until a user gesture.
 * Resume on any keydown/click/touch that the player makes; once unlocked it
 * stays unlocked for the session.
 */
function unlockAudioOnGesture(): void {
  const handler = () => {
    sfx.unlock();
    window.removeEventListener('keydown', handler);
    window.removeEventListener('pointerdown', handler);
    window.removeEventListener('touchstart', handler);
  };
  window.addEventListener('keydown', handler, { once: true });
  window.addEventListener('pointerdown', handler, { once: true });
  window.addEventListener('touchstart', handler, { once: true });
}
unlockAudioOnGesture();

type Binding =
  | 'wasd'
  | 'arrows'
  | 'gamepad-0'
  | 'midi-0'
  | 'midi-deck1'
  | 'midi-deck2';

type LocalSlot = {
  binding: Binding;
  name: string;
  provider: InputProvider;
  state: 'idle' | 'pending' | 'registered';
  playerIndex: number | null;
  lastTurn: -1 | 0 | 1;
  /** Last emitted MIDI turn intensity (0..1); keyboard/gamepad implicit 1. */
  lastTurnIntensity: number;
  lastActivate: boolean;
  lastTurbo: boolean;
  lastBrake: boolean;
};

let midiRuntime: ResolvedDdjMidiConfig;
let slots: Partial<Record<Binding, LocalSlot>> = {};
let duelFromMenu = false;
/** Prevents duplicate player:set-team emits for the same pair of indices. */
let duelTeamPairKey: string | null = null;

function applyMidiHubRuntime(cfg: ResolvedDdjMidiConfig): void {
  const hub = MidiHub.shared();
  hub.setInputNameIncludes(cfg.midiInputNameIncludes);
  const urlDebug = window.location.search.includes('midi-debug');
  hub.setDebugMidi(urlDebug || cfg.debugMidi);
}

function disposeAllSlots(current: Partial<Record<Binding, LocalSlot>>): void {
  for (const slot of Object.values(current)) {
    if (slot) slot.provider.destroy();
  }
}

function applyMidiLaneMapsToHub(): void {
  const hub = MidiHub.shared();
  for (const slot of Object.values(slots)) {
    if (!slot || !(slot.provider instanceof MidiDeckProvider)) continue;
    if (slot.binding === 'midi-0' || slot.binding === 'midi-deck1') {
      hub.setLaneMap(slot.provider.laneId, midiRuntime.deck1);
    } else if (slot.binding === 'midi-deck2') {
      hub.setLaneMap(slot.provider.laneId, midiRuntime.deck2);
    }
  }
}

function makeSlot(binding: Binding, name: string, provider: InputProvider): LocalSlot {
  return {
    binding, name, provider,
    state: 'idle',
    playerIndex: null,
    lastTurn: 0,
    lastTurnIntensity: 1,
    lastActivate: false,
    lastTurbo: false,
    lastBrake: false,
  };
}

function buildNormalSlots(): Partial<Record<Binding, LocalSlot>> {
  return {
    wasd: makeSlot('wasd', 'Keyboard WASD', new KeyboardProvider('wasd')),
    arrows: makeSlot('arrows', 'Keyboard Arrows', new KeyboardProvider('arrows')),
    'gamepad-0': makeSlot('gamepad-0', 'Gamepad', new GamepadProvider(0)),
    'midi-0': makeSlot('midi-0', 'DDJ-400', new MidiProvider(midiRuntime.deck1)),
  };
}

function buildDuelSlots(): Partial<Record<Binding, LocalSlot>> {
  const hub = MidiHub.shared();
  const lane1 = hub.addLane(midiRuntime.deck1);
  const lane2 = hub.addLane(midiRuntime.deck2);
  return {
    wasd: makeSlot('wasd', 'Keyboard WASD', new KeyboardProvider('wasd')),
    arrows: makeSlot('arrows', 'Keyboard Arrows', new KeyboardProvider('arrows')),
    'gamepad-0': makeSlot('gamepad-0', 'Gamepad', new GamepadProvider(0)),
    'midi-deck1': makeSlot(
      'midi-deck1',
      'DDJ Deck 1 (left)',
      new MidiDeckProvider(hub, lane1, 'midi-deck1', 'mapped'),
    ),
    'midi-deck2': makeSlot(
      'midi-deck2',
      'DDJ Deck 2 (right)',
      new MidiDeckProvider(hub, lane2, 'midi-deck2', 'mapped'),
    ),
  };
}

function enterLobby(fromDuel: boolean): void {
  disposeAllSlots(slots);
  duelTeamPairKey = null;
  duelFromMenu = fromDuel;
  slots = fromDuel ? buildDuelSlots() : buildNormalSlots();
  setScreen('lobby');
}

function tryAssignDuelTeams(): void {
  if (!duelFromMenu) return;
  const d1 = slots['midi-deck1'];
  const d2 = slots['midi-deck2'];
  if (!d1 || !d2 || d1.state !== 'registered' || d2.state !== 'registered') return;
  if (d1.playerIndex === null || d2.playerIndex === null) return;
  const key = `${d1.playerIndex}-${d2.playerIndex}`;
  if (duelTeamPairKey === key) return;
  duelTeamPairKey = key;
  socket.emit('player:set-team', d1.playerIndex, 0);
  socket.emit('player:set-team', d2.playerIndex, 1);
}

/** Kick off registration for a binding once its device is used. Guards
 *  against double-emits — a second keystroke while we're waiting on the
 *  server is a no-op until the response arrives. */
function requestRegister(binding: Binding): void {
  const slot = slots[binding];
  if (!slot) return;
  if (slot.state !== 'idle') return;
  if (clientScreen !== 'lobby') return;
  slot.state = 'pending';
  socket.emit('host:join-local', { name: slot.name, binding });
}

function setScreen(next: ClientScreen): void {
  if (next === clientScreen) return;
  if (next === 'main-menu') bgBoids.reset();
  clientScreen = next;
}

function doRestart(): void {
  lastGameOver = null;
  gameOverPending = false;
  // Force the server back to the lobby immediately — otherwise it would
  // auto-return on its own timer 6s after round end, and in the meantime
  // the ingame-snapshot handler below could yank us back to the ingame
  // screen. Safe no-op if the server has already returned.
  socket.emit('lobby:return');
  enterLobby(duelFromMenu);
}

function doMainMenuFromGameOver(): void {
  lastGameOver = null;
  gameOverPending = false;
  socket.emit('lobby:return');
  disposeAllSlots(slots);
  duelFromMenu = false;
  duelTeamPairKey = null;
  slots = buildNormalSlots();
  setScreen('main-menu');
}

// --- Keyboard (host only: menu nav, start, pause, local-input opt-in) ---
window.addEventListener('keydown', (e) => {
  if (clientScreen === 'game-over') {
    if (e.code === 'Enter' || e.code === 'KeyR') {
      sfx.menuClick();
      doRestart();
    } else if (e.code === 'Escape' || e.code === 'KeyM') {
      sfx.menuClick();
      doMainMenuFromGameOver();
    }
    return;
  }

  if (clientScreen === 'exit-confirm') {
    if (e.code === 'KeyY') {
      socket.emit('game:set-paused', false);
      socket.emit('lobby:return');
      disposeAllSlots(slots);
      duelFromMenu = false;
      duelTeamPairKey = null;
      slots = buildNormalSlots();
      setScreen('main-menu');
    } else if (e.code === 'KeyR' || e.code === 'KeyN' || e.code === 'Escape') {
      socket.emit('game:set-paused', false);
      setScreen('ingame');
    }
    return;
  }

  if (clientScreen === 'main-menu') {
    if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      mainMenuRenderer.move(-1);
      sfx.menuClick();
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      mainMenuRenderer.move(1);
      sfx.menuClick();
    } else if (e.code === 'Enter') {
      const sel = mainMenuRenderer.selected;
      sfx.menuClick();
      if (sel === 'play') enterLobby(false);
      else if (sel === 'ddj-duel') enterLobby(true);
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
      disposeAllSlots(slots);
      duelFromMenu = false;
      duelTeamPairKey = null;
      slots = buildNormalSlots();
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

function canvasToArena(e: MouseEvent): { x: number; y: number } {
  const rect = mainCanvas.getBoundingClientRect();
  const elAR = rect.width / rect.height;
  const arenaAR = ARENA_WIDTH / ARENA_HEIGHT;
  let drawW = rect.width, drawH = rect.height, offX = 0, offY = 0;
  if (elAR > arenaAR) {
    drawW = rect.height * arenaAR;
    offX = (rect.width - drawW) / 2;
  } else {
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
  const { x, y } = canvasToArena(e);
  if (clientScreen === 'game-over') {
    const action: GameOverAction | null = gameOverRenderer.hit(x, y);
    if (!action) return;
    sfx.menuClick();
    if (action === 'restart') doRestart();
    else if (action === 'main-menu') doMainMenuFromGameOver();
    return;
  }
  if (clientScreen !== 'lobby') return;
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

mainCanvas.addEventListener('mousemove', (e) => {
  const { x, y } = canvasToArena(e);
  if (clientScreen === 'game-over') {
    mainCanvas.style.cursor = gameOverRenderer.hit(x, y) ? 'pointer' : 'default';
    return;
  }
  if (clientScreen !== 'lobby') {
    mainCanvas.style.cursor = 'default';
    return;
  }
  mainCanvas.style.cursor = lobbyRenderer.hit(x, y) ? 'pointer' : 'default';
});

socket.on('connect', () => {
  console.log('[Client] Connected to server');
});

socket.on('host:joined', ({ playerIndex, binding }) => {
  const slot = binding ? slots[binding as Binding] : undefined;
  if (!slot) return;
  slot.state = 'registered';
  slot.playerIndex = playerIndex;
  slot.lastTurn = 0;
  slot.lastTurnIntensity = 1;
  slot.lastActivate = false;
  slot.lastTurbo = false;
  slot.lastBrake = false;
  console.log(`[Client] ${slot.name} joined slot ${playerIndex + 1}`);
  tryAssignDuelTeams();
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
    // Once the game-over modal is up, stop absorbing ingame snapshots —
    // otherwise on an old (multi-round) server we'd keep feeding live
    // frames into the buffer and the "frozen" background would visibly
    // animate behind the popup.
    if (clientScreen !== 'game-over') {
      buffer.push(snapshot);
      lastIngameSnapshot = snapshot;
    }
    // Enter the ingame screen on any incoming ingame snapshot — EXCEPT
    // when we're parked on the game-over screen waiting for the player
    // to hit Restart / Main Menu. The server's own 6s post-round timer
    // will eventually return to lobby on its own.
    if (
      clientScreen !== 'ingame'
      && clientScreen !== 'exit-confirm'
      && clientScreen !== 'game-over'
    ) {
      setScreen('ingame');
    }
    // SFX + screen shake from snapshot diffs. Only run while in-game and not
    // paused — otherwise queued effects could fire when the round resumes.
    if (
      prevSnapshotForEvents
      && prevSnapshotForEvents.gamePhase === 'ingame'
      && prevSnapshotForEvents.round.phase === snapshot.round.phase
      && !snapshot.paused
    ) {
      const evs = diffSnapshots(prevSnapshotForEvents, snapshot);
      for (const ev of evs) handleSnapshotEvent(ev);
    }
    prevSnapshotForEvents = snapshot;
  } else if (snapshot.gamePhase === 'lobby') {
    prevSnapshotForEvents = null;
    if (clientScreen === 'ingame' || clientScreen === 'exit-confirm') {
      // Natural game end (round finished, server returned to lobby) takes
      // the player to the game-over screen so they can see who won and
      // pick Restart vs Main Menu. Manual exits (ESC → confirm → Y) clear
      // `gameOverPending` themselves so they bypass this branch.
      if (gameOverPending) {
        gameOverPending = false;
        setScreen('game-over');
      } else {
        disposeAllSlots(slots);
        duelFromMenu = false;
        duelTeamPairKey = null;
        slots = buildNormalSlots();
        setScreen('main-menu');
      }
    }
  }

  const activeIndices = new Set(snapshot.lobbyPlayers.map(p => p.index));
  for (const slot of Object.values(slots)) {
    if (!slot) continue;
    if (slot.state === 'registered' && slot.playerIndex !== null && !activeIndices.has(slot.playerIndex)) {
      slot.state = 'idle';
      slot.playerIndex = null;
      slot.lastTurn = 0;
      slot.lastTurnIntensity = 1;
      slot.lastActivate = false;
      slot.lastTurbo = false;
      slot.lastBrake = false;
    }
  }

  if (duelFromMenu) {
    const d1 = slots['midi-deck1'];
    const d2 = slots['midi-deck2'];
    const both =
      d1?.state === 'registered'
      && d2?.state === 'registered'
      && d1.playerIndex !== null
      && d2.playerIndex !== null;
    if (!both) duelTeamPairKey = null;
  }
});

socket.on('game:reveal-update', (delta) => {
  renderer.applyRevealDelta(delta);
});

socket.on('game:round-start', ({ roundNumber, tiles }) => {
  console.log(`[Game] Round ${roundNumber} starting with ${tiles?.length ?? 0} tiles`);
  renderer.resetRound();
  prevSnapshotForEvents = null;
  sfx.roundStart();
  renderer.shake.add(0.35);
  if (tiles && tiles.length > 0) {
    renderer.loadTileImages(tiles).catch(err => {
      console.warn('[Game] Failed to load tile images:', err);
    });
  }
});

socket.on('game:round-end', ({ roundNumber, winner, pairScores, reason }) => {
  console.log(`[Game] Round ${roundNumber} ended`, pairScores, reason);
  sfx.roundEnd();
  renderer.shake.add(0.65);
  const endReason: RoundEndReason = reason ?? 'board-complete';
  if (winner) {
    // Server's round-end payload has id + name + score but not the color.
    const snake = latestSnapshot?.snakes.find(s => s.id === winner.id);
    lastGameOver = {
      winner: {
        name: winner.name,
        color: snake?.color ?? '#FFD700',
        score: winner.score,
      },
      reason: endReason,
    };
    renderer.showWinner(winner.name, winner.score);
  } else {
    lastGameOver = { winner: null, reason: endReason };
  }
  // Pop the game-over modal immediately — `round-end` was never emitted from
  // the normal memory win path before (RoundManager.update never returns
  // 'ended'); the server now always queues this event with `forceEndRound`.
  if (clientScreen === 'ingame' || clientScreen === 'exit-confirm' || clientScreen === 'game-over') {
    gameOverPending = false;
    setScreen('game-over');
  } else {
    gameOverPending = true;
  }
});

/** Fan a single snapshot event out to SFX + screen shake. */
function handleSnapshotEvent(ev: SnapshotEvent): void {
  switch (ev.kind) {
    case 'death':
      sfx.death();
      renderer.shake.add(0.45);
      break;
    case 'pickup':
      sfx.pickup();
      renderer.shake.add(0.05);
      break;
    case 'activate':
      sfx.activate();
      renderer.shake.add(0.12);
      break;
    case 'effectEnd':
      // Subtle, no shake.
      break;
    case 'frozen':
      sfx.freeze();
      renderer.shake.add(0.6);
      break;
    case 'shrunken':
      sfx.lightning();
      renderer.shake.add(0.7);
      break;
    case 'crippled':
      sfx.cripple();
      renderer.shake.add(0.4);
      break;
    case 'tileCaptured':
      sfx.tileCapture();
      break;
    case 'pairMatched':
      if (ev.isBonus) {
        sfx.bonusMatch();
        renderer.shake.add(0.85);
      } else {
        sfx.match();
        renderer.shake.add(0.3);
      }
      break;
    case 'pairNeutralized':
      sfx.neutralized();
      renderer.shake.add(0.18);
      break;
  }
}

function pollLocalSlots(): void {
  for (const slot of Object.values(slots)) {
    if (!slot) continue;
    if (!slot.provider.isConnected()) continue;
    const state = slot.provider.poll();
    const used = state.turnDirection !== 0 || state.activate
      || (slot.provider.hasRecentActivity?.() ?? false);

    if (slot.state === 'idle') {
      if (used) requestRegister(slot.binding);
      continue;
    }
    if (slot.state !== 'registered' || slot.playerIndex === null) continue;

    const inten = state.turnIntensity ?? 1;
    const intenQ = Math.round(inten * 24) / 24;
    const lastQ = Math.round(slot.lastTurnIntensity * 24) / 24;
    const turnChanged = state.turnDirection !== slot.lastTurn;
    const intenChanged = state.turnDirection !== 0 && intenQ !== lastQ;
    if (turnChanged || intenChanged) {
      socket.emit(
        'input:turn',
        slot.playerIndex,
        state.turnDirection,
        state.turnDirection === 0 ? 1 : intenQ,
      );
      slot.lastTurn = state.turnDirection;
      slot.lastTurnIntensity = state.turnDirection === 0 ? 1 : intenQ;
    }
    if (state.activate && !slot.lastActivate) {
      socket.emit('input:activate', slot.playerIndex);
    }
    slot.lastActivate = state.activate;

    const turbo = !!state.turbo;
    if (turbo !== slot.lastTurbo) {
      socket.emit('input:turbo', slot.playerIndex, turbo);
      slot.lastTurbo = turbo;
    }
    const brake = !!state.brake;
    if (brake !== slot.lastBrake) {
      socket.emit('input:brake', slot.playerIndex, brake);
      slot.lastBrake = brake;
    }
  }
}

function gameLoop(): void {
  pollLocalSlots();

  if (clientScreen === 'main-menu') {
    mainMenuRenderer.render();
  } else if (clientScreen === 'instructions') {
    instructionsRenderer.render();
  } else if (clientScreen === 'lobby') {
    const lobbyPlayers = latestSnapshot?.lobbyPlayers ?? [];
    lobbyRenderer.render(lobbyPlayers, boardPreset, duelFromMenu);
  } else if (clientScreen === 'game-over') {
    // Draw the frozen final game frame behind the popup so the scoreboard
    // + snake positions stay visible under the modal.
    const bg = buffer.interpolate(Date.now()) ?? lastIngameSnapshot;
    if (bg) renderer.render(bg);
    gameOverRenderer.render(lastGameOver);
  } else {
    const snapshot = buffer.interpolate(Date.now());
    if (snapshot) renderer.render(snapshot);
    if (clientScreen === 'exit-confirm') {
      confirmRenderer.render('Exit to main menu?');
    }
  }
  requestAnimationFrame(gameLoop);
}

async function bootstrap(): Promise<void> {
  midiRuntime = await loadDdjMidiConfig();
  applyMidiHubRuntime(midiRuntime);
  slots = buildNormalSlots();
  applyMidiLaneMapsToHub();
  socket.connect();
  requestAnimationFrame(gameLoop);
}

void bootstrap();

container.addEventListener('dblclick', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
});
