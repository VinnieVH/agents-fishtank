#!/usr/bin/env bash
# Starts the fishtank server in the background if it isn't already running.
# Used by the Copilot CLI and Claude Code sessionStart hooks (registered by install.sh). Prints nothing:
# Claude Code adds a SessionStart hook's output to the conversation.
#   --claude      forward the hook event on stdin to the server, so a new Claude Code session shows up right away
#   --no-browser  don't open the page
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${FISHTANK_PORT:-4321}"
CLAUDE=0; BROWSER=1
for arg in "$@"; do
  case "$arg" in --claude) CLAUDE=1 ;; --no-browser) BROWSER=0 ;; esac
done
[ "$CLAUDE" = 1 ] && EVENT="$(cat)"

is_up() { curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$PORT/"; }
forward() {
  [ "$CLAUDE" = 1 ] && curl -s -o /dev/null --max-time 2 -H 'Content-Type: application/json' \
    --data-binary "$EVENT" "http://127.0.0.1:$PORT/hook/claude"
}

if is_up; then forward; exit 0; fi
command -v node >/dev/null 2>&1 || exit 0

if command -v setsid >/dev/null 2>&1; then
  FISHTANK_PORT="$PORT" setsid nohup node "$DIR/server/index.ts" >/dev/null 2>&1 < /dev/null &
else
  FISHTANK_PORT="$PORT" nohup node "$DIR/server/index.ts" >/dev/null 2>&1 < /dev/null &
fi
disown 2>/dev/null || true

for _ in $(seq 1 20); do is_up && break; sleep 0.25; done
forward
if [ "$BROWSER" = 1 ]; then
  if [ "$(uname)" = "Darwin" ]; then open "http://localhost:$PORT" >/dev/null 2>&1
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "http://localhost:$PORT" >/dev/null 2>&1 &
  fi
fi
exit 0
