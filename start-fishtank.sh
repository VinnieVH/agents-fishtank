#!/usr/bin/env bash
# Starts the fishtank server in the background if it isn't already running.
# Used by the Copilot CLI sessionStart hook (registered by install.sh).
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${FISHTANK_PORT:-4321}"

is_up() { curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$PORT/"; }

is_up && exit 0
command -v node >/dev/null 2>&1 || exit 0

if command -v setsid >/dev/null 2>&1; then
  FISHTANK_PORT="$PORT" setsid nohup node "$DIR/server.js" >/dev/null 2>&1 < /dev/null &
else
  FISHTANK_PORT="$PORT" nohup node "$DIR/server.js" >/dev/null 2>&1 < /dev/null &
fi
disown 2>/dev/null || true

if [ "$1" != "--no-browser" ]; then
  for _ in $(seq 1 20); do is_up && break; sleep 0.25; done
  if [ "$(uname)" = "Darwin" ]; then open "http://localhost:$PORT" >/dev/null 2>&1
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "http://localhost:$PORT" >/dev/null 2>&1 &
  fi
fi
exit 0
