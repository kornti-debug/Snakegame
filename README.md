# Snake Game

A multiplayer Snake game for interactive exhibitions. Players compete on a shared screen (projected via beamer) while Twitch viewers interact through chat.

Built as a university project (CAMI / BCC4 @ FH St. Polten).

## Quick Start

```bash
# Install dependencies
npm install

# Build shared types (required once)
npm run build --workspace=packages/shared

# Start server (Terminal 1)
npm run dev:server

# Start client (Terminal 2)
npm run dev:client
```

Open **http://localhost:5173** in your browser.

## Controls

| Player   | Turn Left    | Turn Right    |
|----------|-------------|---------------|
| Player 1 | A           | D             |
| Player 2 | Arrow Left  | Arrow Right   |

- **Double-click** to toggle fullscreen
- **Gamepad** support built-in (left stick to turn)

## Tech Stack

- **Monorepo** with npm workspaces
- **Server**: TypeScript, Node.js, socket.io, Express
- **Client**: TypeScript, HTML5 Canvas, Vite
- **Shared**: Types and constants shared between server and client

## Project Structure

```
packages/
  shared/    Shared types, constants, math utilities
  server/    Authoritative game server (30Hz tick)
  client/    Browser client (60fps rendering)
docs/
  GAME_DESIGN.md    Game concept and mechanics
  ARCHITECTURE.md   Technical architecture
```

## Documentation

- [Game Design](docs/GAME_DESIGN.md) — Full game concept, mechanics, and features
- [Architecture](docs/ARCHITECTURE.md) — Technical decisions and system overview
