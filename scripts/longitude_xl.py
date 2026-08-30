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
# Sonnet-5 / Haiku-4.5 $/Mtok (input, output)
PRICE = {"claude-sonnet-5": (3.0, 15.0), "claude-haiku-4-5": (1.0, 5.0)}

LAB_EVERY, QUIZ_EVERY = 20, 10
RESTARTS = {100, 300, 500, 700, 900}
QUIET = set(range(200, 216)) | set(range(450, 466)) | set(range(800, 831))
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
        topics.append({"id": tid, "name": name, "kind": "person", "attention": att, "facts": [
            mk_fact(name, "person", "role", "material" if rng.random() < 0.2 else "city", teach, False, rng),
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
    for i, (pname, pool) in enumerate(PREFS * 2):
        label = pname if i < len(PREFS) else f"weekend {pname}"
        teach = rng.randint(1, 250)
        topics.append({"id": tid, "name": label, "kind": "preference", "attention": rng.choice(["monthly", "rare"]),
                       "facts": [mk_fact(label, "preference", "is", pool, teach, True, rng)]}); tid += 1
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


def plan_day(day: int, rng: random.Random) -> list[tuple[str, str]]:
    acts: list[tuple[str, str]] = []
    if day in QUIET:
        acts.append(("chat", "Quiet day. Anything that needs me?"))
        return acts

    # 1) teach facts due today (batched per topic into agent runs)
    by_topic: dict[str, list[str]] = {}
    for f in ALL_FACTS:
        if f["teach"] == day:
            by_topic.setdefault(f["topic"], []).append(fact_statement(f, truth_value(f, day)))
        for flip in f["flips"]:
            if flip == day:
                by_topic.setdefault(f["topic"], []).append(
                    "update your memory — " + fact_statement(f, truth_value(f, day)) + " now (it changed)")
    for topic, stmts in list(by_topic.items())[:4]:  # bound the day's teaching load
        # ≤3 statements per run: a 5-statement batch exhausted the step budget
        # and silently dropped facts (shakeout day-30 finding)
        for i in range(0, min(len(stmts), 6), 3):
            acts.append(("agent-teach", "Remember these things: " + "; ".join(stmts[i:i + 3]) + "."))

    # 2) deep-topic corrections on schedule (the REAL promotion signal)
    for t in CATALOG:
        if t["kind"] == "deep" and day in t.get("correct_days", []):
            first = day == t["correct_days"][0]
            acts.append(("chat-deep",
                         f"Any thoughts on {t['name']} for tomorrow?" if first
                         else f"How would you approach tuning the {t['name']} side of things?"))

    # 3) attention chats — mention topics naturally (keeps retrieval honest)
    due = [t for t in CATALOG if t["facts"] and attention_due(t, day, rng)]
    for t in due[:3]:
        f = t["facts"][0]
        acts.append(("chat", f"Thinking about the {t['name']} today — anything on file I should remember?"))

    # 4) routine forced-deep (D-0052 evidence trail + junk-promotion CONTROL)
    acts.append(("chat-forced-deep", ROUTINE_DEEP[day % len(ROUTINE_DEEP)]))
    if day % 2 == 0:
        acts.append(("chat-forced-deep", ROUTINE_DEEP[(day + 2) % len(ROUTINE_DEEP)]))

    # 5) learned-topic probe every 50 days: an ordinary phrasing on a taught deep topic
    if day % 50 == 25:
        dt = DEEP_TOPICS[(day // 50) % len(DEEP_TOPICS)]
        acts.append(("chat", f"Any thoughts on {dt} drift compensation?"))

    # 6) smalltalk filler up to ~10 acts
    while len(acts) < 10:
        acts.append(("chat", SMALLTALK[(day + len(acts)) % len(SMALLTALK)]))
    return acts[:12]


# -------------------------------------------------------------------- quiz ---
NEG = re.compile(r"\b(no record|not found|don'?t have|do not have|won'?t fabricate|"
                 r"haven'?t told|not (on file|recorded|stored)|i have no)\b", re.I)


def quiz_battery(day: int, rng: random.Random) -> dict:
    """Stratified ~20-fact quiz in batches of 5 questions per agent run.
    Scored per fact against the truth engine; full answers preserved."""
    taught = [f for f in ALL_FACTS if f["teach"] <= day - 1]
    if not taught:
        return {"day": day, "facts": [], "score": 0, "of": 0}
    prefs = [f for f in taught if f["pref"]]
    flipped = [f for f in taught if any(d <= day for d in f["flips"]) and not f["pref"]]
    plain = [f for f in taught if f not in prefs and f not in flipped]
    sample = (rng.sample(prefs, min(5, len(prefs))) +
              rng.sample(flipped, min(6, len(flipped))) +
              rng.sample(plain, min(QUIZ_FACTS - min(5, len(prefs)) - min(6, len(flipped)), len(plain))))
    rng.shuffle(sample)
    records, hits = [], 0
    for i in range(0, len(sample), 5):
        batch = sample[i:i + 5]
        qs = " ".join(f"{j + 1}) {fact_question(f)}" for j, f in enumerate(batch))
        r = agent("From your memory, answer these briefly, one numbered line each. "
                  "If a value is not in memory say 'not found' — never guess. " + qs, max_steps=8)
        answer = (r.get("answer") or "").lower()
        segs = re.split(r"(?:^|\n|\s)[1-5]\s*[)\.]", answer)
        for j, f in enumerate(batch):
            seg = segs[j + 1] if j + 1 < len(segs) else answer
            tv = truth_value(f, day - 1).lower()
            hit = int(all(w in seg for w in tv.split()) and not NEG.search(seg[:120]))
            honest_miss = int(not hit and bool(NEG.search(seg)))
            hits += hit
            records.append({"fid": f["fid"], "topic": f["topic"], "pref": f["pref"],
                            "age": day - f["teach"], "flips": sum(1 for d in f["flips"] if d <= day),
                            "hit": hit, "honest_miss": honest_miss, "truth": tv,
                            "seg": seg.strip()[:300]})
        QUIZ_LOG.write(json.dumps({"day": day, "batch_answer": answer[:4000]}) + "\n")
    QUIZ_LOG.flush()
    return {"day": day, "facts": records, "score": hits, "of": len(sample)}


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


# -------------------------------------------------------------------- main ---
METRICS = (OUT / "metrics.jsonl").open("a")
QUIZ_LOG = (OUT / "quizzes.jsonl").open("a")


def main() -> None:
    state = load_state()
    start = state["next_day"]
    log(f"LONGITUDE-XL: days {start}..{DAYS} against {K} | catalog {len(CATALOG)} topics / "
        f"{len(ALL_FACTS)} facts ({sum(1 for f in ALL_FACTS if f['pref'])} prefs, "
        f"{sum(1 for f in ALL_FACTS if f['flips'])} flipping) | hash {CATALOG_HASH}")
    ensure_kernel()

    if start == 1:
        put_setting("heartbeat.deferWhileActiveMinutes", 0, "xl: nights follow days immediately")
        put_setting("heartbeat.privacy", "STANDARD", "xl: no local generative model in-container")
        put_setting("memory.consolidation.staleDays", 45, "xl: propose stale within the run horizon")
        put_setting("budget.lab.nightlyTokenCap", 60000, "xl: bounded lab nights")
        put_setting("autonomy.enabled", True, "xl: the scheduler is the night")

    for day in range(start, DAYS + 1):
        t_day = time.time()
        rng = random.Random(SEED * 100000 + day)  # per-day deterministic
        session = str(uuid.uuid4())
        deep_on_auto = 0
        lat: list[int] = []

        for kind, text in plan_day(day, rng):
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
        at = httpx.get(f"{K}/core/reasoning/autotune", timeout=20).json()
        if (at.get("source") == "jarvis" and at.get("changedUserSetting")
                and state["repins"] < 2 and at.get("at") != state.get("last_override_at")):
            state["last_override_at"] = at.get("at")
            state["pending_repin"] = day + 3
        if state.get("pending_repin") == day:
            httpx.post(f"{K}/core/reasoning/autotune",
                       json={"signalThreshold": 2, "reason": "Chief: re-pinning — conservative, evidence or not"},
                       timeout=20)
            state["repins"] += 1
            state.pop("pending_repin", None)
            log(f"  [pin] day {day}: user RE-PINS (#{state['repins']})")

        quiz = quiz_battery(day, rng) if day % QUIZ_EVERY == 0 or day == 1 else None
        tick = night(day)
        shifted = shift_world_one_day()

        if day in RESTARTS:
            log(f"  [restart] day {day}: kernel restart (continuity check)")
            rc = subprocess.run(["bash", str(OUT / "restart_kernel.sh")], timeout=240).returncode
            post = quiz_battery(day, random.Random(SEED * 999 + day))
            log(f"  [restart] back rc={rc}; post-restart quiz {post['score']}/{post['of']}")
            snapshot(day, {"restart": {"rc": rc, "post_quiz_score": post["score"], "post_quiz_of": post["of"]}})
            QUIZ_LOG.write(json.dumps({"day": day, "post_restart": post}) + "\n")

        snapshot(day, {
            "quiz_score": quiz["score"] if quiz else None,
            "quiz_of": quiz["of"] if quiz else None,
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
