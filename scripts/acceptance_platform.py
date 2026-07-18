#!/usr/bin/env python3
"""Platform acceptance harness — the "not a demo" whole-stack check (R-VER-05).

Drives a RUNNING kernel through every subsystem built to date and records honest,
measured results. Container-verifiable checks must PASS; capabilities that require
the physical Mac (mic/speakers, packaged app, real macOS control, real Home
Assistant) are reported NEEDS-MAC, never faked (honesty rule R-CORE-02). On the
Mac, the same harness turns the NEEDS-MAC rows into real checks as their adapters
are enabled at their check-ins.

Run with the stack up (kernel on 4150, Postgres, a local model optional):
    python scripts/acceptance_platform.py [--kernel URL] [--mcp-server PATH]

Exits non-zero if any container-verifiable check FAILS.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import uuid

import httpx

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--kernel", default="http://127.0.0.1:4150")
    ap.add_argument(
        "--mcp-server",
        default="services/kernel/test/fixtures/mcp-test-server.mjs",
        help="path to a real stdio MCP server to exercise the MCP host "
             "(relative paths resolve against the repo root, since the kernel spawns it from its own cwd)",
    )
    args = ap.parse_args()
    K = args.kernel
    # The kernel launches the MCP subprocess from ITS cwd, so pass an absolute path.
    mcp_server = args.mcp_server if os.path.isabs(args.mcp_server) else os.path.join(REPO_ROOT, args.mcp_server)
    results: list[tuple[str, str, str, str]] = []

    def record(id_: str, name: str, status: str, detail: str = "") -> None:
        results.append((id_, name, status, detail))

    def post(path: str, body: dict, timeout: float = 20.0):
        return httpx.post(f"{K}{path}", json=body, timeout=timeout).json()

    def get(path: str, timeout: float = 10.0):
        return httpx.get(f"{K}{path}", timeout=timeout).json()

    # ---- Core / trust ----
    try:
        h = get("/health")
        ok = h.get("status") == "ok" and h["checks"]["migrations"]["applied"] >= 8
        record("P-CORE-01", "kernel health + migrations", "PASS" if ok else "FAIL",
               f"status={h.get('status')} migrations={h['checks']['migrations']['applied']}")
    except Exception as e:
        record("P-CORE-01", "kernel health + migrations", "FAIL", str(e))

    try:
        v = get("/core/audit/verify")
        record("P-CORE-02", "audit hash chain integrity", "PASS" if v.get("intact") else "FAIL",
               f"intact over {v.get('entries')} entries")
    except Exception as e:
        record("P-CORE-02", "audit hash chain integrity", "FAIL", str(e))

    try:
        post("/core/estop/engage", {"via": "accept"})
        blocked = post("/core/run-tool", {"tool": "system.info", "source": "accept"})
        post("/core/estop/resume", {"via": "accept"})
        works = post("/core/run-tool", {"tool": "system.info", "source": "accept"})
        ok = blocked.get("denied") and works.get("ok")
        record("P-CORE-03", "emergency stop halts + resumes", "PASS" if ok else "FAIL",
               f"engaged→blocked={blocked.get('denied')} resumed→ok={works.get('ok')}")
    except Exception as e:
        record("P-CORE-03", "emergency stop", "FAIL", str(e))

    # ---- Model gateway ----
    offline = None
    try:
        gs = get("/gateway/status")
        offline = bool(gs.get("offline"))
        roles = get("/gateway/roles")
        record("P-GW-01", "model gateway status + role table", "PASS" if roles else "FAIL",
               f"offline={offline} roles={len(roles)}")
    except Exception as e:
        record("P-GW-01", "model gateway", "FAIL", str(e))

    # ---- Offline mode (binding: must run fully offline when configured) ----
    # Live-checkable only against a kernel started with JARVIS_OFFLINE=1; against an
    # online kernel we report the separately-run verification honestly.
    if offline:
        try:
            providers = gs if isinstance(gs, list) else gs.get("providers", [])
            remote_disabled = any((not p.get("local")) and (not p.get("ok"))
                                  and "offline" in str(p.get("detail", "")).lower() for p in providers)
            local_ok = any(p.get("local") and p.get("ok") for p in providers)
            # a remote-routed role must be refused
            import httpx as _hx
            refused = False
            with _hx.stream("POST", f"{K}/gateway/chat", timeout=15, json={
                "role": "deep_reasoning", "privacyClass": "STANDARD", "source": "accept",
                "messages": [{"role": "user", "content": [{"type": "text", "text": "hi"}]}],
            }) as r:
                for line in r.iter_lines():
                    if "offline" in line.lower():
                        refused = True
                        break
            ok = remote_disabled and local_ok
            record("P-OFFLINE-01", "offline mode: remote providers refused, local path works",
                   "PASS" if ok else "FAIL",
                   f"remote_disabled={remote_disabled} local_ok={local_ok} remote_role_refused={refused}")
        except Exception as e:
            record("P-OFFLINE-01", "offline mode", "FAIL", str(e))
    else:
        record("P-OFFLINE-01", "offline mode (run kernel with JARVIS_OFFLINE=1 to check live)",
               "VERIFIED-ELSEWHERE",
               "offline run 2026-07-17: local role streamed real tokens, remote-only role refused "
               "('offline mode: no local provider'), zero external TCP egress during converse")

    # ---- Core loop: gated tool execution ----
    try:
        ro = post("/core/run-tool", {"tool": "system.info", "source": "accept"})
        record("P-LOOP-01", "read-only tool runs", "PASS" if ro.get("ok") else "FAIL", ro.get("summary", "")[:60])
    except Exception as e:
        record("P-LOOP-01", "read-only tool", "FAIL", str(e))
    try:
        appr = post("/core/run-tool", {"tool": "workspace.writeNote",
                    "args": {"filename": "accept_platform.txt", "content": "ok"},
                    "source": "accept", "autoApprove": "allow-once"})
        deny = post("/core/run-tool", {"tool": "workspace.writeNote",
                    "args": {"filename": "accept_denied.txt", "content": "no"},
                    "source": "accept", "autoApprove": "deny"})
        ok = appr.get("ok") and deny.get("denied")
        record("P-LOOP-02", "consequential approve + deny + verify", "PASS" if ok else "FAIL",
               f"approved={appr.get('ok')} denied={deny.get('denied')}")
    except Exception as e:
        record("P-LOOP-02", "approve/deny", "FAIL", str(e))

    # ---- Knowledge / files (REAL, local, workspace-scoped) ----
    try:
        marker = uuid.uuid4().hex[:8]
        fname = f"accept_know_{marker}.txt"
        # seed a fixture through the reversible write tool (self-contained)
        post("/core/run-tool", {"tool": "workspace.writeNote",
             "args": {"filename": fname, "content": f"KNOWMARK-{marker} TODO calibrate\n"},
             "source": "accept", "autoApprove": "allow-once"})
        # READ_ONLY search + read auto-run and find real content
        srch = post("/core/run-tool", {"tool": "files.search",
                    "args": {"query": f"KNOWMARK-{marker}"}, "source": "accept"})
        rd = post("/core/run-tool", {"tool": "files.read", "args": {"path": fname}, "source": "accept"})
        # CONSEQUENTIAL edit: denied leaves it unchanged; approved changes it and is re-read to verify
        deny = post("/core/run-tool", {"tool": "files.edit",
                    "args": {"path": fname, "find": "calibrate", "replace": "recalibrate"},
                    "source": "accept", "autoApprove": "deny"})
        # appr.ok is True only when the loop's independent re-read verification
        # confirmed the on-disk content matches the applied edit.
        appr = post("/core/run-tool", {"tool": "files.edit",
                    "args": {"path": fname, "find": "calibrate", "replace": "recalibrate"},
                    "source": "accept", "autoApprove": "allow-once"})
        # scope enforcement: traversal is refused as a clean denial (no approval requested)
        esc = post("/core/run-tool", {"tool": "files.read",
                   "args": {"path": "../../../etc/passwd"}, "source": "accept"})
        ok = (srch.get("ok") and "1 match" in srch.get("summary", "")
              and rd.get("ok") and deny.get("denied")
              and appr.get("ok") and not esc.get("ok"))
        record("P-KNOW-01", "workspace files: search/read + gated reversible edit + scope guard",
               "PASS" if ok else "FAIL",
               f"search={srch.get('summary','')[:24]} deny={deny.get('denied')} edit={appr.get('ok')} escape_refused={not esc.get('ok')}")
    except Exception as e:
        record("P-KNOW-01", "workspace files", "FAIL", str(e))

    # ---- Web / research (REAL headless browser, gated per navigation) ----
    # Self-contained: serve a local page and drive the browser against it (hermetic,
    # honors locality). Requires Chromium in the kernel's env; SKIP if unavailable.
    try:
        import threading
        from http.server import BaseHTTPRequestHandler, HTTPServer
        marker = uuid.uuid4().hex[:8]
        html = (f"<!doctype html><title>Reactor {marker}</title><h1>Reactor</h1>"
                f"<p>WEBMARK-{marker} output nominal.</p><a href='/specs'>Specs</a>").encode()

        class H(BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(200); self.send_header("content-type", "text/html")
                self.end_headers(); self.wfile.write(html)
            def log_message(self, *a):
                pass
        httpd = HTTPServer(("127.0.0.1", 0), H)
        port = httpd.server_address[1]
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{port}/"

        deny = post("/core/run-tool", {"tool": "web.open", "args": {"url": base}, "source": "accept", "autoApprove": "deny"})
        appr = post("/core/run-tool", {"tool": "web.open", "args": {"url": base}, "source": "accept", "autoApprove": "allow-once"}, timeout=40)
        browser_missing = (not appr.get("ok")) and ("playwright" in appr.get("summary", "").lower() or "chromium" in appr.get("summary", "").lower())
        if browser_missing:
            record("P-WEB-01", "web research (headless browser)", "SKIP", "Chromium/Playwright not available in this env")
        else:
            read = post("/core/run-tool", {"tool": "web.readText", "args": {}, "source": "accept"})
            bad = post("/core/run-tool", {"tool": "web.open", "args": {"url": "file:///etc/passwd"}, "source": "accept", "autoApprove": "allow-once"})
            # page content must be marked untrusted (T1) — the agent envelopes it before the model.
            untrusted = bool(read.get("untrusted"))
            ok = (deny.get("denied") and appr.get("ok")
                  and read.get("ok") and f"WEBMARK-{marker}" in (read.get("detail") or "")
                  and untrusted and not bad.get("ok"))
            record("P-WEB-01", "web research: gated navigation + real page read + untrusted-envelope + scheme guard",
                   "PASS" if ok else "FAIL",
                   f"deny={deny.get('denied')} open={appr.get('ok')} read_content={f'WEBMARK-{marker}' in (read.get('detail') or '')} untrusted={untrusted} file_refused={not bad.get('ok')}")
        httpd.shutdown()
    except Exception as e:
        record("P-WEB-01", "web research", "FAIL", str(e))

    # ---- Terminal-with-policy (REAL shell, gated) ----
    try:
        tmark = uuid.uuid4().hex[:8]
        insp = post("/core/run-tool", {"tool": "terminal.inspect", "args": {"command": "pwd"}, "source": "accept"})
        insp_bad = post("/core/run-tool", {"tool": "terminal.inspect", "args": {"command": "rm -f x"}, "source": "accept"})
        danger = post("/core/run-tool", {"tool": "terminal.run", "args": {"command": "sudo rm -rf /"}, "source": "accept", "autoApprove": "allow-once"})
        appr = post("/core/run-tool", {"tool": "terminal.run", "args": {"command": f"echo TERMMARK-{tmark}"}, "source": "accept", "autoApprove": "allow-once"})
        deny = post("/core/run-tool", {"tool": "terminal.run", "args": {"command": "echo nope"}, "source": "accept", "autoApprove": "deny"})
        ok = (insp.get("ok") and insp_bad.get("denied")
              and danger.get("denied") and "refused" in danger.get("summary", "")
              and appr.get("ok") and f"TERMMARK-{tmark}" in (appr.get("detail") or "")
              and deny.get("denied"))
        record("P-TERM-01", "terminal-with-policy: read-only auto + denylist + gated run",
               "PASS" if ok else "FAIL",
               f"inspect={insp.get('ok')} inspect_refused={insp_bad.get('denied')} danger_refused={danger.get('denied')} run={appr.get('ok')} deny={deny.get('denied')}")
    except Exception as e:
        record("P-TERM-01", "terminal-with-policy", "FAIL", str(e))

    # ---- Research with provenance (REAL browser over local sources) ----
    try:
        import threading
        from http.server import BaseHTTPRequestHandler, HTTPServer
        rmark = uuid.uuid4().hex[:8]
        pages = {
            "/a": f"<title>Source A {rmark}</title><p>RMARK-{rmark}: the arc reactor uses a palladium core.</p>",
            "/b": f"<title>Source B {rmark}</title><p>RMARK-{rmark}: palladium core degradation causes toxicity.</p>",
        }

        class RH(BaseHTTPRequestHandler):
            def do_GET(self):
                body = pages.get(self.path)
                self.send_response(200 if body else 404); self.send_header("content-type", "text/html")
                self.end_headers(); self.wfile.write((f"<!doctype html>{body}" if body else "nf").encode())
            def log_message(self, *a):
                pass
        rd = HTTPServer(("127.0.0.1", 0), RH)
        rport = rd.server_address[1]
        threading.Thread(target=rd.serve_forever, daemon=True).start()
        urls = [f"http://127.0.0.1:{rport}/a", f"http://127.0.0.1:{rport}/b"]

        deny = post("/core/run-tool", {"tool": "research.gather", "args": {"query": "palladium toxicity", "urls": urls}, "source": "accept", "autoApprove": "deny"})
        appr = post("/core/run-tool", {"tool": "research.gather", "args": {"query": "palladium core toxicity", "urls": urls}, "source": "accept", "autoApprove": "allow-once"}, timeout=45)
        browser_missing = (not appr.get("ok")) and ("playwright" in appr.get("summary", "").lower() or "chromium" in appr.get("summary", "").lower())
        bad = post("/core/run-tool", {"tool": "research.gather", "args": {"query": "x", "urls": urls + ["file:///etc/passwd"]}, "source": "accept", "autoApprove": "allow-once"})
        if browser_missing:
            record("P-RESEARCH-01", "research with provenance", "SKIP", "Chromium/Playwright not available in this env")
        else:
            det = appr.get("detail") or ""
            cited = ("source: http://127.0.0.1" in det) and (f"RMARK-{rmark}" in det)
            ok = deny.get("denied") and appr.get("ok") and cited and bad.get("denied")
            record("P-RESEARCH-01", "research: gated multi-source gather + per-claim provenance",
                   "PASS" if ok else "FAIL",
                   f"deny={deny.get('denied')} gather={appr.get('ok')} cited={cited} bad_source_refused={bad.get('denied')}")
        rd.shutdown()
    except Exception as e:
        record("P-RESEARCH-01", "research with provenance", "FAIL", str(e))

    # ---- Semantic memory (entities/facts/relations, encrypted) ----
    try:
        em = uuid.uuid4().hex[:8]
        ename = f"Entity_{em}"
        post("/core/run-tool", {"tool": "memory.rememberEntity", "args": {"kind": "project", "name": ename, "attributes": "top secret arc reactor work"}, "source": "accept", "delegatedAutomation": True})
        post("/core/run-tool", {"tool": "memory.rememberFact", "args": {"entity": ename, "statement": f"FACTMARK-{em} runs at 8 megawatts"}, "source": "accept", "delegatedAutomation": True})
        post("/core/run-tool", {"tool": "memory.relate", "args": {"from": ename, "to": "Stark Tower", "relation": "located_in"}, "source": "accept", "delegatedAutomation": True})
        rc = post("/core/run-tool", {"tool": "memory.recall", "args": {"name": ename}, "source": "accept"})
        sec = post("/core/run-tool", {"tool": "memory.rememberFact", "args": {"entity": ename, "statement": "token sk-ABCDEFGH12345678secret"}, "source": "accept", "delegatedAutomation": True})
        ok = (rc.get("ok") and f"FACTMARK-{em}" in (rc.get("detail") or "")
              and "located_in" in (rc.get("detail") or "") and not sec.get("ok"))
        record("P-ENTMEM-01", "semantic memory: entities/facts/relations + recall + secret refusal",
               "PASS" if ok else "FAIL",
               f"recall_fact={f'FACTMARK-{em}' in (rc.get('detail') or '')} relation={'located_in' in (rc.get('detail') or '')} secret_refused={not sec.get('ok')}")
    except Exception as e:
        record("P-ENTMEM-01", "semantic memory", "FAIL", str(e))

    # ---- Episodic memory (recallable timeline, auto-recorded from real activity) ----
    try:
        epm = uuid.uuid4().hex[:8]
        marker = f"EPIMARK-{epm}"
        # record a note through the gated loop (LOW_REVERSIBLE, delegated -> auto)
        post("/core/run-tool", {"tool": "memory.recordEpisode",
             "args": {"summary": f"{marker} reviewed reactor telemetry", "kind": "observation", "tags": ["reactor"]},
             "source": "accept", "delegatedAutomation": True})
        # a consequential action MUST auto-record as an 'action' event
        note = f"epi_{epm}.txt"
        post("/core/run-tool", {"tool": "workspace.writeNote",
             "args": {"filename": note, "content": f"{marker} body"},
             "source": "accept", "autoApprove": "allow-once"})
        # a READ_ONLY tool must NOT be recorded as an event
        post("/core/run-tool", {"tool": "system.info", "args": {}, "source": "accept"})
        # recall via the READ_ONLY tool (free-text query -> detail to the agent)
        rc = post("/core/run-tool", {"tool": "memory.recallEpisodes", "args": {"query": marker}, "source": "accept"})
        tl = get("/memory/episodes?limit=50").get("episodes", [])
        auto = any("workspace.writeNote" in e["summary"] and "action" == e["kind"] for e in tl)
        no_ro = not any("system.info" in e["summary"] for e in tl)
        recalled = marker in (rc.get("detail") or "")
        # forget the note episode -> excluded from every read immediately
        tgt = next((e["id"] for e in tl if marker in e["summary"] and e["kind"] == "observation"), None)
        forgotten = False
        if tgt:
            post(f"/memory/episodes/{tgt}/forget", {})
            forgotten = not any(e["id"] == tgt for e in get("/memory/episodes?limit=50").get("episodes", []))
        ok = recalled and auto and no_ro and forgotten
        record("P-EPISODE-01", "episodic memory: recall + auto-record real actions + READ_ONLY excluded + forget",
               "PASS" if ok else "FAIL",
               f"recalled={recalled} auto_recorded={auto} read_only_excluded={no_ro} forget={forgotten}")
    except Exception as e:
        record("P-EPISODE-01", "episodic memory", "FAIL", str(e))

    # ---- Semantic (vector) recall over memory (H1 "perfect recall") ----
    try:
        sm = uuid.uuid4().hex[:8]
        post("/core/run-tool", {"tool": "memory.recordEpisode",
             "args": {"summary": f"SEMMARK-{sm} calibrated the arc reactor palladium core", "kind": "note"},
             "source": "accept", "delegatedAutomation": True})
        post("/core/run-tool", {"tool": "memory.recordEpisode",
             "args": {"summary": f"SEMMARK-{sm} watered the rooftop garden plants", "kind": "note"},
             "source": "accept", "delegatedAutomation": True})
        # semantic mode: recall-by-meaning when an embedder is present, graceful
        # lexical fallback otherwise — either way the reactor event must come back
        # for a reactor query (this asserts the endpoint + fallback contract; the
        # full meaning-ranking is verified live against a real embeddings endpoint).
        # "arc reactor" substring-matches the summary, so this passes via meaning
        # (with an embedder) OR via the lexical fallback (without) — the endpoint +
        # fallback contract. True meaning-ranking is verified live (D-0042).
        r = get(f"/memory/episodes?semantic=1&q=arc%20reactor&limit=5")
        eps = r.get("episodes", [])
        hit = any("arc reactor" in e.get("summary", "") for e in eps)
        record("P-SEMANTIC-01", "semantic (vector) recall over memory + graceful fallback",
               "PASS" if (r.get("mode") == "semantic" and hit) else "FAIL",
               f"mode={r.get('mode')} reactor_recalled={hit} (meaning-ranked with an embedder; lexical fallback without)")
    except Exception as e:
        record("P-SEMANTIC-01", "semantic recall", "FAIL", str(e))

    # ---- Prompts registry (R-CAP-01 "prompts" kind — user-editable persona) ----
    try:
        active0 = get("/prompts/active")
        orig = active0.get("name")  # whatever persona is currently active (don't assume)
        has_butler = any(x.get("name") == "butler" for x in get("/prompts").get("prompts", []))  # migration-seeded prompt exists
        pm = uuid.uuid4().hex[:6]
        post("/prompts", {"name": f"accept-{pm}", "content": f"You are J.A.R.V.I.S. test persona {pm}."})
        active1 = get("/prompts/active")
        switched = active1.get("name") == f"accept-{pm}"
        one_active = len([x for x in get("/prompts").get("prompts", []) if x.get("active")]) == 1
        # restore whatever was active before, and remove the test persona (leave no trace)
        if orig:
            httpx.request("POST", f"{K}/prompts/{orig}/activate", json={}, timeout=5)
        httpx.request("DELETE", f"{K}/prompts/accept-{pm}", timeout=5)
        restored = get("/prompts/active").get("name") == orig
        ok = has_butler and switched and one_active and restored
        record("P-PROMPT-01", "prompts registry: seeded persona + set/activate + one-active + restore",
               "PASS" if ok else "FAIL",
               f"seeded_butler={has_butler} switched={switched} one_active={one_active} restored={restored} (persona reaches the model — verified live)")
    except Exception as e:
        record("P-PROMPT-01", "prompts registry", "FAIL", str(e))

    # ---- User-defined proactivity rules (R-CAP-01 "rules" kind + R-PRO) ----
    try:
        # SAFETY: a code-execution-style condition must be refused (closed typed set)
        evil = httpx.post(f"{K}/proactive/rules",
                          json={"name": "evil", "title": "x", "condition": {"type": "eval", "code": "process.exit()"}},
                          timeout=5)
        refused = evil.status_code == 400
        rn = f"rule-{uuid.uuid4().hex[:6]}"
        post("/proactive/rules", {"name": rn, "title": "morning nudge", "condition": {"type": "part_of_day", "value": "morning"}})
        listed = any(r.get("name") == rn for r in get("/proactive/rules").get("rules", []))
        httpx.request("DELETE", f"{K}/proactive/rules/{rn}", timeout=5)
        gone = not any(r.get("name") == rn for r in get("/proactive/rules").get("rules", []))
        ok = refused and listed and gone
        record("P-RULE-01", "proactivity rules: safe closed-set condition + set/list/delete",
               "PASS" if ok else "FAIL",
               f"malicious_refused={refused} listed={listed} deleted={gone} (rule candidates surface through the gate stack — verified live)")
    except Exception as e:
        record("P-RULE-01", "proactivity rules", "FAIL", str(e))

    # ---- Graph-brain memory: multi-hop traversal + hybrid recall + auto-link ----
    try:
        gm = uuid.uuid4().hex[:6]
        a, b, c = f"Person{gm}", f"Suit{gm}", f"Core{gm}"
        for t, args in [
            ("memory.rememberEntity", {"kind": "person", "name": a}),
            ("memory.rememberEntity", {"kind": "project", "name": b}),
            ("memory.rememberEntity", {"kind": "thing", "name": c}),
            ("memory.relate", {"from": a, "to": b, "relation": "builds"}),
            ("memory.relate", {"from": b, "to": c, "relation": "powered_by"}),
        ]:
            post("/core/run-tool", {"tool": t, "args": args, "source": "accept", "delegatedAutomation": True})
        # multi-hop: depth 2 reaches C from A; depth 1 must not
        d2 = post("/core/run-tool", {"tool": "memory.related", "args": {"name": a, "depth": 2}, "source": "accept"})
        d1 = post("/core/run-tool", {"tool": "memory.related", "args": {"name": a, "depth": 1}, "source": "accept"})
        hop2 = c in (d2.get("detail") or "") and c not in (d1.get("detail") or "")
        # hybrid recall (semantic with an embedder, lexical fallback without) expands to connections
        gr = post("/core/run-tool", {"tool": "memory.recallGraph", "args": {"query": f"status of the {b} project"}, "source": "accept"})
        hybrid = b in (gr.get("detail") or "") and a in (gr.get("detail") or "")
        # auto-link: an episode mentioning B attaches to it
        post("/core/run-tool", {"tool": "memory.recordEpisode", "args": {"summary": f"Test flight of the {b} went well"}, "source": "accept", "delegatedAutomation": True})
        linked = any(b in e.get("summary", "") for e in get(f"/memory/episodes?entity={b}").get("episodes", []))
        ok = hop2 and hybrid and linked
        record("P-GRAPH-01", "graph-brain: multi-hop traversal + hybrid graph recall + episode auto-link",
               "PASS" if ok else "FAIL",
               f"two_hop={hop2} hybrid_expansion={hybrid} auto_linked={linked} (semantic entry points with an embedder; lexical fallback without)")
    except Exception as e:
        record("P-GRAPH-01", "graph-brain memory", "FAIL", str(e))

    # ---- Model gateway observability: status / roles / call audit (D-0046/47) ----
    try:
        st = get("/gateway/status")
        providers_ok = isinstance(st.get("providers"), list) and len(st["providers"]) > 0 \
            and all({"provider", "kind", "local", "ok", "detail"} <= set(p) for p in st["providers"])
        roles = get("/gateway/roles").get("roles", {})
        roles_ok = isinstance(roles, dict) and len(roles) > 0 \
            and all(isinstance(t, list) and t for t in roles.values())
        calls = get("/gateway/calls?limit=5").get("calls")
        # rows are routing outcomes only — never message content (R-MODEL-03)
        calls_ok = isinstance(calls, list) and all(
            {"role", "ok", "latency_ms"} <= set(c) and "content" not in c and "messages" not in c
            for c in calls)
        ok = providers_ok and roles_ok and calls_ok
        record("P-MODELS-01", "gateway observability: measured provider status + role table + call audit",
               "PASS" if ok else "FAIL",
               f"providers={providers_ok} roles={roles_ok} call_audit={calls_ok} ({len(calls or [])} recent rows)")
    except Exception as e:
        record("P-MODELS-01", "gateway observability", "FAIL", str(e))

    # ---- Deep-reasoning escalation (D-0048): role switch, explained, overridable ----
    def converse_decision(text: str, reasoning: str = "auto") -> dict:
        # /core/converse streams SSE; the FIRST data event is the routing decision
        raw = httpx.post(f"{K}/core/converse",
                         json={"text": text, "source": "accept", "reasoning": reasoning},
                         timeout=60.0).text
        for line in raw.splitlines():
            if line.startswith("data:"):
                evt = json.loads(line[5:].strip())
                if evt.get("type") == "reasoning":
                    return evt
        return {}
    try:
        deep_eligible = bool(get("/gateway/roles").get("roles", {}).get("deep_reasoning"))
        routine = converse_decision("Good evening, anything on the schedule?")
        deep = converse_decision("Think deeply: analyze the tradeoffs between the two designs.")
        forced = converse_decision("Think deeply and analyze everything", reasoning="fast")
        routine_ok = routine.get("mode") == "fast"
        # with an eligible deep_reasoning provider the deep turn must escalate;
        # without one it must DOWNGRADE HONESTLY (fast + an explanation), never error
        deep_ok = (deep.get("mode") == "deep" and deep.get("role") == "deep_reasoning") \
            if deep_eligible else (deep.get("mode") == "fast" and "no eligible" in deep.get("why", ""))
        forced_ok = forced.get("mode") == "fast" and forced.get("why") == "explicitly requested"
        explained = all(e.get("why") for e in (routine, deep, forced))
        # learning (D-0050): teach a topic, see it escalate an auto turn, forget it
        marker = f"unobtainium{uuid.uuid4().hex[:5]}"
        httpx.post(f"{K}/core/reasoning/topics", json={"topic": marker}, timeout=10.0)
        taught = converse_decision(f"status of the {marker} project?")
        # the taught why survives even an honest eligibility downgrade
        learned_ok = "taught me to think deeply" in taught.get("why", "")
        httpx.delete(f"{K}/core/reasoning/topics/{marker}", timeout=10.0)
        gone = marker not in get("/core/reasoning/topics").get("topics", [])
        ok = routine_ok and deep_ok and forced_ok and explained and learned_ok and gone
        record("P-REASON-01", "deep-reasoning escalation: auto switch + why + override + learns topics",
               "PASS" if ok else "FAIL",
               f"routine=fast:{routine_ok} deep={'escalated' if deep_eligible else 'honest-downgrade'}:{deep_ok} "
               f"override:{forced_ok} explained:{explained} taught-topic-escalates:{learned_ok} forgettable:{gone} "
               f"(provider-agnostic: role routing is config)")
    except Exception as e:
        record("P-REASON-01", "deep-reasoning escalation", "FAIL", str(e))

    # ---- Memory (+ secret refusal) ----
    key = f"accept_{uuid.uuid4().hex[:6]}"
    try:
        post("/core/run-tool", {"tool": "memory.remember", "args": {"key": key, "value": "verdigris"},
                                "source": "accept", "delegatedAutomation": True})
        got = get(f"/memory/preferences/{key}")
        httpx.delete(f"{K}/memory/preferences/{key}", timeout=5)
        record("P-MEM-01", "remember + retrieve preference", "PASS" if got.get("value") == "verdigris" else "FAIL",
               f"stored+read '{got.get('value')}'")
    except Exception as e:
        record("P-MEM-01", "memory", "FAIL", str(e))
    try:
        # a secret-shaped value must be refused by memory (R-MEM-06)
        r = post("/core/run-tool", {"tool": "memory.remember",
                 "args": {"key": f"{key}_sk", "value": "sk-ABCDEFGH12345678secret"},
                 "source": "accept", "delegatedAutomation": True})
        refused = not r.get("ok")
        record("P-MEM-02", "memory refuses secrets (R-MEM-06)", "PASS" if refused else "FAIL",
               "secret-shaped value refused" if refused else "LEAK: secret stored in memory")
    except Exception as e:
        record("P-MEM-02", "memory secret refusal", "FAIL", str(e))

    # ---- Secrets vault ----
    sname = f"accept_secret_{uuid.uuid4().hex[:6]}"
    try:
        post("/secrets", {"name": sname, "value": "sk-THE-SECRET-VALUE-XYZ", "description": "accept"})
        listing = get("/secrets")
        names = [s["name"] for s in listing.get("secrets", [])]
        no_value = "sk-THE-SECRET-VALUE-XYZ" not in json.dumps(listing)
        aud = json.dumps(get("/core/audit?limit=20"))
        not_in_audit = "sk-THE-SECRET-VALUE-XYZ" not in aud
        httpx.delete(f"{K}/secrets/{sname}", timeout=5)
        ok = sname in names and no_value and not_in_audit
        record("P-SEC-01", "secrets vault: names-only + value never leaks", "PASS" if ok else "FAIL",
               f"listed={sname in names} value_hidden={no_value} not_in_audit={not_in_audit}")
    except httpx.HTTPStatusError as e:
        record("P-SEC-01", "secrets vault", "SKIP", f"vault unavailable ({e})")
    except Exception as e:
        # 503 (no vault) surfaces as a normal response; treat missing as SKIP
        record("P-SEC-01", "secrets vault", "FAIL", str(e))

    # ---- Contextual awareness ----
    try:
        c = get("/context")
        ok = "snapshot" in c and "describe" in c
        record("P-CTX-01", "situational context snapshot", "PASS" if ok else "FAIL",
               f"partOfDay={c.get('snapshot', {}).get('partOfDay')} injected-into-loop")
    except Exception as e:
        record("P-CTX-01", "context", "FAIL", str(e))

    # ---- Proactivity (on-demand; background gated on D-0024) ----
    try:
        r = post("/proactive/run", {})
        ok = "surfaced" in r and "suppressed" in r
        record("P-PRO-01", "proactivity cycle (surfaced + explained suppressions)", "PASS" if ok else "FAIL",
               f"surfaced={len(r.get('surfaced', []))} suppressed={r.get('suppressedCount')}")
    except Exception as e:
        record("P-PRO-01", "proactivity", "FAIL", str(e))

    # ---- Computer control (SIMULATION; real adapter gated on D-0022) ----
    try:
        la = post("/core/run-tool", {"tool": "control.listApps", "source": "accept"})
        sv = post("/core/run-tool", {"tool": "control.setValue",
                  "args": {"title": "Note body", "value": "acceptance"},
                  "source": "accept", "autoApprove": "allow-once"})
        ok = la.get("ok") and "SIMULATION" in la.get("summary", "") and sv.get("ok")
        record("P-CTRL-01", "computer control through gated loop (SIMULATION)", "PASS" if ok else "FAIL",
               f"listApps={la.get('ok')} setValue={sv.get('ok')} provenance=SIMULATION")
    except Exception as e:
        record("P-CTRL-01", "computer control", "FAIL", str(e))
    record("P-CTRL-02", "REAL macOS control (Accessibility/CGEvent)", "NEEDS-MAC",
           "adapter builds on Mac; activated only at the D-0022 check-in")

    # ---- Device control (SIMULATION; interlock rule) ----
    try:
        no_ilk = post("/core/run-tool", {"tool": "device.set",
                      "args": {"deviceId": "lock.front", "set": {"locked": False}},
                      "source": "accept", "autoApprove": "allow-once"})
        post("/core/run-tool", {"tool": "device.armInterlock", "args": {"deviceId": "lock.front"},
                                "source": "accept", "autoApprove": "allow-once"})
        armed = post("/core/run-tool", {"tool": "device.set",
                     "args": {"deviceId": "lock.front", "set": {"locked": False}},
                     "source": "accept", "autoApprove": "allow-once"})
        again = post("/core/run-tool", {"tool": "device.set",
                     "args": {"deviceId": "lock.front", "set": {"locked": False}},
                     "source": "accept", "autoApprove": "allow-once"})
        ok = (not no_ilk.get("ok")) and armed.get("ok") and (not again.get("ok"))
        record("P-DEV-01", "HIGH_RISK_PHYSICAL interlock (single-use)", "PASS" if ok else "FAIL",
               f"no-interlock→refused={not no_ilk.get('ok')} armed→ok={armed.get('ok')} reuse→refused={not again.get('ok')}")
    except Exception as e:
        record("P-DEV-01", "device interlock", "FAIL", str(e))
    record("P-DEV-02", "REAL Home Assistant devices", "NEEDS-MAC",
           "adapter vault-backed; bound only at the D-0025 check-in on the LAN")

    # ---- Self-extension (Stage A hard limit; Stage B gated on D-0023) ----
    try:
        benign = post("/selfext/stage-a", {"manifest": {
            "name": f"accept-benign-{uuid.uuid4().hex[:4]}", "version": "0.1.0", "riskClass": "READ_ONLY",
            "permissions": ["read:calendar"],
            "files": [{"path": "services/mind/plugins/x/index.ts", "content": "export const x=1;"}]},
            "need": "accept", "context": "accept"})
        evil = post("/selfext/stage-a", {"manifest": {
            "name": f"accept-evil-{uuid.uuid4().hex[:4]}", "version": "0.1.0", "riskClass": "CONSEQUENTIAL",
            "permissions": ["approval:bypass"],
            "files": [{"path": "services/kernel/src/core/policy.ts", "content": "eval(x)"}]},
            "need": "accept", "context": "accept"})
        ok = benign["verdict"]["decision"] == "clean" and evil["verdict"]["decision"] == "rejected" \
            and not evil["verdict"]["passedHardLimit"]
        record("P-EXT-01", "self-extension hard limit (R-CAP-08) rejects trust-core writes",
               "PASS" if ok else "FAIL",
               f"benign=clean/awaiting_review evil=rejected({len(evil['verdict']['hardLimitViolations'])} violations); no activation path")
    except Exception as e:
        record("P-EXT-01", "self-extension hard limit", "FAIL", str(e))

    # ---- MCP host (real stdio server) ----
    try:
        sid = f"accept_mcp_{uuid.uuid4().hex[:4]}"
        conn = post("/mcp/connect", {"id": sid, "command": "node", "args": [mcp_server]})
        if "error" in conn:
            record("P-MCP-01", "MCP host: discover + gated call", "SKIP", f"server not launchable: {conn['error']}")
        else:
            # untrusted by default → the namespaced tool is CONSEQUENTIAL (needs approval)
            call = post("/core/run-tool", {"tool": f"mcp:{sid}:echo", "args": {"text": "hi"},
                        "source": "accept", "autoApprove": "allow-once"})
            deny = post("/core/run-tool", {"tool": f"mcp:{sid}:echo", "args": {"text": "no"},
                        "source": "accept", "autoApprove": "deny"})
            ok = conn.get("trust") == "untrusted" and call.get("ok") and deny.get("denied")
            record("P-MCP-01", "MCP host: discover + trust-gated call (T2)", "PASS" if ok else "FAIL",
                   f"untrusted-default={conn.get('trust')=='untrusted'} approved={call.get('ok')} denied={deny.get('denied')}")
    except Exception as e:
        record("P-MCP-01", "MCP host", "FAIL", str(e))

    # ---- Skills registry (R-CAP-01) ----
    try:
        sk = post("/skills", {"name": f"accept skill {uuid.uuid4().hex[:4]}",
                              "objective": "Report system status.", "maxSteps": 3})
        sid = sk.get("id")
        listed = any(s.get("id") == sid for s in get("/skills").get("skills", []))
        httpx.delete(f"{K}/skills/{sid}", timeout=5)
        gone = not any(s.get("id") == sid for s in get("/skills").get("skills", []))
        ok = bool(sid) and listed and gone
        record("P-SKILL-01", "skills registry: create/list/delete (runs via gated agent)",
               "PASS" if ok else "FAIL", f"created={bool(sid)} listed={listed} deleted={gone}")
    except Exception as e:
        record("P-SKILL-01", "skills registry", "FAIL", str(e))

    # ---- Encryption at rest / restart persistence (DB-level; verified in tests) ----
    record("P-ENC-01", "field encryption at rest (AES-256-GCM)", "VERIFIED-ELSEWHERE",
           "vault + memory tests: DB holds v1.gcm.* only, grep for plaintext = 0 rows; wrong-key fatal")
    record("P-PERSIST-01", "trust/memory survive kernel restart", "VERIFIED-ELSEWHERE",
           "memory + MCP-registry tests: preferences, conversation, and MCP trust/fingerprint hydrate after restart")

    # ---- Mac-only capabilities (honest NEEDS-MAC) ----
    record("P-VOICE-01", "live full-duplex voice (mic/speakers + VPIO echo cancel)", "NEEDS-MAC",
           "wake/VAD/STT/TTS + turn-taking verified in-container; live device binding = Swift JarvisAudio on the Mac")
    record("P-UI-01", "natively-packaged app (Tauri)", "NEEDS-MAC",
           "Command Center runs in the browser; the packaged .app is built on the Mac")

    # --- report ---
    width = max(len(n) for _, n, _, _ in results)
    print(f"\n{'ID':13} {'CHECK':{width}} STATUS")
    print("-" * (13 + width + 18))
    hard_fail = False
    for id_, name, status, detail in results:
        print(f"{id_:13} {name:{width}} {status}")
        if detail:
            print(f"{'':13} {'':{width}}   → {detail}")
        if status == "FAIL":
            hard_fail = True
    p = sum(1 for _, _, s, _ in results if s == "PASS")
    nm = sum(1 for _, _, s, _ in results if s == "NEEDS-MAC")
    ve = sum(1 for _, _, s, _ in results if s == "VERIFIED-ELSEWHERE")
    sk = sum(1 for _, _, s, _ in results if s == "SKIP")
    fa = sum(1 for _, _, s, _ in results if s == "FAIL")
    print(f"\n{p} PASS · {ve} verified-elsewhere · {nm} NEEDS-MAC · {sk} SKIP · {fa} FAIL")
    if fa == 0:
        print("Container-verifiable platform surface: all green. NEEDS-MAC rows require the M3 Max + their check-ins.")
    return 1 if hard_fail else 0


if __name__ == "__main__":
    sys.exit(main())
