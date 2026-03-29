# CLAUDE.md

## Project Overview
Multiplayer Snake game (Slither.io style, smooth curves) for a university exhibition (CAMI / BCC4 @ FH St. Polten). Projected on wall, 2+ local players, Twitch audience interaction via Touch Designer bridge.

## Build & Run

```bash
# Install
npm install

# Build shared types (required before server/client)
npm run build --workspace=packages/shared

# Dev server (port 3000)
npm run dev:server

# Dev client (port 5173, proxies /socket.io to server)
npm run dev:client
```

## Project Structure
- `packages/shared/` — Types, constants, math utils. No runtime deps. Build with `npm run build --workspace=packages/shared`.
- `packages/server/` — Authoritative game server. 30Hz tick. Express + socket.io. Run with `tsx watch`.
- `packages/client/` — Browser client. HTML5 Canvas, Vite dev server. 60fps rendering with interpolation.
- `docs/GAME_DESIGN.md` — Full game concept and mechanics.
- `docs/ARCHITECTURE.md` — Technical architecture and design decisions.

## Key Conventions
- Monorepo with npm workspaces. Shared package must be built before server/client can import from it.
- Server is authoritative — all game logic server-side. Client sends input, renders state.
- Multiple local players per socket connection, identified by `playerIndex`.
- Input providers implement `InputProvider` interface (poll-based, not event-based).
- Power-ups use plugin registry pattern (`PowerUpRegistry.register()`).
- External services (Touch Designer, Twitch) connect via REST API + WebSocket namespace — the game does NOT handle Twitch directly.
- Scoring is based on **area revealed** (blocks), not kills. Kills are tactical (dead = not revealing).

## What's Implemented
- Snake movement with continuous smooth curves (angle + turn rate)
- Collision system (snake-vs-snake, snake-vs-wall, self-collision, snake-vs-obstacle)
- Ghost mode (pass through snakes, semi-transparent rendering)
- Auto-respawn after 2 seconds
- Keyboard input (WASD + Arrows for 2 players)
- Gamepad input provider (ready, not actively used yet)
- Canvas rendering with bezier curve snakes + eyes
- 4-canvas layer stack (background image, reveal mask, game objects, UI)
- Image reveal mechanic (bitmask grid, destination-out compositing)
- Per-snake reveal tracking and scoring
- Round management (waiting → playing → ended → repeat, 90s rounds)
- Power-up system: SpeedBoost, WideTrail, Ghost (plugin registry pattern)
- HUD with round timer, reveal scores, winner overlay
- State interpolation (30Hz server → 60fps client)
- Graceful server shutdown (Ctrl+C)
- Obstacle entity (for God Mode / external API)

## What's Planned
- Phase 5: External API for Touch Designer (REST + WebSocket) — God Mode, image push, guess checking
- Phase 6: Polish — lobby screen, visual effects, death animations, sound
