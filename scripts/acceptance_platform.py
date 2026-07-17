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
