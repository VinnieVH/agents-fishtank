#!/usr/bin/env bash
# Registers the Copilot Fishtank as a Copilot CLI sessionStart hook (macOS / Linux).
# Usage: ./install.sh
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20.19+ is required. Install it from https://nodejs.org and run this again." >&2; exit 1
fi
if ! node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>20||(a===20&&b>=19)?0:1)'; then
  echo "Node.js 20.19+ is required (found $(node --version))." >&2; exit 1
fi
if ! command -v curl >/dev/null 2>&1; then echo "curl is required." >&2; exit 1; fi

# Build the page (Vite + PixiJS) into dist/, which server.js serves.
echo "Installing dependencies and building the fishtank..."
(cd "$DIR" && npm ci --no-audit --no-fund && npm run build)

chmod +x "$DIR/start-fishtank.sh"
HOOKS_DIR="${COPILOT_HOME:-$HOME/.copilot}/hooks"
mkdir -p "$HOOKS_DIR"

# Use node to write the JSON so paths with spaces/quotes are escaped correctly.
SCRIPT="$DIR/start-fishtank.sh" HOOK_FILE="$HOOKS_DIR/fishtank.json" node -e '
const fs = require("fs");
const cmd = "bash " + JSON.stringify(process.env.SCRIPT);
const hook = { version: 1, hooks: { sessionStart: [{ type: "command", bash: cmd, timeoutSec: 15 }] } };
fs.writeFileSync(process.env.HOOK_FILE, JSON.stringify(hook, null, 2) + "\n");
'

echo "Installed Copilot CLI hook: $HOOKS_DIR/fishtank.json"
echo "The fishtank opens automatically the next time you start \`copilot\`."
echo "Start it now:  $DIR/start-fishtank.sh"
