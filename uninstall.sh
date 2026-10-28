#!/usr/bin/env bash
# Removes the Agent Fishtank hooks (Copilot CLI and Claude Code) and stops the server (macOS / Linux).
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK_FILE="${COPILOT_HOME:-$HOME/.copilot}/hooks/fishtank.json"
if [ -f "$HOOK_FILE" ]; then rm "$HOOK_FILE"; echo "Removed $HOOK_FILE"; fi

SETTINGS="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json"
if [ -f "$SETTINGS" ] && grep -q '/hook/claude\|start-fishtank\|statusline.ts' "$SETTINGS"; then
  if node "$DIR/scripts/claude-hooks.ts" uninstall "$SETTINGS"; then echo "Removed the Claude Code hooks from $SETTINGS"; fi
fi

if pkill -f "node $DIR/server/index.ts" 2>/dev/null; then echo "Stopped fishtank server."; fi
