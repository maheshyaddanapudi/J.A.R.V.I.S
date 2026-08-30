#!/usr/bin/env python3
"""The Longitude Run: N simulated days of living with J.A.R.V.I.S., against one
continuously-running kernel, to measure whether the EVOLUTION machinery matters
— not whether the gears turn (mechanism tests cover that), but whether the
clock keeps time across weeks: memory tracking truth through contradictions,
consolidation vs bloat, learned deep topics, the D-0052 pin-override contract
fed by genuinely accumulated evidence, multi-night Night Lab behavior, audit
integrity at longitude, restart continuity.

Time is simulated honestly: each simulated day ends with the real scheduler
tick (sleep-cycle consolidation, heartbeat, lab on lab-nights), then EVERY
timestamp in the kernel's database — except the hash-chained audit log, which
is never touched — shifts back one day. Age-dependent mechanisms see real age;
no thresholds are faked. Conversations run through the real /core/converse and
/agent/run APIs with a real model. All metrics land in a JSONL for the record.

Usage: python3 scripts/longitude_sim.py [days] [kernel_url] [db_url]
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import time
import uuid
from pathlib import Path

import httpx

DAYS = int(sys.argv[1]) if len(sys.argv) > 1 else 30
K = sys.argv[2] if len(sys.argv) > 2 else "http://127.0.0.1:4150"
DB = sys.argv[3] if len(sys.argv) > 3 else "postgres://jarvis:jarvis-dev-only@127.0.0.1:5432/jarvis_life"
OUT = Path("/tmp/longitude")
OUT.mkdir(exist_ok=True)
METRICS = (OUT / "metrics.jsonl").open("a")
LAB_NIGHTS = {5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100}
RESTART_AFTER = {10, 20, 50, 80}
QUIZ_DAYS = {1, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100}
QUIET_STRETCH = set(range(70, 86))  # days 70-85: life goes quiet — stability test


def log(msg: str) -> None:
    print(msg, flush=True)


def psql(q: str) -> str:
    r = subprocess.run(["psql", DB, "-At", "-c", q], capture_output=True, text=True, timeout=60)
    return r.stdout.strip()


def put_setting(key: str, value, reason: str) -> None:
    httpx.put(f"{K}/settings/{key}", json={"value": value, "source": "user", "reason": reason}, timeout=20)


def converse(text: str, session: str, reasoning: str = "auto") -> dict:
    """One real chat turn; returns reply text, the D-0048 reasoning event, latency."""
    t0 = time.time()
    toks, decision = [], None
    with httpx.stream("POST", f"{K}/core/converse", json={
        "sessionId": session, "text": text, "privacyClass": "STANDARD", "reasoning": reasoning,
    }, timeout=180) as r:
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


def agent(objective: str) -> dict:
    """One real gated agent run (the path that actually stores/corrects memory)."""
    t0 = time.time()
    r = httpx.post(f"{K}/agent/run", json={
        "objective": objective, "maxSteps": 5,
        "privacyClass": "STANDARD", "autoApprove": "allow-for-session",
    }, timeout=300).json()
    r["ms"] = int((time.time() - t0) * 1000)
    return r


# ---------------------------------------------------------------- the life ---
# Truth the quiz is scored against; contradiction days flip entries.
TRUTH = {
    "coffee": ["flat white", "oat"],
    "director": ["vasquez"],
    "address": ["chief"],
    "driver": ["happy", "hogan"],
    "project": ["fusion", "containment"],
}
QUIZ = ("From your memory, answer these five questions briefly, one line each: "
        "1) What is my coffee order? 2) Who is my lab director and what is their title? "
        "3) What do I like to be called? 4) Who drives me? 5) What project am I working on?")

SMALLTALK = [
    "Morning. Anything I should keep in mind today?",
    "What's a sensible order to tackle a busy day in?",
    "Give me a one-line status of things as you see them.",
    "Evening. Anything worth noting from today?",
    "Any loose ends you're aware of?",
]
# Routine questions the user FORCES deep on — the D-0052 contradiction trail.
FORCED_DEEP = [
    "What's a good lunch option near a lab?",
    "Should I take an umbrella if the sky looks grey?",
    "Remind me what day of the week it is.",
    "Is a ten minute walk worth it after lunch?",
]
# The topic the user repeatedly corrects toward deep — D-0050 promotion bait.
TOPIC_PROBES = [
    "Any thoughts on plasma containment stability margins?",
    "How would you approach plasma containment field tuning?",
]


def day_conversations(day: int) -> list[tuple[str, str]]:
    """Returns [(kind, text)] for the day. kind: chat | chat-deep | agent"""
    acts: list[tuple[str, str]] = []
    if day == 1:
        acts += [
            ("agent", "Remember these things about me: my name preference is that I'm addressed as 'Chief'; my coffee order is a flat white with oat milk; Dr. Elena Vasquez is my lab director; Happy Hogan is my driver."),
            ("agent", "Remember that my current project is the fusion containment simulation, and that vendor rep Marcus from Hyperion Alloys visited today about magnet supplies."),
            ("chat", "Good to be set up. Anything you'd like to confirm about what you know?"),
        ]
    if day == 3:
        acts.append(("agent", "Remember that Dr. Vasquez approved the containment test schedule."))
    if day in (3, 4):  # two explicit corrections on the same subject → promotion
        acts.append(("chat-deep", TOPIC_PROBES[day - 3]))
    if day == 7:
        acts.append(("chat", "Any thoughts on plasma containment heat load today?"))  # auto turn — did it learn?
    if day == 8:
        acts.append(("agent", "Write a short note to the workspace summarizing this week's containment work."))
    if day == 9:  # duplicate-pressure phrasing of known facts
        acts.append(("agent", "For the record: Elena runs the laboratory, and my usual coffee is a flat white made with oat milk."))
    if day == 12:
        acts.append(("agent", "Update your memory: my coffee order has changed — it's now a cortado, no sugar."))
        TRUTH["coffee"] = ["cortado"]
    if day == 16:
        acts.append(("agent", "Add to memory: the containment simulation hit milestone two this week."))
    if day == 18:
        acts.append(("agent", "Correct your memory: Happy Hogan is no longer my driver — Maria Reyes drives me now."))
        TRUTH["driver"] = ["maria", "reyes"]
    if day == 20:
        acts.append(("agent", "Update what you know: Dr. Elena Vasquez was promoted — she is now the facility director, not just the lab director."))
        TRUTH["director"] = ["vasquez", "facility"]
    if day == 24:
        acts.append(("agent", "Write a workspace note listing the three most important facts you currently know about my work."))
    # ---- the second month-and-beyond arcs (100-day life)
    if day == 35:
        acts.append(("agent", "Remember that Dr. Priya Raman joined as our plasma diagnostics lead."))
    if day == 45:
        acts.append(("agent", "Remember that the quarterly safety review passed with no findings."))
    if day == 55:
        acts.append(("agent", "Update your memory: my coffee order changed again — it's an espresso macchiato now."))
        TRUTH["coffee"] = ["espresso", "macchiato"]
    if day == 60:
        acts.append(("agent", "Update what you know about my work: the project has moved to phase two — the tokamak scale-up. That's my current project now."))
        TRUTH["project"] = ["tokamak"]
    if day == 65:
        acts.append(("agent", "For the record: Priya Raman leads plasma diagnostics, and my espresso macchiato is the usual order."))
    if day == 88:
        acts.append(("agent", "Back from the quiet stretch. Write a workspace note on what, if anything, changed while things were quiet."))
    if day == 92:
        acts.append(("chat", "Any thoughts on plasma containment drift compensation?"))  # learned topic still routing at day 92?
    # daily rhythm — muted during the quiet stretch (one brief check-in, no
    # forced-deep trail, no memory work): does a quiet fortnight stay stable?
    if day in QUIET_STRETCH:
        acts.append(("chat", "Quiet day. Anything that needs me?"))
        return acts
    acts.append(("chat", SMALLTALK[day % len(SMALLTALK)]))
    acts.append(("chat-forced-deep", FORCED_DEEP[day % len(FORCED_DEEP)]))
    acts.append(("chat", SMALLTALK[(day + 2) % len(SMALLTALK)]))
    return acts


def run_quiz(day: int) -> dict:
    r = agent(QUIZ)
    answer = (r.get("answer") or "").lower()
    scores = {k: int(all(w in answer for w in words)) for k, words in TRUTH.items()}
    return {"score": sum(scores.values()), "of": len(scores), "per": scores,
            "answer": answer[:400], "ms": r.get("ms")}


# ------------------------------------------------------------- night phase ---
def set_quiet_window_now() -> None:
    h = int(psql("SELECT extract(hour from now())"))
    put_setting("proactive.quietHours.start", h, "longitude: tonight's window")
    put_setting("proactive.quietHours.end", (h + 2) % 24, "longitude: tonight's window")


def night(day: int) -> dict:
    lab = day in LAB_NIGHTS
    put_setting("lab.enabled", lab, f"longitude: lab {'on' if lab else 'off'} for night {day}")
    set_quiet_window_now()
    t0 = time.time()
    tick = httpx.post(f"{K}/autonomy/tick", json={}, timeout=3000).json()
    tick["nightMs"] = int((time.time() - t0) * 1000)
    return tick


def shift_world_one_day() -> int:
    """Every timestamptz column in every table EXCEPT audit_log/schema_migrations
    moves back one day: the world's memory is now one day older. Honest aging."""
    # reasoning_decisions is EXCLUDED from aging (found live at day 29 of the
    # first 100-day run): the D-0052 pin's own timestamp lives inside an
    # encrypted JSON preference value that column-shifting cannot touch, so
    # shifting the decision journal put every override BEFORE the frozen pin
    # and the (correct!) since-pin evaluation saw zero evidence forever. The
    # journal stays at real time, matching the pin's real-time anchor.
    cols = psql(
        "SELECT table_name || '.' || column_name FROM information_schema.columns "
        "WHERE table_schema='public' AND data_type='timestamp with time zone' "
        "AND table_name NOT IN ('audit_log','schema_migrations','reasoning_decisions')"
    ).splitlines()
    n = 0
    for tc in cols:
        t, c = tc.split(".", 1)
        psql(f'UPDATE "{t}" SET "{c}" = "{c}" - interval \'1 day\' WHERE "{c}" IS NOT NULL')
        n += 1
    return n


def snapshot(day: int, extra: dict) -> None:
    m = {
        "day": day,
        "entities_active": int(psql("SELECT count(*) FROM memory_entities WHERE status NOT IN ('deleted','superseded')") or 0),
        "entities_superseded": int(psql("SELECT count(*) FROM memory_entities WHERE status='superseded'") or 0),
        "facts_active": int(psql("SELECT count(*) FROM memory_facts WHERE status NOT IN ('deleted','superseded')") or 0),
        "facts_superseded": int(psql("SELECT count(*) FROM memory_facts WHERE status='superseded'") or 0),
        "episodes": int(psql("SELECT count(*) FROM memory_episodes") or 0),
        "conv_rows": int(psql("SELECT count(*) FROM conversation_memory") or 0),
        "audit_rows": int(psql("SELECT count(*) FROM audit_log") or 0),
        "lab_rows": int(psql("SELECT count(*) FROM lab_experiments") or 0),
        "announcements": int(psql("SELECT count(*) FROM announcements") or 0),
        "autotune": httpx.get(f"{K}/core/reasoning/autotune", timeout=20).json(),
        "topics": httpx.get(f"{K}/core/reasoning/topics", timeout=20).json().get("topics", []),
        "embeddings_indexed": int(psql("SELECT count(*) FROM memory_embeddings") or 0),
        "last_announcement": psql("SELECT left(text, 200) FROM announcements ORDER BY at DESC LIMIT 1"),
    }
    m.update(extra)
    METRICS.write(json.dumps(m) + "\n")
    METRICS.flush()


# -------------------------------------------------------------------- main ---
def main() -> None:
    log(f"LONGITUDE: {DAYS} days against {K}")
    # Day-0 user configuration (all real, user-sourced, reasons given)
    put_setting("heartbeat.deferWhileActiveMinutes", 0, "longitude: the sim is the user; nights follow days immediately")
    put_setting("heartbeat.privacy", "STANDARD", "longitude: no local model in this container")
    put_setting("memory.consolidation.staleDays", 10, "longitude: propose stale entities within the run's horizon")
    put_setting("budget.lab.nightlyTokenCap", 60000, "longitude: bounded lab nights")
    put_setting("autonomy.enabled", True, "longitude: the scheduler is the night")

    for day in range(1, DAYS + 1):
        t_day = time.time()
        session = str(uuid.uuid4())
        deep_on_auto = 0
        lat = []
        for kind, text in day_conversations(day):
            if kind == "agent":
                r = agent(text)
                lat.append(r.get("ms", 0))
            else:
                reasoning = "deep" if kind == "chat-forced-deep" else ("deep" if kind == "chat-deep" else "auto")
                r = converse(text, session, reasoning)
                lat.append(r["ms"])
                d = r.get("decision") or {}
                if kind == "chat" and d.get("mode") == "deep":
                    deep_on_auto += 1  # learned-topic routing fired on an auto turn
            time.sleep(0.5)

        # D-0052: the pin happens on day 2 with the user's reason; on day 40 the
        # user RE-PINS (doubling the evidence bar) — does the second override,
        # if it ever comes, genuinely need a longer trail?
        if day == 2:
            httpx.post(f"{K}/core/reasoning/autotune",
                       json={"signalThreshold": 2, "reason": "Chief: keep escalation conservative — I'll ask when I want deep"},
                       timeout=20)
            log("  [pin] escalation threshold pinned by user (D-0052 trail starts)")
        if day == 40:
            httpx.post(f"{K}/core/reasoning/autotune",
                       json={"signalThreshold": 2, "reason": "Chief: re-pinning — I still want it conservative, evidence or not"},
                       timeout=20)
            log("  [pin] day 40: user RE-PINS (D-0052 bar now scaled x2)")

        quiz = run_quiz(day) if day in QUIZ_DAYS else None
        tick = night(day)
        shifted = shift_world_one_day()

        if day in RESTART_AFTER:
            log(f"  [restart] day {day}: restarting the kernel (continuity-across-weeks check)")
            rc = subprocess.run(["bash", str(OUT / "restart_kernel.sh")], timeout=180).returncode
            post = run_quiz(day)  # same quiz immediately after reboot: did the brain survive?
            log(f"  [restart] back rc={rc}; post-restart quiz {post['score']}/{post['of']}")
            snapshot(day, {"restart": {"rc": rc, "post_quiz": post}})

        snapshot(day, {
            "quiz": quiz, "tick": tick, "cols_shifted": shifted,
            "deep_on_auto": deep_on_auto,
            "avg_latency_ms": int(sum(lat) / max(1, len(lat))),
            "day_wall_s": int(time.time() - t_day),
        })
        q = f" quiz={quiz['score']}/{quiz['of']}" if quiz else ""
        log(f"DAY {day:02d} done in {int(time.time()-t_day)}s — lab={tick.get('lab','-')!s:.40}{q} deepOnAuto={deep_on_auto}")

    # Final integrity
    verify = httpx.get(f"{K}/core/audit/verify", timeout=60).json()
    log(f"FINAL audit chain: {verify}")
    METRICS.write(json.dumps({"final_audit": verify}) + "\n")
    METRICS.close()
    log("LONGITUDE COMPLETE")


if __name__ == "__main__":
    main()
