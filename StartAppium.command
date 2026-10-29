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

# Restart only an Appium listener owned by this user. Active sessions will end.
listener_pids=$(/usr/sbin/lsof -nP -t -iTCP:4723 -sTCP:LISTEN 2>/dev/null | /usr/bin/sort -u)
for server_pid in $listener_pids; do
  server_command=$(/bin/ps -p "$server_pid" -o command=)
  server_owner=$(/bin/ps -p "$server_pid" -o uid= | /usr/bin/tr -d ' ')
  [ "$server_owner" = "$(id -u)" ] || fail "Port 4723 belongs to another user; not stopping PID $server_pid."
  if ! printf '%s\n' "$server_command" | /usr/bin/grep -Eq '(^|[ /])appium([ /]|$)'; then
    fail "Port 4723 is used by a non-Appium process (PID $server_pid)."
  fi

  echo "Stopping previous Appium server (PID $server_pid). Existing sessions will end."
  kill -TERM "$server_pid" 2>/dev/null || true
  for ((attempt = 0; attempt < 50; attempt++)); do
    kill -0 "$server_pid" 2>/dev/null || break
    sleep 0.2
  done
  if kill -0 "$server_pid" 2>/dev/null; then
    # Recheck identity before forcing shutdown in case the PID was reused.
    current_command=$(/bin/ps -p "$server_pid" -o command=)
    [ "$current_command" = "$server_command" ] || fail 'Process identity changed; restart cancelled.'
    echo "Appium did not stop in 10 seconds; forcing shutdown (PID $server_pid)."
    kill -KILL "$server_pid" 2>/dev/null || true
  fi
done

# Verify the old listener released its port before starting the new server.
for ((attempt = 0; attempt < 20; attempt++)); do
  /usr/sbin/lsof -nP -t -iTCP:4723 -sTCP:LISTEN >/dev/null 2>&1 || break
  sleep 0.1
done
if /usr/sbin/lsof -nP -t -iTCP:4723 -sTCP:LISTEN >/dev/null 2>&1; then
  fail 'Port 4723 is still occupied. Appium was not started.'
fi

# Listen locally, matching Main Manager.
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
