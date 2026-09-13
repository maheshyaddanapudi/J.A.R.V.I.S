#!/usr/bin/env python3
"""Strict scoring rubric for Longitude-XL answers — ONE implementation shared by
the re-score instrument (`longitude_xl_rescore.py`, acts one and two from the
raw answers) and the live harness (`longitude_xl.py`, act three onward).

The rubric is the one recorded in `docs/verification/LONGITUDE_XL_RESCORE_2026-09-11.md`
(gap G-13); the function bodies here are the re-score instrument's, moved
verbatim so that re-running the instrument reproduces its published rows
byte-for-byte (verified when this module was extracted). The answer must STATE
the truth as the answer for the ASKED entity:

  1. whole-phrase match (word-bounded; "3" is not "13");
  2. the asked entity is the one answered — naming only a longer twin
     (X two / X north) is a twin substitution;
  3. the STATED value is the first value of the fact's pool in the answer (a
     value whose every mention is history-marked is skipped), unless a
     commitment phrase ("answer: X", "most likely X") names another; a stated
     value other than the truth is wrong (or misattributed when the truth
     appears only as history / another item's value);
  4. a stated truth accompanied by a conflict phrase and no commitment is a
     hedge — the agent did not answer;
  5. an answer that OPENS with a not-found phrase is a declared miss;
  6. two-hop: the device hop must be the asked device, the STATED place is the
     one after "located at/in" (last plain statement wins; "both X and Y" with
     no later commitment is a hedge);
  7. retirements: the exact retired entity must be the one described plus a
     closed-word.

The scorer is built from the world it scores (`StrictScorer(names, relations,
value_pools, neg, retired_re)`) so twins, devices and places come from the same
generator that produced the questions.
"""
from __future__ import annotations

import re
from collections.abc import Iterable

HISTORY = re.compile(r"\b(previous(ly)?|formerly|earlier|older|outdated|stale|legacy|prior|was|were|used to|changed from|updated from|before|old value|superseded|history|originally|no longer)\b", re.I)
CONFLICT = re.compile(r"\b(conflicting|conflict|ambiguous|ambiguity|two (distinct|different|matching|conflicting|separate|stored|entries|values|records)|"
                      r"multiple (matching|entities|records|\"?\w+\"? entities))\b", re.I)
NONCOMMIT = re.compile(r"\b(please (clarify|specify)|which (one|.{0,14}) (did|do) you mean|cannot confirm|can'?t (confirm|resolve|say|give)|not resolvable|"
                       r"won'?t guess|not (a )?confident|not a single|not resolved|unresolved|no single|isn'?t uniquely|not uniquely|"
                       r"needs? reconciliation|unclear which)\b", re.I)
LOCATED = re.compile(r"located(?:_in|_at| at| in)\s+(?:(both)\s+)?(?:the\s+)?[\"'“]?", re.I)
CLAUSE = re.compile(r"[;.()\[\]\n]|\s[—–-]+\s|,\s|\bbut\b|\bhowever\b|\bwhile\b|\bthough\b")
COMMIT_LEAD = (r"\b(?:answer|so|therefore|current(?:ly)?|most likely|best guess|likely|confirmed|resolved|treat(?:ing)?|going with|"
               r"i'?ll go with|taking|final answer|best answer|authoritative|direct match|exact match|main|plain|most specifically|specifically|primarily|primary)\b[^.;\n]{0,40}?\**")
HOP_Q = re.compile(r"which place is the (.+?) — the one (.+?) (maintains|supplies|depends on|is located at) — located at\?")
RETIRED_Q = re.compile(r"is the (.+?) still active\?")


def wb(phrase: str) -> re.Pattern:
    return re.compile(r"(?<!\w)" + re.escape(phrase.lower()) + r"(?!\w)")


def clauses(text: str) -> list[str]:
    return [c.strip() for c in CLAUSE.split(text) if c and c.strip()]


def value_clauses(text: str, value: str) -> list[str]:
    rx = wb(value)
    return [c for c in clauses(text) if rx.search(c)]


def hedged(text: str, stated: str, committed: bool) -> bool:
    """A hedge: the agent did not commit — a conflict phrase comes BEFORE the value
    it states, or an explicit non-commitment phrase appears anywhere. A value stated
    up front and merely annotated ("… (note: a separate weekend_… is teal)") is not."""
    if committed:
        return False
    if NONCOMMIT.search(text):
        return True
    c = CONFLICT.search(text)
    v = wb(stated).search(text)
    return bool(c and v and c.start() < v.start())


def stated_value(text: str, candidates: list[str]) -> tuple[str | None, bool]:
    """The value the answer states: the first candidate by position whose mention
    is not purely history-marked; a commitment phrase naming a candidate wins.
    Returns (value, committed)."""
    commits = []
    for v in candidates:
        for m in re.finditer(COMMIT_LEAD + re.escape(v) + r"(?!\w)", text):
            commits.append((m.start(), len(v), v))
    if commits:
        return max(commits)[2], True  # the last (and at one position the longest) commitment is the answer
    occ, t = [], text
    for v in sorted(candidates, key=len, reverse=True):  # longest first: "rooftop garden two" before "rooftop garden"
        m = wb(v).search(t)
        if not m:
            continue
        if not all(HISTORY.search(c) for c in value_clauses(text, v)):
            occ.append((m.start(), v))  # skipped when only ever mentioned as history
        t = wb(v).sub(lambda mm: " " * len(mm.group(0)), t)  # blank so a shorter candidate cannot match inside it
    return (min(occ)[1], False) if occ else (None, False)


class StrictScorer:
    """Rubric bound to one world: its topic names (twins derived by containment),
    the devices/places of its relation layer, its value pools and the harness's
    negation / closed-word regexes."""

    def __init__(self, names: Iterable[str], relations: list[dict], value_pools: dict[str, list[str]],
                 neg: re.Pattern, retired_re: re.Pattern) -> None:
        self.NAMES = sorted({n.lower() for n in names}, key=len, reverse=True)
        self.NAME_RE = {n: re.compile(r"(?<!\w)" + re.escape(n) + r"(?!\w)") for n in self.NAMES}
        self.TWINS = {a: [b for b in self.NAMES if a != b and self.NAME_RE[a].search(b)] for a in self.NAMES}
        self.DEVICES = ({r["to"].lower() for r in relations if r["verb"] != "is located at"}
                        | {r["from"].lower() for r in relations if r["verb"] == "is located at"})
        self.PLACES = {r["to"].lower() for r in relations if r["verb"] == "is located at"}
        self.pools = value_pools
        self.NEG = neg
        self.RETIRED_RE = retired_re

    # ---------------------------------------------------------------- helpers
    def names_in(self, text: str) -> set[str]:
        """Topic names present in the text, longest first, each blanked out once found
        so a shorter name never counts because it sits inside a longer twin."""
        found, t = set(), text
        for n in self.NAMES:  # sorted longest first
            if self.NAME_RE[n].search(t):
                found.add(n)
                t = self.NAME_RE[n].sub(" " * len(n), t)
        return found

    def leading_neg(self, text: str) -> bool:
        first = clauses(text)[:1]
        return bool(first and self.NEG.search(first[0])) or bool(self.NEG.search(text[:25]))

    # ------------------------------------------------------------------ rules
    def fact(self, rec: dict, full: str, pool: str, asked: str | None) -> tuple[int, str]:
        """(hit, class). Classes: hit · honest · twin · hedge · stale · negated · wrong · empty · nomatch."""
        text = full.lower()
        truth = rec["truth"].lower()
        if not text.strip():
            return 0, "empty"
        present = self.names_in(text)
        if asked and asked not in present and any(t in present for t in self.TWINS.get(asked, [])):
            return 0, "twin"
        if self.leading_neg(text):
            return 0, "honest"
        stated, committed = stated_value(text, list(self.pools[pool]))
        truth_hit = bool(wb(truth).search(text))
        if stated is None:
            return 0, "honest" if self.NEG.search(text) else "nomatch"
        if stated != truth:
            return 0, "misattributed" if truth_hit else "wrong"
        tclauses = value_clauses(text, truth)
        if tclauses and all(self.NEG.search(c) for c in tclauses):
            return 0, "negated"
        if hedged(text, truth, committed):
            return 0, "hedge"
        return 1, "hit"

    def retired(self, rec: dict, full: str) -> tuple[int, str]:
        text = full.lower()
        m = RETIRED_Q.match(rec["topic"].lower())
        asked = m.group(1) if m else None
        if not text.strip():
            return 0, "empty"
        present = self.names_in(text)
        if asked and asked not in present and any(t in present for t in self.TWINS.get(asked, [])):
            return 0, "twin"
        if self.leading_neg(text):
            return 0, "honest"
        if not self.RETIRED_RE.search(text):
            return 0, "honest" if self.NEG.search(text) else "nomatch"
        return 1, "hit"

    def hop(self, rec: dict, full: str, question: str | None) -> tuple[int, str]:
        text = full.lower()
        truth = rec["truth"].lower()
        if not text.strip():
            return 0, "empty"
        device = other = None
        if question:
            m = HOP_Q.match(question.lower())
            if m:
                device, other = m.group(1), m.group(2)
        if self.leading_neg(text):
            return 0, "honest"
        present = self.names_in(text)
        TWINS, DEVICES = self.TWINS, self.DEVICES
        dev_twin = bool(device) and any(t in present for t in TWINS.get(device, []))
        if device and device not in present:
            if dev_twin:
                return 0, "twin"
            wrong_dev = [n for n in present if n in DEVICES and n not in (device, other, truth) and device not in TWINS.get(n, [])]
            if wrong_dev:
                return 0, "wrong-device"
        places = sorted(self.PLACES, key=len, reverse=True)
        stated, committed = stated_value(text, places)
        # the place the answer STATES is the one after "located at/in"; the last
        # plain statement wins, a "located in both X and Y" with no later plain
        # statement is a hedge
        located, both_only = [], True
        for m in LOCATED.finditer(text):
            p = next((p for p in places if text.startswith(p, m.end())), None)
            if p:
                located.append((p, bool(m.group(1))))
        if committed:
            both_only = False                      # an explicit commitment names the answer
        elif located:
            plain = [p for p, b in located if not b]
            if plain:
                stated, both_only = plain[-1], False
            else:
                stated = located[0][0]
        else:
            both_only = False
        if stated is None:
            if any(t in present for t in TWINS.get(truth, [])):
                return 0, "twin"
            return 0, "honest" if self.NEG.search(text) else "nomatch"
        if stated != truth:
            if dev_twin or stated in TWINS.get(truth, []):
                return 0, "twin"
            other_devices = [n for n in present if n in DEVICES and n not in (device, other, truth) and (not device or (n not in TWINS.get(device, []) and device not in TWINS.get(n, [])))]
            if other_devices:
                return 0, "wrong-device"
            return 0, "misattributed" if truth in present else "wrong"
        if both_only and not committed:
            return 0, "hedge"
        if any(self.NEG.search(c) for c in value_clauses(text, truth)) and not committed:
            return 0, "negated"
        if hedged(text, truth, committed):
            return 0, "hedge"
        return 1, "hit"
