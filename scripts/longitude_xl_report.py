#!/usr/bin/env python3
"""Longitude-XL evolution report — the run's own rows in one fixed, human format.

Reads /tmp/longitude_xl/{metrics,quizzes}.jsonl + run.log (the live series:
days 1-500 of the first act, then the second act) and prints:

  daily      one row per simulated day: memory growth (+Δ), night, latency,
             spend, quiz, and what happened that day (pins, restarts, quiet
             fortnights, promotions, overrides, chapter-two events)
  batteries  one row per quiz battery, split old-world / chapter two /
             nicknames / retirements / multi-hop, with miss kinds
  map        the milestone map from day 1 to now
  json       everything above as JSON (feeds the published page)

  --from N --to N     day range (daily)
  --since-last        daily rows after the last printed day (keepalive ticks)

Usage: python3 scripts/longitude_xl_report.py daily --from 600 --to 620
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
from pathlib import Path

SRC = Path("/tmp/longitude_xl")
LAST = SRC / ".report_last_day"
QUIET = (set(range(200, 216)) | set(range(450, 466)) | set(range(800, 831))
         | set(range(1200, 1216)) | set(range(1400, 1416)))
RESTARTS = {100, 300, 500, 700, 900, 1100, 1300}


def load_harness():
    sys.argv = ["x", "1000"]
    spec = importlib.util.spec_from_file_location("xl", Path(__file__).with_name("longitude_xl.py"))
    xl = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(xl)  # type: ignore[union-attr]
    return xl


def load() -> dict:
    metrics: dict[int, dict] = {}
    restarts: dict[int, dict] = {}
    for line in (SRC / "metrics.jsonl").open():
        try:
            r = json.loads(line)
        except Exception:
            continue
        if "day" not in r:
            continue
        if r.get("restart"):
            restarts[r["day"]] = r["restart"]
            continue
        metrics[r["day"]] = r  # last regular row per day wins
    batteries: dict[int, dict] = {}
    for line in (SRC / "quizzes.jsonl").open():
        try:
            r = json.loads(line)
        except Exception:
            continue
        if "facts" in r and r["facts"]:
            batteries[r["day"]] = r  # last battery per day (a re-run day replaces its void one)
    log = (SRC / "run.log").read_text(errors="replace").splitlines() if (SRC / "run.log").exists() else []
    return {"metrics": metrics, "restarts": restarts, "batteries": batteries, "log": log}


# ----------------------------------------------------------------- milestones ---
def milestones(d: dict, xl) -> list[dict]:
    ms: list[dict] = []
    add = lambda day, kind, text: ms.append({"day": day, "kind": kind, "text": text})
    days = sorted(d["metrics"])
    prev_topics: list[str] = []
    prev_auto = None
    for day in days:
        r = d["metrics"][day]
        t = r.get("topics") or []
        for x in t:
            if x not in prev_topics:
                add(day, "learned", f"learned to think deeply about '{x}' (promoted from repeated corrections)")
        for x in prev_topics:
            if x not in t:
                add(day, "hygiene", f"'{x}' removed from learned topics (D-0080 C3, the activity word learned during the outage)")
        prev_topics = t
        a = r.get("autotune") or {}
        key = (a.get("signalThreshold"), a.get("source"))
        if key != prev_auto:
            if a.get("source") == "jarvis":
                add(day, "override", f"J.A.R.V.I.S. set escalation threshold → {a.get('signalThreshold')} (its own evidence: {(a.get('reason') or '')[:60]})")
            elif a.get("source") == "user":
                add(day, "pin", f"user pinned escalation threshold = {a.get('signalThreshold')}")
            prev_auto = key
        lab = str(r.get("tick_lab") or "")
        m = re.search(r"(\d+) kept", lab)
        if m and int(m.group(1)) > 0:
            add(day, "lab-keep", f"Night Lab KEEP — an experiment beat the live baseline by the margin and was applied ({lab[:70]})")
    for day, info in sorted(d["restarts"].items()):
        add(day, "restart", f"kernel restart drill — memory intact, post-restart quiz {info.get('post_quiz_score')}/{info.get('post_quiz_of')}")
    for lo, hi in ((200, 215), (450, 465), (800, 830)):
        if lo <= max(days):
            add(lo, "quiet", f"quiet fortnight days {lo}–{hi}: no teaching, no chats — only the nightly cycle")
    add(1, "start", "day 1 — an empty memory; the first preference stored that day")
    add(500, "act", "end of the first act: 500 days, 353 facts taught, recall 87.9% flat, 0 fabrications; world snapshotted")
    add(501, "upgrade", "second act on the D-0080 kernel: identity-first recall, route-agnostic correction, judge-confirmed learning, tidy guard")
    if max(days) >= xl.EXPANSION_FROM:
        add(xl.EXPANSION_FROM, "chapter", f"chapter two begins: {len(xl.EXP_FACTS)} facts about {len(xl.EXPANSION['topics'])} new topics in new kinds, arriving over the next ~250 days")
    for a in xl.EXPANSION["aliases"]:
        if a["day"] <= max(days):
            add(a["day"], "alias", f"{a['person']} now goes by '{a['alias']}' — resolution by nickname from here on")
    for rt in xl.EXPANSION["retirements"]:
        if rt["day"] <= max(days):
            add(rt["day"], "retire", f"'{rt['name']}' wrapped up — records kept, no longer active")
    rels = [r for r in xl.EXPANSION["relations"]]
    if rels and rels[0]["teach"] <= max(days):
        add(rels[0]["teach"], "links", f"cross-links between chapters start (new people maintain old devices, vehicles at old places) — {len(rels)} edges through day {rels[-1]['teach']}")
    for line in d["log"]:
        if "[rewind]" in line:
            add(540, "outage", "provider credits ran out mid-day-540 (attempt 1): 4 void days rolled back by verified replay; harness now halts the same day")
        if "[act2-attempt1 ended]" in line:
            add(581, "restart-act", "attempt 1 stopped at day 581 — a preference-selector defect found in the audit; fixed, and the act restarted from the day-500 snapshot")
    order = {"start": 0, "pin": 1, "override": 2, "learned": 3, "hygiene": 4, "lab-keep": 5, "restart": 6, "quiet": 7,
             "act": 8, "upgrade": 9, "chapter": 10, "links": 11, "alias": 12, "retire": 13, "outage": 14, "restart-act": 15}
    return sorted(ms, key=lambda m: (m["day"], order.get(m["kind"], 99)))


# --------------------------------------------------------------------- daily ---
def day_notes(day: int, ms_by_day: dict[int, list[dict]], xl) -> str:
    notes = [m["kind"] for m in ms_by_day.get(day, [])]
    if day in QUIET:
        notes.append("quiet")
    if day % 20 == 0:
        notes.append("lab-night")
    return ",".join(dict.fromkeys(notes))


def daily_rows(d: dict, xl, lo: int, hi: int) -> list[dict]:
    ms_by_day: dict[int, list[dict]] = {}
    for m in milestones(d, xl):
        ms_by_day.setdefault(m["day"], []).append(m)
    out = []
    prev = None
    for day in sorted(d["metrics"]):
        r = d["metrics"][day]
        p = prev or {}
        dl = lambda k: (r.get(k) or 0) - (p.get(k) or 0) if prev else None
        b = d["batteries"].get(day)
        row = {
            "day": day,
            "entities": r.get("entities_active"), "d_entities": dl("entities_active"),
            "facts": r.get("facts_active"), "d_facts": dl("facts_active"),
            "superseded": r.get("facts_superseded"), "d_superseded": dl("facts_superseded"),
            "prefs": r.get("prefs_active"), "d_prefs": dl("prefs_active"),
            "episodes": r.get("episodes"), "vectors": r.get("embeddings"),
            "topics": len(r.get("topics") or []),
            "threshold": (r.get("autotune") or {}).get("signalThreshold"),
            "threshold_by": (r.get("autotune") or {}).get("source"),
            "deep_auto": r.get("deep_on_auto"),
            "latency_ms": r.get("avg_latency_ms"),
            "spend": r.get("spend_usd"), "d_spend": round((r.get("spend_usd") or 0) - (p.get("spend_usd") or 0), 2) if prev else None,
            "quiz": f"{r['quiz_score']}/{r['quiz_of']}" if r.get("quiz_of") else "",
            "quiz_pct": round(100 * r["quiz_score"] / r["quiz_of"]) if r.get("quiz_of") else None,
            "new_asked": r.get("quiz_new_asked"), "new_hits": r.get("quiz_new_hits"),
            "chapter2_delivered": r.get("expansion_delivered"),
            "night": "lab" if day % 20 == 0 else ("quiet" if day in QUIET else "sleep"),
            "notes": day_notes(day, ms_by_day, xl),
            "wall_s": r.get("day_wall_s"),
        }
        prev = r
        if lo <= day <= hi:
            out.append(row)
    return out


def fmt_delta(v) -> str:
    if v is None:
        return ""
    return f"{v:+d}" if isinstance(v, int) and v else ("" if not v else f"{v:+.2f}")


def print_daily(rows: list[dict]) -> None:
    hdr = f"{'day':>4} │ {'entities':>8} {'Δ':>4} │ {'facts':>6} {'Δ':>4} │ {'supersd':>7} {'Δ':>3} │ {'prefs':>5} {'Δ':>3} │ {'vec':>5} │ {'topics':>6} │ {'thr':>3} │ {'deep':>4} │ {'lat ms':>6} │ {'night':>5} │ {'spend $':>8} {'Δ$':>5} │ {'quiz':>6} │ notes"
    print(hdr); print("─" * len(hdr))
    for r in rows:
        dsp = "" if r["d_spend"] is None else f"{r['d_spend']:+.2f}"
        print(f"{r['day']:>4} │ {r['entities']:>8} {fmt_delta(r['d_entities']):>4} │ {r['facts']:>6} {fmt_delta(r['d_facts']):>4} │ "
              f"{r['superseded']:>7} {fmt_delta(r['d_superseded']):>3} │ {r['prefs']:>5} {fmt_delta(r['d_prefs']):>3} │ {r['vectors'] or 0:>5} │ "
              f"{r['topics']:>6} │ {str(r['threshold'] or '-'):>3} │ {r['deep_auto'] or 0:>4} │ {r['latency_ms'] or 0:>6} │ {r['night']:>5} │ "
              f"{r['spend'] or 0:>8.2f} {dsp:>5} │ {r['quiz']:>6} │ {r['notes']}")


# ----------------------------------------------------------------- batteries ---
def battery_rows(d: dict) -> list[dict]:
    out = []
    for day in sorted(d["batteries"]):
        b = d["batteries"][day]
        fs = b["facts"]
        def split(pred):
            sub = [f for f in fs if pred(f)]
            return {"asked": len(sub), "hits": sum(f["hit"] for f in sub)}
        base = split(lambda f: f.get("layer", "base") == "base" and not f.get("multihop") and not f.get("special"))
        new = split(lambda f: f.get("layer") == "new")
        alias = split(lambda f: f.get("special") == "alias")
        retired = split(lambda f: f.get("special") == "retired")
        hop = split(lambda f: f.get("multihop"))
        misses = [f for f in fs if not f["hit"]]
        honest = sum(1 for f in misses if f.get("honest_miss"))
        ages = [f["age"] for f in fs if not f.get("multihop") and not f.get("special")]
        out.append({
            "day": day, "score": b["score"], "of": b["of"], "pct": round(100 * b["score"] / b["of"]) if b["of"] else None,
            "base": base, "new": new, "alias": alias, "retired": retired, "hop": hop,
            "honest_misses": honest, "wrong_value": len(misses) - honest,
            "oldest_age": max(ages) if ages else 0, "flipped_asked": sum(1 for f in fs if f.get("flips")),
        })
    return out


def print_batteries(rows: list[dict]) -> None:
    f = lambda s: f"{s['hits']}/{s['asked']}" if s["asked"] else "—"
    hdr = f"{'day':>4} │ {'score':>6} {'%':>4} │ {'old world':>9} │ {'chapter 2':>9} │ {'nickname':>8} │ {'retired':>7} │ {'2-hop':>5} │ {'honest':>6} {'wrong':>5} │ {'oldest':>6} {'flipped':>7}"
    print(hdr); print("─" * len(hdr))
    for r in rows:
        print(f"{r['day']:>4} │ {r['score']:>2}/{r['of']:<3} {r['pct']:>4} │ {f(r['base']):>9} │ {f(r['new']):>9} │ {f(r['alias']):>8} │ {f(r['retired']):>7} │ {f(r['hop']):>5} │ "
              f"{r['honest_misses']:>6} {r['wrong_value']:>5} │ {r['oldest_age']:>5}d {r['flipped_asked']:>7}")


def print_map(ms: list[dict]) -> None:
    for m in ms:
        print(f"  day {m['day']:>4}  {m['kind']:<12} {m['text']}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["daily", "batteries", "map", "json"])
    ap.add_argument("--from", dest="lo", type=int, default=1)
    ap.add_argument("--to", dest="hi", type=int, default=10 ** 6)
    ap.add_argument("--since-last", action="store_true")
    ap.add_argument("out", nargs="?")
    a = ap.parse_args()
    d = load()
    xl = load_harness()
    if a.mode == "daily":
        lo = a.lo
        if a.since_last and LAST.exists():
            lo = int(LAST.read_text().strip() or 0) + 1
        rows = daily_rows(d, xl, lo, a.hi)
        if rows:
            print_daily(rows)
            LAST.write_text(str(rows[-1]["day"]))
        else:
            print("(no new days)")
    elif a.mode == "batteries":
        print_batteries(battery_rows(d))
    elif a.mode == "map":
        print_map(milestones(d, xl))
    else:
        days = daily_rows(d, xl, 1, 10 ** 6)
        payload = {
            "generated_day": days[-1]["day"] if days else 0,
            "days": days, "batteries": battery_rows(d), "milestones": milestones(d, xl),
            "chapter_two": {"from": xl.EXPANSION_FROM, "facts": len(xl.EXP_FACTS), "topics": len(xl.EXPANSION["topics"]),
                            "aliases": xl.EXPANSION["aliases"], "retirements": xl.EXPANSION["retirements"],
                            "links": len(xl.EXPANSION["relations"])},
            "base": {"topics": len(xl.CATALOG), "facts": len(xl.ALL_FACTS), "hash": xl.CATALOG_HASH},
        }
        text = json.dumps(payload)
        if a.out:
            Path(a.out).write_text(text); print(f"wrote {a.out} ({len(text)//1024} KB)")
        else:
            print(text)


if __name__ == "__main__":
    main()
