"""
twitch_callbacks — DAT Execute on your websocket_twitch WebSocket DAT

SETUP: Set your websocket_twitch DAT Execute callbacks to this script.
Make sure 'bridge_script' Text DAT exists with the bridge module.
"""

def onConnect(dat):
    print("[Twitch] Connected! Logging in...")

    # ---- CHANGE THESE ----
    token = "oauth:YOUR_TOKEN_HERE"
    user = "your_bot_name"
    channel = "your_channel"
    # ----------------------

    dat.sendText(f"PASS {token}")
    dat.sendText(f"NICK {user}")
    dat.sendText(f"JOIN #{channel}")
    return

def onDisconnect(dat):
    print("[Twitch] Disconnected")
    return

def onReceiveText(dat, rowIndex, message):
    msg = message.strip()

    # Keep-alive: respond to PING
    if msg.startswith("PING"):
        dat.sendText("PONG :tmi.twitch.tv")
        return

    # Parse chat messages (PRIVMSG)
    if "PRIVMSG" in msg:
        parts = msg.split(":", 2)
        if len(parts) > 2:
            username = parts[1].split("!")[0]
            chat_content = parts[2].strip()

            # Route to bridge script
            bridge = mod.bridge_script
            bridge.handle_twitch_message(username, chat_content)
    return

def onReceiveBinary(dat, contents):
    return
