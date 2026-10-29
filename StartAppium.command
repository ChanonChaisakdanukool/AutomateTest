#!/bin/bash
# Open from Finder; always use this project's Appium installation.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd -- "$(dirname -- "$0")" || exit 1
source tools/android-env.sh

fail() {
  echo "$1"
  printf '\nPress Enter to close...'
  read -r _
  exit 1
}

node_bin="$(command -v node 2>/dev/null)"
if [ -z "$node_bin" ]; then
  bundled_node="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
  [ ! -x "$bundled_node" ] || node_bin="$bundled_node"
fi
[ -n "$node_bin" ] || fail 'Node.js is required.'
"$node_bin" -e 'const [major,minor]=process.versions.node.split(".").map(Number);process.exit(major>22 || (major===22 && minor>=12) ? 0 : 1)' || fail 'Node.js 22.12+ is required.'
[ -f node_modules/appium/build/lib/main.js ] || fail 'Appium is missing. Run npm install in this project first.'

# Listen locally, matching Main Manager. Appium reports port conflicts itself.
echo 'Starting Appium at http://127.0.0.1:4723/'
echo 'Keep this window open while running tests. Press Control+C to stop.'
"$node_bin" node_modules/appium/build/lib/main.js --address 127.0.0.1 --port 4723
result=$?
if [ "$result" -ne 0 ]; then
  printf '\nAppium stopped with exit code %s. Check the error above.\n' "$result"
  printf 'Press Enter to close...'
  read -r _
fi
exit "$result"
