import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { io } from 'socket.io-client';
import { GameRoom } from '../packages/server/dist/GameRoom.js';
import { SocketManager } from '../packages/server/dist/network/SocketManager.js';

test('Node host still accepts keyboards and phones using the shared handlers', async (t) => {
  const http = createServer();
  const room = new GameRoom();
  const manager = new SocketManager(http, room);
  t.after(() => manager.io.close());
  await new Promise((resolve) => http.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${http.address().port}`;
  const host = io(url, { autoConnect: false, transports: ['websocket'] });
  const phone = io(url, { autoConnect: false, transports: ['websocket'] });
  t.after(() => { host.disconnect(); phone.disconnect(); });
  const hostConnected = once(host, 'connect');
  const phoneConnected = once(phone, 'connect');
  host.connect();
  phone.connect();
  await Promise.all([hostConnected, phoneConnected]);

  const hostJoined = once(host, 'host:joined');
  host.emit('host:join-local', { name: 'Keyboard', binding: 'wasd' });
  assert.equal((await hostJoined)[0].playerIndex, 0);
  const phoneJoined = once(phone, 'phone:joined');
  phone.emit('phone:join', { name: 'Phone', clientId: 'test-phone' });
  assert.equal((await phoneJoined)[0].playerIndex, 1);
  phone.emit('player:ready', 1);
  // Follow-up messages arrive in order on each connection.
  phone.emit('player:set-name', 1, 'Ready Phone');
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Phone did not become ready')), 2000);
    const timer = setInterval(() => {
      if (!room.getLobbyPlayers().some((p) => p.name === 'Ready Phone' && p.ready)) return;
      clearTimeout(timeout);
      clearInterval(timer);
      resolve();
    }, 10);
    t.after(() => clearInterval(timer));
  });
  room.startGame();
  const started = once(host, 'game:round-start');
  const snapshot = once(host, 'game:snapshot');
  manager.broadcastSnapshot();
  assert.equal((await started)[0].tiles.length, 20);
  assert.equal((await snapshot)[0].snakes.length, 2);
});
