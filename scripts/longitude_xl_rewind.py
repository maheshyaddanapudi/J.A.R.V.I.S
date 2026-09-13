#!/usr/bin/env python3
"""Rewind the Longitude-XL harness checkpoint to the END of a given day by
DETERMINISTIC REPLAY of the harness's own pure state logic (teach_due →
drain_teach), starting from a preserved base state. Used after a void period
(provider dead) so the days are re-run for real instead of being counted.

    python3 scripts/longitude_xl_rewind.py <target_day> [--verify-against <state.json>]
        [--base docs/verification/longitude_xl/state.json] [--write /tmp/longitude_xl/state.json]

--verify-against replays to that state's (next_day-1) and asserts the teach
queue / delivered / announced ledgers reproduce it exactly — proof the replay
matches what the harness actually did — before anything is written.
The DB is NOT touched here: un-age the world separately (+N days on the same
column set shift_world_one_day() uses, N = number of void nights).
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("target_day", type=int)
ap.add_argument("--base", default="docs/verification/longitude_xl/state.json")
ap.add_argument("--verify-against", default=None)
ap.add_argument("--write", default=None)
ap.add_argument("--vec-count", type=int, default=None, help="current memory_embeddings count for the guard")
args = ap.parse_args()

sys.argv = ["x", "1000"]  # the catalog is pinned to LIFE=1000
spec = importlib.util.spec_from_file_location("xl", Path(__file__).with_name("longitude_xl.py"))
xl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(xl)  # type: ignore[union-attr]


def replay(base: dict, upto: int) -> dict:
    s = json.loads(json.dumps(base))
    for day in range(base["next_day"], upto + 1):
        s.setdefault("teach_queue", []).extend(xl.teach_due(day))
        if day not in xl.QUIET:
            xl.drain_teach(s, day)
    s["next_day"] = upto + 1
    return s


base = json.loads(Path(args.base).read_text())
assert base.get("catalog_hash") == xl.CATALOG_HASH, "base state catalog hash mismatch"

if args.verify_against:
    cur = json.loads(Path(args.verify_against).read_text())
    got = replay(base, cur["next_day"] - 1)
    for k in ("teach_queue", "delivered", "announced"):
        if got.get(k) != cur.get(k):
            print(f"VERIFY FAILED on '{k}': replay != current")
            sys.exit(1)
    print(f"verified: replay {base['next_day']}..{cur['next_day']-1} reproduces the current ledgers exactly")

out = replay(base, args.target_day)
# scalar fields that the replay cannot derive come from the newest state
src = json.loads(Path(args.verify_against).read_text()) if args.verify_against else base
for k in ("repins", "last_override_at", "pending_repin"):
    if k in src:
        out[k] = src[k]
out["last_vec_day"] = args.target_day
if args.vec_count is not None:
    out["last_vec_count"] = args.vec_count
print(f"rewound state: next_day={out['next_day']} queue={len(out.get('teach_queue', []))} "
      f"delivered={len(out.get('delivered', {}))} announced_sum={sum(out.get('announced', {}).values())}")
if args.write:
    Path(args.write).write_text(json.dumps(out))
    print(f"-> wrote {args.write}")
