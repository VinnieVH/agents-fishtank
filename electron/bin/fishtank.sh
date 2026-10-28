#!/bin/sh
# Runs the Agent Fishtank command line (cli/cli.mjs) with the app's own binary in Node mode, so no Node.js is needed.
# Lives in Agent Fishtank.app/Contents/Resources/bin (macOS) or resources/bin (Linux).
DIR="$(cd "$(dirname "$0")" && pwd)"
APP="$DIR/../../MacOS/Agent Fishtank"
[ -x "$APP" ] || APP="$DIR/../../agent-fishtank"
ELECTRON_RUN_AS_NODE=1 exec "$APP" "$DIR/../cli/cli.mjs" "$@"
