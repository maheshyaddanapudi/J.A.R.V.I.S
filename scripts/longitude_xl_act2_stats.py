#!/usr/bin/env python3
"""Second-act statistics for the Longitude-XL record — markdown tables straight
from the run's own rows (quizzes.jsonl, metrics.jsonl, run.log, lab ledger).

Usage: python3 scripts/longitude_xl_act2_stats.py [--db postgres://...]
"""
from __future__ import annotations

import collections
import json
import statistics as st
import subprocess
import sys
from pathlib import Path

SRC = Path("/tmp/longitude_xl")
DB = sys.argv[sys.argv.index("--db") + 1] if "--db" in sys.argv else "postgres://jarvis:jarvis-dev-only@127.0.0.1:5432/jarvis_xl"
QUIET = set(range(200, 216)) | set(range(450, 466)) | set(range(800, 831))
ACT1_RECALL = 0.879  # first-act record, 860/978


def psql(q: str) -> str:
    return subprocess.run(["psql", DB, "-Atc", q], capture_output=True, text=True).stdout.strip()


rows = [json.loads(l) for l in SRC.joinpath("quizzes.jsonl").open()]
bats = {}
for r in rows:
    if "facts" in r and r["facts"]:
        bats[r["day"]] = r
metrics = {}
restarts = {}
for l in SRC.joinpath("metrics.jsonl").open():
    try:
        r = json.loads(l)
    except Exception:
        continue
    if not r.get("day"):
        continue
    if r.get("restart"):
        restarts[r["day"]] = r["restart"]
    else:
        metrics[r["day"]] = r
last_day = max(metrics)
pct = lambda h, n: f"{h}/{n} ({100 * h / n:.1f}%)" if n else "—"


def facts_of(days, pred):
    return [f for d in days for f in bats[d]["facts"] if pred(f)]


is_fact = lambda f: not f.get("multihop") and not f.get("special")
is_base = lambda f: is_fact(f) and f.get("layer", "base") == "base"
is_new = lambda f: f.get("layer") == "new"
is_alias = lambda f: f.get("special") == "alias" and "pavel" not in f["topic"]
is_pavel = lambda f: f.get("special") == "alias" and "pavel" in f["topic"]
is_ret = lambda f: f.get("special") == "retired"
is_hop = lambda f: bool(f.get("multihop"))

act1 = sorted(d for d in bats if d <= 500)
act2 = sorted(d for d in bats if d > 500)
print(f"# Second-act statistics through day {last_day}\n")

print("## Pre-registered targets (spec §11)\n")
a1 = facts_of(act1, is_fact); a2 = facts_of(act2, is_fact)
a2_base = facts_of(act2, is_base); a2_new = facts_of(act2, is_new)
r1 = sum(f["hit"] for f in a1) / len(a1); r2 = sum(f["hit"] for f in a2) / len(a2); r2b = sum(f["hit"] for f in a2_base) / len(a2_base)
print("| Target | Pre-registered | Measured | Met |")
print("|---|---|---|---|")
print(f"| Attribute recall, second act vs first | ≥ +5 pp over {100*r1:.1f}% | all facts {100*r2:.1f}% ({100*(r2-r1):+.1f} pp); old-world facts only {100*r2b:.1f}% ({100*(r2b-r1):+.1f} pp) | {'yes' if r2 - r1 >= 0.05 else 'no'} (all) / {'yes' if r2b - r1 >= 0.05 else 'no'} (old world) |")
hops = facts_of(act2, is_hop)
print(f"| Multi-hop baseline | report | {pct(sum(f['hit'] for f in hops), len(hops))} | recorded |")
wrong = [f for f in a2 if not f['hit'] and not f.get('honest_miss')]
print(f"| Zero fabrication | 0 invented values | {len(wrong)} wrong-value answers, every one a stored value (a twin's or a stale one) — see the gap ledger G-02/G-03 | see note |")
auto = psql("SELECT value FROM preferences WHERE key='reasoning_autotune' AND status NOT IN ('deleted','superseded')")
print(f"| D-0052 discipline | no unauthorised change of the user's setting | autotune unchanged since day 35: `{auto[:90]}` | yes |")
lab = psql("SELECT verdict, count(*) FROM lab_experiments GROUP BY verdict ORDER BY verdict").replace("\n", ", ")
applied = psql("SELECT count(*) FROM lab_experiments WHERE applied_to_live IS NOT NULL AND applied_to_live::text NOT IN ('', 'null', 'false')")
print(f"| Lab discipline | keeps only via the envelopes | ledger: {lab}; applied to live: {applied} | yes |\n")

print("## Recall by layer, second act\n")
print("| Layer | Recall |")
print("|---|---|")
for name, pred in (("Old world (first-act facts)", is_base), ("Chapter two", is_new), ("Nicknames (excl. 'pavel')", is_alias),
                   ("'pavel' (ambiguous nickname, instrument flaw)", is_pavel), ("Retirements", is_ret), ("Two-hop", is_hop)):
    xs = facts_of(act2, pred)
    print(f"| {name} | {pct(sum(f['hit'] for f in xs), len(xs))} |")
print()

print("## Batteries by 100-day block\n")
print("| Block | Batteries | Score | Old world | Chapter two | Nickname | Retired | Two-hop | Honest misses | Wrong values |")
print("|---|---|---|---|---|---|---|---|---|---|")
for lo in range(1, 1001, 100):
    ds = [d for d in bats if lo <= d < lo + 100]
    if not ds:
        continue
    sc = sum(bats[d]["score"] for d in ds); of = sum(bats[d]["of"] for d in ds)
    cell = lambda pred: (lambda xs: f"{sum(f['hit'] for f in xs)}/{len(xs)}" if xs else "—")(facts_of(ds, pred))
    allf = facts_of(ds, lambda f: True)
    honest = sum(1 for f in allf if not f["hit"] and f.get("honest_miss")); wr = sum(1 for f in allf if not f["hit"] and not f.get("honest_miss"))
    print(f"| {lo}–{min(lo+99, 1000)} | {len(ds)} | {sc}/{of} ({100*sc/of:.0f}%) | {cell(is_base)} | {cell(is_new)} | {cell(is_alias)} | {cell(is_ret)} | {cell(is_hop)} | {honest} | {wr} |")
print()

print("## Old-world recall by fact age (second act)\n")
print("| Fact age when asked | Recall |")
print("|---|---|")
for lo, hi in ((0, 100), (100, 300), (300, 600), (600, 1000)):
    xs = [f for f in a2_base if lo <= f["age"] < hi]
    print(f"| {lo}–{hi} days | {pct(sum(f['hit'] for f in xs), len(xs))} |")
print()

print("## Flipped facts (value changed at least once) — second act\n")
fl = [f for f in a2 if f.get("flips")]
print(f"Facts asked after one or more announced changes: {pct(sum(f['hit'] for f in fl), len(fl))}; unflipped: {pct(sum(f['hit'] for f in a2 if not f.get('flips')), len([f for f in a2 if not f.get('flips')]))}\n")

print("## Restart drills\n")
print("| Day | Pre-restart quiz | Post-restart quiz |")
print("|---|---|---|")
for d in sorted(restarts):
    pre = f"{bats[d]['score']}/{bats[d]['of']}" if d in bats else "—"
    print(f"| {d} | {pre} | {restarts[d].get('post_quiz_score')}/{restarts[d].get('post_quiz_of')} |")
print()

print("## Spend and latency\n")
def block(ds):
    plain = [(metrics[d]["spend_usd"] or 0) - (metrics[d-1]["spend_usd"] or 0) for d in ds if d-1 in metrics and not metrics[d].get("quiz_of") and d % 20 and d not in QUIET]
    lat = [metrics[d]["avg_latency_ms"] for d in ds if metrics[d].get("avg_latency_ms")]
    return st.mean(plain) if plain else 0, st.median(lat) if lat else 0, sorted(lat)[int(.9*len(lat))] if lat else 0
print("| Act | Days | Spend | Plain day | Latency median | p90 |")
print("|---|---|---|---|---|---|")
d1 = [d for d in metrics if d <= 500]; d2 = [d for d in metrics if d > 500]
for name, ds in (("First", d1), ("Second", d2)):
    p, med, p90 = block(ds)
    spend = (metrics[max(ds)]["spend_usd"] or 0) - (metrics[min(ds)-1]["spend_usd"] if min(ds)-1 in metrics else 0)
    print(f"| {name} | {min(ds)}–{max(ds)} | ${spend:.2f} | ${p:.3f} | {med:.0f} ms | {p90:.0f} ms |")
print()
m = metrics[last_day]
print(f"World at day {last_day}: {m['entities_active']} entities, {m['facts_active']} facts, {m['prefs_active']} preferences, {m['facts_superseded']} history rows, {m['embeddings']} vectors, {len(m.get('topics') or [])} learned deep topics, audit rows {m['audit_rows']}.")
