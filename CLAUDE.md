# CLAUDE.md

## Project Overview
**Snake Memory** — a multiplayer Snake game (Slither.io style, smooth curves) crossed with a memory-match card game, for a university exhibition (CAMI / BCC4 @ FH St. Polten). Projected on wall, 2+ local players, Twitch audience interaction via Touch Designer bridge.

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
- Collision system (snake-vs-snake, snake-vs-wall, self-collision, snake-vs-obstacle, snake-vs-boid)
- Ghost mode (pass through snakes/boids, semi-transparent rendering)
- Auto-respawn after 2 seconds
- Keyboard input (WASD + Arrows for 2 players)
- Gamepad input provider (ready, not actively used yet)
- Canvas rendering with bezier curve snakes + eyes
- 5-canvas layer stack (background tiles, reveal mask, tile overlay, game objects, UI)
- **Memory card game** mechanic (configurable board: small 4×3/6 pairs → huge 7×6/20 pairs, 90% capture threshold, same-snake matching)
- Per-snake per-tile reveal tracking with visual breakdown bars
- Round management (waiting → playing → ended → repeat, 120s rounds)
- Power-up system: SpeedBoost, WideTrail, Ghost, Star, SwarmLeader, Predator (plugin registry)
- **AI boid swarm** system (flocking with alpha/follower hierarchy, flee/follow behaviors)
- HUD with round timer, pair scores, match counter, powerup legend, winner overlay
- State interpolation (30Hz server → 60fps client, includes boid interpolation)
- Graceful server shutdown (Ctrl+C)
- Obstacle entity (for God Mode / external API)
- Lobby/menu system — main menu + instructions screen + exit confirm dialog, ambient flocking boids behind menus
- Board preset picker in lobby (small / medium / large / huge) via keys 1-4 or [ / ]
- Title: **SNAKE MEMORY**
- **Phone-join (Phase 1)**: QR code in lobby points to `/phone.html`; phone clients act as virtual gamepads (tap-and-hold left/right zones → `input:turn`). Auto-allocates the lowest free slot (max 4 players, keyboard + phones mix).
- **External REST API** (`/api/external/*`) for Touch Designer integration
- **WebSocket namespace** (`/touchdesigner`) for real-time TD events
- Tile image management (built-in SVG defaults + TD override via API)
- **Twitch viewer credit economy** (join, team assignment, spend on powerups/obstacles/hints, earn by guessing)
- Hint system (pulsing gold border highlights matching tile pairs)
- Grid coordinate system (A1-P9, 16x9 cells)
- God Mode actions via API (place obstacles, spawn power-ups)

## What's Planned
- Touch Designer integration testing
- Visual polish — capture/match animations, death effects
- Sound effects
- Stream overlay data
- Powerup slot system (1 active slot + stacking passives, manual activation button, "Steering" passive)
- Input expansion: gamepad auto-detect, MIDI provider
- Phone-join Phase 2: on-phone game view (slither.io-style follow camera), personal HUD, active-powerup button
- Phone-join Phase 3: larger arena enabled by per-player phone view

## External API (Touch Designer)

### REST Endpoints (`/api/external/`)

| Method | Endpoint | Body | Purpose |
|--------|----------|------|---------|
| GET | `/state` | — | Full game state (incl. memory board, hints) |
| GET | `/reveal-percentage` | — | Current reveal % |
| GET | `/memory/board` | — | Memory board state (tiles, pairs, scores) |
| POST | `/tiles` | `{ tiles: [{ symbolName, imageUrl?, imageBase64? }] }` | Set custom tile images |
| POST | `/image` | `{ imageUrl, word, imageBase64? }` | Legacy: queue single image |
| POST | `/guess` | `{ viewerName, guess }` | Guess a symbol name |
| POST | `/viewer/join` | `{ viewerName }` | Register viewer, auto-assign team |
| POST | `/viewer/action` | `{ viewerName, action, params }` | Spend credits (hint/powerup/obstacle) |
| POST | `/viewer/guess` | `{ viewerName, symbolName }` | Guess symbol for credits |
| GET | `/viewer/:name` | — | Get viewer state (credits, team) |
| POST | `/god/obstacle` | `{ cell: "D5", durationMs? }` | Place obstacle at grid cell |
| POST | `/god/powerup` | `{ cell: "H3", type }` | Spawn power-up at grid cell |
| POST | `/round/start` | — | Force start round/game |
| POST | `/round/end` | — | Force end current round |

### WebSocket Namespace (`/touchdesigner`)
Auth: `{ auth: { apiKey: "your-key" } }` (set `API_KEY` env var on server)

**Server → TD events:**
- `event:round-start` → `{ roundNumber, tiles }`
- `event:round-end` → `{ roundNumber, winner, scores, pairScores }`
- `event:tile-captured` → `{ tileId, capturedBy, symbolName }`
- `event:pair-matched` → `{ pairId, symbolName, matchedBy }`
- `event:reveal-milestone` → `{ percentage }` (at 25/50/75/90%)

**TD → Server commands:**
- `command:set-image` → `{ imageUrl, word, imageBase64? }`
- `command:guess` → `{ viewerName, guess }`
- `command:god-obstacle` → `{ cell, durationMs? }`
- `command:god-powerup` → `{ cell, type }`

### Grid System
Arena (1920x1080) divided into 16×9 cells (120×120px each). Columns A-P, rows 1-9. Example: `D5` = center of column D, row 5 = pixel (420, 540).

### Memory Tile Grid
Board is preset-driven (chosen in lobby, sent via `lobby:set-config` socket event, echoed in `GameSnapshot.boardPreset`). Defined in `BOARD_PRESETS` in `packages/shared/src/constants.ts`:

| Preset  | Grid | Pairs | Tile size |
|---------|------|-------|-----------|
| small   | 4×3  | 6     | 240×240   |
| medium  | 5×4  | 10    | 240×240   | *(default)*
| large   | 6×5  | 15    | 200×200   |
| huge    | 7×6  | 20    | 160×160   |

Layout is auto-centered in the 1920×1080 arena with 8px gaps. Tiles use built-in SVG symbols by default. Override via `POST /tiles`.
