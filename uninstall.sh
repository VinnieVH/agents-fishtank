#!/usr/bin/env bash
# Removes the Copilot Fishtank hook and stops the server (macOS / Linux).
HOOK_FILE="${COPILOT_HOME:-$HOME/.copilot}/hooks/fishtank.json"
if [ -f "$HOOK_FILE" ]; then rm "$HOOK_FILE"; echo "Removed $HOOK_FILE"; else echo "Hook not installed."; fi

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if pkill -f "node $DIR/server.js" 2>/dev/null; then echo "Stopped fishtank server."; fi
