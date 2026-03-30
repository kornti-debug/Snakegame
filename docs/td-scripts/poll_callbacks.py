"""
poll_callbacks — Script to start polling the Snake game server.

OPTION A: Call mod.bridge_script.start_polling() once from a Script DAT.
          This starts a self-repeating loop using run() with delayFrames.

OPTION B: Use a Timer CHOP + CHOP Execute DAT (see below).
"""

# ---- OPTION A: Self-repeating poll (simplest) ----
# Put this in a Script DAT and run it once, or call from your project's onStart:
#
#   mod.bridge_script.start_polling()
#


# ---- OPTION B: CHOP Execute on a Timer CHOP ----
# Create a Timer CHOP named 'timer_poll':
#   - Length: 0.5 seconds
#   - Play Mode: Sequential
#   - Done Behavior: Re-Start
#
# Then create a CHOP Execute DAT with this code:

def onOffToOn(channel, sampleIndex, val, prev):
    if channel.name == "done":
        bridge = mod.bridge_script
        bridge.poll_game_state()

def whileOn(channel, sampleIndex, val, prev):
    pass

def onOnToOff(channel, sampleIndex, val, prev):
    pass

def onValueChange(channel, sampleIndex, val, prev):
    pass
