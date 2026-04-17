# Snake Memory

A multiplayer Snake game crossed with a memory-match card game, built for interactive exhibitions. Players drive snakes on a projected screen to uncover tiles and match pairs, using phones, keyboards, gamepads, or a DJ MIDI controller. Twitch viewers interact via a Touch Designer bridge.

Built as a university project (CAMI / BCC4 @ FH St. Pölten).

## Quick Start

```bash
# Install dependencies
npm install

# Build shared types (required once after changes to packages/shared)
npm run build --workspace=packages/shared

# Start server (Terminal 1)
npm run dev:server

# Start client (Terminal 2)
npm run dev:client
```

Open **http://localhost:5173** on the projector. Phones join by scanning the QR shown in the lobby.

## How to join the lobby

Any number of these can be mixed (up to 10 total players):

| Input         | How to join                                  |
|---------------|----------------------------------------------|
| Phone         | Scan the lobby QR, tap Join, tap Ready       |
| Keyboard WASD | Press **A** or **D** — slot opens auto-ready |
| Keyboard Arrows | Press **◀** or **▶** — slot opens auto-ready |
| Gamepad       | Move the left stick — slot opens auto-ready  |
| MIDI (DDJ-400) | Spin the jog wheel — slot opens auto-ready  |

Click the **✕** on any row in the lobby to kick that slot; the same input device can re-join by being used again.

## Controls

| Action     | Phone          | WASD | Arrows    | Gamepad      | DDJ-400     |
|------------|----------------|------|-----------|--------------|-------------|
| Turn left  | Left touch pad | **A** | **◀**   | stick left   | jog CCW     |
| Turn right | Right touch pad | **D** | **▶**  | stick right  | jog CW      |
| Powerup    | Tap slot card  | **W** | **▲**  | **A** button | Play/Pause  |

Host extras on the projector keyboard:
- **Double-click** canvas — toggle fullscreen
- **Enter** in the lobby — start the game (all players must be ready)
- **ESC** in-game — pause + exit confirm dialog

## MIDI / Web MIDI notes

- Chromium / Chrome / Edge / Firefox — Web MIDI is supported. Safari does not support Web MIDI.
- **Requires a secure origin**: `localhost`, `127.0.0.1`, or HTTPS. A LAN IP over plain HTTP (e.g. `http://192.168.1.5:5173`) will hide MIDI from the page.
- Default mapping is the Pioneer DDJ-400 deck-1 jog wheel (CC 34 ch 1) for steering + deck-1 play (note 11 ch 1) for powerup. To discover your device's actual MIDI IDs and remap, open the projector with `?midi-debug=1` and watch the browser console while touching controls.

## Tech Stack

- **Monorepo** with npm workspaces
- **Server**: TypeScript, Node.js, Express, socket.io (30 Hz tick)
- **Client**: TypeScript, HTML5 Canvas, Vite (60 fps rendering with interpolation)
- **Shared**: Types and constants shared between server and client

## Project Structure

```
packages/
  shared/    Shared types, constants, math utilities
  server/    Authoritative game server
  client/    Browser client (projector + phone controller)
docs/
  GAME_DESIGN.md         Game concept and mechanics
  ARCHITECTURE.md        Technical architecture
  TOUCHDESIGNER_GUIDE.md TD integration guide
scripts/
  deploy.sh              One-command SFTP deploy to the campus PaaS
```

## Deploy (production)

Single-instance: the built Node server serves the compiled client bundle and socket.io on one port.

```bash
# One-time: put SFTP creds in ~/.netrc (perms 0600)
#   machine node.ustp.cloud
#     login node-cc241070-11015
#     password <from-dashboard>
sudo pacman -S lftp

# Every deploy:
npm run deploy
```

The script builds all three packages then mirrors `packages/*/dist`, `packages/*/package.json`, and the root manifests to the campus instance. The platform auto-runs `npm install` + `npm start`.

## Documentation

- [Game Design](docs/GAME_DESIGN.md) — Full game concept, mechanics, and features
- [Architecture](docs/ARCHITECTURE.md) — Technical decisions and system overview
- [Touch Designer Guide](docs/TOUCHDESIGNER_GUIDE.md) — External REST + WS API for exhibition integration
