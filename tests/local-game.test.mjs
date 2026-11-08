import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LocalGameClient } from '../packages/server/dist/browser.js';
import { GameRoom } from '../packages/server/dist/GameRoom.js';
import { ImageManager } from '../packages/server/dist/api/ImageManager.js';

function nextEvent(client, event, matches = () => true) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), 2500);
    client.on(event, (payload) => {
      if (!matches(payload)) return;
      clearTimeout(timeout);
      resolve(payload);
    });
  });
}

async function localGame(t) {
  const client = new LocalGameClient();
  t.after(() => client.disconnect());
  const ready = nextEvent(client, 'connect');
  client.connect();
  await ready;
  return client;
}

test('local lobby allocates distinct ready slots and preserves old snapshots', async (t) => {
  const client = await localGame(t);
  const joined = [];
  client.on('host:joined', (player) => joined.push(player));
  client.emit('host:join-local', { name: 'WASD', binding: 'wasd' });
  client.emit('host:join-local', { name: 'Arrows', binding: 'arrows' });
  const before = await nextEvent(client, 'game:snapshot', (s) => s.lobbyPlayers.length === 2);
  assert.deepEqual(joined.map((p) => p.playerIndex), [0, 1]);
  assert.ok(before.lobbyPlayers.every((p) => p.ready));
  assert.notEqual(joined[0].color, joined[1].color);
  client.emit('player:set-name', 0, 'Changed');
  const after = await nextEvent(client, 'game:snapshot', (s) => s.lobbyPlayers[0].name === 'Changed');
  assert.equal(before.lobbyPlayers[0].name, 'WASD');
  assert.equal(after.lobbyPlayers[1].name, 'Arrows');
});

test('memory mode emits browser-safe tiles, pause state, and supports restarting', async (t) => {
  const client = await localGame(t);
  client.emit('host:join-local', { name: 'Player', binding: 'wasd' });
  client.emit('lobby:set-config', { preset: 'small' });
  const round = nextEvent(client, 'game:round-start');
  const started = nextEvent(client, 'game:snapshot', (s) => s.gamePhase === 'ingame');
  client.emit('lobby:start-game');
  const { tiles } = await round;
  assert.equal(tiles.length, 12);
  assert.ok(tiles.every((tile) => tile.imageUrl.startsWith('data:image/svg+xml;')));
  const state = await started;
  assert.equal(state.boardPreset, 'small');
  assert.equal(state.snakes.length, 1);

  client.emit('game:set-paused', true);
  const paused = await nextEvent(client, 'game:snapshot', (s) => s.paused);
  const later = await nextEvent(client, 'game:snapshot', (s) => s.tick > paused.tick);
  assert.deepEqual(later.snakes, paused.snakes);
  assert.equal(later.round.timeRemainingMs, paused.round.timeRemainingMs);
  client.emit('game:set-paused', false);
  await nextEvent(client, 'game:snapshot', (s) => !s.paused);

  client.emit('lobby:return');
  const lobby = await nextEvent(client, 'game:snapshot', (s) => s.gamePhase === 'lobby');
  assert.equal(lobby.lobbyPlayers.length, 0);
  client.emit('host:join-local', { name: 'Restarted', binding: 'wasd' });
  const restarted = nextEvent(client, 'game:round-start');
  client.emit('lobby:start-game');
  assert.equal((await restarted).roundNumber, 1);
});

test('Boid Battle requires two players and has no memory tiles', async (t) => {
  const client = await localGame(t);
  client.emit('lobby:set-game-mode', 'boid-battle');
  client.emit('host:join-local', { name: 'One', binding: 'wasd' });
  client.emit('lobby:start-game');
  assert.equal((await nextEvent(client, 'game:snapshot')).gamePhase, 'lobby');
  client.emit('host:join-local', { name: 'Two', binding: 'arrows' });
  const started = nextEvent(client, 'game:round-start');
  const ingame = nextEvent(client, 'game:snapshot', (s) => s.gamePhase === 'ingame');
  client.emit('lobby:start-game');
  assert.deepEqual((await started).tiles, []);
  const state = await ingame;
  assert.equal(state.gameMode, 'boid-battle');
  assert.equal(state.snakes.length, 2);
});

test('each local client has an independent game', async (t) => {
  const one = await localGame(t);
  const two = await localGame(t);
  one.emit('host:join-local', { name: 'One' });
  const first = await nextEvent(one, 'game:snapshot');
  const second = await nextEvent(two, 'game:snapshot');
  assert.equal(first.lobbyPlayers.length, 1);
  assert.equal(second.lobbyPlayers.length, 0);
});

test('shared game handles steering, reveals, active powerups, and round-end events', () => {
  const room = new GameRoom();
  const slot = room.localJoin('host', 'Player');
  room.startGame();
  const snake = room.getSnake('host', slot.index);
  // Fix the initial position so collisions and boids cannot make this flaky.
  snake.respawn({ x: 600, y: 500 }, 0);
  room.boidSystem.reset();
  room.roundManager.startRound();
  snake.turnDirection = 1;
  const angle = snake.angle;
  room.update(1 / 30);
  assert.ok(snake.angle > angle);
  assert.ok(room.revealSystem.flushDelta());
  snake.itemSlot = 'ghost';
  room.powerUpSystem.activateSlot(snake, room.getAllSnakes());
  assert.equal(snake.ghosting, true);
  assert.equal(snake.itemSlot, null);
  room.forceEndRoundWithNotification('admin');
  assert.ok(room.pendingEvents.some((e) => e.type === 'round-end' && e.reason === 'admin'));
});

test('image handling works in memory and with injected Node storage', () => {
  const browser = new ImageManager();
  assert.equal(browser.setNextImage(null, 'star', 'YWJj'), 'data:image/png;base64,YWJj');
  assert.equal(browser.startRound().imageUrl, 'data:image/png;base64,YWJj');
  assert.equal(browser.checkGuess(' STAR '), true);
  const saved = [];
  const node = new ImageManager((base64) => { saved.push(base64); return '/uploads/test.png'; });
  assert.equal(node.setNextImage(null, 'star', 'YWJj'), '/uploads/test.png');
  assert.deepEqual(saved, ['YWJj']);
});
