# Parked Ideas

Things we discussed but did not build, in rough priority order. Each entry includes enough context to pick it up later without re-litigating the design.

The rule we keep coming back to: **less is more.** Don't build any of this without a real reason from playtest. Adding speculatively bloats the game; the strip-down to two clean modes was the right move.

---

## Likely-to-do (small, useful)

### Min 2 players gate already done — note for context
Boid Battle now requires 2+ players in the lobby. If we ever add a single-player mode, the gate just becomes mode-specific.

### Sticky jog-wheel steering (DDJ alternative)
**Problem:** the jog wheel is a delta encoder, not absolute position — when your hand stops, the wheel stops sending data, and after 100ms of silence the snake stops turning. Lukas (and probably any non-DJ) intuitively expects "I turned left, now I'm going left until I tell it to go right."

**Fix:** in `MidiHub.dispatch`, don't reset `lane.turn` to 0 on the silence-release path. Last spin direction stays active until you spin the *other* way. ~5 line change in `refreshJogStateForLane`.

**Status:** parked because Lukas wanted to playtest with classmates first to see if the current scratch-feel is actually disliked or just unfamiliar.

### Second action button on keyboard / phone (parity with DDJ)
DDJ players have **turbo (CUE)** + **brake (PLAY)** + **activate (PLAY, same as brake)**. Keyboard / phone players only have one action button (activate). In Snake Memory this means DDJ players get speed control phones don't — a fairness gap.

**Fix:** add a second key binding (e.g. `Space` for turbo on WASD, `Enter` for turbo on Arrows) and a second pad on the phone (small "TURBO" button below the slot card). Server already accepts `input:turbo` and `input:brake` from any provider.

**Status:** Lukas flagged it as nice-to-have; not urgent because Boid Battle (where turbo+brake matters most) is DDJ-only in practice.

### Replace some procedural SFX with sample files
Procedural SFX engine sounds fine, but we have unused WhatsApp recordings in `packages/client/public/sounds/sfx/`. If a specific event would be more characterful with a real sample (death, eat-boid, match), wire it via `<audio>` and call from the same handler in `main.ts`. Keep the engine as the default; samples are a per-event override.

**Status:** wait until something specifically *bothers* us about a current procedural sound.

---

## Bigger ideas (need playtest to justify)

### Battle-Royale shrinking zone for Boid Battle
**Goal:** late-round visual urgency + force engagement when both players are turtling.

**Mechanic:** circle drawn over the arena, shrinks across the last ~30s of the round. Snake outside circle = instant death. Boids get a "flee outside-zone" steering force in `BoidSystem` so prey + predator concentrate together — without it, boids escape the unprotected edges and players starve at the end.

**Why parked:** Lukas's directive has consistently been "less, not more." Adding the zone preemptively means tuning two unknowns at once (eat mechanic + zone). Playtest the open arena first; if late-game feels static, *that's* when we add the zone.

**Implementation rough sketch:**
- `GameRoom.zone: { cx, cy, r }` updated each tick
- New event `'event:zone-shrink'` for sound triggers
- Client: red pulsing overlay outside the safe circle in `Renderer`
- `BoidSystem.update` adds a wall-style force pushing boids inward when outside zone

### Single-player / co-op mode (reuse reveal mechanic)
The reveal-as-digging visual is gorgeous and currently only justified by Memory mode. A solo / co-op variant could re-use it:

- **Treasure hunt:** hidden goal symbols somewhere on the board. Reveal % gives proximity hints. Find all goals before timer expires.
- **Co-op variant:** 2+ players reveal *together*; combined progress bar.
- **No PvP, no boids killing on touch** in this mode.

**Why interesting:** brings the reveal mechanic back into a fresh purpose, supports lone players walking up to the exhibition.

**Why parked:** speculative. Wait until we have the basic two-mode setup playtested; only build if there's audience demand for a non-competitive entry point.

---

## Far-future / brainstorm

### Snake Royale (full BR-style memory replacement)
Detailed design lives in the ideas-archive plan file (`~/.claude/plans/jolly-stirring-spindle.md`). Summary: rip out memory entirely, replace with BR-style last-alive on a shrinking arena with treasures dropping from dig-pops. Won't happen unless current Memory mode plays poorly with friends *and* we want a competitive-leaning audience.

### Sheepdog Trials (herding pivot)
Dogs (players) herd colored boids (sheep) into team-colored pens. Closest reference: *Flock!* (2009, Proper Games / Capcom). Won't happen unless we want a coop / family-friendly pivot. Same archive plan file has the full design.

### Twitch god-mode adapted per mode
Twitch infra is in place (`/api/external` REST + `/touchdesigner` socket namespace). For Memory it's bolted-on; for any future Boid Battle escalation it could shine — viewers spawn extra boid packs, trigger zone surges, drop "wolf" panic boids. Per-mode action sets.

### "Snake Arcade" branding pass
Project was renamed to Snake Arcade in May 2026 to fit the multi-mode framing. UI uses the new name; no full visual identity yet. If we ship publicly, an actual logo + colour palette pass would help. Low priority; the projector is the marketing.

---

## Known gaps (not really ideas — just things on the floor)

- **Instructions screen** got a once-over for both modes but not a visual redesign.
- **`SnakeState.boidsEaten`** is sent in every snapshot to every client even in Memory mode (always 0). Trivial bandwidth, but if we ever add a Mode-3 with another integer counter, consider a discriminated-union snapshot shape.
- **DDJ tuning JSON** doesn't reload at runtime; restart the server to see changes (`tsx watch` doesn't pick up JSON-only edits). Note in the file's `_comment` already says this.
- **DDJ jog-wheel steering feel:** see the sticky-jog idea above. Lukas flagged it as "feels off" but wants to playtest before changing it.
