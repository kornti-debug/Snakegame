"""
bridge_script — Text DAT
Central bridge between Twitch IRC, Snake game REST API, and Stream Diffusion.

SETUP: Create a Text DAT named 'bridge_script' and paste this entire file.
Other scripts reference it via: mod.bridge_script
"""

import json
import urllib.request
import urllib.error
import base64
import re
import random

# =============================================================================
# CONFIG — Change these to match your setup
# =============================================================================
SNAKE_API = "http://localhost:3000/api/external"
API_KEY = ""  # Set if your server uses API_KEY env var, leave empty otherwise

# God mode budget per round
GOD_BUDGET_TOTAL = 5        # max total actions per round
GOD_MAX_OBSTACLES = 3       # max obstacles
GOD_MAX_POWERUPS = 2        # max power-ups

# Stream Diffusion operator names (change to match your TD project)
SD_PROMPT_OP = "sd_prompt"      # Text DAT where the prompt goes
SD_OUTPUT_OP = "sd_output"      # TOP with the generated image

# Delay in frames before reading SD output (adjust to your generation time)
SD_DELAY_FRAMES = 90  # ~1.5s at 60fps


# =============================================================================
# STATE
# =============================================================================
class _State:
    round_phase = "waiting"
    round_number = 0
    game_phase = "lobby"
    current_word = ""
    current_category = ""
    reveal_percentage = 0.0
    god_mode_user = ""
    god_budget_remaining = 0
    god_obstacles_placed = 0
    god_powerups_placed = 0
    image_queued = False

state = _State()


# =============================================================================
# REST API HELPERS
# =============================================================================
def _api_call(method, endpoint, body=None):
    url = f"{SNAKE_API}/{endpoint}"
    headers = {"Content-Type": "application/json"}
    if API_KEY:
        headers["X-Api-Key"] = API_KEY

    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=2) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.URLError as e:
        print(f"[Bridge] API error ({method} {endpoint}): {e}")
        return None
    except Exception as e:
        print(f"[Bridge] Error: {e}")
        return None

def api_get(endpoint):
    return _api_call("GET", endpoint)

def api_post(endpoint, body=None):
    return _api_call("POST", endpoint, body or {})


# =============================================================================
# POLL GAME STATE — call every 0.5s from timer
# =============================================================================
def poll_game_state():
    result = api_get("state")
    if not result:
        return

    old_phase = state.round_phase
    new_phase = result.get("round", {}).get("phase", "waiting")
    new_round = result.get("round", {}).get("roundNumber", 0)

    state.game_phase = result.get("gamePhase", "lobby")
    state.reveal_percentage = result.get("revealPercentage", 0)
    state.round_phase = new_phase
    state.round_number = new_round

    # Detect transitions
    if old_phase == "playing" and new_phase == "ended":
        _on_round_ended()
    elif old_phase != "playing" and new_phase == "playing":
        _on_round_started()

    _sync_state_table()


def start_polling():
    """Start polling loop. Call once on project load."""
    poll_game_state()
    run("args[0]()", start_polling, delayFrames=30)  # ~0.5s at 60fps


# =============================================================================
# ROUND LIFECYCLE
# =============================================================================
def _on_round_started():
    print(f"[Bridge] === Round {state.round_number} started ===")
    state.image_queued = False
    if state.god_mode_user:
        state.god_budget_remaining = GOD_BUDGET_TOTAL
        state.god_obstacles_placed = 0
        state.god_powerups_placed = 0
        print(f"[Bridge] God mode: {state.god_mode_user} (budget: {GOD_BUDGET_TOTAL})")


def _on_round_ended():
    print(f"[Bridge] === Round {state.round_number} ended ===")
    state.god_mode_user = ""
    state.god_budget_remaining = 0
    generate_and_push_image()


# =============================================================================
# TWITCH MESSAGE HANDLING
# =============================================================================
def handle_twitch_message(username, message):
    """Call this from your Twitch WebSocket callback."""
    msg = message.strip()
    if not msg:
        return

    # God mode commands (only from god user, only during playing)
    if msg.startswith("!") and state.round_phase == "playing":
        if state.god_mode_user and username.lower() == state.god_mode_user.lower():
            _handle_god_command(username, msg)
        return  # don't treat !commands as guesses

    # Regular guess (any non-command message during playing)
    if state.round_phase == "playing" and 0 < len(msg) < 50:
        _submit_guess(username, msg)


def _submit_guess(username, guess):
    result = api_post("guess", {"viewerName": username, "guess": guess})
    if result and result.get("correct"):
        print(f"[Bridge] CORRECT! {username} guessed '{guess}'")
        state.god_mode_user = username
        print(f"[Bridge] {username} gets God Mode next round!")


# =============================================================================
# GOD MODE
# =============================================================================
_CELL_RE = re.compile(r"^[A-Pa-p][1-9]$")
_POWERUP_MAP = {"speed": "speed-boost", "wide": "wide-trail", "ghost": "ghost"}

def _handle_god_command(username, message):
    if state.god_budget_remaining <= 0:
        print(f"[Bridge] {username} has no budget left")
        return

    parts = message.lower().split()
    cmd = parts[0]

    if cmd in ("!wall", "!obstacle") and len(parts) >= 2:
        cell = parts[1].upper()
        if not _CELL_RE.match(cell):
            return
        if state.god_obstacles_placed >= GOD_MAX_OBSTACLES:
            print(f"[Bridge] Obstacle limit reached")
            return
        result = api_post("god/obstacle", {"cell": cell, "durationMs": 15000})
        if result and result.get("ok"):
            state.god_budget_remaining -= 1
            state.god_obstacles_placed += 1
            print(f"[Bridge] Wall at {cell} (budget: {state.god_budget_remaining})")

    elif cmd in ("!powerup", "!pu") and len(parts) >= 3:
        cell = parts[1].upper()
        ptype = parts[2]
        if not _CELL_RE.match(cell) or ptype not in _POWERUP_MAP:
            return
        if state.god_powerups_placed >= GOD_MAX_POWERUPS:
            print(f"[Bridge] Powerup limit reached")
            return
        result = api_post("god/powerup", {"cell": cell, "type": _POWERUP_MAP[ptype]})
        if result and result.get("ok"):
            state.god_budget_remaining -= 1
            state.god_powerups_placed += 1
            print(f"[Bridge] Powerup {ptype} at {cell} (budget: {state.god_budget_remaining})")


# =============================================================================
# IMAGE GENERATION
# =============================================================================

# Word dictionary (fallback — prefer the word_dictionary Table DAT)
_WORDS = {
    "animals": ["cat", "dog", "elephant", "penguin", "dolphin", "owl", "tiger",
                "rabbit", "giraffe", "whale", "octopus", "parrot"],
    "nature": ["tree", "mountain", "ocean", "sunset", "flower", "forest",
               "waterfall", "desert", "volcano", "rainbow", "aurora"],
    "objects": ["house", "bicycle", "guitar", "lighthouse", "clock", "umbrella",
                "bridge", "telescope", "lantern", "anchor", "typewriter"],
    "food": ["pizza", "banana", "cupcake", "sushi", "pretzel", "pineapple",
             "hamburger", "donut", "taco", "ice cream"],
    "vehicles": ["airplane", "sailboat", "rocket", "train", "helicopter",
                 "submarine", "hot air balloon", "motorcycle"],
    "fantasy": ["dragon", "castle", "unicorn", "wizard", "fairy", "pirate ship",
                "treasure chest", "crystal ball", "phoenix"],
}

def _load_words():
    """Try loading from word_dictionary Table DAT, fallback to built-in."""
    t = op("word_dictionary")
    if t and t.numRows > 1:
        d = {}
        for row in range(1, t.numRows):
            cat = t[row, 0].val
            word = t[row, 1].val
            d.setdefault(cat, []).append(word)
        return d
    return _WORDS

def pick_random_word():
    d = _load_words()
    category = random.choice(list(d.keys()))
    word = random.choice(d[category])
    return word, category


def generate_and_push_image():
    if state.image_queued:
        return

    word, category = pick_random_word()
    state.current_word = word
    state.current_category = category
    prompt = f"a clear, colorful illustration of a {word}"
    print(f"[Bridge] Generating: '{word}' ({category}) — prompt: {prompt}")

    # Set the prompt in Stream Diffusion
    p = op(SD_PROMPT_OP)
    if p:
        p.text = prompt

    # Wait for SD to generate, then push
    run("args[0]()", push_image_when_ready, delayFrames=SD_DELAY_FRAMES)


def push_image_when_ready():
    if state.image_queued:
        return

    top = op(SD_OUTPUT_OP)
    if top is None:
        print("[Bridge] SD output TOP not found — pushing word only")
        api_post("image", {"word": state.current_word, "imageUrl": ""})
        state.image_queued = True
        return

    # Save TOP to temp file, convert to base64
    import os
    tmp = f"{project.folder}/tmp_sd_image.png"
    top.save(tmp)

    with open(tmp, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")

    try:
        os.remove(tmp)
    except:
        pass

    result = api_post("image", {"word": state.current_word, "imageBase64": b64})
    if result and result.get("ok"):
        state.image_queued = True
        print(f"[Bridge] Image pushed: '{state.current_word}'")
    else:
        print(f"[Bridge] Image push failed: {result}")


# =============================================================================
# STATE TABLE (for monitoring in TD)
# =============================================================================
def _sync_state_table():
    t = op("game_state")
    if not t:
        return
    t.clear()
    t.appendRow(["key", "value"])
    t.appendRow(["game_phase", state.game_phase])
    t.appendRow(["round_phase", state.round_phase])
    t.appendRow(["round_number", state.round_number])
    t.appendRow(["current_word", state.current_word])
    t.appendRow(["reveal_pct", f"{state.reveal_percentage:.1f}%"])
    t.appendRow(["god_user", state.god_mode_user or "(none)"])
    t.appendRow(["god_budget", state.god_budget_remaining])
    t.appendRow(["image_queued", state.image_queued])
