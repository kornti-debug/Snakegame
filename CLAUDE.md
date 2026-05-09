# CLAUDE.md

## Project Overview
**Snake Arcade** — a multiplayer Snake game (Slither.io style, smooth curves) for a university exhibition (CAMI / BCC4 @ FH St. Polten). Projected on a wall, played with phones / keyboard / DDJ-400 controller, Twitch audience interaction via Touch Designer bridge. Two modes shipped, more planned (see `docs/IDEAS.md`):

- **Snake Memory** — reveal hidden tiles, capture pairs, most matches wins. Powerups, bonus pair → OP powerup, phone follow-cam.
- **Boid Battle** — stripped DDJ-friendly 1v1. No tiles, no powerups. Eat AI boids by touching them with your snake's head. Last alive wins; 90s timer with most-eaten as tiebreaker. Min 2 players.

Mode is picked in the main menu. `gameMode` flag on `GameRoom` gates which subsystems run (memory + powerups for Memory mode; just boid-eat for Boid Battle).

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
- **Mixed-input lobby**: any combination of phones + local inputs fills the 10 player slots. Local inputs are **opt-in** — each device self-registers the first time it's used, and auto-readies server-side (no "tap when ready" step for locals). Bindings: `wasd` (A/D turn, W powerup), `arrows` (◀/▶ turn, ▲ powerup), `gamepad-0` (left stick + A button), `midi-deck1` / `midi-deck2` (DDJ-400 left/right decks as separate players). Click the X on a lobby row to kick a slot; the device can re-register by being used again.
- **MIDI controller** via the `MidiHub` singleton + `MidiDeckProvider` lanes (Web MIDI API). See the DDJ-400 bullet below for the full subsystem. `?midi-debug` URL flag logs every incoming MIDI message. **Requires a secure origin** (localhost or HTTPS) — Web MIDI is gated by the Secure Contexts spec.
- `input:activate` (edge-triggered, one-shot on rising edge) replaces `input:boost` across all local inputs and matches the phone's slot-card tap. `input:boost` is vestigial.
- Canvas rendering with bezier curve snakes + eyes
- 5-canvas layer stack (background tiles, reveal mask, tile overlay, game objects, UI)
- **Memory card game** mechanic (configurable board: small 4×3/6 pairs → huge 7×6/20 pairs, 90% capture threshold, same-snake matching)
- Per-snake per-tile reveal tracking with visual breakdown bars
- Round management — **single-round** game. `RoundManager` cycles waiting → playing → ended → (returnToLobby instead of next round). Memory mode ends on board-complete or decisive-lead; Boid Battle ends on last-alive or 90s timer. Pre-round 'waiting' phase shown for `TUNING.round.waitTimeMs` (5s default).
- Power-up system with **slot mechanic**: `PowerUpDefinition.kind` is `'active'` or `'passive'`. Actives (SpeedBoost, WideTrail, Ghost, Star, SwarmLeader, Predator) queue into `snake.itemSlot` on pickup — if the slot is already full, the powerup is **not** collected (stays on the field). Player taps the phone's slot overlay to fire `input:activate`, which cancels any currently-running active effect and starts the slotted one. Only one active effect per snake at a time. Passives (Growth, Steering, Speed+) apply instantly and stack per round; they feed into `snake.baseSpeed` / `baseTurnRate` / `baseRevealRadius` so actives that modify these stats multiply the passive-boosted baseline and restore it on expire. Projector draws a small glyph badge above each snake's head for the queued item; phone shows an icon in its slot card and per-passive pills in the top HUD bar.
- **Bonus pair + OP powerups**: `MemoryPair.isBonus` marks one random pair per round (pulsing gold border + crown on its tiles). Matching it queues a random OP powerup into the matcher's slot — **overrides** any pending item (only exception to the no-overwrite rule). The three OP powerups (`spawnWeight: 0`, never on the field) target all OTHER living snakes: **Time Freeze** (3s, speed=0), **Lightning** (5s, half radius), **Cripple** (4s, 45% speed + 30% turn rate). `PowerUpDefinition.onApply/onExpire` now receive `(self, others)` so broadcast effects can reach every opponent.
- **Pre-reveal**: during the 'waiting' phase (3s first round, `ROUND_WAIT_TIME` subsequent) both the projector and phone skip drawing the reveal mask, so players see all tiles + the bonus pair before the round starts.
- **AI boid swarm** system (flocking with alpha/follower hierarchy, flee/follow behaviors)
- HUD with round timer, pair scores, match counter, powerup legend, winner overlay
- State interpolation (30Hz server → 60fps client, includes boid interpolation)
- Graceful server shutdown (Ctrl+C)
- Obstacle entity (for God Mode / external API)
- Lobby/menu system — main menu + instructions screen + exit confirm dialog, ambient flocking boids behind menus
- Board preset picker in lobby (small / medium / large / huge) via keys 1-4 or [ / ]
- Title: **SNAKE ARCADE** with mode picker (Snake Memory · Boid Battle · Instructions)
- **Boid Battle mode** — DDJ-friendly 1v1: no memory tiles, no powerups, no respawn. Snake heads consume boids on touch (`BoidSystem.consumeBoidsNearHead` returns the count, `Snake.boidsEaten` tracks it). Body-vs-boid is unchanged (still kills on head only since the boid collision check is head-only). Round ends when only one snake remains alive (`reason: 'last-alive'`) or after `BOID_BATTLE_DURATION_MS` (90s) elapses (`reason: 'timer'`, most-eaten wins). Min 2 players gate enforced both in lobby UI and in `GameRoom.startGame`.
- **Mode gating** — `GameRoom.gameMode: 'memory' | 'ddj-duel' | 'boid-battle'` (`'ddj-duel'` is legacy/inert; menu only exposes Memory + Boid Battle now). In boid-battle the playing-phase update skips: powerup spawn/lifecycle, reveal system, memory-board update, decisive-lead / board-complete checks, respawn timers, and tile rendering on the client (`Renderer` early-outs the BackgroundLayer/RevealLayer/TileOverlayLayer draws).
- **Audio** — BGM player (`BgmPlayer.ts`) loops the title soundtrack on menu screens and the in-game soundtrack during play, cross-fading 800ms on transitions. SFX engine (`SfxEngine.ts`) is fully procedural Web-Audio synthesis (no asset loading) — covers pickup / activate / match / bonus / death / freeze / lightning / cripple / round-start / round-end / menu-click / tile-capture / pair-neutralized. Both unlock on the first user gesture per the autoplay policy. User-supplied BGM lives in `packages/client/public/sounds/bgm/`; SFX folder exists with WhatsApp recordings staged but unused (procedural is good enough for now — see `docs/IDEAS.md`).
- **Eat-boid particles** — `Particles.ts` runs lightweight color-matched bursts on the main ctx (between game and UI layers, so they ride the screen-shake transform). Triggered from a `boidEaten` snapshot-diff event in `SnapshotEvents.ts` (detects `Snake.boidsEaten` increases between snapshots).
- **DDJ-400 MIDI input** (collaborator's branch, kept):
  - `MidiHub.shared()` is a singleton owning the Web MIDI access. Multiple `MidiDeckProvider` lanes register against it — both decks always wired, regardless of mode. Each lane consumes its own subset of the channel/CC/note space.
  - Jog wheel: pulse-rate intensity (50ms window), EMA smoothing, hysteresis around the 64 neutral value, scratch-stop release after 100ms of silence. Driven by `analogEnergyCcs` (CC 2) for extra "energy" pulses without direction.
  - Default mapping (overridable in `packages/client/public/ddj-midi.json`): jog wheel = CCs 33/34/35; PLAY/PAUSE = note 11 → both `activate` AND `brake` (same physical button); CUE = note 12 → `turbo`. Channels 0/1 = decks 1/2.
  - Server-side turbo/brake state machine on `Snake` (turbo = +75% speed, max 2s, then 400ms cooldown; brake = speed=0 for 500ms, 800ms cooldown). Tunable in `packages/server/config/tuning.json`.
  - When both decks register in the lobby, the client auto-assigns the two players to opposing teams 0/1.
- Single-round mode + game-over modal (`GameOverRenderer`): round-end always pops the modal (Restart / Main Menu) instead of looping into the next round. `gameOverPending` flag handles the case where the server returns to lobby on its 6s timer before the player clicks anything.
- **Phone join via QR** (`/phone.html`). Phone has three screens: Join (name entry, portrait OK), Settings (in-lobby: name / color / team picker + Ready button, landscape), Controller (left/right pads + follow-cam canvas of the arena centered on the player's snake, landscape). Auto-switches between Settings ↔ Controller based on `gamePhase`. `MAX_PLAYERS` = 10.
- **Phone reconnect resilience**: server holds dropped phones in a 10s grace window instead of evicting immediately. Phone persists a `clientId` in `localStorage['snakemem:clientId']`, includes it in `phone:join`, and emits `phone:reclaim({clientId})` on reconnect — if the slot is still in grace, the new socket is re-keyed to the existing lobby entry + live snake (score/position/color preserved). Snakes in grace render dimmed on the projector. `pingInterval: 10s` / `pingTimeout: 20s` on the socket.io server for faster drop detection. `createPhoneSocket()` uses an explicit `reconnection` config (500ms → 3s backoff, infinite attempts). Full-screen "Reconnecting…" overlay appears on the phone while the socket is down.
- **Phone follow-cam**: `PhoneArenaRenderer` reuses the projector's `BackgroundLayer` / `RevealLayer` / `TileOverlayLayer` / `GameLayer` classes to composite a 1920×1080 arena buffer, then blits a camera-centered window to the visible canvas. Camera follows the phone's own snake (matched via `SnakeState.playerIndex`), clamped to arena bounds. Zoom is fixed at `CAMERA_VIEW_HEIGHT = 540` arena pixels tall; width derived from canvas aspect.
- **Teams**: `LobbyPlayer.team` / `SnakeState.team` (null = solo) + `player:set-team` event. 4 team colors defined in `TEAM_COLORS` / `TEAM_NAMES`. Shown as a colored dot on the lobby player row and as a **team-colored halo ring around the snake's head** in-game. Teams don't affect gameplay yet (reserved for a follow-up).
- **Host controls (mouse + a few keys)**: lobby is mouse-driven — click a preset card to pick the board, click the red X on a player row to kick, click "START GAME" (or press Enter). ESC in-game pauses + opens a dialog (R resume, Y exit, ESC/N resume). ESC in the lobby returns to the main menu. Phones can't trigger pause/kick (server gates via `phoneSockets`).
- **External REST API** (`/api/external/*`) for Touch Designer integration
- **WebSocket namespace** (`/touchdesigner`) for real-time TD events
- Tile image management (built-in SVG defaults + TD override via API)
- **Twitch viewer credit economy** (join, team assignment, spend on powerups/obstacles/hints, earn by guessing)
- Hint system (pulsing gold border highlights matching tile pairs)
- Grid coordinate system (A1-P9, 16x9 cells)
- God Mode actions via API (place obstacles, spawn power-ups)

## What's Planned
- Touch Designer integration testing
- Cloud deployment on the campus PaaS (single-instance — server serves client static + socket.io on one port over HTTPS)
- Playtest Boid Battle with classmates → decide on shrinking-zone / BR layer (see `docs/IDEAS.md`)
- Possible single-player / co-op mode reusing the reveal-as-digging mechanic (treasure-hunt style)
- See `docs/IDEAS.md` for full parked-ideas list (sticky jog, second-button parity, BR zone, etc.)

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
