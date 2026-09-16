#!/bin/bash
# Reliable act-four liveness check.
#
# `pgrep -f "longitude_xl.py 2000"` MATCHES ITS OWN SHELL: the wrapper bash -c
# carries the pattern inside its command string, so it reports ALIVE on a dead
# harness. Match the python process by its executable instead.
alive() { pgrep -x python3 >/dev/null 2>&1 && \
          ps -o pid=,cmd= -C python3 2>/dev/null | grep -q "scripts/longitude_xl.py"; }
if alive; then
  echo "harness ALIVE  pid=$(ps -o pid=,cmd= -C python3 | grep 'scripts/longitude_xl.py' | awk '{print $1}' | head -1)"
else
  echo "harness DOWN"
fi
echo -n "kernel 4160: ";   curl -s -m 5 http://127.0.0.1:4160/health   >/dev/null && echo UP || echo DOWN
echo -n "embedder 9302: "; curl -s -m 5 http://127.0.0.1:9302/v1/models >/dev/null && echo UP || echo DOWN
echo "log mtime:   $(stat -c '%y' /tmp/longitude_xl/run.log | cut -d. -f1)  (now $(date -u '+%Y-%m-%d %H:%M:%S'))"
python3 -c "import json;s=json.load(open('/tmp/longitude_xl/state.json'));print('next_day  ',s['next_day'])"
tail -3 /tmp/longitude_xl/run.log
