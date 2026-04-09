# Architecture

## Overview

TypeScript monorepo with three packages:

```
packages/
  shared/   ← Pure types, constants, math utils (no runtime deps)
  server/   ← Authoritative game server (Node.js, 30Hz tick)
  client/   ← Browser renderer + input (Vite + Canvas, 60fps)
```

The game server is **authoritative** — all game state is computed server-side. The client only sends input and renders snapshots.

## System Diagram

```
┌─────────────────────────────────────────────────────┐
│                    Game Server                       │
│                                                      │
│  GameLoop (30Hz)                                     │
│    ├── MovementSystem     (snake positions)           │
│    ├── CollisionSystem    (snake/boid/obstacle kills) │
│    ├── RevealSystem       (bitmask grid, per-snake)   │
│    ├── MemoryBoardSystem  (tile capture + matching)   │
│    ├── BoidSystem         (AI flocking swarm)         │
│    ├── PowerUpSystem      (6 powerups, plugin-based)  │
│    └── CreditSystem       (Twitch viewer economy)     │
│                                                      │
│  GameRoom ←→ RoundManager (waiting/playing/ended)    │
│  SocketManager ←→ socket.io ←→ Browser Client        │
│  ExternalRouter ←→ REST/WS ←→ Touch Designer         │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                   Browser Client                     │
│                                                      │
│  InputManager                                        │
│    ├── KeyboardProvider (WASD / Arrows)               │
│    └── GamepadProvider  (Gamepad API)                 │
│                                                      │
│  InterpolationBuffer (smooth 60fps from 30Hz)        │
│                                                      │
│  Renderer (5 Canvas layers)                          │
│    ├── BackgroundLayer   (tile images)                │
│    ├── RevealLayer       (opaque mask w/ holes)       │
│    ├── TileOverlayLayer  (borders, capture, hints)    │
│    ├── GameLayer         (snakes, boids, powerups)    │
│    └── UILayer           (HUD, scores, legend)        │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│             Touch Designer (External)                │
│                                                      │
│  Twitch Chat ←→ Bot                                 │
│  Stream Diffusion ←→ AI Image Generation             │
│  OBS ←→ Stream Output                               │
│                                                      │
│  Connects to Game Server via REST + WebSocket        │
└─────────────────────────────────────────────────────┘
```

## Key Systems

### Memory Board System
Manages the 5x4 tile grid (20 tiles, 10 pairs). Uses a **block-to-tile lookup table** (`Uint8Array`) for O(1) mapping of reveal-grid blocks to tiles. Tracks per-tile per-snake reveal counts, detects captures at 90% threshold, and checks pair matching (same-snake requirement).

### Boid (AI Swarm) System
Implements Craig Reynolds' flocking algorithm with an **alpha/follower** hierarchy:
- **Alpha boids**: Wander freely, drive group movement, ignore cohesion
- **Follower boids**: Follow nearest alpha via attraction + alignment, flock with each other
- **Snake interaction**: Flee from player snakes, follow Swarm Leader powerup holders
- Performance: O(n²) naive approach, <0.5ms per tick for 30 boids at 30Hz

### Reveal System
480x270 block grid (4px per block). Each block stores the snake index that revealed it (not just 0/1). Supports `revealAt(x, y, radius, snakeId)` for boid-driven reveals. Delta compression sends only changed blocks to clients.

### Credit System
Manages Twitch viewer economy: team auto-assignment (round-robin), credit balance, spending validation. Persists across rounds within a session.

## Key Design Decisions

### Server-Authoritative Model
All game logic runs on the server. Client sends only input (turn direction) and renders snapshots. Prevents cheating, keeps clients in sync.

### Tick Rate: 30Hz Server, 60fps Client
- Server updates 30x/sec, broadcasts snapshots
- Client interpolates between two most recent snapshots for smooth 60fps
- Boid positions also interpolated for fluid movement

### 5-Layer Canvas Rendering
Separate offscreen canvases composited each frame:
1. **BackgroundLayer**: Tile images, drawn once per round
2. **RevealLayer**: Opaque mask, holes via `destination-out` compositing
3. **TileOverlayLayer**: Tile borders, capture states, hint animations
4. **GameLayer**: Snakes, boids, powerups, obstacles — redrawn every frame
5. **UILayer**: HUD, pair scores, match counter, powerup legend

### Plugin-Based Power-Ups
Each powerup is a separate file implementing `PowerUpDefinition`:
```typescript
{ id, displayName, spawnWeight, duration, onApply(snake), onExpire(snake), renderHint }
```
Registration: one `registry.register()` call in PowerUpSystem constructor.

### External API for Touch Designer
- **REST API** (`/api/external/`) — state queries, tile management, viewer actions, god mode
- **WebSocket namespace** (`/touchdesigner`) — real-time events (round lifecycle, captures, matches)

## Data Flow

### Input → Render
```
KeyPress → KeyboardProvider.poll() → InputManager
  → socket.emit('input:turn', playerIndex, direction)
  → Server: snake.turnDirection = direction
  → Server tick: Movement → Collision → Reveal → MemoryBoard → Boids → PowerUps
  → Server: broadcast snapshot at 30Hz
  → Client: InterpolationBuffer.push(snapshot)
  → Client: requestAnimationFrame → interpolate → Renderer.render()
```

### Memory Card Flow
```
Round start → MemoryBoardSystem.generateBoard(symbols)
  → Tiles placed in 5x4 grid, block-to-tile lookup built
  → Client loads tile images at grid positions
Each tick:
  → RevealSystem marks blocks, MemoryBoard attributes to tiles/snakes
  → Tile at 90%+ → captured by top-contributing snake
  → Both tiles of pair captured by same snake → pair matched, +1 point
  → All 10 pairs matched → round ends early
```

## Implementation Status

| Feature | Status |
|---------|--------|
| Snake movement + smooth curves | Done |
| Collision (snake/wall/self/obstacle/boid) | Done |
| Image reveal (bitmask grid) | Done |
| Memory card game (tiles, capture, matching) | Done |
| AI boid swarm (flocking, alpha/follower) | Done |
| 6 power-ups (speed, wide, ghost, star, swarm, predator) | Done |
| 5-layer canvas rendering | Done |
| Lobby/menu system | Done |
| External REST API + WebSocket | Done |
| Twitch credit economy (join, spend, earn) | Done |
| Hint system (highlight matching pairs) | Done |
| Touch Designer integration testing | Pending |
| Visual polish + animations | In Progress |
| Sound effects | Planned |
