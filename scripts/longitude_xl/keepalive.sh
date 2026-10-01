#!/bin/bash
# Longitude-XL keepalive watcher.
#
# WHY: the container is reclaimed on session inactivity, which kills the
# detached harness a few minutes after each hourly wake — days 1555/1556 got
# 2 simulated days out of a 60-minute hour. This watcher runs as a foreground
# background-task for the session so the container stays warm, and restarts the
# harness in place if it dies while the container survives.
#
# SAFETY — this script relaunches nothing when any of these hold:
#   * /tmp/longitude_xl/PAUSED exists  (a human stopped the act deliberately;
#     the 2026-09-13 incident — an automated carrier resumed a run over an
#     unanswered question and destroyed the evidence the pause protected)
#   * the last log lines carry FATAL or HALT (credits, bad key, cost cap)
# In every such case it exits with a reason on stdout and leaves the act alone.
#
# Usage: keepalive.sh [minutes]   (default 50)
set -u
XL=/tmp/longitude_xl
REPO=/home/user/J.A.R.V.I.S
MINUTES=${1:-50}
DEADLINE=$(( $(date +%s) + MINUTES * 60 ))
RELAUNCHES=0

alive() { ps -o cmd= -C python3 2>/dev/null | grep -q "scripts/longitude_xl.py"; }

blocked() {
  if [ -f "$XL/PAUSED" ]; then echo "PAUSED file present"; return 0; fi
  if tail -n 5 "$XL/run.log" 2>/dev/null | grep -qE "FATAL|HALT"; then
    echo "FATAL/HALT in the last log lines"; return 0
  fi
  return 1
}

relaunch() {
  curl -s -m 5 http://127.0.0.1:9302/v1/models >/dev/null 2>&1 \
    || bash "$XL/restart_embedder.sh" >/tmp/emb_restart.log 2>&1
  for _ in 1 2 3 4 5 6 7 8; do
    curl -s -m 3 http://127.0.0.1:9302/v1/models >/dev/null 2>&1 && break
    sleep 3
  done
  cd "$REPO" || return 1
  set -a; . "$REPO/.claude/graphify.env"; set +a
  XL_COST_CAP_USD=450 setsid nohup python3 -u "$REPO/scripts/longitude_xl.py" 2000 \
    >> "$XL/run.log" 2>&1 < /dev/null &
  disown
  RELAUNCHES=$(( RELAUNCHES + 1 ))
}

echo "keepalive: watching for ${MINUTES}m from $(date -u '+%H:%M:%S')"
while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  if reason=$(blocked); then
    echo "keepalive: STOPPING — $reason. Relaunched $RELAUNCHES time(s) this window."
    exit 0
  fi
  if ! alive; then
    echo "keepalive: harness down at $(date -u '+%H:%M:%S') — relaunching from $(python3 -c "import json;print(json.load(open('$XL/state.json'))['next_day'])" 2>/dev/null)"
    relaunch
    sleep 25
    alive && echo "keepalive: back up" || echo "keepalive: relaunch did NOT take"
  fi
  sleep 30
done
echo "keepalive: window done at $(date -u '+%H:%M:%S'). Relaunched $RELAUNCHES time(s)."
alive && echo "harness ALIVE" || echo "harness DOWN"
python3 -c "import json;print('next_day', json.load(open('$XL/state.json'))['next_day'])"
tail -n 3 "$XL/run.log"
