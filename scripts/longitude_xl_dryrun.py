#!/usr/bin/env python3
"""Longitude-XL dry run — the whole day engine for the act about to run
(third act 1001–1500, fourth act 1501–2000; horizon from XL_DRYRUN_TO)
WITHOUT the model or the kernel (no HTTP), on a copy of the real checkpoint.

Proves before launch (RUNBOOK_ACT3.md step 6):
  - the base and chapter-two hashes are byte-unchanged (a resume is safe);
  - chapter three builds and its assertions hold (unique nicknames, re-teach
    topics exist, anchors are devices);
  - every chapter-three fact gets delivered and every re-teach fact recapped;
  - no day exceeds the act cap; the hop truth has one maintainer per device;
  - the strict scorer classifies the canonical shapes as designed.

Usage: python3 scripts/longitude_xl_dryrun.py [/tmp/longitude_xl/state.json]
Exit 0 only if every check passes.
"""
from __future__ import annotations

import collections
import copy
import importlib.util
import json
import random
import os
import sys
from pathlib import Path

STATE = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/longitude_xl/state.json")
HORIZON = int(os.environ.get("XL_DRYRUN_TO", "1500"))
sys.argv = ["x", str(HORIZON)]
_spec = importlib.util.spec_from_file_location("xl", Path(__file__).with_name("longitude_xl.py"))
xl = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(xl)

failures: list[str] = []


def check(cond: bool, msg: str) -> None:
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        failures.append(msg)


print(f"hashes: catalog {xl.CATALOG_HASH} · chapter two {xl.EXPANSION_HASH} · chapter three {xl.CHAPTER3_HASH}"
      + (f" · chapter four {xl.CHAPTER4_HASH}" if HORIZON > 1500 else ""))
check(xl.CATALOG_HASH == "9206ceb12fd98ad6", "base catalog hash unchanged")
check(xl.EXPANSION_HASH == "10a2cef1fd90db2c", "chapter-two hash unchanged")
c3 = xl.CHAPTER3
print(f"chapter three: {len(c3['topics'])} topics / {len(xl.CH3_FACTS)} facts / {len(c3['aliases'])} aliases / "
      f"{len(c3['retirements'])} retirements / {len(c3['relations'])} cross-links / re-teach {len(xl.RETEACH_FIDS)} facts")
world_first = [t["name"].split()[0] for t in xl.CATALOG + xl.EXPANSION["topics"] + c3["topics"] if t["kind"] == "person"]
check(all(world_first.count(a["alias"]) == 1 for a in c3["aliases"]), "every chapter-three nickname is unique in the world (G-12)")
check(all(a["alias"] in xl.UNIQUE_HANDLES for a in c3["aliases"]), "chapter-three handles are in the unique set")

state = json.loads(STATE.read_text())
check(state.get("catalog_hash") == xl.CATALOG_HASH, "checkpoint catalog hash matches")
check(state.get("expansion_hash") in (None, xl.EXPANSION_HASH), "checkpoint chapter-two hash matches")
st = copy.deepcopy(state)
kinds: collections.Counter = collections.Counter()
per_day: dict[int, int] = {}
start = max(int(st.get("next_day", 1001)), xl.CHAPTER3_FROM if HORIZON <= 1500 else xl.CHAPTER4_FROM)
for day in range(start, HORIZON + 1):
    rng = random.Random(xl.SEED * 100000 + day)
    st.setdefault("teach_queue", []).extend(xl.teach_due(day))
    teach_acts = [] if day in xl.QUIET else xl.drain_teach(st, day)
    acts = xl.plan_day(day, rng, teach_acts)
    per_day[day] = len(acts)
    for k, _ in acts:
        kinds[k] += 1
print(f"day engine {start}–{HORIZON}: acts/day {min(per_day.values())}–{max(per_day.values())}, kinds {dict(kinds)}")
check(max(per_day.values()) <= 12, "no day exceeds the 12-act cap")
if HORIZON > 1500:
    check(sum(1 for f in xl.CH4_FACTS if f["fid"] in st["delivered"]) == len(xl.CH4_FACTS), "every chapter-four fact delivered by the horizon")
    check(len({a["alias"] for a in xl.CHAPTER4["aliases"]} & xl.UNIQUE_HANDLES) == len(xl.CHAPTER4["aliases"]), "every chapter-four handle is unique in the world (G-12)")
    check(all(r["name"] in {t2["name"] for t2 in xl.CHAPTER3["topics"]} for r in xl.CHAPTER4["retirements"]), "chapter-four retirements are chapter-three things (measured on what this kernel wrote)")
else:
    check(sum(1 for f in xl.CH3_FACTS if f["fid"] in st["delivered"]) == len(xl.CH3_FACTS), "every chapter-three fact delivered by day 1500")
check(len(st.get("retaught", {})) == len(xl.RETEACH_FIDS), "every re-teach fact recapped")
check(not st["teach_queue"], "teach queue drained by the horizon")
cur = xl.current_relations(1501)
per_device = collections.Counter(r["to"] for r in cur if r["verb"] == "maintains")
check(max(per_device.values()) == 1, "hop truth: one maintainer per device (current_relations)")
check(sum(1 for a in cur for b in cur if xl.two_hop_question(a, b)) >= 60, "≥60 two-hop chains available")

S = xl.scorer()
check(S.fact({"truth": "teal"}, "teal", "color", "coral census") == (1, "hit"), "strict: plain correct value → hit")
check(S.fact({"truth": "teal"}, "the coral census two's status colour is teal", "color", "coral census")[1] == "twin", "strict: twin substitution → twin")
check(S.fact({"truth": "42"}, "conflicting records found — 42 and 68; cannot confirm", "number", None)[1] == "hedge", "strict: uncommitted conflict → hedge")
check(S.fact({"truth": "42"}, "not found — no record", "number", None)[1] == "honest", "strict: leading not-found → honest")
check(S.hop({"truth": "boat shed"}, "the kiln is located at the boat shed", "which place is the kiln — the one sanjay iyer maintains — located at?") == (1, "hit"), "strict hop: exact device + place → hit")
check(S.hop({"truth": "boat shed"}, "kiln north is located at the boat shed", "which place is the kiln — the one sanjay iyer maintains — located at?")[1] == "twin", "strict hop: twin device → twin")
check(S.retired({"topic": "Is the kiln still active?", "truth": "closed"}, "no — the kiln was wrapped up and is no longer active")[0] == 1, "strict retired: closed-word on the exact entity → hit")

print("RESULT:", "PASS" if not failures else f"FAIL ({len(failures)})")
sys.exit(0 if not failures else 1)
