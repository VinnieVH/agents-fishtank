#!/usr/bin/env bash
# Builds the Agent Fishtank and registers it as a sessionStart hook for GitHub Copilot CLI and/or Claude Code (macOS / Linux).
# Usage: ./install.sh              # every CLI found on this machine
#        ./install.sh claude       # only the CLIs named (copilot, claude)
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${FISHTANK_PORT:-4321}"
COPILOT_DIR="${COPILOT_HOME:-$HOME/.copilot}"
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22.18+ is required. Install it from https://nodejs.org and run this again." >&2; exit 1
fi
if ! node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=18)?0:1)'; then
  echo "Node.js 22.18+ is required (found $(node --version))." >&2; exit 1
fi
if ! command -v curl >/dev/null 2>&1; then echo "curl is required." >&2; exit 1; fi

if [ $# -gt 0 ]; then CLIS="$*"; else
  CLIS=""
  { command -v copilot >/dev/null 2>&1 || [ -d "$COPILOT_DIR" ]; } && CLIS="copilot"
  { command -v claude >/dev/null 2>&1 || [ -d "$CLAUDE_DIR" ]; } && CLIS="$CLIS claude"
fi
if [ -z "${CLIS// }" ]; then
  echo "Found neither GitHub Copilot CLI nor Claude Code. Install one, or name it: ./install.sh copilot|claude" >&2; exit 1
fi
for cli in $CLIS; do
  case "$cli" in copilot|claude) ;; *) echo "Unknown CLI '$cli' (use copilot or claude)." >&2; exit 1 ;; esac
done

# Build the page (Vite + PixiJS) into dist/, which the server serves.
echo "Installing dependencies and building the fishtank..."
(cd "$DIR" && npm ci --no-audit --no-fund && npm run build)
chmod +x "$DIR/start-fishtank.sh"
START="bash $(node -p 'JSON.stringify(process.argv[1])' "$DIR/start-fishtank.sh")"

for cli in $CLIS; do
  if [ "$cli" = copilot ]; then
    mkdir -p "$COPILOT_DIR/hooks"
    # Use node to write the JSON so paths with spaces/quotes are escaped correctly.
    CMD="$START" HOOK_FILE="$COPILOT_DIR/hooks/fishtank.json" node -e '
const fs = require("fs");
const hook = { version: 1, hooks: { sessionStart: [{ type: "command", bash: process.env.CMD, timeoutSec: 15 }] } };
fs.writeFileSync(process.env.HOOK_FILE, JSON.stringify(hook, null, 2) + "\n");
'
    echo "Installed Copilot CLI hook: $COPILOT_DIR/hooks/fishtank.json"
  else
    node "$DIR/scripts/claude-hooks.ts" install "$CLAUDE_DIR/settings.json" "$PORT" "$START --claude"
    echo "Installed Claude Code hooks and status line in $CLAUDE_DIR/settings.json (your own status line still shows)"
  fi
done

echo "The fishtank opens automatically the next time you start a session."
echo "Start it now:  $DIR/start-fishtank.sh"
