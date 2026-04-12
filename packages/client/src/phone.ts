import { createSocket } from './network/ClientSocket.js';

// Phone controller: virtual gamepad. Connects, requests a free slot, then
// sends input:turn based on left/right tap-and-hold. No game rendering —
// the player watches the projected arena.

const socket = createSocket();

const statusDot = document.getElementById('status-dot')!;
const statusText = document.getElementById('status-text')!;
const joinScreen = document.getElementById('join-screen')!;
const controller = document.getElementById('controller')!;
const errorScreen = document.getElementById('error-screen')!;
const errorMsg = document.getElementById('error-msg')!;
const nameInput = document.getElementById('name-input') as HTMLInputElement;
const joinBtn = document.getElementById('join-btn') as HTMLButtonElement;
const padLeft = document.getElementById('pad-left')!;
const padRight = document.getElementById('pad-right')!;

let playerIndex: number | null = null;
let playerColor = '#44aaff';
let connected = false;
let lastTurn: -1 | 0 | 1 = 0;

function setStatus(text: string, ok: boolean): void {
  statusText.textContent = text;
  statusDot.classList.toggle('connected', ok);
}

function show(el: 'join' | 'controller' | 'error'): void {
  joinScreen.classList.toggle('hidden', el !== 'join');
  controller.classList.toggle('hidden', el !== 'controller');
  errorScreen.style.display = el === 'error' ? 'flex' : 'none';
}

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
  playerColor = color;
  setStatus(`Player ${idx + 1} · tap-and-hold to turn`, true);
  controller.style.setProperty('--accent', color);
  padLeft.style.borderColor = color;
  padRight.style.borderColor = color;
  show('controller');
});

socket.on('phone:join-error', ({ reason }) => {
  errorMsg.textContent = reason;
  show('error');
});

joinBtn.addEventListener('click', () => {
  if (!connected) return;
  socket.emit('phone:join', { name: nameInput.value.trim() || undefined });
  joinBtn.disabled = true;
  joinBtn.textContent = 'Joining…';
});

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

// Prevent pull-to-refresh / double-tap zoom / page scroll
document.body.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

socket.connect();
setStatus('Connecting…', false);
