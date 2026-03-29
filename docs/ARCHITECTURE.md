# Architecture

## Overview

The project is a TypeScript monorepo with three packages:

```
packages/
  shared/   ← Pure types, constants, math utils (no runtime deps)
  server/   ← Authoritative game server (Node.js)
  client/   ← Browser renderer + input (Vite + Canvas)
```

The game server is **authoritative** — all game state (movement, collisions, scoring) is computed server-side. The client only sends input and renders what the server tells it.

## System Diagram

```
┌─────────────────────────────────────────────────┐
│                  Game Server                     │
│                                                  │
│  GameLoop (30Hz)                                 │
│    ├── MovementSystem  (update snake positions)  │
│    ├── CollisionSystem (detect kills)            │
│    ├── RevealSystem    (track revealed pixels)   │ ← Phase 3
│    ├── PowerUpSystem   (spawn/apply/expire)      │ ← Phase 4
│    └── GodModeSystem   (Twitch viewer actions)   │ ← Phase 5
│                                                  │
│  SocketManager ←→ socket.io ←→ Browser Client    │
│  ExternalRouter ←→ REST/WS ←→ Touch Designer    │ ← Phase 5
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│                 Browser Client                   │
│                                                  │
│  InputManager                                    │
│    ├── KeyboardProvider (WASD / Arrows)          │
│    └── GamepadProvider  (Gamepad API)            │
│                                                  │
│  InterpolationBuffer (smooth 60fps from 30Hz)    │
│                                                  │
│  Renderer (Canvas layers)                        │
│    ├── BackgroundLayer  (hidden image)           │ ← Phase 3
│    ├── RevealLayer      (opaque mask w/ holes)   │ ← Phase 3
│    ├── GameLayer        (snakes, powerups)        │
│    └── UILayer          (HUD, scores)            │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│           Touch Designer (External)              │
│                                                  │
│  Twitch Chat ←→ Bot                             │
│  Stream Diffusion ←→ AI Image Generation         │
│  OBS ←→ Stream Output                           │
│                                                  │
│  Connects to Game Server via REST + WebSocket    │
└─────────────────────────────────────────────────┘
```

## Key Design Decisions

### Server-Authoritative Model
All game logic runs on the server. The client sends only input (turn direction) and renders the state snapshots it receives. This prevents cheating and keeps all clients in sync.

### Tick Rate: 30Hz Server, 60fps Client
- Server updates game state 30 times per second
- Client renders at 60fps using `requestAnimationFrame`
- Client **interpolates** between the two most recent server snapshots for smooth visuals
- Input is sent only when it changes (not every frame)

### Multiple Local Players Per Socket
Since this is an exhibition setup, multiple players share one browser. A single socket.io connection handles all local players, with each input event tagged by `playerIndex`.

### Canvas Layer Stack (Phase 3)
Four separate `<canvas>` elements stacked via CSS, rather than one canvas:
- **BackgroundLayer**: Hidden image, drawn once per round
- **RevealLayer**: Opaque mask, holes punched via `globalCompositeOperation: 'destination-out'`
- **GameLayer**: Snakes/powerups, cleared + redrawn every frame at 60fps
- **UILayer**: HUD, only redrawn on data change

This avoids redrawing the mask and background every frame.

### Plugin-Based Power-Ups (Phase 4)
Power-ups are registered via a `PowerUpRegistry`:
```typescript
registry.register({
  id: 'speed-boost',
  spawnWeight: 10,
  duration: 5000,
  onApply(snake, game) { snake.speed *= 1.5; },
  onExpire(snake, game) { snake.speed /= 1.5; },
  renderHint: { color: '#ffaa00', icon: 'bolt', shape: 'circle' },
});
```
New power-ups = new file + one `register()` call. No existing code changes needed.

### Input Provider Pattern
All input devices implement `InputProvider`:
```typescript
interface InputProvider {
  id: string;
  type: string;
  isConnected(): boolean;
  poll(): InputState;  // { turnDirection: -1|0|1, boost: boolean }
  destroy(): void;
}
```
Adding a new input device (MIDI controller, dance pad, etc.) = implement this interface.

### External API for Touch Designer (Phase 5)
The game exposes:
- **REST API** (`/api/external/`) — for commands and state polling
- **WebSocket namespace** (`/touchdesigner`) — for real-time events

This keeps the game engine independent from Twitch/AI concerns. Touch Designer is the bridge.

## Data Flow

### Input → Server → Render
```
KeyPress → KeyboardProvider.poll() → InputManager
  → socket.emit('input:turn', playerIndex, direction)
  → Server: snake.turnDirection = direction
  → Server: MovementSystem.update() moves snake
  → Server: snapshot broadcast at 30Hz
  → Client: InterpolationBuffer.push(snapshot)
  → Client: requestAnimationFrame → interpolate → Renderer.render()
```

### Image Reveal (Phase 3)
```
Server: RevealSystem tracks bitmask grid (4x4px blocks)
  → Snake head moves → mark blocks as revealed
  → Send delta (newly revealed blocks) to client
Client: RevealLayer punches holes in opaque mask
  → Background image shows through
Server: Calculates reveal % → available via API for Touch Designer
```

## Implementation Phases

| Phase | What                    | Status  |
|-------|------------------------|---------|
| 1     | Movement + Rendering   | Done    |
| 2     | Collisions + Gamepad   | Done    |
| 3     | Image Reveal Mechanic  | Planned |
| 4     | Power-Up System        | Planned |
| 5     | External API (Touch Designer) | Planned |
| 6     | Polish + Exhibition    | Planned |
