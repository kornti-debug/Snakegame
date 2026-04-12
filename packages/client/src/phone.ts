import { createSocket } from './network/ClientSocket.js';
import type { GameSnapshot, LobbyPlayer, MemoryTile, RevealDelta } from '@snakegame/shared';
import { PLAYER_COLORS, TEAM_COLORS, TEAM_NAMES, ARENA_WIDTH, ARENA_HEIGHT } from '@snakegame/shared';
import { PhoneArenaRenderer } from './rendering/PhoneArenaRenderer.js';

// Phone client. Three screens:
//   1. join     — enter name, tap Join
//   2. settings — lobby view: change name / color / team while waiting
//   3. controller — two tap-and-hold zones, shown while the game is running

const socket = createSocket();

const statusDot = document.getElementById('status-dot')!;
const statusText = document.getElementById('status-text')!;
const leaveBtn = document.getElementById('leave-btn') as HTMLButtonElement;
const fsBtn = document.getElementById('fs-btn') as HTMLButtonElement;

const joinScreen = document.getElementById('join-screen')!;
const settingsScreen = document.getElementById('settings-screen')!;
const controllerScreen = document.getElementById('controller-screen')!;
const errorScreen = document.getElementById('error-screen')!;
const errorMsg = document.getElementById('error-msg')!;

const nameInput = document.getElementById('name-input') as HTMLInputElement;
const joinBtn = document.getElementById('join-btn') as HTMLButtonElement;

const slotLabel = document.getElementById('slot-label')!;
const settingsName = document.getElementById('settings-name') as HTMLInputElement;
const colorRow = document.getElementById('color-row')!;
const teamRow = document.getElementById('team-row')!;

const padLeft = document.getElementById('pad-left')!;
const padRight = document.getElementById('pad-right')!;
const readyBtn = document.getElementById('ready-btn') as HTMLButtonElement;

// Controller info column
const infoColor = document.getElementById('info-color') as HTMLElement;
const infoName = document.getElementById('info-name') as HTMLElement;
const infoTeamDot = document.getElementById('info-team-dot') as HTMLElement;
const infoTeamName = document.getElementById('info-team-name') as HTMLElement;
const infoScore = document.getElementById('info-score') as HTMLElement;

// Arena follow-cam
const arenaCanvas = document.getElementById('arena-canvas') as HTMLCanvasElement;
const arenaMsg = document.getElementById('arena-msg') as HTMLElement;
const arenaRenderer = new PhoneArenaRenderer();
// How much of the arena is visible around the player (arena pixels). The
// visible canvas aspect ratio determines the actual width — we pick the
// vertical extent and compute width from that.
const CAMERA_VIEW_HEIGHT = 540;
let lastSnapshot: GameSnapshot | null = null;

let playerIndex: number | null = null;
let myName = '';
let myColor = PLAYER_COLORS[0];
let myTeam: number | null = null;
let myReady = false;
let connected = false;
let lastTurn: -1 | 0 | 1 = 0;
type Screen = 'join' | 'settings' | 'controller' | 'error';
let screen: Screen = 'join';
let latestLobbyPlayers: LobbyPlayer[] = [];

function setStatus(text: string, ok: boolean): void {
  statusText.textContent = text;
  statusDot.classList.toggle('connected', ok);
}

function show(next: Screen): void {
  screen = next;
  for (const [id, el] of [
    ['join', joinScreen], ['settings', settingsScreen],
    ['controller', controllerScreen], ['error', errorScreen],
  ] as const) {
    el.classList.toggle('active', id === next);
  }
  // Portrait is fine on Join (text entry). Landscape is required from
  // Settings onward, where controls are laid out horizontally.
  document.body.classList.toggle('allow-portrait', next === 'join' || next === 'error');

  // Top-bar HUD only shows on the Controller; the status text shows elsewhere.
  const onController = next === 'controller';
  const hudBar = document.getElementById('hud-bar');
  if (hudBar) hudBar.classList.toggle('visible', onController);
  statusText.classList.toggle('hidden', onController);
  // Full-screen overlay layout only on Controller — turns the whole viewport
  // into the arena with the bar + pads floating on top.
  document.body.classList.toggle('controller-mode', onController);
}

function renderColorRow(): void {
  // Colors already claimed by OTHER players are unavailable — two snakes
  // with the same color would be impossible to tell apart mid-game.
  const taken = new Set(
    latestLobbyPlayers
      .filter(p => p.index !== playerIndex)
      .map(p => p.color.toUpperCase()),
  );

  colorRow.innerHTML = '';
  for (const color of PLAYER_COLORS) {
    const isTaken = taken.has(color.toUpperCase());
    const sw = document.createElement('div');
    sw.className = 'swatch' + (color === myColor ? ' selected' : '') + (isTaken ? ' taken' : '');
    sw.style.background = color;
    if (isTaken) {
      sw.title = 'taken';
    } else {
      sw.addEventListener('click', () => {
        if (playerIndex === null) return;
        myColor = color;
        socket.emit('player:set-color', playerIndex, color);
        renderColorRow();
      });
    }
    colorRow.appendChild(sw);
  }
}

function renderTeamRow(): void {
  teamRow.innerHTML = '';

  const makeBtn = (label: string, color: string | null, team: number | null) => {
    const btn = document.createElement('button');
    btn.className = 'team-btn' + (team === myTeam ? ' selected' : '');
    btn.innerHTML = color
      ? `<span class="dot" style="background:${color}"></span>${label}`
      : label;
    btn.addEventListener('click', () => {
      if (playerIndex === null) return;
      myTeam = team;
      socket.emit('player:set-team', playerIndex, team);
      renderTeamRow();
    });
    teamRow.appendChild(btn);
  };

  makeBtn('Solo', null, null);
  TEAM_COLORS.forEach((c, i) => makeBtn(TEAM_NAMES[i], c, i));
}

// --- Socket lifecycle ---

socket.on('connect', () => {
  connected = true;
  setStatus('Connected — join the game', true);
  joinBtn.disabled = false;
});

socket.on('disconnect', () => {
  connected = false;
  setStatus('Disconnected', false);
  joinBtn.disabled = true;
  if (playerIndex !== null) {
    playerIndex = null;
    show('join');
  }
});

socket.on('phone:joined', ({ playerIndex: idx, color }) => {
  playerIndex = idx;
  myColor = color;
  myReady = false;
  slotLabel.textContent = `Player ${idx + 1}`;
  settingsName.value = myName;
  setStatus(`Player ${idx + 1}`, true);
  leaveBtn.classList.add('visible');
  renderColorRow();
  renderTeamRow();
  renderReadyBtn();
  show('settings');
});

socket.on('phone:join-error', ({ reason }) => {
  errorMsg.textContent = reason;
  show('error');
});

socket.on('game:round-start', ({ tiles }: { roundNumber: number; tiles: MemoryTile[] }) => {
  arenaRenderer.resetRound();
  if (tiles && tiles.length > 0) {
    arenaRenderer.loadTileImages(tiles).catch(() => {});
  }
});

socket.on('game:reveal-update', (delta: RevealDelta) => {
  arenaRenderer.applyRevealDelta(delta);
});

socket.on('game:snapshot', (snapshot: GameSnapshot) => {
  lastSnapshot = snapshot;
  if (playerIndex === null) return;
  // Swap between settings (while lobby) and controller (while ingame).
  if (snapshot.gamePhase === 'ingame' && screen !== 'controller') {
    leaveBtn.classList.add('visible');
    show('controller');
  } else if (snapshot.gamePhase === 'lobby' && screen === 'controller') {
    show('settings');
  }

  // Cache lobby players so the color palette can disable taken colors.
  latestLobbyPlayers = snapshot.lobbyPlayers;

  // Sync my state from the server snapshot.
  const me = snapshot.lobbyPlayers.find(p => p.index === playerIndex);
  const serverReady = !!me?.ready;
  if (serverReady !== myReady) {
    myReady = serverReady;
    renderReadyBtn();
  }
  // If the server rejected a color change (duplicate) our cached myColor
  // may drift from the server's value — reconcile and redraw.
  if (me && me.color !== myColor) {
    myColor = me.color;
  }
  if (screen === 'settings') renderColorRow();

  updateInfoColumn(snapshot);
});

function renderReadyBtn(): void {
  readyBtn.classList.toggle('ready', myReady);
  readyBtn.textContent = myReady ? '✓ Ready — waiting for others' : 'Tap when Ready';
}

function updateInfoColumn(snapshot: GameSnapshot): void {
  if (playerIndex === null) return;
  const me = snapshot.lobbyPlayers.find(p => p.index === playerIndex);
  infoColor.style.background = me?.color ?? myColor;
  infoName.textContent = me?.name ?? myName ?? `Player ${playerIndex + 1}`;

  const team = me?.team ?? null;
  if (team === null) {
    infoTeamDot.style.background = 'rgba(255,255,255,0.25)';
    infoTeamName.textContent = 'Solo';
  } else {
    infoTeamDot.style.background = TEAM_COLORS[team];
    infoTeamName.textContent = TEAM_NAMES[team];
  }

  // Find my snake by name match (snakeId is server-side) to pull pair score.
  // Fall back to 0 if not found (between rounds or before spawn).
  const mySnake = snapshot.snakes.find(s => s.name === (me?.name ?? myName));
  infoScore.textContent = String(mySnake?.pairScore ?? 0);
}

// --- Join + leave flow ---

joinBtn.addEventListener('click', () => {
  if (!connected) return;
  myName = nameInput.value.trim();
  socket.emit('phone:join', { name: myName || undefined });
  joinBtn.disabled = true;
  joinBtn.textContent = 'Joining…';
  // Must happen inside the tap handler to satisfy the user-gesture rule.
  requestFullscreen();
});

fsBtn.addEventListener('click', () => requestFullscreen());

readyBtn.addEventListener('click', () => {
  if (playerIndex === null) return;
  // Server toggles ready state. We optimistically flip so the button
  // feels responsive; the next snapshot reconciles.
  socket.emit('player:ready', playerIndex);
  myReady = !myReady;
  renderReadyBtn();
});

function requestFullscreen(): void {
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void>;
  };
  try {
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  } catch {
    // iOS Safari doesn't support fullscreen on documentElement; silently ignore.
  }
}

function updateFsButton(): void {
  const isFs = !!document.fullscreenElement;
  fsBtn.classList.toggle('hidden', isFs);
}
document.addEventListener('fullscreenchange', updateFsButton);
updateFsButton();

leaveBtn.addEventListener('click', () => {
  if (playerIndex === null) return;
  socket.emit('player:leave', playerIndex);
  playerIndex = null;
  lastTurn = 0;
  myReady = false;
  padLeft.classList.remove('active');
  padRight.classList.remove('active');
  leaveBtn.classList.remove('visible');
  joinBtn.disabled = false;
  joinBtn.textContent = 'Join';
  setStatus('Connected — join the game', true);
  show('join');
});

// --- Settings name live sync ---

settingsName.addEventListener('input', () => {
  if (playerIndex === null) return;
  myName = settingsName.value.trim();
  socket.emit('player:set-name', playerIndex, myName || `Player ${playerIndex + 1}`);
});

// --- Controller pads ---

function sendTurn(dir: -1 | 0 | 1): void {
  if (playerIndex === null || dir === lastTurn) return;
  socket.emit('input:turn', playerIndex, dir);
  lastTurn = dir;
}

function pressState(): void {
  const l = padLeft.classList.contains('active');
  const r = padRight.classList.contains('active');
  if (l && !r) sendTurn(-1);
  else if (r && !l) sendTurn(1);
  else sendTurn(0);
}

function bindPad(el: HTMLElement): void {
  const down = (e: Event) => {
    e.preventDefault();
    el.classList.add('active');
    pressState();
  };
  const up = (e: Event) => {
    e.preventDefault();
    el.classList.remove('active');
    pressState();
  };
  el.addEventListener('touchstart', down, { passive: false });
  el.addEventListener('touchend', up, { passive: false });
  el.addEventListener('touchcancel', up, { passive: false });
  el.addEventListener('mousedown', down);
  el.addEventListener('mouseup', up);
  el.addEventListener('mouseleave', up);
}

bindPad(padLeft);
bindPad(padRight);

document.body.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

// Initialize body class for the starting Join screen so portrait mode is
// allowed immediately on page load (before any show() call).
show('join');

// --- Arena follow-cam render loop ---
// Keeps the visible canvas sized to its displayed box (respecting DPR) and
// draws a camera window each frame while we're in the Controller screen.
function resizeArenaCanvas(): void {
  const rect = arenaCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const targetW = Math.max(1, Math.floor(rect.width * dpr));
  const targetH = Math.max(1, Math.floor(rect.height * dpr));
  if (arenaCanvas.width !== targetW) arenaCanvas.width = targetW;
  if (arenaCanvas.height !== targetH) arenaCanvas.height = targetH;
}

function arenaFrame(): void {
  requestAnimationFrame(arenaFrame);
  if (screen !== 'controller' || !lastSnapshot || playerIndex === null) return;

  resizeArenaCanvas();

  // Camera target: my snake's head if alive / present, otherwise arena center.
  const mySnake = lastSnapshot.snakes.find(s => s.playerIndex === playerIndex);
  let cx = ARENA_WIDTH / 2;
  let cy = ARENA_HEIGHT / 2;
  if (mySnake && mySnake.segments.length > 0) {
    cx = mySnake.segments[0].x;
    cy = mySnake.segments[0].y;
  }

  const aspect = arenaCanvas.width / arenaCanvas.height;
  const viewH = CAMERA_VIEW_HEIGHT;
  const viewW = viewH * aspect;

  arenaRenderer.render(lastSnapshot, arenaCanvas, cx, cy, viewW, viewH);

  // Hide "waiting" overlay once the game is actually running.
  const playing = lastSnapshot.round.phase === 'playing';
  arenaMsg.style.display = playing ? 'none' : 'flex';
  if (!playing) {
    arenaMsg.textContent = lastSnapshot.round.phase === 'waiting'
      ? `round starting in ${Math.ceil(lastSnapshot.round.timeRemainingMs / 1000)}…`
      : 'round ended';
  }
}
requestAnimationFrame(arenaFrame);

socket.connect();
setStatus('Connecting…', false);
