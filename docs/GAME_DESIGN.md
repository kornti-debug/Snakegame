# Game Design Document — Snake Memory

## Concept

**Snake Memory** — a multiplayer Snake game for interactive exhibitions (CAMI / BCC4 @ FH St. Polten). Projected on a wall, 2+ local players compete while a Twitch audience participates remotely through chat with a credit-based economy.

The core mechanic: a **memory card game** — the arena contains a grid of tiles (matching pairs) covered by an opaque layer. As snakes move, they reveal the hidden tile images. Capture tiles by revealing 90%+ and match pairs to score points. Board size is picked in the lobby (preset cards: small / medium / large / huge — 6 to 20 pairs). Twitch viewers earn credits by guessing symbols and spend them to influence the game.

## Exhibition Setup

```
 [Projector/Beamer]
        |
        v
 +--------------+
 |  Game Screen  |  <-- projected on wall
 |  (Browser)    |
 +--------------+
        ^
 [Game PC] ---- [Touch Designer PC]
    |                    |
 [Controllers]     [Twitch Chat]
 [Keyboard]        [Stream Diffusion]
```

- **Game PC**: Runs game server + client in fullscreen browser
- **Touch Designer**: Handles Twitch chat, AI image generation, stream output
- **Players**: 2+ local players using keyboard or game controllers
- **Audience**: Twitch viewers interacting through chat

## Core Mechanics

### Snake Movement
- Smooth, continuous movement (not grid-based)
- Players control turning direction (left/right), snake always moves forward
- Constant speed, fixed turn rate (creates natural curves)

### Collision Rules
- **Head hits another snake's body** → you die, other player scores a kill
- **Head-on collision** → both die
- **Hit the arena wall** → you die
- **Self-collision** → you die (with generous head-skip to avoid false positives)
- **Hit a boid (AI fish)** → you die (unless ghosting or starred)

### Death & Respawn
- Auto-respawn after 2 seconds at random position
- Scores persist across deaths within a round

## Memory Card Game Mechanic

### How It Works
1. Arena (1920x1080) contains a **configurable grid of tiles** (preset small 4×3 → huge 7×6, auto-centered)
2. Each tile has a matching partner somewhere else (6 to 20 pairs depending on preset)
3. Tiles are covered by an opaque mask — snakes reveal them by moving over them
4. When a snake reveals **90%+** of a tile, it's **captured** by whoever revealed the most
5. When the **same snake** captures both tiles of a pair, the pair is **matched** and they score a point
6. Winner = most matched pairs when the round ends

### Tile Images
- **Built-in defaults**: 10 SVG symbols (star, heart, diamond, circle, moon, lightning, flower, crown, flame, music)
- **Touch Designer override**: Custom images can be pushed via API before each round

### Per-Tile Reveal Tracking
- Each tile shows a progress bar with colored segments per snake
- Dashed line at 90% threshold shows how close to capture
- Captured tiles glow in the capturer's snake color
- Matched pairs have a bright, thick border in the capturing snake's color

## AI Boid Swarm System

### Overview
Small AI-controlled fish-like entities roam the arena using **flocking behavior** (Craig Reynolds' boids algorithm). They act as dynamic obstacles that players must avoid.

### Behavior
- **Alpha boids** lead each group, wandering freely across the arena
- **Follower boids** follow their group's alpha via alignment and attraction
- Groups naturally merge when alphas get close
- Boids **flee** from nearby player snakes (150px fear radius)
- Spawn: 4 groups of 3 at round start, new groups of 3 every 15 seconds, max 30

### Interaction with Players
- Colliding with a wild boid **kills your snake** (like hitting a wall)
- Boids following a **Swarm Leader** are friendly (no collision with that snake)
- **Starred** snakes destroy boids on contact
- **Predator** powerup makes boids flee from a larger radius (250px)

## Power-Ups

Power-ups spawn randomly every 8 seconds (max 3 on field). Collected by passing over them.

| Power-Up | Icon | Effect | Duration | Spawn Weight |
|----------|------|--------|----------|-------------|
| Speed Boost | ⚡ | 1.5x movement speed | 5s | 10 |
| Wide Trail | ◎ | 2.5x reveal radius | 5s | 8 |
| Ghost | 👻 | Pass through snakes and boids | 3s | 5 |
| Star | ⭐ | Invincible + kills other snakes/boids on touch, rainbow effect | 5s | 3 (rare) |
| Swarm Leader | 🐟 | Nearby boids follow you and reveal tiles for your team | 8s | 4 |
| Predator | 🦈 | Boids flee from you with 250px radius (vs normal 150px) | 6s | 5 |

The power-up system is plugin-based — new power-ups = new file + one `register()` call.

## Twitch Viewer Credit Economy

### How Viewers Participate
1. Viewer joins chat → auto-assigned to a snake team (round-robin, least-populated team)
2. Receives **100 initial credits**
3. Can spend credits to influence the game
4. Can earn more credits by guessing symbols

### Spending Credits
| Action | Cost | Effect |
|--------|------|--------|
| Place obstacle | 20 | Drops a hazard block at a grid cell |
| Spawn powerup | 30 | Spawns a specific powerup at a grid cell |
| Hint | 40 | Highlights both tiles of a matching pair with pulsing gold border for 8s |

### Earning Credits
| Action | Reward | How |
|--------|--------|-----|
| Correct symbol guess | 50 | Guess one of the active symbol names (`!guess star`) |
| Joining | 100 | Automatic on first join |

Credits earnable per round scale with pair count (e.g. 10 pairs = up to 500 credits).

## Round Flow

```
1. [WAITING]    → 5s countdown, players position
2. [PLAYING]    → 120s round, snakes reveal tiles, boids roam
                  Tiles captured at 90%, pairs matched by same snake
                  Round ends at timer OR when all pairs matched
3. [ENDED]      → 4s scoreboard, winner announced
4. → Back to [WAITING] with new tile layout
```

## Twitch Integration

All Twitch interaction flows through Touch Designer as a bridge:

```
Twitch Chat  →  Touch Designer  →  Game API (REST/WebSocket)
                     ↓
              Stream Diffusion (AI images for tiles)
                     ↓
              OBS / Stream Output
```

### External API Endpoints
- `POST /api/external/tiles` — push custom tile images
- `POST /api/external/viewer/join` — register viewer
- `POST /api/external/viewer/action` — spend credits (hint/powerup/obstacle)
- `POST /api/external/viewer/guess` — guess a symbol
- `GET /api/external/state` — full game state
- `GET /api/external/memory/board` — current memory board
- God Mode: `POST /god/obstacle`, `POST /god/powerup`

### WebSocket Events (server → Touch Designer)
- `event:round-start`, `event:round-end`
- `event:tile-captured`, `event:pair-matched`
- `event:reveal-milestone` (at 25/50/75/90%)
