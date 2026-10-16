#!/bin/sh
# Starts the Firebase emulators, loads the test users, and serves the site against them.
# Usage: dev/start.sh [site folder] (defaults to this checkout)
set -e
DEV=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "${1:-$DEV/..}" && pwd)
cd "$DEV"
[ -d node_modules ] || npm install --no-audit --no-fund
# The emulators only read rules from inside this folder, and they should be the served checkout's rules.
mkdir -p rules && cp "$ROOT/firestore.rules" "$ROOT/storage.rules" rules/
npx firebase emulators:start --project railroadradar-accounts --config firebase.json &
EMU=$!
trap 'kill $EMU $WEB 2>/dev/null' EXIT INT TERM
node seed.mjs "$ROOT"
python3 serve.py "$ROOT" &
WEB=$!
wait $EMU
