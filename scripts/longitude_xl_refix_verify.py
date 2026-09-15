#!/usr/bin/env python3
"""R15 verification — re-ask act three's STRICT MISSES against the repaired world.

The fix pass (D-0088) repaired three name-damage families and one live lookup
defect. Unit tests prove each shape in isolation; this asks the real questions
the act actually got wrong, against the real 1500-day world, through the real
agent, and scores them with the same strict rubric the act used.

It separates two things that look identical in an aggregate:
  * FIXED    — the answer is now right (the repair reached it)
  * ABSENT   — still "not found" because the fact genuinely is not stored
               anywhere (a re-teach item for a future chapter, not a defect)

Read-only with respect to memory: it asks, it never teaches.

Usage: python3 scripts/longitude_xl_refix_verify.py [kernel_url] [--limit N]
"""
from __future__ import annotations

import importlib.util
import json
import sys
import time
from pathlib import Path

import httpx

K = next((a for a in sys.argv[1:] if a.startswith("http")), "http://127.0.0.1:4160")
LIMIT = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else 0
RESCORE = Path("/tmp/claude-0/-home-user-J-A-R-V-I-S/5b9f29f3-2d39-51dd-8dfc-80efb170532a/scratchpad/rescore_final.jsonl")

# the harness's own catalog + strict scorer, loaded exactly as the re-score does
_argv = sys.argv
sys.argv = ["x", "1500"]
_spec = importlib.util.spec_from_file_location("xl", Path(__file__).with_name("longitude_xl.py"))
xl = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(xl)
sys.argv = _argv
sys.path.insert(0, str(Path(__file__).resolve().parent))
from longitude_xl_strict import StrictScorer  # noqa: E402


def agent(objective: str, max_steps: int = 6) -> str:
    r = httpx.post(
        f"{K}/agent/run",
        json={"objective": objective, "maxSteps": max_steps,
              "privacyClass": "STANDARD", "autoApprove": "allow-for-session"},
        timeout=600,
    ).json()
    return str(r.get("answer") or r.get("summary") or "")


def main() -> int:
    rows = [json.loads(l) for l in RESCORE.open() if l.strip()]
    miss = [r for r in rows if r.get("day", 0) >= 1001 and r.get("strict") == 0]
    if LIMIT:
        miss = miss[:LIMIT]
    print(f"# R15 verification — {len(miss)} act-three strict misses re-asked against {K}\n")
    print(f"Run {time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime())}. "
          f"Scored by the same StrictScorer the act used. Asking only — nothing is taught.\n")

    names = [e["name"] for e in httpx.get(f"{K}/memory/entities", timeout=60).json()["entities"]]
    S = StrictScorer(names, [], xl.VALUE_POOLS, xl.NEG, xl.RETIRED_RE)

    out = {"fixed": [], "absent": [], "still_wrong": []}
    for i, r in enumerate(miss, 1):
        q = str(r.get("topic") or "")
        if not q:
            continue
        ans = agent(f"From your memory, answer in one line. Check entity/graph memory and stored "
                    f"preferences; say 'not found' if it is truly not there.\n\n{q}")
        truth = str(r.get("truth") or "")
        kind = str(r.get("kind") or "")
        # the pool comes from the catalog fact, not the re-score row
        cat = xl.FACT_BY_ID.get(str(r.get("fid")))
        pool = str(cat.get("pool")) if cat else ""
        asked = str(cat.get("topic")) if cat else None
        if kind == "retired" or not pool or pool not in xl.VALUE_POOLS:
            score, cls = S.retired({"truth": truth, "topic": (asked or q)}, ans)
        else:
            score, cls = S.fact({"truth": truth}, ans, pool, asked)
        bucket = "fixed" if score == 1 else ("absent" if "not found" in ans.lower() else "still_wrong")
        out[bucket].append({"day": r.get("day"), "kind": kind, "q": q, "truth": truth,
                            "was": r.get("class"), "now": cls, "answer": ans[:200]})
        print(f"{i:>3}. [{kind:<8}] {bucket:<11} was={r.get('class'):<13} {q[:64]}")

    n = sum(len(v) for v in out.values())
    print(f"\n## Result over {n} re-asked misses\n")
    for k in ("fixed", "absent", "still_wrong"):
        print(f"  {k:<12} {len(out[k]):>3}  ({100*len(out[k])/n:.1f}%)" if n else f"  {k}: 0")
    for k in ("fixed", "absent", "still_wrong"):
        by = {}
        for e in out[k]:
            by[e["kind"]] = by.get(e["kind"], 0) + 1
        print(f"  {k:<12} by kind: {by}")
    Path("/tmp/refix_verify.json").write_text(json.dumps(out, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
