#!/usr/bin/env python3
"""Longitude-XL: a 1000-simulated-day life against one continuously-running
kernel, at scale — ~180 topics with programmatic ground truth, ~10 chats/day
(~10k conversations), preference-type facts (the finding-#2 fix under test),
promotion-precision control arcs, multi-cycle D-0052 pin/override, quiz
batteries every 10 days scored per-fact against the truth engine, lab nights
every 20, restarts every 200, quiet stretches, honest timestamp aging.

Everything real: /core/converse + /agent/run + /autonomy/tick against a live
kernel (Haiku fast_conversation, Sonnet planning/deep, real local embedder).
The harness is CHECKPOINTED: state.json records the next day to run; kill it
anywhere (container freeze included) and rerun the same command to resume.
The catalog is derived from a fixed seed, so a resume regenerates identical
ground truth (verified by hash).

Usage: python3 scripts/longitude_xl.py [days] [kernel_url] [db_url]
Env:   XL_COST_CAP_USD (default 400) — halt if est. spend crosses the cap.
"""
from __future__ import annotations

import hashlib
import json
import os
import random
import re
import subprocess
import sys
import time
import uuid
from pathlib import Path

import httpx

DAYS = int(sys.argv[1]) if len(sys.argv) > 1 else 1000
# The WORLD is always generated against the full 1000-day life, no matter how
# many days this invocation runs — so the catalog (and its hash) is identical
# for the smoke, the 100-day shakeout, and the full run, and a resume with a
# different argv can never silently regenerate a different ground truth.
LIFE = 1000
K = sys.argv[2] if len(sys.argv) > 2 else "http://127.0.0.1:4160"
DB = sys.argv[3] if len(sys.argv) > 3 else "postgres://jarvis:jarvis-dev-only@127.0.0.1:5432/jarvis_xl"
OUT = Path("/tmp/longitude_xl")
OUT.mkdir(exist_ok=True)
STATE = OUT / "state.json"
SEED = 20260830
COST_CAP = float(os.environ.get("XL_COST_CAP_USD", "400"))
EMBED = os.environ.get("XL_EMBED_URL", "http://127.0.0.1:9302")
# Sonnet-5 / Haiku-4.5 $/Mtok (input, output)
PRICE = {"claude-sonnet-5": (3.0, 15.0), "claude-haiku-4-5": (1.0, 5.0)}

LAB_EVERY, QUIZ_EVERY = 20, 10
RESTARTS = {100, 300, 500, 700, 900, 1100, 1300}
QUIET = (set(range(200, 216)) | set(range(450, 466)) | set(range(800, 831))
         | set(range(1200, 1216)) | set(range(1400, 1416)))
QUIZ_FACTS = 20


def log(msg: str) -> None:
    print(msg, flush=True)


def psql(q: str) -> str:
    r = subprocess.run(["psql", DB, "-At", "-c", q], capture_output=True, text=True, timeout=120)
    return r.stdout.strip()


def put_setting(key: str, value, reason: str) -> None:
    httpx.put(f"{K}/settings/{key}", json={"value": value, "source": "user", "reason": reason}, timeout=20)


def converse(text: str, session: str, reasoning: str = "auto") -> dict:
    t0 = time.time()
    toks, decision = [], None
    with httpx.stream("POST", f"{K}/core/converse", json={
        "sessionId": session, "text": text, "privacyClass": "STANDARD", "reasoning": reasoning,
    }, timeout=240) as r:
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
    return {"text": "".join(toks), "decision": decision, "ms": int((time.time() - t0) * 1000)}


def agent(objective: str, max_steps: int = 5) -> dict:
    t0 = time.time()
    r = httpx.post(f"{K}/agent/run", json={
        "objective": objective, "maxSteps": max_steps,
        "privacyClass": "STANDARD", "autoApprove": "allow-for-session",
    }, timeout=600).json()
    r["ms"] = int((time.time() - t0) * 1000)
    return r


# ------------------------------------------------------------- the catalog ---
FIRST = ["maya", "arjun", "elena", "tomas", "priya", "hana", "diego", "ingrid", "kofi", "lena",
         "marco", "noor", "otto", "rosa", "sanjay", "tessa", "umar", "vera", "wendell", "yuki"]
LAST = ["okafor", "lindqvist", "vasquez", "tanaka", "novak", "reyes", "haddad", "petrov",
        "mbeki", "silva", "keller", "moreau", "iyer", "castillo", "brandt", "oyelaran"]
THINGS = {
    "project": ["fusion sim", "drone survey", "archive digitisation", "greenhouse automation",
                "tidal model", "battery retrofit", "coral census", "glacier telemetry"],
    "vendor": ["alloy supplier", "optics vendor", "catering service", "cloud recycler",
               "seed bank", "filament shop", "lab-glass supplier", "sensor importer"],
    "device": ["air scrubber", "roof array", "kiln", "microscope", "3d printer", "aquarium rig",
               "weather mast", "irrigation controller"],
    "place": ["lakeside cabin", "workshop annex", "rooftop garden", "storage unit",
              "test range", "boat shed", "observatory dome", "cold cellar"],
    "routine": ["morning swim", "friday review", "monthly backup", "quarterly audit",
                "evening walk", "sunday roast", "biweekly standup", "annual service"],
}
VALUE_POOLS = {
    "drink": ["flat white", "cortado", "espresso macchiato", "matcha latte", "black filter", "oat cappuccino"],
    "day": ["monday", "tuesday", "wednesday", "thursday", "friday"],
    "color": ["teal", "ochre", "slate", "crimson", "olive", "cobalt"],
    "number": [str(n) for n in (3, 7, 12, 19, 24, 42, 68, 91)],
    "city": ["lisbon", "osaka", "tallinn", "cusco", "windhoek", "bergen", "hobart"],
    "material": ["palladium", "graphene", "basalt fiber", "titanium", "borosilicate", "cedar"],
    "tea": ["earl grey", "sencha", "chamomile", "darjeeling", "peppermint rooibos"],
    "hour": [str(n) for n in (6, 7, 8, 9, 21, 22, 23)],
    "smallnum": [str(n) for n in (11, 12, 13, 14, 16)],
    "plant": ["fern", "cactus", "monstera", "basil", "jade plant"],
}
# Six genuinely deep topics for the promotion arc; routine-forced-deep is the junk control.
DEEP_TOPICS = ["plasma containment", "orbital rendezvous", "battery chemistry",
               "coral genetics", "glacier dynamics", "antenna arrays"]
SMALLTALK = ["Morning. Anything I should keep in mind today?",
             "Give me a one-line status of things as you see them.",
             "Evening. Anything worth noting from today?",
             "Any loose ends you're aware of?",
             "What's a sensible order to tackle a busy day in?"]
ROUTINE_DEEP = ["Should I take an umbrella if the sky looks grey?",
                "Is a ten minute walk worth it after lunch?",
                "Remind me what day of the week it is.",
                "What's a good lunch option near the lab?",
                "Should I have a second coffee this late?"]


def build_catalog() -> list[dict]:
    """Deterministic ~180-topic world. Each fact: statement template, value pool,
    optional flips, teach day, attention cadence, and storage route (fact|pref)."""
    rng = random.Random(SEED)
    topics: list[dict] = []
    tid = 0

    def mk_fact(topic_name: str, kind: str, slot: str, pool: str, teach: int, pref: bool, rng: random.Random) -> dict:
        vals = rng.sample(VALUE_POOLS[pool], k=min(4, len(VALUE_POOLS[pool])))
        flips = []
        if rng.random() < 0.28:  # ~28% of facts change over the life
            n = rng.choice([1, 1, 2, 3])
            days = sorted(rng.sample(range(teach + 30, min(LIFE - 20, teach + 900)), k=min(n, 3))) if teach + 40 < LIFE - 20 else []
            flips = days
        return {"slot": slot, "pool": pool, "values": vals, "teach": teach, "flips": flips, "pref": pref}

    # ~40 people
    people = [f"{rng.choice(FIRST)} {rng.choice(LAST)}" for _ in range(40)]
    people = list(dict.fromkeys(people))
    for name in people:
        att = rng.choices(["weekly", "monthly", "rare", "fading"], weights=[2, 3, 4, 2])[0]
        teach = rng.randint(1, 350)
        slot, pool = ("preferred material", "material") if rng.random() < 0.2 else ("based in", "city")
        topics.append({"id": tid, "name": name, "kind": "person", "attention": att, "facts": [
            mk_fact(name, "person", slot, pool, teach, False, rng),
            mk_fact(name, "person", "meets on", "day", teach + rng.randint(0, 4), False, rng),
        ]}); tid += 1
    # ~28 preference-type topics (finding-#2 fix at scale): stored as PREFERENCES
    # slot-PLAUSIBLE pools (shakeout day-20 finding: an implausible pairing like
    # 'tea order = espresso macchiato' makes the model refuse a correct recall)
    PREFS = [("coffee order", "drink"), ("tea order", "tea"), ("preferred workday start", "hour"),
             ("favourite colour", "color"), ("lucky number", "number"), ("preferred travel city", "city"),
             ("workshop paint colour", "color"), ("preferred meeting day", "day"),
             ("evening drink", "tea"), ("preferred font size", "smallnum"), ("desk plant", "plant"),
             ("preferred backup hour", "hour"), ("dream destination", "city"), ("preferred alloy", "material")]
    base_pref_facts: dict[str, dict] = {}
    for i, (pname, pool) in enumerate(PREFS * 2):
        label = pname if i < len(PREFS) else f"weekend {pname}"
        teach = rng.randint(1, 250)
        fact = mk_fact(label, "preference", "is", pool, teach, True, rng)
        if i < len(PREFS):
            base_pref_facts[pname] = fact
        else:
            # a weekend twin must never share the base topic's current value —
            # shakeout v4 day-80: equal values made the (correct!) preference
            # dup-tidy fold two genuinely distinct topics into one
            base = base_pref_facts[pname]
            if fact["values"][0] == base["values"][0]:
                fact["values"] = fact["values"][1:] + fact["values"][:1]
        topics.append({"id": tid, "name": label, "kind": "preference", "attention": rng.choice(["monthly", "rare"]),
                       "facts": [fact]}); tid += 1
    # ~110 things across the THINGS domains
    for kind, pool_names in THINGS.items():
        for base in pool_names:
            for suffix in ("", " two", " north"):
                if len(topics) >= 178 - len(DEEP_TOPICS):
                    break
                name = (base + suffix).strip()
                att = rng.choices(["weekly", "monthly", "rare", "fading"], weights=[1, 3, 4, 2])[0]
                teach = rng.randint(1, 400)
                nfacts = rng.choice([2, 2, 3])
                slots = rng.sample([("status colour", "color"), ("assigned number", "number"),
                                    ("home city", "city"), ("service day", "day"),
                                    ("core material", "material")], k=nfacts)
                topics.append({"id": tid, "name": name, "kind": kind, "attention": att, "facts": [
                    mk_fact(name, kind, s, p, teach + rng.randint(0, 6), False, rng) for s, p in slots
                ]}); tid += 1
    # deep-reasoning topics (2 scheduled corrections each → expect promotion)
    for i, dt in enumerate(DEEP_TOPICS):
        d0 = 6 + i * 12
        topics.append({"id": tid, "name": dt, "kind": "deep", "attention": "monthly",
                       "correct_days": [d0, d0 + 2], "facts": []}); tid += 1
    return topics


CATALOG = build_catalog()
CATALOG_HASH = hashlib.sha256(json.dumps(CATALOG, sort_keys=True).encode()).hexdigest()[:16]
ALL_FACTS: list[dict] = []
for t in CATALOG:
    for i, f in enumerate(t["facts"]):
        ALL_FACTS.append({"fid": f"{t['id']}.{i}", "topic": t["name"], "kind": t["kind"],
                          "attention": t["attention"], **f})


# ------------------------------------------------- the relationship layer ---
# SECOND ACT (day > RELATIONS_FROM). Days 1-500 taught only ATTRIBUTES, so the
# knowledge graph grew 60+ entities with ZERO edges and multi-hop recall
# (`memory.related`, the recursive CTE) was never exercised. This layer teaches
# how things CONNECT, giving a before/after inside one continuous life.
#
# Deliberately computed OUTSIDE `CATALOG` and excluded from CATALOG_HASH — the
# world's facts, flips and teach days stay byte-identical, so a run already in
# progress resumes without the hash guard tripping.
RELATIONS_FROM = int(os.environ.get("XL_RELATIONS_FROM", "500"))


def build_relations() -> list[dict]:
    """Deterministic edges over the EXISTING catalog: who maintains what, which
    vendor supplies which device, what depends on what, what lives where."""
    rng = random.Random(SEED + 777)
    by = lambda k: [t for t in CATALOG if t["kind"] == k]
    people, vendors = by("person"), by("vendor")
    devices, projects, places = by("device"), by("project"), by("place")
    rels: list[dict] = []

    def add(a: dict, verb: str, b: dict, day: int) -> None:
        rels.append({"rid": f"r{len(rels)}", "from": a["name"], "verb": verb,
                     "to": b["name"], "teach": day})

    day = RELATIONS_FROM + 2
    for i, dev in enumerate(devices):                      # vendor supplies device
        if vendors: add(vendors[i % len(vendors)], "supplies", dev, day); day += 2
    for i, dev in enumerate(devices):                      # person maintains device
        if people: add(people[(i * 3) % len(people)], "maintains", dev, day); day += 2
    for i, pr in enumerate(projects):                      # project depends on device
        if devices: add(pr, "depends on", devices[(i * 5) % len(devices)], day); day += 2
    for i, dev in enumerate(devices):                      # device located at place
        if places: add(dev, "is located at", places[(i * 7) % len(places)], day); day += 3
    return rels


RELATIONS = build_relations()


def relation_statement(r: dict) -> str:
    if r.get("handover"):  # chapter three: an exclusive edge replaced on purpose
        return f"{r['from']} now maintains the {r['to']} — taking over from whoever had it before"
    return f"{r['from']} {r['verb']} the {r['to']}"


def two_hop_question(r1: dict, r2: dict) -> tuple[str, str] | None:
    """A question that CANNOT be answered from one edge: chain r1 -> r2.
    Only the ...->device->place shape is phrased today; any other chain returns
    None rather than emitting a sentence its verbs do not support."""
    if r1["to"] != r2["from"] or r2["verb"] != "is located at" or r1 is r2:
        return None
    return (f"Which place is the {r1['to']} — the one {r1['from']} {r1['verb']} — located at?",
            r2["to"])


def truth_value(f: dict, day: int) -> str:
    """Ground truth for a fact on a given day (values rotate at each flip)."""
    idx = sum(1 for d in f["flips"] if d <= day)
    return f["values"][idx % len(f["values"])]


def fact_statement(f: dict, value: str) -> str:
    if f["pref"]:
        return f"my {f['topic']} is {value}"
    return f"the {f['topic']}'s {f['slot']} is {value}"


def fact_question(f: dict) -> str:
    if f["pref"]:
        return f"What is my {f['topic']}?"
    return f"What is the {f['topic']}'s {f['slot']}?"


# --------------------------------------------------------------- day engine ---
def attention_due(t: dict, day: int, rng: random.Random) -> bool:
    if day in QUIET:
        return False
    att = t["attention"]
    if att == "weekly":
        return day % 7 == t["id"] % 7
    if att == "monthly":
        return day % 30 == t["id"] % 30
    if att == "rare":
        return rng.random() < 0.012
    if att == "fading":  # attended early, abandoned after ~day 150
        return day < 150 and day % 10 == t["id"] % 10
    return False


def plan_day(day: int, rng: random.Random, teach_acts: list[str]) -> list[tuple[str, str]]:
    acts: list[tuple[str, str]] = []
    if day in QUIET:
        acts.append(("chat", "Quiet day. Anything that needs me?"))
        return acts

    # 1) teaching handled by the persistent queue (see teach_due/drain_teach):
    # a capped day CARRIES OVER instead of dropping topics (shakeout v2 day-20
    # finding: >4 topics due on one day silently vanished forever)
    for stmt in teach_acts:
        acts.append(("agent-teach", stmt))

    # 1b) relationship teaching (second act): how things CONNECT, so the graph
    # gains edges and multi-hop recall becomes exercisable
    due_rels = [r for r in RELATIONS if r["teach"] == day]
    for i in range(0, len(due_rels), 3):
        stmts = "; ".join(relation_statement(r) for r in due_rels[i:i + 3])
        acts.append(("agent-teach", f"Remember how these connect: {stmts}."))

    # 1c) chapter two: nicknames, retirements, and plans that span both chapters
    if day >= EXPANSION_FROM:
        for a in EXPANSION["aliases"]:
            if a["day"] == day:
                acts.append(("agent-teach", f"By the way, {a['person']} usually just goes by {a['alias']} — same person, remember that."))
        for r in EXPANSION["retirements"]:
            if r["day"] == day:
                acts.append(("agent-teach", f"We've wrapped up the {r['name']} — consider it closed. Keep its records, but it is no longer active."))
        if day % 10 == 5 and day >= EXPANSION_FROM + 70:
            people = sorted(EXP_PEOPLE)
            who = people[(day // 10) % len(people)]
            acts.append(("agent", f"Plan next week's maintenance round: which devices does {who} maintain, "
                                  "and where is each of them located? Use what you know; say 'not found' for anything you don't."))

    # 1d) chapter three: nicknames, retirements of chapter-two things, the
    # re-teach of muddled relation families, the kiln's retirement re-stated,
    # and plans that span all three chapters
    if day >= CHAPTER3_FROM:
        for a in CHAPTER3["aliases"]:
            if a["day"] == day:
                acts.append(("agent-teach", f"By the way, {a['person']} usually just goes by {a['alias']} — same person, remember that."))
        for r in CHAPTER3["retirements"]:
            if r["day"] == day:
                acts.append(("agent-teach", f"We've wrapped up the {r['name']} — consider it closed. Keep its records, but it is no longer active."))
        for stmt in reteach_relations_due(day):
            acts.append(("agent-teach", stmt))
        if day == CHAPTER3_FROM + 12:
            acts.append(("agent-teach", "Just to be clear: the kiln is still closed — we wrapped it up a while back and it is "
                                        "no longer active. The kiln two and the kiln north are separate things and unaffected."))
        if day % 10 == 5 and day >= CHAPTER3_FROM + 90:
            people = sorted(CH3_PEOPLE)
            who = people[(day // 10) % len(people)]
            acts.append(("agent", f"Plan next week's maintenance round: which devices does {who} maintain, "
                                  "and where is each of them located? Use what you know; say 'not found' for anything you don't."))

    # 2) deep-topic corrections on schedule (the REAL promotion signal)
    for t in CATALOG:
        if t["kind"] == "deep" and day in t.get("correct_days", []):
            first = day == t["correct_days"][0]
            acts.append(("chat-deep",
                         f"Any thoughts on {t['name']} for tomorrow?" if first
                         else f"How would you approach tuning the {t['name']} side of things?"))
    if day >= CHAPTER3_FROM:
        # chapter three: late deep topics (G-09) and the activity-word junk controls,
        # asked with exactly the same phrasing so only the SUBJECT differs
        for t in CHAPTER3["deep"]:
            if day in t["correct_days"]:
                first = day == t["correct_days"][0]
                acts.append(("chat-deep",
                             f"Any thoughts on {t['name']} for tomorrow?" if first
                             else f"How would you approach tuning the {t['name']} side of things?"))
        if day in (CHAPTER3_FROM + 100, CHAPTER3_FROM + 101):
            # junk probe on auto: must stay fast (no learned topic behind an activity word)
            acts.append(("chat", f"Any thoughts on {JUNK_WORDS3[day - CHAPTER3_FROM - 100]} for tomorrow?"))

    # 3) attention chats — mention topics naturally (keeps retrieval honest)
    pool = (CATALOG + ([t for t in EXPANSION["topics"] if t["facts"][0]["teach"] < day] if day >= EXPANSION_FROM else [])
            + ([t for t in CHAPTER3["topics"] if t["facts"][0]["teach"] < day] if day >= CHAPTER3_FROM else []))
    due = [t for t in pool if t["facts"] and attention_due(t, day, rng)]
    for t in due[:3]:
        f = t["facts"][0]
        acts.append(("chat", f"Thinking about the {t['name']} today — anything on file I should remember?"))

    # 4) routine forced-deep (D-0052 evidence trail + junk-promotion CONTROL)
    acts.append(("chat-forced-deep", ROUTINE_DEEP[day % len(ROUTINE_DEEP)]))
    if day % 2 == 0:
        acts.append(("chat-forced-deep", ROUTINE_DEEP[(day + 2) % len(ROUTINE_DEEP)]))

    # 5) learned-topic probe every 50 days: an ordinary phrasing on a taught deep topic
    # (third act: alternates with the chapter-three topics once they have been corrected)
    if day % 50 == 25:
        dt = DEEP_TOPICS[(day // 50) % len(DEEP_TOPICS)]
        if day >= CHAPTER3_FROM and (day // 50) % 2 == 0:
            learned = [t["name"] for t in CHAPTER3["deep"] if not t["junk"] and t["correct_days"][-1] + 5 < day]
            if learned:
                dt = learned[(day // 50) % len(learned)]
        acts.append(("chat", f"Any thoughts on {dt} drift compensation?"))

    # 6) smalltalk filler up to ~10 acts
    while len(acts) < 10:
        acts.append(("chat", SMALLTALK[(day + len(acts)) % len(SMALLTALK)]))
    return acts[:12]


# ---------------------------------------------------------- teaching queue ---
def teach_due(day: int) -> list[dict]:
    """Queue items that come due today: first-teach and flip announcements.
    The seq tag keeps items unique (two queued flips of one fact must not
    alias each other when the drain removes delivered items)."""
    items = []
    for f in (ALL_FACTS + (EXP_FACTS if day >= EXPANSION_FROM else [])
              + (CH3_FACTS if day >= CHAPTER3_FROM else [])):
        if f["teach"] == day:
            items.append({"fid": f["fid"], "kind": "teach", "seq": f"{f['fid']}:t"})
        for i, flip in enumerate(f["flips"]):
            if flip == day:
                items.append({"fid": f["fid"], "kind": "flip", "seq": f"{f['fid']}:f{i}"})
    if day >= CHAPTER3_FROM:
        # chapter three re-teach: ~8 facts (≈3 topics) a day from CHAPTER3_FROM+2
        for i, fid in enumerate(RETEACH_FIDS):
            if CHAPTER3_FROM + 2 + i // 8 == day:
                items.append({"fid": fid, "kind": "reteach", "seq": f"{fid}:r"})
    return items


FACT_BY_ID = {f["fid"]: f for f in ALL_FACTS}


# ------------------------------------------------------ chapter two layer ---
# SECOND ACT, CHAPTER TWO (day >= EXPANSION_FROM). The base catalog was fully
# delivered by day 500, so days 501+ only re-exercised the same 178 topics.
# Real lives keep changing: new people arrive, new kinds of things appear,
# people get nicknames, old projects are wrapped up, changes reach you through
# third parties, and plans span what you knew long ago and what you learned
# last week. This layer adds exactly that — deterministically, seeded apart
# from the base, hashed apart from CATALOG_HASH (a run in progress resumes
# untouched; the chapter simply begins at EXPANSION_FROM) — and the quiz is
# stratified old/new so the two curves can be read separately.
EXPANSION_FROM = int(os.environ.get("XL_EXPANSION_FROM", "540"))
FIRST2 = ["amara", "bjorn", "celeste", "dmitri", "esme", "farid", "greta", "hiro", "ines", "jonas",
          "kavya", "leon", "mireille", "nils", "odalys", "pavel", "quinn", "ravi", "selene", "theo"]
LAST2 = ["adeyemi", "bergstrom", "carvalho", "dubois", "eriksen", "ferreira", "gallo", "hoffmann",
         "ivanova", "jensen", "kowalski", "lindholm", "mendes", "nakamura", "okoro", "pereira"]
NEW_THINGS = {
    "vehicle": ["cargo bike", "field truck", "survey drone", "canal boat", "snow tractor", "rail trolley"],
    "course": ["welding course", "orbital mechanics seminar", "fermentation workshop",
               "first-aid refresher", "celestial navigation class", "soil chemistry course"],
    "collection": ["fossil cabinet", "seed vault", "map archive", "mineral tray", "tide log", "radio log"],
}
NEW_PREFS = [("weekend brunch drink", "drink"), ("gym day", "day"), ("bike colour", "color"),
             ("preferred podcast length", "smallnum"), ("study plant", "plant"),
             ("preferred sauna hour", "hour"), ("preferred camping city", "city"),
             ("preferred rope material", "material")]
RETIRE_DAYS = [600, 660, 720, 780, 840, 900]
RETIRED_RE = re.compile(r"\b(closed|wrapped|no longer|inactive|finished|retired|not active|concluded|shut down)\b", re.I)


def build_expansion() -> dict:
    rng = random.Random(SEED + 4242)
    topics: list[dict] = []
    tid = 1000  # base tids are < 200; chapter-two fids never collide

    def mk(topic: str, slot: str, pool: str, teach: int, pref: bool) -> dict:
        vals = rng.sample(VALUE_POOLS[pool], k=min(4, len(VALUE_POOLS[pool])))
        flips: list[int] = []
        if rng.random() < 0.30 and teach + 40 < LIFE - 20:
            n = rng.choice([1, 1, 2])
            flips = sorted(rng.sample(range(teach + 30, LIFE - 20), k=n))
        return {"slot": slot, "pool": pool, "values": vals, "teach": teach, "flips": flips, "pref": pref}

    people = list(dict.fromkeys(f"{rng.choice(FIRST2)} {rng.choice(LAST2)}" for _ in range(24)))[:20]
    for i, name in enumerate(people):
        teach = EXPANSION_FROM + i * 11 + rng.randint(0, 4)
        att = rng.choices(["weekly", "monthly", "rare"], weights=[2, 3, 3])[0]
        slot, pool = ("preferred material", "material") if rng.random() < 0.2 else ("based in", "city")
        topics.append({"id": tid, "name": name, "kind": "person", "attention": att, "facts": [
            mk(name, slot, pool, teach, False),
            mk(name, "meets on", "day", teach + rng.randint(0, 3), False),
        ]}); tid += 1
    i = 0
    for kind, names in NEW_THINGS.items():
        for base in names:
            teach = EXPANSION_FROM + 5 + i * 13 + rng.randint(0, 5); i += 1
            slots = rng.sample([("status colour", "color"), ("assigned number", "number"),
                                ("home city", "city"), ("service day", "day"),
                                ("core material", "material")], k=rng.choice([2, 2, 3]))
            topics.append({"id": tid, "name": base, "kind": kind,
                           "attention": rng.choices(["weekly", "monthly", "rare"], weights=[1, 3, 4])[0],
                           "facts": [mk(base, s, p, teach + rng.randint(0, 4), False) for s, p in slots]}); tid += 1
    for i, (pname, pool) in enumerate(NEW_PREFS):
        teach = EXPANSION_FROM + 20 + i * 25 + rng.randint(0, 6)
        topics.append({"id": tid, "name": pname, "kind": "preference", "attention": rng.choice(["monthly", "rare"]),
                       "facts": [mk(pname, "is", pool, teach, True)]}); tid += 1

    # nicknames: four new people pick up a short handle ~45 days after arrival
    aliases = []
    for idx in (2, 7, 12, 17):
        if idx < len(people):
            full = people[idx]
            aliases.append({"person": full, "alias": full.split()[0], "day": topics[idx]["facts"][0]["teach"] + 45})
    # retirements: six long-lived base projects/devices get wrapped up
    candidates = [t for t in CATALOG if t["kind"] in ("project", "device") and t["attention"] in ("rare", "fading")]
    retirements = [{"name": t["name"], "day": d} for t, d in zip(rng.sample(candidates, len(RETIRE_DAYS)), RETIRE_DAYS)]
    # cross-links between the chapters, on the verbs the multi-hop question supports
    by = lambda k: [t for t in CATALOG if t["kind"] == k]
    rels, day = [], EXPANSION_FROM + 60
    devices, places, vendors = by("device"), by("place"), by("vendor")
    vehicles = [t for t in topics if t["kind"] == "vehicle"]
    for i, p in enumerate(people[:8]):
        rels.append({"rid": f"x{len(rels)}", "from": p, "verb": "maintains", "to": devices[(i * 5) % len(devices)]["name"], "teach": day}); day += 10
    for i, v in enumerate(vehicles):
        rels.append({"rid": f"x{len(rels)}", "from": v["name"], "verb": "is located at", "to": places[(i * 3) % len(places)]["name"], "teach": day}); day += 10
    for i, v in enumerate(vehicles):
        rels.append({"rid": f"x{len(rels)}", "from": vendors[(i * 7) % len(vendors)]["name"], "verb": "supplies", "to": v["name"], "teach": day}); day += 10
    return {"topics": topics, "aliases": aliases, "retirements": retirements, "relations": rels}


EXPANSION = build_expansion()
EXPANSION_HASH = hashlib.sha256(json.dumps(EXPANSION, sort_keys=True).encode()).hexdigest()[:16]
EXP_FACTS: list[dict] = []
for t in EXPANSION["topics"]:
    for i, f in enumerate(t["facts"]):
        EXP_FACTS.append({"fid": f"{t['id']}.{i}", "topic": t["name"], "kind": t["kind"],
                          "attention": t["attention"], "layer": "new", **f})
FACT_BY_ID.update({f["fid"]: f for f in EXP_FACTS})
RELATIONS.extend(EXPANSION["relations"])   # teach days >= EXPANSION_FROM+60; earlier days unaffected
EXP_PEOPLE = {t["name"] for t in EXPANSION["topics"] if t["kind"] == "person"}


# -------------------------------------------------- chapter three layer ---
# THIRD ACT, CHAPTER THREE (day >= CHAPTER3_FROM). Runs on the preserved
# day-1000 world and the refined kernel (REFINEMENT_2026-09-11.md R1–R9). It is
# built to close what the gap ledger left open by design:
#   G-09  late-life deep-topic learning: four new deep topics corrected twice
#         each after day 1000, plus two activity-word JUNK controls that must
#         NOT promote;
#   G-10  the D-0052 pin/override arc re-armed late: a user pin on day
#         CHAPTER3_FROM+9 (re-pin #3 → bar 24); the harness may re-pin once
#         more after the next override (→ bar 30);
#   G-12  every nickname is a first name that occurs exactly ONCE among all the
#         people of all three chapters (asserted at build time — a collision
#         is a crash, not a footnote);
#   G-01/G-17/G-07/G-16  a RE-TEACH of what the old kernel dropped or muddled:
#         every topic with ≥2 strict misses in the second act (derived from
#         docs/verification/longitude_xl/rescore_strict.jsonl), both sides of
#         the nine twin pairs `POST /memory/reconcile-twins` could not split,
#         the CURRENT edges of the device families `POST /memory/reconcile-
#         relations` skipped, and the kiln's retirement — re-stated as the
#         current truth through the ordinary teach queue and then quizzed like
#         everything else (records carry `reteach: true`);
# plus new people/things/preferences, cross-links with maintainer HANDOVERS
# (an exclusive relation replaced on purpose — the R5 rule under load) and
# retirements of chapter-two things. Seeded and hashed apart from the base and
# chapter two, whose hashes are untouched: the day-1000 checkpoint resumes as is.
CHAPTER3_FROM = int(os.environ.get("XL_CHAPTER3_FROM", "1001"))
LIFE3 = 1500
FIRST3 = ["aurelio", "beatrix", "casimir", "dagny", "efrem", "fenna", "gustavo", "halvard", "isolde", "jiro",
          "kalinda", "lucan", "marisol", "nadir", "orsolya", "petra", "rashid", "sunniva", "tavish", "ulla"]
LAST3 = ["abernathy", "bianchi", "castellanos", "delacroix", "engel", "fitzgerald", "goncalves", "haugen",
         "ibarra", "jakobsen", "kaminski", "larsen", "matsuda", "nwosu", "olofsson", "pinto"]
assert not set(FIRST3) & (set(FIRST) | set(FIRST2)), "chapter-three first names must be new (G-12)"
NEW_THINGS3 = {
    "instrument": ["gantry crane", "spectrometer", "tide gauge", "plasma torch", "seismograph", "wind tunnel"],
    "garden": ["herb spiral", "orchard plot", "bee yard", "pond terrace", "vine trellis", "moss wall"],
}
NEW_PREFS3 = [("preferred hiking day", "day"), ("winter drink", "drink"), ("studio colour", "color"),
              ("preferred reading hour", "hour"), ("preferred ferry city", "city"), ("balcony plant", "plant")]
DEEP_TOPICS3 = ["cryogenic pumps", "lidar calibration", "tidal turbines", "ion thrusters"]
JUNK_WORDS3 = ["scheduling", "tidying"]   # activity words, two explicit-deep turns each: must NOT promote
RETIRE_DAYS3 = [1080, 1160, 1240]
# Re-teach set — derived 2026-09-11 (R9): topics with ≥2 strict misses in days
# 501–1000 (rescore_strict.jsonl), both sides of the reconcile-twins `unsplit`
# pairs, the device families behind the reconcile-relations `skipped` anchors;
# R10 added the facts the day-1000 replay found ABSENT from every store.
RETEACH_TOPICS = sorted({
    # absent from every store on the day-1000 replay (R10, replay_after_r10.json)
    "test range", "roof array two", "irrigation controller two",
    # G-19 (R10): its act-two retirement went through memory.correct and superseded one of its facts
    "fusion sim north",
    # ≥2 strict misses in the second act (26)
    "weekend preferred meeting day", "sensor importer two", "coral census", "coral census north", "gym day",
    "microscope two", "tea order", "aquarium rig", "dream destination", "microscope", "tidal model north",
    "archive digitisation", "boat shed", "boat shed north", "drone survey", "filament shop", "glacier telemetry",
    "irrigation controller", "lab-glass supplier", "lakeside cabin two", "optics vendor two", "study plant",
    "test range two", "tidal model two", "umar brandt", "weather mast two",
    # both sides of the nine unsplit twin pairs
    "aquarium rig two", "catering service", "catering service two", "coral census two", "lakeside cabin",
    "lakeside cabin north", "lena moreau", "glacier telemetry north", "sensor importer north",
    "morning swim", "morning swim north",
})
RETEACH_ANCHORS = ["3d printer", "3d printer north", "microscope", "microscope two", "aquarium rig",
                   "aquarium rig two", "roof array", "roof array two", "kiln", "kiln north"]


def build_chapter_three() -> dict:
    rng = random.Random(SEED + 31337)
    topics: list[dict] = []
    tid = 2000  # base tids < 200, chapter two 1000–1099

    def mk(slot: str, pool: str, teach: int, pref: bool) -> dict:
        vals = rng.sample(VALUE_POOLS[pool], k=min(4, len(VALUE_POOLS[pool])))
        flips: list[int] = []
        if rng.random() < 0.30 and teach + 40 < LIFE3 - 20:
            n = rng.choice([1, 1, 2])
            flips = sorted(rng.sample(range(teach + 30, LIFE3 - 20), k=n))
        return {"slot": slot, "pool": pool, "values": vals, "teach": teach, "flips": flips, "pref": pref}

    firsts, lasts = rng.sample(FIRST3, 12), rng.sample(LAST3, 12)
    people = [f"{a} {b}" for a, b in zip(firsts, lasts)]
    for i, name in enumerate(people):
        teach = CHAPTER3_FROM + 4 + i * 9 + rng.randint(0, 3)
        att = rng.choices(["weekly", "monthly", "rare"], weights=[2, 3, 3])[0]
        slot, pool = ("preferred material", "material") if rng.random() < 0.2 else ("based in", "city")
        topics.append({"id": tid, "name": name, "kind": "person", "attention": att, "facts": [
            mk(slot, pool, teach, False), mk("meets on", "day", teach + rng.randint(0, 3), False)]}); tid += 1
    i = 0
    for kind, names in NEW_THINGS3.items():
        for base in names:
            teach = CHAPTER3_FROM + 8 + i * 11 + rng.randint(0, 5); i += 1
            slots = rng.sample([("status colour", "color"), ("assigned number", "number"), ("home city", "city"),
                                ("service day", "day"), ("core material", "material")], k=rng.choice([2, 2, 3]))
            topics.append({"id": tid, "name": base, "kind": kind,
                           "attention": rng.choices(["weekly", "monthly", "rare"], weights=[1, 3, 4])[0],
                           "facts": [mk(s, p, teach + rng.randint(0, 4), False) for s, p in slots]}); tid += 1
    for i, (pname, pool) in enumerate(NEW_PREFS3):
        teach = CHAPTER3_FROM + 15 + i * 20 + rng.randint(0, 6)
        topics.append({"id": tid, "name": pname, "kind": "preference", "attention": rng.choice(["monthly", "rare"]),
                       "facts": [mk("is", pool, teach, True)]}); tid += 1
    # G-09: late deep topics (two scheduled corrections each) and junk controls
    deep = []
    for i, dt in enumerate(DEEP_TOPICS3):
        d0 = CHAPTER3_FROM + 5 + i * 12
        deep.append({"name": dt, "correct_days": [d0, d0 + 2], "junk": False})
    for i, jw in enumerate(JUNK_WORDS3):
        d0 = CHAPTER3_FROM + 60 + i * 12
        deep.append({"name": jw, "correct_days": [d0, d0 + 2], "junk": True})
    # G-12: a nickname is a first name that occurs exactly once among ALL people
    world_first = ([t["name"].split()[0] for t in CATALOG if t["kind"] == "person"]
                   + [n.split()[0] for n in sorted(EXP_PEOPLE)] + firsts)
    aliases = []
    for idx in (1, 4, 7, 10):
        full = people[idx]
        handle = full.split()[0]
        assert world_first.count(handle) == 1, f"nickname collision: {handle} (G-12)"
        aliases.append({"person": full, "alias": handle, "day": topics[idx]["facts"][0]["teach"] + 40})
    # retirements: three chapter-two things get wrapped up
    cands = [t for t in EXPANSION["topics"] if t["kind"] in ("vehicle", "collection")]
    retirements = [{"name": t["name"], "day": d} for t, d in zip(rng.sample(cands, len(RETIRE_DAYS3)), RETIRE_DAYS3)]
    # cross-links: instruments located at base places and vendors supplying them
    # (new two-hop chains), then six maintainer HANDOVERS of base devices
    by = lambda k: [t for t in CATALOG if t["kind"] == k]
    devices, places, vendors = by("device"), by("place"), by("vendor")
    instruments = [t for t in topics if t["kind"] == "instrument"]
    rels, day = [], CHAPTER3_FROM + 40
    for i, ins in enumerate(instruments):
        rels.append({"rid": f"y{len(rels)}", "from": ins["name"], "verb": "is located at",
                     "to": places[(i * 5 + 2) % len(places)]["name"], "teach": day}); day += 8
    for i, ins in enumerate(instruments):
        rels.append({"rid": f"y{len(rels)}", "from": vendors[(i * 3 + 1) % len(vendors)]["name"], "verb": "supplies",
                     "to": ins["name"], "teach": day}); day += 8
    for i, p in enumerate(people[:6]):
        rels.append({"rid": f"y{len(rels)}", "from": p, "verb": "maintains",
                     "to": devices[(i * 7 + 3) % len(devices)]["name"], "teach": day, "handover": True}); day += 8
    return {"topics": topics, "deep": deep, "aliases": aliases, "retirements": retirements, "relations": rels}


CHAPTER3 = build_chapter_three()
CHAPTER3_HASH = hashlib.sha256(json.dumps(CHAPTER3, sort_keys=True).encode()).hexdigest()[:16]
CH3_FACTS: list[dict] = []
for t in CHAPTER3["topics"]:
    for i, f in enumerate(t["facts"]):
        CH3_FACTS.append({"fid": f"{t['id']}.{i}", "topic": t["name"], "kind": t["kind"],
                          "attention": t["attention"], "layer": "three", **f})
FACT_BY_ID.update({f["fid"]: f for f in CH3_FACTS})
RELATIONS.extend(CHAPTER3["relations"])   # teach days >= CHAPTER3_FROM+40; earlier days unaffected
CH3_PEOPLE = {t["name"] for t in CHAPTER3["topics"] if t["kind"] == "person"}
_TOPIC_NAMES = {t["name"] for t in CATALOG} | {t["name"] for t in EXPANSION["topics"]}
assert set(RETEACH_TOPICS) <= _TOPIC_NAMES, sorted(set(RETEACH_TOPICS) - _TOPIC_NAMES)
assert set(RETEACH_ANCHORS) <= {t["name"] for t in CATALOG if t["kind"] == "device"}
RETEACH_FIDS = [f["fid"] for f in ALL_FACTS + EXP_FACTS if f["topic"] in RETEACH_TOPICS]
_WORLD_FIRST = [t["name"].split()[0] for t in CATALOG + EXPANSION["topics"] + CHAPTER3["topics"] if t["kind"] == "person"]
# nickname questions in the third act use only handles that are unique in the world
UNIQUE_HANDLES = {a["alias"] for a in EXPANSION["aliases"] + CHAPTER3["aliases"] if _WORLD_FIRST.count(a["alias"]) == 1}


def current_relations(day: int) -> list[dict]:
    """Edges taught by day-1 with exclusive slots resolved to the LATEST teach
    (one maintainer per device, one place per thing) — the kernel's R5 rule
    mirrored, so a two-hop question never identifies a device by a maintainer
    it no longer has. Used from the third act on (earlier acts asked every edge)."""
    latest: dict = {}
    for r in sorted((r for r in RELATIONS if r["teach"] <= day - 1), key=lambda r: r["teach"]):
        key = (("maintains", r["to"]) if r["verb"] == "maintains"
               else ("at", r["from"]) if r["verb"] == "is located at" else ("rid", r["rid"]))
        latest[key] = r
    return list(latest.values())


def reteach_relations_due(day: int) -> list[str]:
    """From CHAPTER3_FROM+14, two device families a day: their CURRENT edges
    (maintainer, location, supplier) re-stated from the harness truth as a
    replacement — the relation groups the reconciliation skipped."""
    i = day - (CHAPTER3_FROM + 14)
    if i < 0 or i * 2 >= len(RETEACH_ANCHORS):
        return []
    cur = current_relations(day + 1)   # edges taught up to and including today
    out = []
    for anchor in RETEACH_ANCHORS[i * 2:i * 2 + 2]:
        parts = [f"{r['from']} maintains the {anchor}" for r in cur if r["verb"] == "maintains" and r["to"] == anchor]
        parts += [f"the {anchor} is located at the {r['to']}" for r in cur if r["verb"] == "is located at" and r["from"] == anchor]
        parts += [f"{r['from']} supplies the {anchor}" for r in cur if r["verb"] == "supplies" and r["to"] == anchor]
        if parts:
            out.append("To be clear about how these connect today — this replaces anything older you have "
                       f"about the {anchor} (its look-alikes are separate things): " + "; ".join(parts) + ".")
    return out


_SCORER = None


def build_scorer(chapter3: bool = True):
    """The strict rubric (scripts/longitude_xl_strict.py) bound to this world.
    `chapter3=False` reproduces the re-score instrument's world of acts one and two."""
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from longitude_xl_strict import StrictScorer
    names = {t["name"] for t in CATALOG} | {t["name"] for t in EXPANSION["topics"]}
    rels = [r for r in RELATIONS if not r["rid"].startswith("y")]
    if chapter3:
        names |= {t["name"] for t in CHAPTER3["topics"]}
        rels = RELATIONS
    names |= {r["from"] for r in rels} | {r["to"] for r in rels}
    return StrictScorer(names, rels, VALUE_POOLS, NEG, RETIRED_RE)


def scorer():
    global _SCORER
    if _SCORER is None:
        _SCORER = build_scorer(chapter3=True)
    return _SCORER


def reporter_for(fid: str) -> str:
    """A chapter-two flip reaches the user through a third party — deterministic per fact."""
    names = sorted(EXP_PEOPLE)
    return names[int(hashlib.sha256(fid.encode()).hexdigest(), 16) % len(names)] if names else "a colleague"


def drain_teach(state: dict, day: int) -> list[str]:
    """Pop up to 4 topics' worth (≤3 statements per run) off the queue; build
    the statements from the ANNOUNCED value index so a delayed flip announces
    the right next value. Marks delivery/announcement in state."""
    queue: list[dict] = state.setdefault("teach_queue", [])
    delivered: dict = state.setdefault("delivered", {})
    announced: dict = state.setdefault("announced", {})
    by_topic: dict[str, list[dict]] = {}
    for item in queue:
        by_topic.setdefault(FACT_BY_ID[item["fid"]]["topic"], []).append(item)
    stmts_out: list[str] = []
    taken: list[dict] = []
    for topic, items in list(by_topic.items())[:4]:
        batch = items[:3]
        parts = []
        for it in batch:
            f = FACT_BY_ID[it["fid"]]
            if it["kind"] == "teach":
                v = f["values"][announced.get(it["fid"], 0) % len(f["values"])]
                parts.append(fact_statement(f, v))
                delivered[it["fid"]] = day
            elif it["kind"] == "reteach":
                # chapter three: the CURRENT truth re-stated (delivery day untouched —
                # the fact was taught long ago; `retaught` records the recap day)
                v = f["values"][announced.get(it["fid"], 0) % len(f["values"])]
                parts.append(fact_statement(f, v))
                state.setdefault("retaught", {})[it["fid"]] = day
            else:
                nxt = announced.get(it["fid"], 0) + 1
                v = f["values"][nxt % len(f["values"])]
                if f.get("layer") == "new":
                    # chapter two: the change arrives THROUGH someone (provenance)
                    parts.append(f"{reporter_for(it['fid'])} told me that " + fact_statement(f, v) + " now — update your memory (it changed)")
                else:
                    parts.append("update your memory — " + fact_statement(f, v) + " now (it changed)")
                announced[it["fid"]] = nxt
        if any(it["kind"] == "reteach" for it in batch):
            stmts_out.append("A recap, in case any of this is missing or muddled on your side — treat each as "
                             "the current truth and correct anything older: " + "; ".join(parts) + ".")
        else:
            stmts_out.append("Remember these things: " + "; ".join(parts) + ".")
        taken.extend(batch)
    taken_seqs = {i["seq"] for i in taken}
    state["teach_queue"] = [i for i in queue if i["seq"] not in taken_seqs]
    return stmts_out


def announced_truth(state: dict, fid: str) -> str:
    """Ground truth as ANNOUNCED to the kernel (a queued, not-yet-delivered
    flip does not count against it — scoring follows what it was told)."""
    f = FACT_BY_ID[fid]
    return f["values"][state.get("announced", {}).get(fid, 0) % len(f["values"])]


# -------------------------------------------------------------------- quiz ---
NEG = re.compile(r"\b(no record|not found|don'?t have|do not have|won'?t fabricate|"
                 r"haven'?t told|not (on file|recorded|stored)|i have no)\b", re.I)

# Answer-list markers, LINE-ANCHORED and keyed by their own number. The earlier
# whitespace-anchored split scored a perfect answer 0/4 (XL-500 relaunch day 10)
# because a preamble sentence — "…relying on preferences for items 1 and 3." —
# matched " 3." and shifted every segment by one.
ITEM = re.compile(r"(?m)^[^\S\n]*\**\s*([1-9])\s*[).]\s*")


def segment_answer(answer: str) -> dict[int, str]:
    """Map each numbered answer line to its own number: {1: 'text', 2: ...}."""
    marks = [(m.start(), m.end(), int(m.group(1))) for m in ITEM.finditer(answer)]
    out: dict[int, str] = {}
    for i, (start, end, num) in enumerate(marks):
        stop = marks[i + 1][0] if i + 1 < len(marks) else len(answer)
        out[num] = answer[end:stop].strip()
    return out


def quiz_battery(day: int, rng: random.Random, state: dict) -> dict:
    """Stratified ~20-fact quiz in batches of 5 questions per agent run.
    Scored per fact against the ANNOUNCED truth; full answers preserved."""
    delivered = state.get("delivered", {})
    act3 = day >= CHAPTER3_FROM
    taught = [f for f in ALL_FACTS if delivered.get(f["fid"], 10 ** 9) <= day - 1]
    if not taught:
        return {"day": day, "facts": [], "score": 0, "of": 0}
    # chapter two facts get a reserved share (up to 6 of the 20; 4 in the third
    # act, where chapter three takes 4 and the re-taught facts 3) so every
    # layer's recall curve is sampled every battery
    new_taught = [f for f in EXP_FACTS if delivered.get(f["fid"], 10 ** 9) <= day - 1]
    ch3_sample: list[dict] = []
    re_sample: list[dict] = []
    if act3:
        ch3_taught = [f for f in CH3_FACTS if delivered.get(f["fid"], 10 ** 9) <= day - 1]
        ch3_sample = rng.sample(ch3_taught, min(4, len(ch3_taught)))
        retaught = state.get("retaught", {})
        re_pool = [f for f in taught + new_taught if retaught.get(f["fid"], 10 ** 9) <= day - 1]
        re_sample = rng.sample(re_pool, min(3, len(re_pool)))
    exclude = {f["fid"] for f in re_sample}
    new_pool = [f for f in new_taught if f["fid"] not in exclude]
    new_sample = rng.sample(new_pool, min(4 if act3 else 6, len(new_pool)))
    n_base = QUIZ_FACTS - len(new_sample) - len(ch3_sample) - len(re_sample)
    prefs = [f for f in taught if f["pref"] and f["fid"] not in exclude]
    flipped = [f for f in taught if any(d <= day for d in f["flips"]) and not f["pref"] and f["fid"] not in exclude]
    plain = [f for f in taught if f not in prefs and f not in flipped and f["fid"] not in exclude]
    n_pref, n_flip = min(5, len(prefs), n_base), min(6, len(flipped), n_base)
    sample = (rng.sample(prefs, n_pref) + rng.sample(flipped, n_flip) +
              rng.sample(plain, min(max(0, n_base - n_pref - n_flip), len(plain))) + new_sample
              + ch3_sample + re_sample)
    rng.shuffle(sample)
    records, hits, strict_hits = [], 0, 0
    S = scorer() if act3 else None
    # specials: one alias question and one retirement question when available
    # (third act: only handles that are unique in the world — G-12 — and the
    # chapter-three retirements join the pool)
    specials: list[tuple[str, str, str, str]] = []  # (kind, question, truth, fid)
    alias_pool = EXPANSION["aliases"] + (CHAPTER3["aliases"] if act3 else [])
    if act3:
        alias_pool = [a for a in alias_pool if a["alias"] in UNIQUE_HANDLES]
    layer_facts = EXP_FACTS + (CH3_FACTS if act3 else [])
    active_aliases = [a for a in alias_pool if a["day"] <= day - 1 and delivered.get(next(
        (f["fid"] for f in layer_facts if f["topic"] == a["person"] and f["slot"] == "meets on"), ""), 10 ** 9) <= day - 1]
    if active_aliases:
        a = rng.choice(active_aliases)
        fid = next(f["fid"] for f in layer_facts if f["topic"] == a["person"] and f["slot"] == "meets on")
        specials.append(("alias", f"What is the {a['alias']}'s meets on?", announced_truth(state, fid).lower(), fid))
    retired = [r for r in EXPANSION["retirements"] + (CHAPTER3["retirements"] if act3 else []) if r["day"] <= day - 1]
    if retired:
        r = rng.choice(retired)
        specials.append(("retired", f"Is the {r['name']} still active?", "closed", f"retired:{r['name']}"))
    # multi-hop probes: only once the edges they chain have actually been taught
    # (third act: exclusive slots resolved to the current edge, see current_relations)
    hops: list[tuple[str, str]] = []
    taught_rels = current_relations(day) if act3 else [r for r in RELATIONS if r["teach"] <= day - 1]
    for r1 in taught_rels:
        for r2 in taught_rels:
            q = two_hop_question(r1, r2)
            if q: hops.append(q)
    hops = rng.sample(hops, min(3, len(hops))) if hops else []
    # Prompts. The third act's wording is a DISCLOSED instrument change (R9):
    # it names memory.lookup (the one-call path built in R8) and states the
    # exact-entity rule; the two-hop prompt asks for one committed place.
    if act3:
        battery_prompt = ("From your memory, answer these briefly, one numbered line each. "
                          "Check BOTH your entity/graph memory and stored preferences before concluding anything "
                          "is missing (memory.lookup answers several questions in one call; memory.recallPreferences "
                          "for preferences). Answer about exactly the named thing — 'X two' / 'X north' are different "
                          "things from 'X'. If a value is truly not in memory say 'not found' — never guess. ")
        hop_prompt = ("Answer from memory in one line. This needs you to connect two things you know — use your "
                      "entity/graph memory (memory.related / memory.recallGraph / memory.lookup). Answer about exactly "
                      "the named device: a look-alike ('X two', 'X north') is a different thing, and if the named one "
                      "has no recorded location say 'not found' rather than answering from a look-alike. Give ONE "
                      "committed place, or 'not found'. ")
    else:
        battery_prompt = ("From your memory, answer these briefly, one numbered line each. "
                          "Check BOTH your entity/graph memory and stored preferences "
                          "(memory.recallPreferences) before concluding anything is missing. "
                          "If a value is truly not in memory say 'not found' — never guess. ")
        hop_prompt = ("Answer from memory in one line. This needs you to connect two "
                      "things you know — use your entity/graph memory (memory.related / "
                      "memory.recallGraph). Say 'not found' if you cannot connect them. ")
    retaught = state.get("retaught", {})
    for i in range(0, len(sample), 5):
        batch = sample[i:i + 5]
        qs = " ".join(f"{j + 1}) {fact_question(f)}" for j, f in enumerate(batch))
        r = agent(battery_prompt + qs, max_steps=8)
        answer = (r.get("answer") or "").lower()
        if not answer.strip():  # transient empty batch (XL-500 day 110) — one retry
            r = agent("Answer these from memory, one numbered line each; check both "
                      "entity memory and stored preferences; say 'not found' if truly absent. " + qs,
                      max_steps=8)
            answer = (r.get("answer") or "").lower()
        segs = segment_answer(answer)
        for j, f in enumerate(batch):
            seg = segs.get(j + 1, "").strip()
            tv = announced_truth(state, f["fid"]).lower()
            hit = int(all(w in seg for w in tv.split()) and not NEG.search(seg[:120]))
            honest_miss = int(not hit and bool(NEG.search(seg)))
            hits += hit
            rec = {"fid": f["fid"], "topic": f["topic"], "pref": f["pref"],
                   "layer": f.get("layer", "base"),
                   "age": day - delivered.get(f["fid"], day),
                   "flips": state.get("announced", {}).get(f["fid"], 0),
                   "hit": hit, "honest_miss": honest_miss, "truth": tv,
                   "seg": seg[:300]}
            if S:
                s_hit, cls = S.fact(rec, seg, f["pool"], f["topic"].lower())
                s_hit = int(hit and s_hit)   # monotone: strict ⊆ lenient
                strict_hits += s_hit
                rec.update({"full": seg, "strict": s_hit, "class": "hit" if s_hit else cls,
                            "reteach": f["fid"] in retaught})
            records.append(rec)
        QUIZ_LOG.write(json.dumps({"day": day, "batch_answer": answer if act3 else answer[:4000]}) + "\n")

    for skind, qtext, truth, fid in specials:
        r = agent("From your memory, answer in one line. Check entity/graph memory and stored preferences; "
                  "say 'not found' if it is truly not in memory — never guess. " + qtext, max_steps=8)
        ans = (r.get("answer") or "").lower()
        if skind == "retired":
            hit = int(bool(RETIRED_RE.search(ans)) and not NEG.search(ans[:120]))
        else:
            hit = int(all(w in ans for w in truth.split()) and not NEG.search(ans[:120]))
        hits += hit
        rec = {"fid": fid, "topic": qtext[:60], "pref": False, "layer": skind, "age": 0, "flips": 0,
               "hit": hit, "honest_miss": int(not hit and bool(NEG.search(ans))), "truth": truth,
               "seg": ans[:300], "special": skind}
        if S:
            s_hit, cls = S.retired(rec, ans) if skind == "retired" else S.fact(rec, ans, "day", None)
            s_hit = int(hit and s_hit)
            strict_hits += s_hit
            rec.update({"full": ans, "strict": s_hit, "class": "hit" if s_hit else cls})
        records.append(rec)
        QUIZ_LOG.write(json.dumps({"day": day, "special": skind, "q": qtext, "truth": truth,
                                   "answer": ans if act3 else ans[:2000]}) + "\n")

    for qtext, truth in hops:
        r = agent(hop_prompt + qtext, max_steps=8)
        ans = (r.get("answer") or "").lower()
        hit = int(all(w in ans for w in truth.lower().split()) and not NEG.search(ans[:160]))
        hits += hit
        rec = {"fid": "hop", "topic": qtext[:60], "pref": False, "age": 0,
               "flips": 0, "hit": hit, "honest_miss": int(not hit and bool(NEG.search(ans))),
               "truth": truth, "seg": ans[:300], "multihop": True}
        if S:
            s_hit, cls = S.hop(rec, ans, qtext)
            s_hit = int(hit and s_hit)
            strict_hits += s_hit
            rec.update({"full": ans, "strict": s_hit, "class": "hit" if s_hit else cls, "q": qtext})
        records.append(rec)
        QUIZ_LOG.write(json.dumps({"day": day, "hop_q": qtext, "truth": truth,
                                   "answer": ans if act3 else ans[:2000]}) + "\n")
    QUIZ_LOG.flush()
    out = {"day": day, "facts": records, "score": hits, "of": len(sample) + len(hops) + len(specials),
           "multihop_asked": len(hops), "new_asked": len(new_sample), "specials_asked": len(specials)}
    if act3:
        out.update({"strict": strict_hits, "ch3_asked": len(ch3_sample), "reteach_asked": len(re_sample)})
    return out


# ------------------------------------------------------------- night + time ---
def set_quiet_window_now() -> None:
    h = int(psql("SELECT extract(hour from now())"))
    put_setting("proactive.quietHours.start", h, "xl: tonight's window")
    put_setting("proactive.quietHours.end", (h + 2) % 24, "xl: tonight's window")


def night(day: int) -> dict:
    lab = day % LAB_EVERY == 0
    put_setting("lab.enabled", lab, f"xl: lab {'on' if lab else 'off'} night {day}")
    set_quiet_window_now()
    t0 = time.time()
    tick = httpx.post(f"{K}/autonomy/tick", json={}, timeout=3000).json()
    tick["nightMs"] = int((time.time() - t0) * 1000)
    return tick


def shift_world_one_day() -> int:
    cols = psql(
        "SELECT table_name || '.' || column_name FROM information_schema.columns "
        "WHERE table_schema='public' AND data_type='timestamp with time zone' "
        "AND table_name NOT IN ('audit_log','schema_migrations','reasoning_decisions')"
    ).splitlines()
    for tc in cols:
        t, c = tc.split(".", 1)
        psql(f'UPDATE "{t}" SET "{c}" = "{c}" - interval \'1 day\' WHERE "{c}" IS NOT NULL')
    return len(cols)


def spend_usd() -> float:
    rows = psql("SELECT model, sum(input_tokens), sum(output_tokens) FROM model_calls "
                "WHERE provider='anthropic' GROUP BY model").splitlines()
    total = 0.0
    for row in rows:
        try:
            model, i, o = row.split("|")
            pin, pout = PRICE.get(model, (3.0, 15.0))
            total += int(i) / 1e6 * pin + int(o) / 1e6 * pout
        except ValueError:
            continue
    return round(total, 2)


def snapshot(day: int, extra: dict) -> None:
    m = {
        "day": day,
        "entities_active": int(psql("SELECT count(*) FROM memory_entities WHERE status NOT IN ('deleted','superseded')") or 0),
        "facts_active": int(psql("SELECT count(*) FROM memory_facts WHERE status NOT IN ('deleted','superseded')") or 0),
        "facts_superseded": int(psql("SELECT count(*) FROM memory_facts WHERE status='superseded'") or 0),
        "prefs_active": int(psql("SELECT count(*) FROM preferences WHERE status NOT IN ('deleted','superseded')") or 0),
        "episodes": int(psql("SELECT count(*) FROM memory_episodes") or 0),
        "embeddings": int(psql("SELECT count(*) FROM memory_embeddings") or 0),
        "audit_rows": int(psql("SELECT count(*) FROM audit_log") or 0),
        "lab_rows": int(psql("SELECT count(*) FROM lab_experiments") or 0),
        "topics": httpx.get(f"{K}/core/reasoning/topics", timeout=20).json().get("topics", []),
        "autotune": httpx.get(f"{K}/core/reasoning/autotune", timeout=20).json(),
        "spend_usd": spend_usd(),
    }
    m.update(extra)
    METRICS.write(json.dumps(m) + "\n")
    METRICS.flush()


def load_state() -> dict:
    if STATE.exists():
        s = json.loads(STATE.read_text())
        if s.get("catalog_hash") != CATALOG_HASH:
            log(f"FATAL: state catalog_hash {s.get('catalog_hash')} != {CATALOG_HASH} — seed/code drift")
            sys.exit(2)
        return s
    return {"next_day": 1, "catalog_hash": CATALOG_HASH, "repins": 0, "last_override_at": None}


def save_state(s: dict) -> None:
    STATE.write_text(json.dumps(s))


def ensure_kernel() -> None:
    try:
        httpx.get(f"{K}/health", timeout=5)
    except Exception:
        log("[resume] kernel down — restarting")
        subprocess.run(["bash", str(OUT / "restart_kernel.sh")], timeout=240, check=True)


def ensure_embedder() -> None:
    """Semantic recall needs the local 768-dim embedder alive. A container
    idle-freeze kills it exactly as it kills Postgres — and XL-500 ran 141
    days on the kernel's (correct, honest) LEXICAL fallback before anyone
    noticed, because nothing checked. Self-heal, then verify."""
    try:
        httpx.get(f"{EMBED}/v1/models", timeout=5)
        return
    except Exception:
        pass
    log("[heal] embed server down — restarting")
    subprocess.Popen(["bash", str(OUT / "restart_embedder.sh")],
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(120):
        try:
            httpx.get(f"{EMBED}/v1/models", timeout=3)
            log("[heal] embed server back")
            return
        except Exception:
            time.sleep(2)
    raise SystemExit("FATAL: embed server will not come up — refusing to run blind")


def assert_model_live(day: int) -> None:
    """Halt if the model provider has stopped answering. A spend ceiling cannot
    see an EXHAUSTED BALANCE: the first XL-500 attempt burned its credits at
    ~day 315 and then ran 180 more days of failed calls, scoring 0/20 on every
    battery, because nothing watched the SUCCESS rate. Checks the most recent
    calls, so a long-dead provider is caught within one quiz interval."""
    # Order by the identity id, NEVER by `at`: the nightly world-aging shifts
    # every timestamp, and a compensating repair shift can push historical rows
    # AHEAD of now() — which made an `ORDER BY at` version of this guard read
    # 39 five-month-old failures as "the latest calls" and nearly halt a healthy
    # run. Insertion order is the only monotonic clock in an aged database.
    recent = psql("SELECT ok FROM model_calls WHERE provider <> 'embedserver' "
                  "ORDER BY id DESC LIMIT 40").split()
    if len(recent) >= 20 and all(v == "f" for v in recent):
        err = psql("SELECT left(error,200) FROM model_calls WHERE NOT ok "
                   "ORDER BY at DESC LIMIT 1")
        raise SystemExit(
            f"FATAL day {day}: the last {len(recent)} model calls ALL failed — "
            f"the run is producing void data. Provider said: {err}\n"
            "Fix the provider (credits/key/network) and resume; the checkpoint "
            "is intact, so nothing before this day is lost.")


def assert_day_live(day: int, start_id: int) -> None:
    """Same-day provider check: if the day's Anthropic calls were mostly
    failures (≥5 failed and failures outnumber successes), the model died DURING
    the day — halt before the day is aged, snapshotted or checkpointed. The
    2026-09-01 second act lost its credits mid-quiz on day 540: the quiz scored
    5/20 against a dead model and three 11-second void days followed."""
    row = psql(f"SELECT count(*) FILTER (WHERE ok), count(*) FILTER (WHERE NOT ok) "
               f"FROM model_calls WHERE id > {start_id} AND provider='anthropic'")
    try:
        ok, bad = (int(x) for x in row.split("|"))
    except ValueError:
        return
    if bad >= 5 and bad > ok:
        err = psql("SELECT left(error,200) FROM model_calls WHERE NOT ok ORDER BY id DESC LIMIT 1")
        raise SystemExit(
            f"FATAL day {day}: {bad} of the day's {ok + bad} model calls failed — the provider died "
            f"during the day, so this day is NOT committed (no aging, no checkpoint). Provider said: {err}\n"
            "Fix the provider (credits?) and resume: the day re-runs for real.")


def assert_embeddings_live(day: int, state: dict) -> None:
    """Fail loudly if vectors stop growing while episodes do: a silent
    degradation to lexical-only would invalidate every recall curve."""
    vec = int(psql("SELECT count(*) FROM memory_embeddings") or 0)
    prev = state.get("last_vec_count")
    prev_day = state.get("last_vec_day")
    state["last_vec_count"], state["last_vec_day"] = vec, day
    if prev is None:
        return
    if vec <= prev and day - (prev_day or day) >= 20:
        fails = int(psql("SELECT count(*) FROM model_calls WHERE role='embeddings' AND NOT ok") or 0)
        raise SystemExit(
            f"FATAL day {day}: memory_embeddings flat at {vec} since day {prev_day} "
            f"({fails} failed embedding calls) — semantic recall is not being measured. "
            "Fix the embedder and resume; do not report a lexical-only run as semantic.")


# -------------------------------------------------------------------- main ---
METRICS = (OUT / "metrics.jsonl").open("a")
QUIZ_LOG = (OUT / "quizzes.jsonl").open("a")


def main() -> None:
    state = load_state()
    start = state["next_day"]
    log(f"LONGITUDE-XL: days {start}..{DAYS} against {K} | catalog {len(CATALOG)} topics / "
        f"{len(ALL_FACTS)} facts ({sum(1 for f in ALL_FACTS if f['pref'])} prefs, "
        f"{sum(1 for f in ALL_FACTS if f['flips'])} flipping) | hash {CATALOG_HASH} | "
        f"chapter two {EXPANSION_HASH} | chapter three {CHAPTER3_HASH} (from day {CHAPTER3_FROM})")
    ensure_kernel()
    ensure_embedder()

    if start == 1:
        put_setting("heartbeat.deferWhileActiveMinutes", 0, "xl: nights follow days immediately")
        put_setting("heartbeat.privacy", "STANDARD", "xl: no local generative model in-container")
        put_setting("memory.consolidation.staleDays", 45, "xl: propose stale within the run horizon")
        put_setting("budget.lab.nightlyTokenCap", 60000, "xl: bounded lab nights")
        put_setting("autonomy.enabled", True, "xl: the scheduler is the night")

    for day in range(start, DAYS + 1):
        t_day = time.time()
        ensure_embedder()
        rng = random.Random(SEED * 100000 + day)  # per-day deterministic
        session = str(uuid.uuid4())
        deep_on_auto = 0
        lat: list[int] = []
        day_start_id = int(psql("SELECT coalesce(max(id),0) FROM model_calls") or 0)

        if day >= EXPANSION_FROM:
            # chapter two drift guard: the layer is pinned the day it first appears
            if state.get("expansion_hash") is None:
                state["expansion_hash"] = EXPANSION_HASH
                log(f"  [chapter two] begins day {day}: {len(EXP_FACTS)} facts / {len(EXPANSION['topics'])} topics, "
                    f"{len(EXPANSION['aliases'])} aliases, {len(EXPANSION['retirements'])} retirements, "
                    f"{len(EXPANSION['relations'])} cross-links | hash {EXPANSION_HASH}")
            elif state["expansion_hash"] != EXPANSION_HASH:
                log(f"FATAL: state expansion_hash {state['expansion_hash']} != {EXPANSION_HASH} — chapter-two drift")
                sys.exit(2)
        if day >= CHAPTER3_FROM:
            # chapter three drift guard: pinned the day it first appears
            if state.get("chapter3_hash") is None:
                state["chapter3_hash"] = CHAPTER3_HASH
                log(f"  [chapter three] begins day {day}: {len(CH3_FACTS)} facts / {len(CHAPTER3['topics'])} topics, "
                    f"{len(CHAPTER3['deep'])} deep/junk arcs, {len(CHAPTER3['aliases'])} aliases, "
                    f"{len(CHAPTER3['retirements'])} retirements, {len(CHAPTER3['relations'])} cross-links, "
                    f"re-teach {len(RETEACH_FIDS)} facts / {len(RETEACH_ANCHORS)} device families | hash {CHAPTER3_HASH}")
            elif state["chapter3_hash"] != CHAPTER3_HASH:
                log(f"FATAL: state chapter3_hash {state['chapter3_hash']} != {CHAPTER3_HASH} — chapter-three drift")
                sys.exit(2)
        state.setdefault("teach_queue", []).extend(teach_due(day))
        teach_acts = [] if day in QUIET else drain_teach(state, day)
        for kind, text in plan_day(day, rng, teach_acts):
            if kind in ("agent", "agent-teach"):
                r = agent(text, max_steps=8 if kind == "agent-teach" else 5)
                lat.append(r.get("ms", 0))
            else:
                reasoning = "deep" if kind in ("chat-deep", "chat-forced-deep") else "auto"
                r = converse(text, session, reasoning)
                lat.append(r["ms"])
                d = r.get("decision") or {}
                if kind == "chat" and d.get("mode") == "deep":
                    deep_on_auto += 1
            time.sleep(0.3)

        # D-0052 arc: pin day 5; after each announced override, re-pin 3 days
        # later (up to 2 re-pins → bars 6, 12, 24 — the escalating-cost story).
        if day == 5:
            httpx.post(f"{K}/core/reasoning/autotune",
                       json={"signalThreshold": 2, "reason": "Chief: keep escalation conservative — I'll ask for deep myself"},
                       timeout=20)
            log("  [pin] day 5: threshold pinned by user")
        # Third act (G-10): the arc was dormant since day 35 — acknowledge that old
        # override, then a deliberate LATE user pin (re-pin #3 → bar 24) and room
        # for one more harness re-pin after the next override (→ bar 30).
        if day == CHAPTER3_FROM:
            at0 = httpx.get(f"{K}/core/reasoning/autotune", timeout=20).json()
            state["last_override_at"] = at0.get("at")
            state["repin_cap"] = 4
            log(f"  [pin] chapter three: D-0052 arc re-armed (kernel repins={at0.get('repins')}, harness cap 4)")
        if day == CHAPTER3_FROM + 9:
            httpx.post(f"{K}/core/reasoning/autotune",
                       json={"signalThreshold": 2, "reason": "Chief: late re-pin — conservative again; convince me with evidence from today on"},
                       timeout=20)
            state["repins"] += 1
            log(f"  [pin] day {day}: user LATE RE-PIN (#{state['repins']}, G-10)")
        at = httpx.get(f"{K}/core/reasoning/autotune", timeout=20).json()
        if (at.get("source") == "jarvis" and at.get("changedUserSetting")
                and state["repins"] < state.get("repin_cap", 2) and at.get("at") != state.get("last_override_at")):
            state["last_override_at"] = at.get("at")
            state["pending_repin"] = day + 3
        if state.get("pending_repin") == day:
            httpx.post(f"{K}/core/reasoning/autotune",
                       json={"signalThreshold": 2, "reason": "Chief: re-pinning — conservative, evidence or not"},
                       timeout=20)
            state["repins"] += 1
            state.pop("pending_repin", None)
            log(f"  [pin] day {day}: user RE-PINS (#{state['repins']})")

        # Provider liveness is checked EVERY day (was: quiz days only — the second
        # act's credits died mid-day-540 and three void days were counted before
        # anyone looked). Same-day check runs again after the quiz, before the
        # world is aged or the checkpoint saved, so a day the model died in is
        # never committed: fix the provider, re-run the day for real.
        assert_model_live(day)
        if day % QUIZ_EVERY == 0:
            assert_embeddings_live(day, state)
        quiz = quiz_battery(day, rng, state) if day % QUIZ_EVERY == 0 or day == 1 else None
        assert_day_live(day, day_start_id)
        tick = night(day)
        shifted = shift_world_one_day()

        if day in RESTARTS:
            log(f"  [restart] day {day}: kernel restart (continuity check)")
            rc = subprocess.run(["bash", str(OUT / "restart_kernel.sh")], timeout=240).returncode
            post = quiz_battery(day, random.Random(SEED * 999 + day), state)
            log(f"  [restart] back rc={rc}; post-restart quiz {post['score']}/{post['of']}")
            snapshot(day, {"restart": {"rc": rc, "post_quiz_score": post["score"], "post_quiz_of": post["of"]}})
            QUIZ_LOG.write(json.dumps({"day": day, "post_restart": post}) + "\n")

        snapshot(day, {
            "quiz_score": quiz["score"] if quiz else None,
            "quiz_of": quiz["of"] if quiz else None,
            "quiz_new_asked": quiz.get("new_asked") if quiz else None,
            "quiz_new_hits": sum(1 for f in quiz["facts"] if f.get("layer") == "new" and f["hit"]) if quiz else None,
            "quiz_strict": quiz.get("strict") if quiz else None,
            "quiz_ch3_asked": quiz.get("ch3_asked") if quiz else None,
            "quiz_ch3_strict": sum(1 for f in quiz["facts"] if f.get("layer") == "three" and f.get("strict")) if quiz else None,
            "quiz_reteach_asked": quiz.get("reteach_asked") if quiz else None,
            "quiz_reteach_strict": sum(1 for f in quiz["facts"] if f.get("reteach") and f.get("strict")) if quiz else None,
            "expansion_delivered": sum(1 for f in EXP_FACTS if f["fid"] in state.get("delivered", {})),
            "chapter3_delivered": sum(1 for f in CH3_FACTS if f["fid"] in state.get("delivered", {})),
            "retaught": len(state.get("retaught", {})),
            "tick_lab": str(tick.get("lab", "-"))[:60],
            "cols_shifted": shifted, "deep_on_auto": deep_on_auto,
            "avg_latency_ms": int(sum(lat) / max(1, len(lat))),
            "day_wall_s": int(time.time() - t_day),
        })
        if quiz:
            QUIZ_LOG.write(json.dumps(quiz) + "\n")
            QUIZ_LOG.flush()

        state["next_day"] = day + 1
        save_state(state)

        spend = spend_usd()
        q = f" quiz={quiz['score']}/{quiz['of']}" if quiz else ""
        if quiz and "strict" in quiz:
            q += f" strict={quiz['strict']}/{quiz['of']}"
        log(f"DAY {day:04d} done in {int(time.time() - t_day)}s{q} deepOnAuto={deep_on_auto} ${spend}")
        if spend > COST_CAP:
            log(f"HALT: est. spend ${spend} crossed cap ${COST_CAP} — resume raises XL_COST_CAP_USD")
            sys.exit(3)

    verify = httpx.get(f"{K}/core/audit/verify", timeout=120).json()
    log(f"FINAL audit chain: {verify}")
    METRICS.write(json.dumps({"final_audit": verify}) + "\n")
    log("LONGITUDE-XL COMPLETE")


if __name__ == "__main__":
    main()
