#!/usr/bin/env python3
"""R10 mini-life — every fixed shape of the 2026-09-11 refinement pass, in one
scripted sequence through the REAL agent (Sonnet 5 planning, the gated loop,
real encrypted memory) on the scratch fidelity kernel — NEVER against jarvis_xl.

Each step prints: the objective, the tool steps the agent actually chose, the
answer, and a verdict computed by code (route reads, the strict rubric from
scripts/longitude_xl_strict.py, or a plain rule). Nothing is asserted by eye.
Shapes covered (ledger row in brackets):
  1  first-person preference → memory.remember, recalled            [G-05]
  2  facts stored WITH their subject + write receipts               [G-18, G-01]
  3  twin family taught: no alias merge, exact recall, twin miss     [G-17, G-02]
  4  two homes for one attribute → correct → one clean answer       [G-03]
  5  relation handover + move → supersession with history           [G-07]
  6  two-hop on the exact device; twin device → not found           [G-04]
  7  retirement on a twin family                                    [G-16]
  8  five-question battery → one memory.lookup, 5/5 strict          [E-02]
  9  recallPreferences ranked + capped                              [E-04]
  10 two corrections promote a real topic, a junk word never        [G-09/S3]
  11 D-0052: pin, evidence, override at the bar, re-pin raises it    [G-10]
  12 one active prompt template per name; prompt cache reads > 0    [G-15, E-01]

Usage: python3 scripts/minilife_r10.py [kernel_url] > docs/verification/refinement/R10_minilife_sonnet5.md
Aborts if any of its entity names already exist on the kernel (fresh names only).
"""
from __future__ import annotations

import importlib.util
import json
import re
import sys
import time
import urllib.parse
import uuid
from pathlib import Path

import httpx

K = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4170"
# a name set per run, so the mini-life can be repeated on the same scratch kernel
# with fresh entities and fresh deep/junk topics (argv[2]: brine | sluice | bilge)
SETS = {
    "brine": {"thing": "brine pump", "p1": "orla quist", "p2": "tomas bly", "place1": "north pier", "place2": "boat yard",
              "vendor": "valve works", "pref": "winter drink", "prefval": "cortado", "deep": "cryogenic valves", "junk": "scheduling"},
    "sluice": {"thing": "sluice gate", "p1": "ines varga", "p2": "arlo penn", "place1": "east lock", "place2": "mill race",
               "vendor": "gate works", "pref": "autumn drink", "prefval": "flat white", "deep": "vacuum bellows", "junk": "tidying"},
    "bilge": {"thing": "bilge blower", "p1": "nadia crane", "p2": "elio marsh", "place1": "dry dock", "place2": "slipway shed",
              "vendor": "fan works", "pref": "spring drink", "prefval": "espresso macchiato", "deep": "magnetic bearings", "junk": "filing"},
}
W = SETS[sys.argv[2] if len(sys.argv) > 2 else "brine"]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from longitude_xl_strict import StrictScorer  # noqa: E402

# the harness's negation / closed-word regexes and value pools (no world is built here)
_argv = sys.argv
sys.argv = ["x", "1000"]
_spec = importlib.util.spec_from_file_location("xl", Path(__file__).with_name("longitude_xl.py"))
xl = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(xl)
sys.argv = _argv

T, T2, TN = W["thing"], W["thing"] + " two", W["thing"] + " north"
P1, P2, PL1, PL2, VEN, PREF, PV, DEEP, JUNK = (W["p1"], W["p2"], W["place1"], W["place2"], W["vendor"], W["pref"], W["prefval"], W["deep"], W["junk"])
NAMES = [T, T2, TN, P1, P2, PL1, PL2, VEN]
RELS = [{"from": P1, "verb": "maintains", "to": T}, {"from": T, "verb": "is located at", "to": PL1},
        {"from": T, "verb": "is located at", "to": PL2}, {"from": VEN, "verb": "supplies", "to": T}]
S = StrictScorer(NAMES, RELS, xl.VALUE_POOLS, xl.NEG, xl.RETIRED_RE)
SESSION = str(uuid.uuid4())
verdicts: list[tuple[str, bool, str]] = []


def q(path: str) -> str:
    return urllib.parse.quote(path)


def agent(objective: str, max_steps: int = 8) -> dict:
    t0 = time.time()
    r = httpx.post(f"{K}/agent/run", json={"objective": objective, "maxSteps": max_steps,
                                           "privacyClass": "STANDARD", "autoApprove": "allow-for-session"}, timeout=600).json()
    r["ms"] = int((time.time() - t0) * 1000)
    return r


def converse(text: str, reasoning: str = "auto") -> dict:
    toks, decision = [], None
    with httpx.stream("POST", f"{K}/core/converse", json={"sessionId": SESSION, "text": text,
                                                          "privacyClass": "STANDARD", "reasoning": reasoning}, timeout=240) as r:
        for line in r.iter_lines():
            if not line.startswith("data:"):
                continue
            try:
                evt = json.loads(line[5:].strip())
            except Exception:
                continue
            if evt.get("type") == "token":
                toks.append(evt.get("text", ""))
            elif evt.get("type") == "reasoning":
                decision = evt
    return {"text": "".join(toks), "decision": decision}


def entity(name: str) -> dict | None:
    r = httpx.get(f"{K}/memory/entities/{q(name)}", timeout=30)
    return r.json() if r.status_code == 200 else None


def show(title: str, r: dict, answer_key: str = "answer") -> str:
    steps = " → ".join(f"`{s['tool']}`{'' if s['ok'] else ' ✗'}" for s in r.get("steps", []))
    ans = (r.get(answer_key) or "").strip().replace("\n", " ")
    print(f"**{title}**  \nsteps: {steps or '(none)'}  \nanswer: {ans[:700]}\n")
    return ans.lower()


def verdict(shape: str, ok: bool, why: str) -> None:
    verdicts.append((shape, ok, why))
    print(f"> {'PASS' if ok else 'FAIL'} — {shape}: {why}\n")


def facts_of(name: str) -> list[str]:
    """Active fact statements of an entity: GET /memory/entities/:name returns
    {entity, facts[{statement, status: <epistemic status>}], relationsOut, …} —
    `status` is the epistemic label, so 'active' means not deleted/superseded."""
    e = entity(name)
    if not e:
        return []
    return [f.get("statement", "") for f in (e.get("facts") or []) if f.get("status") not in ("deleted", "superseded")]


print(f"# R10 mini-life — Sonnet 5 through the real agent on {K}\n\nRun {time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime())}. "
      "Every verdict below is computed by code from what the kernel returned.\n")
for n in NAMES:
    if entity(n):
        sys.exit(f"ABORT: entity '{n}' already exists on {K} — pick another name set (argv[2])")
pre_topics = httpx.get(f"{K}/core/reasoning/topics", timeout=20).json().get("topics", [])
for t in (DEEP, JUNK):
    if any(t in str(x).lower() for x in pre_topics):
        sys.exit(f"ABORT: topic '{t}' already learned on {K} — pick another name set (argv[2])")

# ---------------------------------------------------------------- 1 G-05
print("## 1 — first-person preference (G-05)\n")
r = agent(f"Remember: my {PREF} is {PV}.")
show("teach", r)
tools = [s["tool"] for s in r["steps"]]
prefs = httpx.get(f"{K}/memory/preferences", timeout=30).json()["preferences"]
hit = [p for p in prefs if PREF.split()[0] in p["key"].lower() and PV in str(p.get("value", "")).lower()]
verdict("G-05 first-person → preference store", "memory.remember" in tools and bool(hit),
        f"tools {tools}; preference rows matching {PREF.split()[0]}/{PV}: {len(hit)}")
ans = show("ask", agent(f"What is my {PREF}? Answer in one line from memory; say 'not found' if absent."))
verdict("G-05 recall", S.fact({"truth": PV}, ans, "drink", None) == (1, "hit"), f"strict {S.fact({'truth': PV}, ans, 'drink', None)}")

# ---------------------------------------------------------------- 2 G-18 / G-01
print("## 2 — facts carry their subject; write receipts (G-18, G-01)\n")
r = agent(f"Remember these things: the {T}'s status colour is teal; the {T}'s assigned number is 42.")
show("teach", r)
stmts = facts_of(T)
summaries = " ".join(s.get("summary", "") for s in r["steps"]).lower()
verdict("G-18 subject in every stored statement", bool(stmts) and all(T in s.lower() for s in stmts), f"stored: {stmts}")
verdict("G-01 receipt (read back / re-read) in the tool summary", any(w in summaries for w in ("read back", "readback", "re-read", "reread")), f"summaries: {summaries[:300]}")

# ---------------------------------------------------------------- 3 G-17 / G-02
print("## 3 — twin family: no alias merge, exact recall, twin miss (G-17, G-02)\n")
show("teach twin two", agent(f"Remember these things: the {T2}'s status colour is ochre; the {T2}'s assigned number is 7."))
show("teach twin north", agent(f"Remember: the {TN}'s status colour is slate."))
e_base, e_two, e_north = entity(T), entity(T2), entity(TN)


def aliases(e):
    ent = (e or {}).get("entity", e) or {}
    return [a.lower() for a in (ent.get("aliases") or [])]


verdict("G-17 twins are three distinct entities, no twin alias",
        all(x is not None for x in (e_base, e_two, e_north)) and T not in aliases(e_two) + aliases(e_north)
        and not any(t in aliases(e_base) for t in (T2, TN)),
        f"aliases base={aliases(e_base)} two={aliases(e_two)} north={aliases(e_north)}")
ans = show("ask base", agent(f"What is the {T}'s status colour? Answer in one line from memory; '{T2}' and '{TN}' are different things; say 'not found' if absent."))
verdict("G-02 exact recall of the short twin", S.fact({"truth": "teal"}, ans, "color", T) == (1, "hit"), f"strict {S.fact({'truth': 'teal'}, ans, 'color', T)}")
ans = show("ask north's number (never taught)", agent(f"What is the {TN}'s assigned number? Answer in one line from memory; say 'not found' if absent — never answer from a look-alike."))
verdict("G-02 twin miss is honest (no 42 / 7)", not re.search(r"\b(42|7)\b", ans.split(".")[0]) and bool(xl.NEG.search(ans)), f"answer: {ans[:160]}")

# ---------------------------------------------------------------- 4 G-03
print("## 4 — two homes for one attribute → one clean answer (G-03)\n")
show("teach home", agent(f"Remember: the {T}'s home city is lisbon."))
r = agent(f"Update your memory — the {T}'s home city is osaka now (it changed).")
show("update", r)
tools = [s["tool"] for s in r["steps"]]
homes = [s for s in facts_of(T) if "home city" in s.lower()]
verdict("G-03 one active home-city fact after the update", len(homes) == 1 and "osaka" in homes[0].lower(), f"tools {tools}; active home-city facts: {homes}")
ans = show("ask", agent(f"What is the {T}'s home city? Answer in one line from memory."))
verdict("G-03 clean answer (no conflict hedge)", S.fact({"truth": "osaka"}, ans, "city", T) == (1, "hit"), f"strict {S.fact({'truth': 'osaka'}, ans, 'city', T)}")

# ---------------------------------------------------------------- 5 G-07
print("## 5 — relation handover and move → supersession with history (G-07)\n")
show("connect", agent(f"Remember how these connect: {P1} maintains the {T}; the {T} is located at the {PL1}; {VEN} supplies the {T}."))
show("handover", agent(f"Remember: {P2} now maintains the {T} — taking over from whoever had it before."))
show("move", agent(f"Remember: the {T} has moved — it is located at the {PL2} now."))
g = httpx.get(f"{K}/memory/graph?q={q(T)}", timeout=60).json()
rels = json.dumps(g).lower()
verdict(f"G-07 current edges: {P2} maintains, located at {PL2}; old edges gone from the live graph",
        P2 in rels and PL2 in rels and not re.search(re.escape(P1) + r"[^}]{0,80}maintains|maintains[^}]{0,80}" + re.escape(P1), rels)
        and PL1 not in rels, f"graph mentions: new maintainer={P2 in rels} new place={PL2 in rels} old maintainer={P1 in rels} old place={PL1 in rels}")
ans = show("ask", agent(f"Who maintains the {T} today, and where is it located? One line from memory."))
verdict("G-07 answer names the current maintainer and place", P2 in ans and PL2 in ans and P1.split()[0] not in ans.split(PL2)[0], f"answer: {ans[:200]}")

# ---------------------------------------------------------------- 6 G-04
print("## 6 — two-hop on the exact device; twin device → not found (G-04)\n")
HOP = ("Answer from memory in one line. This needs you to connect two things you know — use your entity/graph memory "
       "(memory.related / memory.recallGraph / memory.lookup). Answer about exactly the named device: a look-alike ('X two', 'X north') "
       "is a different thing, and if the named one has no recorded location say 'not found' rather than answering from a look-alike. "
       "Give ONE committed place, or 'not found'. ")
q1 = f"Which place is the {T} — the one {P2} maintains — located at?"
ans = show("hop exact", agent(HOP + q1))
verdict("G-04 exact-device two-hop", S.hop({"truth": PL2}, ans, q1) == (1, "hit"), f"strict {S.hop({'truth': PL2}, ans, q1)}")
q2 = f"Which place is the {TN} — the one {P2} maintains — located at?"
ans = show("hop twin", agent(HOP + q2))
# the asked device has no location: the honest answer OPENS with not-found (the
# strict rubric's `honest` class); leading with the look-alike's chain is the
# G-04 residue even when 'not found' follows
verdict("G-04 twin device → answer opens with not-found (no look-alike chain first)", S.leading_neg(ans), f"answer: {ans[:200]}")

# ---------------------------------------------------------------- 7 G-16
print("## 7 — retirement on a twin family (G-16)\n")
show("retire north", agent(f"We've wrapped up the {TN} — consider it closed. Keep its records, but it is no longer active."))
ans = show("ask north", agent(f"Is the {TN} still active? One line from memory; say 'not found' if you have no record."))
verdict("G-16 retired twin reported closed", S.retired({"topic": f"Is the {TN} still active?", "truth": "closed"}, ans) == (1, "hit"), f"answer: {ans[:160]}")
ans = show("ask base", agent(f"Is the {T} still active? One line from memory; say 'not found' if you have no record of its status."))
verdict("G-16 the un-retired sibling is NOT reported closed", not (xl.RETIRED_RE.search(ans) and TN not in ans and "not" not in ans[:40]) or bool(xl.NEG.search(ans)),
        f"answer: {ans[:160]}")

# ---------------------------------------------------------------- 8 E-02
print("## 8 — five-question battery → memory.lookup, strict 5/5 (E-02)\n")
BAT = ("From your memory, answer these briefly, one numbered line each. Check BOTH your entity/graph memory and stored preferences "
       "before concluding anything is missing (memory.lookup answers several questions in one call; memory.recallPreferences for "
       "preferences). Answer about exactly the named thing — 'X two' / 'X north' are different things from 'X'. If a value is truly "
       "not in memory say 'not found' — never guess. ")
qs = [(f"What is the {T}'s status colour?", "teal", "color", T), (f"What is the {T2}'s assigned number?", "7", "number", T2),
      (f"What is my {PREF}?", PV, "drink", None), (f"What is the {T}'s home city?", "osaka", "city", T),
      (f"What is the {TN}'s status colour?", "slate", "color", TN)]
r = agent(BAT + " ".join(f"{i + 1}) {t[0]}" for i, t in enumerate(qs)))
show("battery", r)
segs = xl.segment_answer((r.get("answer") or "").lower())   # the raw answer: the item regex is line-anchored
strict = [S.fact({"truth": t[1]}, segs.get(i + 1, ""), t[2], t[3]) for i, t in enumerate(qs)]
tools = [s["tool"] for s in r["steps"]]
verdict("E-02 one memory.lookup step, strict 5/5", tools == ["memory.lookup"] and all(s == (1, "hit") for s in strict), f"tools {tools}; strict {strict}")

# ---------------------------------------------------------------- 9 E-04
print("## 9 — recallPreferences ranked and capped (E-04)\n")
rt = httpx.post(f"{K}/core/run-tool", json={"tool": "memory.recallPreferences", "args": {"query": PREF}, "source": "minilife"}, timeout=60).json()
detail = (rt.get("detail") or rt.get("summary") or "")
lines = [l for l in detail.splitlines() if l.strip()]
print(f"tool result ({len(lines)} lines): {detail[:500]}\n")
verdict(f"E-04 '{PREF}' query ranks the exact key first and returns ≤ 12 rows", (PV in lines[0].lower() if lines else False) and len(lines) <= 14,
        f"first line: {lines[0][:120] if lines else '(empty)'}; lines {len(lines)}")

# ---------------------------------------------------------------- 10 G-09 / S3
print("## 10 — learning by correction: a real topic promotes, a junk word never (G-09/S3)\n")
for text in (f"Any thoughts on {DEEP} for tomorrow?", f"How would you approach tuning the {DEEP} side of things?"):
    c = converse(text, "deep"); print(f"deep: {text} → {c['text'][:140].replace(chr(10), ' ')}\n")
for text in (f"Any thoughts on {JUNK} for tomorrow?", f"How would you approach tuning the {JUNK} side of things?"):
    c = converse(text, "deep"); print(f"deep (junk): {text} → {c['text'][:140].replace(chr(10), ' ')}\n")
topics = httpx.get(f"{K}/core/reasoning/topics", timeout=20).json().get("topics", [])
tl = [str(t).lower() for t in topics]
print(f"learned topics now: {topics}\n")
verdict("G-09 real topic promoted after two corrections", any(DEEP.split()[0] in t for t in tl), f"topics {tl}")
verdict("S3 junk activity word never promoted", not any(JUNK in t for t in tl), f"topics {tl}")
c = converse(f"Any thoughts on {DEEP} drift compensation?", "auto")
print(f"auto probe (learned): decision {c['decision']}\n")
verdict("G-09 learned topic escalates on auto", (c["decision"] or {}).get("mode") == "deep", f"decision {c['decision']}")
c = converse(f"Any thoughts on {JUNK} for tomorrow?", "auto")
print(f"auto probe (junk): decision {c['decision']}\n")
verdict("S3 junk word stays fast on auto", (c["decision"] or {}).get("mode") == "fast", f"decision {c['decision']}")

# ---------------------------------------------------------------- 11 D-0052 / G-10
print("## 11 — D-0052: pin, evidence, override at the bar, re-pin raises the bar (G-10)\n")
at0 = httpx.get(f"{K}/core/reasoning/autotune", timeout=20).json(); print(f"autotune before: {at0}\n")
httpx.post(f"{K}/core/reasoning/autotune", json={"signalThreshold": 2, "reason": "Chief: keep escalation conservative — I'll ask for deep myself"}, timeout=20)
at1 = httpx.get(f"{K}/core/reasoning/autotune", timeout=20).json(); print(f"autotune after user pin: {at1}\n")
needed = 6 * ((at1.get("repins") or 0) + 1)
ROUTINE = ["Should I take an umbrella if the sky looks grey?", "Is a ten minute walk worth it after lunch?", "Remind me what day of the week it is.",
           "What's a good lunch option near the lab?", "Should I have a second coffee this late?"]
for i in range(needed + 1):
    converse(ROUTINE[i % len(ROUTINE)], "deep")
rep = httpx.post(f"{K}/core/reasoning/consolidate", json={}, timeout=600).json()
at2 = httpx.get(f"{K}/core/reasoning/autotune", timeout=20).json()
print(f"consolidation after {needed + 1} explicit-deep routine turns (bar {needed}): {json.dumps(rep)[:900]}\n\nautotune: {at2}\n")
verdict("D-0052 override only at the bar, announced with the tally", at2.get("source") == "jarvis" and at2.get("changedUserSetting") is True
        and str(needed) in str(at2.get("reason", "")), f"autotune {at2}")
httpx.post(f"{K}/core/reasoning/autotune", json={"signalThreshold": 2, "reason": "Chief: re-pinning — conservative, evidence or not"}, timeout=20)
at3 = httpx.get(f"{K}/core/reasoning/autotune", timeout=20).json()
rep2 = httpx.post(f"{K}/core/reasoning/consolidate", json={}, timeout=600).json()
at4 = httpx.get(f"{K}/core/reasoning/autotune", timeout=20).json()
print(f"after re-pin: {at3}\n\nimmediate consolidation: {json.dumps(rep2)[:600]}\n\nautotune: {at4}\n")
verdict("D-0052 re-pin raises the bar; no override without evidence since the pin",
        (at3.get("repins") or 0) == (at1.get("repins") or 0) + 1 and at4.get("source") == "user" and at4.get("signalThreshold") == 2,
        f"repins {at1.get('repins')}→{at3.get('repins')} (bar {6 * ((at3.get('repins') or 0) + 1)}); autotune after immediate consolidation: {at4}")

# ---------------------------------------------------------------- 12 G-15 / E-01
print("## 12 — one active template per name; prompt cache in use (G-15, E-01)\n")
pr = httpx.get(f"{K}/prompts", timeout=20).json()
ps = pr.get("prompts", pr) if isinstance(pr, dict) else pr
import collections
active = collections.Counter((p.get("name"), p.get("kind")) for p in ps if p.get("active"))
verdict("G-15 exactly one active prompt row per (name, kind)", all(v == 1 for v in active.values()) and len(active) >= 5, f"{dict(active)}")
gw = httpx.get(f"{K}/gateway/calls?limit=200", timeout=20).json()
calls = [c for c in gw.get("calls", []) if c.get("role") == "planning"]
cr = sum(int(c.get("cache_read_tokens") or 0) for c in calls)
ci = sum(int(c.get("input_tokens") or 0) for c in calls)
verdict("E-01 planning calls read the prompt cache (visible on /gateway/calls)", cr > 0 and cr > ci,
        f"last {len(calls)} planning calls: cache-read tokens {cr}, uncached input {ci}")

# ---------------------------------------------------------------- summary
print("## Summary\n\n| Shape | Verdict | Evidence |\n|---|---|---|")
for shape, ok, why in verdicts:
    print(f"| {shape} | {'PASS' if ok else 'FAIL'} | {why.replace('|', '/')[:220]} |")
n_ok = sum(1 for _, ok, _ in verdicts if ok)
print(f"\n**{n_ok}/{len(verdicts)} PASS.**")
sys.exit(0 if n_ok == len(verdicts) else 1)
