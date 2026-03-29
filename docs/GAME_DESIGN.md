# Game Design Document

## Concept

A multiplayer Snake game inspired by Slither.io and Curve Fever, designed for interactive exhibitions. The game is projected on a wall where local players compete, while a Twitch audience participates remotely through chat.

The core twist: as snakes move across the arena, they **reveal a hidden image** underneath — like scratching off a lottery ticket. Twitch viewers try to guess what the image is. The first correct guesser gains **God Mode**, letting them influence the game in the next round.

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

- **Game PC**: Runs the game server + client in fullscreen browser
- **Touch Designer**: Separate service handling Twitch chat, AI image generation, and stream output
- **Players**: 2+ local players using keyboard or game controllers
- **Audience**: Twitch viewers interacting through chat

## Core Mechanics

### Snake Movement
- **Smooth, continuous movement** — not grid-based 90-degree turns
- Players control **turning direction** (left/right), the snake always moves forward
- Inspired by Slither.io / Curve Fever style curves
- Snake speed is constant, turning rate is fixed (creates natural curves)

### Collision Rules
- **Head hits another snake's body** → you die, the other player scores a point
- **Head-on collision** → both die
- **Hit the arena wall** → you die
- **Self-collision** → you die (skipping segments near the head to avoid instant death on sharp turns)

### Death & Respawn
- On death, the snake disappears
- Auto-respawn after 2 seconds at a random position
- Score persists across deaths

## Image Reveal Mechanic

### How It Works
1. Each round, a **hidden image** is placed underneath the arena
2. The arena starts covered by an **opaque layer** (solid color)
3. As snakes move, their trails **erase the cover**, revealing the image below
4. The more the snakes move, the more of the image becomes visible

### The Guessing Game
1. A word is picked from a dictionary (simple nouns: "tree", "boat", "house", etc.)
2. The word is sent to **Stream Diffusion** (via Touch Designer) to generate an AI image
3. This AI image becomes the hidden picture for the round
4. Twitch viewers watch the stream and try to guess the word in chat
5. Touch Designer monitors chat and sends guesses to the game via API
6. When someone guesses correctly → round ends, guesser is announced

### Image Source Options
- **AI-generated**: Stream Diffusion creates images from dictionary words (primary mode)
- **Pre-loaded**: Static images from a folder (fallback / offline mode)
- **Chat-prompted**: Twitch chat submits prompts, but then others can't guess (party mode)

## God Mode

When a Twitch viewer correctly guesses the hidden image, they earn **God Mode** for the next round.

### God Mode Powers
- **Place obstacles** on the arena that snakes must avoid
- **Create speed zones** that speed up or slow down snakes passing through
- **Trigger visual effects** (screen shake, flash, slow-motion)
- **Spawn specific power-ups** at chosen locations

God Mode actions are sent from Twitch chat → Touch Designer → Game API.

## Power-Ups

Power-ups spawn randomly on the arena. Snakes collect them by passing over them.

### Planned Power-Ups
| Power-Up     | Effect                          | Duration |
|-------------|--------------------------------|----------|
| Speed Boost  | 1.5x movement speed            | 5s       |
| Shield       | Survive one collision           | Until hit |
| Growth Burst | Instantly grow longer           | Instant  |
| Shrink       | Become smaller (harder to hit)  | 5s       |
| Ghost        | Pass through other snakes       | 3s       |

The power-up system is **modular** — new power-ups can be added as plugins without modifying existing code.

## Round Flow

```
1. [WAITING]  → Players join, previous God Mode holder prepares
2. [PLAYING]  → Snakes move, image reveals, Twitch guesses
3. [GUESSED]  → Someone guessed correctly! Brief celebration
4. [SCOREBOARD] → Show scores, announce God Mode winner
5. → Back to [WAITING] with new image
```

## Twitch Integration

All Twitch interaction flows through **Touch Designer** as a bridge:

```
Twitch Chat  →  Touch Designer  →  Game API (REST/WebSocket)
                     ↓
              Stream Diffusion (AI images)
                     ↓
              OBS / Stream Output
```

### Chat Commands (handled by Touch Designer)
- **Guessing**: Any chat message is treated as a guess
- **God Mode actions**: `!obstacle`, `!speedzone`, `!shake` (during God Mode round)

### Stream Overlay
Touch Designer can poll the game API for:
- Current scores
- Reveal percentage
- Active power-ups
- Kill feed

## Future Ideas

- **More input devices**: Dance pads, MIDI controllers, custom hardware
- **Team mode**: 2v2 with shared score
- **Tournament mode**: Best of N rounds with bracket
- **Spectator power-ups**: Twitch chat votes on which power-up spawns next
- **Multiple images**: Different difficulty levels (abstract vs. obvious images)
- **Sound reactive**: Snake speed or arena effects tied to music
