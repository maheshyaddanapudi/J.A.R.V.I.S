#!/usr/bin/env python3
"""Strict re-score of every Longitude-XL battery from the raw answers (gap G-13).

The run scored leniently: the truth's words as substrings anywhere in the answer
segment, and no negation phrase in the segment's first 120 characters. That
rubric was applied identically to both acts, but it is known to be generous:
"lakeside cabin north" satisfies "lakeside cabin"; "conflicting: 42 vs 68,
cannot confirm" satisfies "42"; "13" satisfies "3".

This instrument re-scores the SAME raw answers under a strict rubric and reports
both. The strict score is monotone — a record can only move from hit to miss —
so re-scoring can never inflate a number; the cases where the lenient rule
produced a false MISS are counted separately as an instrument note and are not
added back.

Strict rubric — the answer must STATE the truth as the answer for the ASKED entity:
  1. whole-phrase match (word-bounded; "3" is not "13");
  2. the asked entity is the one answered — naming only a longer twin
     (X two / X north) is a twin substitution;
  3. the STATED value is the first value of the fact's pool in the answer (a
     value whose every mention is history-marked — "previously", "older record"
     — is skipped), unless a commitment phrase ("answer: X", "most likely X",
     "so: X") names another; a stated value other than the truth is wrong, and
     the truth mentioned only as history is stale. A note about a DIFFERENT
     named item ("a separate weekend_… is teal") is not a hedge;
  4. a stated truth accompanied by a conflict phrase ("conflicting records",
     "ambiguous", "please clarify", "cannot confirm") and no commitment is a
     hedge — the agent did not answer;
  5. an answer that OPENS with a not-found phrase is a declared miss whatever
     follows (the truth, if present, is being attributed to something else);
  6. two-hop: the device hop must be the asked device (a twin, or a different
     device, is not), the STATED place is the first place named, whole-phrase;
  7. retirements: the exact retired entity must be the one described plus a
     closed-word.

Usage: python3 scripts/longitude_xl_rescore.py [--src /tmp/longitude_xl]
                                                [--out docs/verification/longitude_xl/rescore_strict.jsonl]
Prints markdown to stdout.
"""
from __future__ import annotations

import collections
import importlib.util
import json
import re
import sys
from pathlib import Path

SRC = Path(sys.argv[sys.argv.index("--src") + 1] if "--src" in sys.argv else "/tmp/longitude_xl")
OUT = Path(sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else "docs/verification/longitude_xl/rescore_strict.jsonl")

# ---------------------------------------------------------------- harness ---
sys.argv = ["x", "1000"]
_spec = importlib.util.spec_from_file_location("xl", Path(__file__).with_name("longitude_xl.py"))
xl = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(xl)

# The rubric itself lives in scripts/longitude_xl_strict.py (shared with the live
# harness from the third act on). Bound here to the world of acts one and two —
# base catalog + chapter two + their relation layer — exactly as this instrument
# scored them on 2026-09-11 (re-running it reproduces rescore_strict.jsonl).
S = xl.build_scorer(chapter3=False)
strict_fact, strict_retired, strict_hop = S.fact, S.retired, S.hop


# ------------------------------------------------------------------- rows ---
rows = [json.loads(l) for l in SRC.joinpath("quizzes.jsonl").open()]
by_day: dict[int, list[dict]] = collections.defaultdict(list)
for r in rows:
    by_day[r["day"]].append(r)


def full_segment(day: int, rec: dict) -> tuple[str, str | None]:
    """The untruncated answer for a record, matched by its 300-char prefix; and
    the full question for two-hop / special rows."""
    seg = rec.get("seg", "")
    if rec.get("multihop"):
        for r in by_day[day]:
            if "hop_q" in r and r["truth"] == rec["truth"] and r["answer"][:300] == seg:
                return r["answer"], r["hop_q"]
        return seg, None
    if rec.get("special"):
        for r in by_day[day]:
            if "special" in r and r["truth"] == rec["truth"] and r["answer"][:300] == seg:
                return r["answer"], r["q"]
        return seg, None
    for r in by_day[day]:
        if "batch_answer" in r:
            for s in xl.segment_answer(r["batch_answer"]).values():
                if s.strip()[:300] == seg:
                    return s.strip(), None
    return seg, None


out_rows = []
for day in sorted(by_day):
    bat = next((r for r in by_day[day] if "score" in r), None)
    if not bat or not bat.get("facts"):
        continue
    for rec in bat["facts"]:
        full, q = full_segment(day, rec)
        if rec.get("multihop"):
            s_hit, cls = strict_hop(rec, full, q)
            kind = "hop"
        elif rec.get("special") == "retired":
            s_hit, cls = strict_retired(rec, full)
            kind = "retired"
        elif rec.get("special") == "alias":
            s_hit, cls = strict_fact(rec, full, "day", None)
            kind = "pavel" if "pavel" in rec["topic"] else "alias"
        else:
            f = xl.FACT_BY_ID[rec["fid"]]
            s_hit, cls = strict_fact(rec, full, f["pool"], rec["topic"].lower())
            kind = "new" if rec.get("layer") == "new" else "base"
        lenient = int(rec["hit"])
        strict = int(lenient and s_hit)          # monotone: strict ⊆ lenient
        if lenient and not s_hit:
            change = "downgrade"
        elif not lenient and s_hit:
            change = "lenient-false-miss"        # counted as a note, never added back
            cls = "honest" if xl.NEG.search(text := full.lower()) else "lenient-neg"
        else:
            change = "same"
        out_rows.append({"day": day, "act": 1 if day <= 500 else 2, "kind": kind, "fid": rec["fid"], "topic": rec["topic"],
                         "truth": rec["truth"], "lenient": lenient, "strict": strict, "class": "hit" if strict else cls,
                         "change": change, "age": rec.get("age"), "flips": rec.get("flips"), "full": full[:600]})

OUT.parent.mkdir(parents=True, exist_ok=True)
with OUT.open("w") as fh:
    for r in out_rows:
        fh.write(json.dumps(r, ensure_ascii=False) + "\n")

# ---------------------------------------------------------------- report ---
pct = lambda h, n: f"{h}/{n} ({100 * h / n:.1f}%)" if n else "—"


def both(rs):
    return f"{pct(sum(r['lenient'] for r in rs), len(rs))} | {pct(sum(r['strict'] for r in rs), len(rs))}"


facts = [r for r in out_rows if r["kind"] in ("base", "new")]
a1 = [r for r in facts if r["act"] == 1]
a2 = [r for r in facts if r["act"] == 2]
a2b = [r for r in a2 if r["kind"] == "base"]
a2n = [r for r in a2 if r["kind"] == "new"]
hops = [r for r in out_rows if r["kind"] == "hop"]
print(f"# Strict re-score of {len(out_rows)} scored answers (days 10–{max(r['day'] for r in out_rows)})\n")
print(f"Records: {len(out_rows)} · lenient hits {sum(r['lenient'] for r in out_rows)} · strict hits {sum(r['strict'] for r in out_rows)} · "
      f"downgrades {sum(r['change'] == 'downgrade' for r in out_rows)} · lenient false misses (noted, not added back) {sum(r['change'] == 'lenient-false-miss' for r in out_rows)}\n")

print("## Pre-registered targets, both rubrics\n")
print("| Target | Lenient (as run) | Strict |")
print("|---|---|---|")
l1, s1 = sum(r["lenient"] for r in a1) / len(a1), sum(r["strict"] for r in a1) / len(a1)
l2, s2 = sum(r["lenient"] for r in a2) / len(a2), sum(r["strict"] for r in a2) / len(a2)
l2b, s2b = sum(r["lenient"] for r in a2b) / len(a2b), sum(r["strict"] for r in a2b) / len(a2b)
print(f"| First act attribute recall (baseline) | {100*l1:.1f}% | {100*s1:.1f}% |")
print(f"| Second act, all facts | {100*l2:.1f}% ({100*(l2-l1):+.1f} pp) | {100*s2:.1f}% ({100*(s2-s1):+.1f} pp) |")
print(f"| Second act, old-world facts only | {100*l2b:.1f}% ({100*(l2b-l1):+.1f} pp) | {100*s2b:.1f}% ({100*(s2b-s1):+.1f} pp) |")
print(f"| Second act, chapter-two facts | {both(a2n)} |")
print(f"| Two-hop | {both(hops)} |")
print(f"| ≥ +5 pp met (all facts / old world) | {'yes' if l2-l1 >= .05 else 'no'} / {'yes' if l2b-l1 >= .05 else 'no'} | {'yes' if s2-s1 >= .05 else 'no'} / {'yes' if s2b-s1 >= .05 else 'no'} |\n")

print("## By layer (second act) — lenient | strict\n")
print("| Layer | Lenient | Strict |")
print("|---|---|---|")
for name, pred in (("Old world", lambda r: r["kind"] == "base"), ("Chapter two", lambda r: r["kind"] == "new"),
                   ("Nicknames (excl. pavel)", lambda r: r["kind"] == "alias"), ("pavel", lambda r: r["kind"] == "pavel"),
                   ("Retirements", lambda r: r["kind"] == "retired"), ("Two-hop", lambda r: r["kind"] == "hop"),
                   ("All", lambda r: True)):
    rs = [r for r in out_rows if r["act"] == 2 and pred(r)]
    if rs:
        print(f"| {name} | {both(rs)} |")
print()

print("## By 100-day block — lenient | strict\n")
print("| Block | Lenient | Strict | Downgrades |")
print("|---|---|---|---|")
for lo in range(1, 1001, 100):
    rs = [r for r in out_rows if lo <= r["day"] < lo + 100]
    if rs:
        print(f"| {lo}–{lo+99} | {both(rs)} | {sum(r['change'] == 'downgrade' for r in rs)} |")
print()

print("## Downgrades (lenient hit → strict miss) by class and act\n")
print("| Class | First act | Second act | Meaning |")
print("|---|---|---|---|")
meaning = {"twin": "answered about a longer twin (X two / X north) — G-02/G-04/G-16", "hedge": "the truth was named but not committed to (conflicting records, please clarify) — G-03",
           "misattributed": "another value stated; the truth appears only as history or as another item's value — G-03 / twins", "negated": "the truth inside a not-found clause", "wrong-device": "two-hop resolved through a different device — G-04",
           "wrong": "another value stated, the truth absent", "nomatch": "truth words present only as substrings / paraphrase", "honest": "answer opens with not-found", "empty": "no answer segment"}
dg = [r for r in out_rows if r["change"] == "downgrade"]
for cls in sorted({r["class"] for r in dg}, key=lambda c: -sum(1 for r in dg if r["class"] == c)):
    print(f"| {cls} | {sum(1 for r in dg if r['class'] == cls and r['act'] == 1)} | {sum(1 for r in dg if r['class'] == cls and r['act'] == 2)} | {meaning.get(cls, '')} |")
print()

print("## Every strict miss in the second act by class and layer\n")
print("| Class | Old world | Chapter two | Nickname | pavel | Retired | Two-hop | Total |")
print("|---|---|---|---|---|---|---|---|")
miss2 = [r for r in out_rows if r["act"] == 2 and not r["strict"]]
kinds = ("base", "new", "alias", "pavel", "retired", "hop")
for cls in sorted({r["class"] for r in miss2}, key=lambda c: -sum(1 for r in miss2 if r["class"] == c)):
    cells = [sum(1 for r in miss2 if r["class"] == cls and r["kind"] == k) for k in kinds]
    print(f"| {cls} | " + " | ".join(str(c) for c in cells) + f" | {sum(cells)} |")
print(f"| **total** | " + " | ".join(str(sum(1 for r in miss2 if r['kind'] == k)) for k in kinds) + f" | {len(miss2)} |\n")

print("## Lenient false misses (instrument note; NOT added back)\n")
fm = [r for r in out_rows if r["change"] == "lenient-false-miss"]
print(f"{len(fm)} answers stated the correct value but were scored as misses because a not-found phrase appeared in the first 120 characters (e.g. \"… (from preference X; not found as a graph entity)\"). "
      "They stay misses in every headline number; the strict scorer for the third act uses clause-level negation so this cannot recur.\n")
for r in fm[:8]:
    print(f"- day {r['day']} · {r['topic']} → `{r['full'][:140]}`")
print(f"\nPer-record output: `{OUT}` ({len(out_rows)} rows: day, kind, lenient, strict, class, change, full answer).")
