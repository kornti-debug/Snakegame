# Touch Designer Integration Guide

## Overview

Touch Designer bridges three systems:
- **Twitch Chat** (IRC WebSocket) — receives viewer guesses and god mode commands
- **Snake Game Server** (REST API at localhost:3000) — sends guesses, images, god mode actions
- **Stream Diffusion** (your existing setup) — generates AI images from word prompts

TD does NOT use Socket.IO. It polls the game server via REST every 0.5s and makes POST requests for actions. This is simpler and works reliably.

## Operator Network

```
                    ┌─────────────────────┐
                    │  websocket_twitch    │  (existing — WebSocket DAT)
                    │  wss://irc-ws.chat   │  (connects to Twitch IRC)
                    │  .twitch.tv:443      │
                    └──────────┬──────────┘
                               │ onReceiveText
                               ▼
                    ┌─────────────────────┐
                    │  twitch_callbacks    │  (DAT Execute)
                    │  parses PRIVMSG      │  (paste twitch_callbacks.py)
                    └──────────┬──────────┘
                               │ mod.bridge_script.handle_twitch_message()
                               ▼
┌──────────┐       ┌─────────────────────┐       ┌──────────────────┐
│timer_poll │──────▶│   bridge_script     │──────▶│  game server     │
│(Timer    │ poll  │   (Text DAT)        │ REST  │  localhost:3000  │
│ CHOP)    │       │                     │       │  /api/external/* │
└──────────┘       │  - state polling    │       └──────────────────┘
                   │  - guess routing    │
                   │  - god mode budget  │
                   │  - image generation │
                   └──────────┬──────────┘
                              │ sets prompt
                              ▼
                   ┌─────────────────────┐
                   │  sd_prompt          │  (Text DAT — your SD prompt input)
                   └──────────┬──────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │  Stream Diffusion   │  (your existing SD pipeline)
                   └──────────┬──────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │  sd_output          │  (TOP — generated image)
                   └──────────┘──────────┘
                              │ save → base64 → POST /image
                              ▼
                   ┌─────────────────────┐
                   │  game_state         │  (Table DAT — monitoring)
                   └─────────────────────┘
                   ┌─────────────────────┐
                   │  word_dictionary    │  (Table DAT — word list)
                   └─────────────────────┘
```

## Step-by-Step Setup

### Step 1: Create the Bridge Script

1. Create a **Text DAT** named `bridge_script`
2. Paste the contents of `docs/td-scripts/bridge_script.py` into it
3. Edit the CONFIG section at the top:
   - `SNAKE_API` — change if game server is on a different machine/port
   - `SD_PROMPT_OP` — name of the Text DAT that feeds your Stream Diffusion prompt
   - `SD_OUTPUT_OP` — name of the TOP that contains the generated image
   - `SD_DELAY_FRAMES` — adjust to how long your SD takes to generate (90 = ~1.5s at 60fps)

### Step 2: Update Twitch Callbacks

1. Select your existing **websocket_twitch** WebSocket DAT
2. Open its DAT Execute callbacks
3. Replace the callback code with `docs/td-scripts/twitch_callbacks.py`
4. Update the credentials (token, user, channel) in `onConnect`

The key change: `onReceiveText` now calls `mod.bridge_script.handle_twitch_message(username, chat_content)` instead of handling commands directly.

### Step 3: Create Monitoring Table

1. Create a **Table DAT** named `game_state`
2. Leave it empty — the bridge script populates it automatically with:
   - `game_phase`, `round_phase`, `round_number`, `current_word`
   - `reveal_pct`, `god_user`, `god_budget`, `image_queued`

### Step 4: Create Word Dictionary (Optional)

1. Create a **Table DAT** named `word_dictionary`
2. Add two columns: `category` and `word`
3. Fill with word entries (see list below)
4. If this table doesn't exist, the bridge uses a built-in fallback dictionary

### Step 5: Start Polling

**Simplest approach** — add this to a **Script DAT** and run it once:
```python
mod.bridge_script.start_polling()
```

**Alternative** — use a Timer CHOP:
1. Create a **Timer CHOP** named `timer_poll` (length: 0.5s, done: Re-Start)
2. Create a **CHOP Execute DAT** referencing `timer_poll`
3. Paste `docs/td-scripts/poll_callbacks.py`

### Step 6: Wire Stream Diffusion

Make sure your SD pipeline has:
- A **Text DAT** (or parameter) named matching `SD_PROMPT_OP` in the bridge config — the bridge writes the image prompt here
- A **TOP** named matching `SD_OUTPUT_OP` — the bridge reads the generated image from here

The bridge will:
1. Set the prompt text when a round ends
2. Wait `SD_DELAY_FRAMES` for generation
3. Save the TOP to a temp PNG → base64 encode → POST to game server

### Step 7: Test

1. Start the game server: `npm run dev:server`
2. Start the game client: `npm run dev:client`
3. In TD, check the textport for `[Bridge] API error` or successful poll messages
4. The `game_state` Table should show `game_phase: lobby`
5. Join the game (press A/D in browser), press Enter to start
6. `game_state` should update to `round_phase: playing`
7. Type something in Twitch chat — check server console for guess logs

## How It All Works

### Round Lifecycle (from TD's perspective)

```
1. ROUND ENDS
   └─ bridge detects phase: playing → ended
   └─ picks random word (e.g. "dolphin" from "animals")
   └─ sets SD prompt: "a clear, colorful illustration of a dolphin"
   └─ SD generates image (~1-2s)
   └─ bridge POSTs image + word to game server

2. WAITING PHASE (5s countdown)
   └─ game server has the image queued
   └─ god mode user (if any) is stored in bridge state

3. PLAYING PHASE (90s)
   └─ game loads the image, snakes start revealing it
   └─ Twitch chat messages → bridge → POST /guess
   └─ god mode user's !commands → POST /god/*
   └─ bridge tracks budget (5 total actions, 3 obstacles, 2 powerups)

4. GUESS CORRECT (or timer expires)
   └─ server ends round
   └─ guesser gets god mode for next round
   └─ back to step 1
```

### Twitch Chat Commands

**Regular viewers** — any message is treated as a guess:
```
viewer123: dolphin     → POST /guess { viewerName: "viewer123", guess: "dolphin" }
```

**God mode holder** — commands start with `!`:
```
goduser: !wall D5              → obstacle at grid cell D5
goduser: !obstacle H3          → same thing
goduser: !powerup F4 ghost     → ghost power-up at F4
goduser: !pu B7 speed          → speed boost at B7
```

Power-up types: `speed`, `wide`, `ghost`

### Grid System

The arena (1920×1080) is divided into a 16×9 grid:

```
     A    B    C    D    E    F    G    H    I    J    K    L    M    N    O    P
  ┌────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┐
1 │    │    │    │    │    │    │    │    │    │    │    │    │    │    │    │    │
  ├────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┤
2 │    │    │    │    │    │    │    │    │    │    │    │    │    │    │    │    │
  ├────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┤
...
9 │    │    │    │    │    │    │    │    │    │    │    │    │    │    │    │    │
  └────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┘
```

Each cell is 120×120px. `A1` = top-left, `P9` = bottom-right.

## Word Dictionary

If using the `word_dictionary` Table DAT, create it with columns `category` | `word`:

| category | word |
|----------|------|
| animals | cat |
| animals | dog |
| animals | elephant |
| animals | penguin |
| animals | dolphin |
| animals | owl |
| animals | tiger |
| animals | rabbit |
| animals | giraffe |
| animals | whale |
| nature | tree |
| nature | mountain |
| nature | ocean |
| nature | sunset |
| nature | flower |
| nature | forest |
| nature | waterfall |
| nature | desert |
| nature | volcano |
| nature | rainbow |
| objects | house |
| objects | bicycle |
| objects | guitar |
| objects | lighthouse |
| objects | clock |
| objects | umbrella |
| objects | telescope |
| objects | lantern |
| objects | anchor |
| food | pizza |
| food | banana |
| food | cupcake |
| food | sushi |
| food | pretzel |
| food | pineapple |
| food | hamburger |
| food | donut |
| vehicles | airplane |
| vehicles | sailboat |
| vehicles | rocket |
| vehicles | train |
| vehicles | helicopter |
| vehicles | submarine |
| fantasy | dragon |
| fantasy | castle |
| fantasy | unicorn |
| fantasy | wizard |
| fantasy | pirate ship |
| fantasy | treasure chest |
| fantasy | crystal ball |

## Timing

Important timing constants (can be changed in `packages/shared/src/constants.ts`):

| Constant | Default | Purpose |
|----------|---------|---------|
| `ROUND_DURATION` | 90,000ms (90s) | How long a round lasts |
| `ROUND_WAIT_TIME` | 5,000ms (5s) | Countdown between rounds |
| `ROUND_END_DISPLAY_TIME` | 4,000ms (4s) | Scoreboard display after round |

You have ~9 seconds (end display + wait time) between rounds to generate and push an image. If Stream Diffusion takes longer, increase `ROUND_WAIT_TIME`.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `API error: connection refused` | Game server not running. Start with `npm run dev:server` |
| Guesses not working | Check `game_state` table — `round_phase` must be `playing` |
| Image not appearing | Check textport for `[Bridge] Image pushed`. Ensure SD output TOP exists |
| God mode commands ignored | Check `god_user` in state table matches the Twitch username |
| Image generation too slow | Increase `SD_DELAY_FRAMES` in bridge_script config |
| PING timeout from Twitch | The `onReceiveText` must respond to PING — check callback is set |
