#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd -- "$(dirname -- "$0")" || exit 1
source tools/android-env.sh

finish() {
  local code="$1"
  printf '\nPress Enter to close...'
  read -r _
  exit "$code"
}

node_bin="$(command -v node 2>/dev/null)"
if [ -z "$node_bin" ]; then
  bundled_node="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
  [ ! -x "$bundled_node" ] || node_bin="$bundled_node"
fi
if [ -z "$node_bin" ] || ! "$node_bin" -e 'const [major,minor]=process.versions.node.split(".").map(Number);process.exit(major>22 || (major===22 && minor>=12) ? 0 : 1)'; then
  echo 'Node.js 22.12+ is required. Install Node.js and try again.'
  finish 1
fi

# Fixed config: edit testCases here before running. No file picker.
"$node_bin" MainManager/run.mjs
result=$?
finish "$result"
