#!/usr/bin/env python3
"""D-0080 replay instrument (RETRIEVAL_FIDELITY_SPEC §9).

Re-asks every fact the Longitude-XL quizzes MISSED, but through the kernel's
recall endpoints directly — no answering model, no tool choice — against the
preserved day-500 database. This isolates the retrieval layer:

  graph    GET /memory/graph?q=<question>      (memory.recallGraph — the path S1 fixes)
  exact    GET /memory/entities/<topic>        (memory.recall by exact name)
  prefs    GET /memory/preferences             (memory.recallPreferences, topic-scoped)

For each miss we record which probes SURFACE the current announced truth, and
classify: surfaced-by-graph / present-but-graph-missed / absent-everywhere.
Run before a fix for the baseline, after for the delta. Zero LLM cost.

Usage: python3 scripts/longitude_replay.py <label> [kernel_url] [snapshot_dir]
"""
from __future__ import annotations

import importlib.util
import json
import re
import sys
from pathlib import Path

import httpx

LABEL = sys.argv[1] if len(sys.argv) > 1 else "baseline"
K = sys.argv[2] if len(sys.argv) > 2 else "http://127.0.0.1:4170"
SNAP = Path(sys.argv[3] if len(sys.argv) > 3 else "docs/verification/longitude_xl")

# the world, for question text + announced truth
sys.argv = ["x", "1000"]
spec = importlib.util.spec_from_file_location("xl", Path(__file__).with_name("longitude_xl.py"))
xl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(xl)  # type: ignore[union-attr]
STATE = json.loads((SNAP / "state.json").read_text())
FACT = {f["fid"]: f for f in xl.ALL_FACTS}


def has(text: str, truth: str) -> bool:
    t = text.lower()
    return all(w in t for w in truth.lower().split())


def scoped_prefs(prefs: list[dict], topic: str) -> str:
    toks = [w for w in re.split(r"\W+", topic.lower()) if len(w) > 2]
    return " ".join(p["value"] for p in prefs
                    if all(w in p["key"].lower().replace("_", " ") for w in toks))


def main() -> None:
    misses: dict[str, dict] = {}
    for line in (SNAP / "quizzes.jsonl").open():
        r = json.loads(line)
        for f in r.get("facts", []):
            if f["hit"] or f["fid"] == "hop" or f["fid"] in misses:
                continue
            misses[f["fid"]] = {"fid": f["fid"], "first_missed_day": r["day"], "topic": f["topic"], "pref": f["pref"]}
    prefs = httpx.get(f"{K}/memory/preferences", timeout=60).json()["preferences"]

    rows = []
    for fid, m in misses.items():
        fact = FACT[fid]
        truth = xl.announced_truth(STATE, fid)
        q = xl.fact_question(fact)
        via: list[str] = []
        # graph (recallGraph)
        g = httpx.get(f"{K}/memory/graph", params={"q": q}, timeout=60).json()
        gtext = " ".join(" ".join(e.get("facts", [])) + " " + e.get("name", "") for e in g.get("entities", []))
        if has(gtext, truth):
            via.append("graph")
        # exact
        ex = httpx.get(f"{K}/memory/entities/{fact['topic'].replace(' ', '%20')}", timeout=30)
        etext = " ".join(x.get("statement", "") for x in ex.json().get("facts", [])) if ex.status_code == 200 else ""
        if has(etext, truth):
            via.append("exact")
        # prefs
        if has(scoped_prefs(prefs, fact["topic"]), truth):
            via.append("prefs")
        # Defect A is a GRAPH defect only when the value is in the graph (exact
        # probe) and recallGraph still missed it. A value that lives only in
        # preferences is structurally invisible to the graph — the agent's
        # memory.recallPreferences is the right path for it, not a graph bug.
        klass = ("surfaced_by_graph" if "graph" in via
                 else "in_graph_but_missed" if "exact" in via
                 else "prefs_only" if "prefs" in via
                 else "absent")
        rows.append({**m, "question": q, "truth": truth, "via": via, "class": klass,
                     "graph_mode": g.get("mode"), "graph_seed0": (g.get("entities") or [{}])[0].get("name")})

    n = len(rows)
    agg = {k: sum(1 for r in rows if r["class"] == k)
           for k in ("surfaced_by_graph", "in_graph_but_missed", "prefs_only", "absent")}
    by_any = sum(1 for r in rows if r["via"])
    out = {"label": LABEL, "kernel": K, "misses": n, "aggregate": agg,
           "surfaced_by_any_probe": by_any, "rows": rows}
    dest = SNAP / f"replay_{LABEL}.json"
    dest.write_text(json.dumps(out, indent=1))
    print(f"REPLAY [{LABEL}] over {n} preserved misses against {K}")
    seed_ok = sum(1 for r in rows if (r.get("graph_seed0") or "").lower() == r["topic"].lower())
    print(f"  surfaced by graph (recallGraph):     {agg['surfaced_by_graph']:>3}  ({100*agg['surfaced_by_graph']/n:.0f}%)")
    print(f"  in the graph, but graph missed it:   {agg['in_graph_but_missed']:>3}  ({100*agg['in_graph_but_missed']/n:.0f}%)  <- Defect A (true graph miss)")
    print(f"  lives in preferences only:           {agg['prefs_only']:>3}  ({100*agg['prefs_only']/n:.0f}%)  (graph cannot see; recallPreferences can)")
    print(f"  absent from every store:             {agg['absent']:>3}  ({100*agg['absent']/n:.0f}%)  <- Defect B")
    print(f"  seed[0] == the asked entity:         {seed_ok:>3}  ({100*seed_ok/n:.0f}%)  <- precision")
    print(f"  surfaced by ANY probe:               {by_any:>3}  ({100*by_any/n:.0f}%)")
    print(f"  -> {dest}")


if __name__ == "__main__":
    main()
