# PLATFORM — ACCEPTANCE RESULTS (R-VER-05)

**Recorded:** 2026-07-17 · **Environment:** Linux dev container (NOT the target Mac).
**Primary harness:** `scripts/acceptance_platform.py` against the live stack
(kernel :4150, Postgres :5433, a local model for the agent/voice rows).
**Result:** **16 PASS · 2 verified-elsewhere · 4 NEEDS-MAC · 0 FAIL.**

This is an honest record (honesty rule R-CORE-02). Everything achievable in the
container is verified for real; the four capabilities whose remaining piece is the
physical M3 Max (Apple audio hardware, the packaged `.app`, real macOS control,
real Home Assistant) are **NEEDS-MAC** — never marked done on hardware we don't
have. Re-run this harness on the M3 Max to turn the NEEDS-MAC rows green as each
adapter is enabled at its check-in (docs/06). The Phase-1 voice/UX criteria are in
`PHASE_1_ACCEPTANCE.md`.

## Whole-stack harness (`scripts/acceptance_platform.py`)

| Check | Status | Evidence |
|---|---|---|
| P-CORE-01 kernel health + migrations | PASS | status=ok, 8 migrations applied |
| P-CORE-02 audit hash-chain integrity | PASS | chain intact |
| P-CORE-03 emergency stop halts + resumes | PASS | engaged→blocked, resumed→ok |
| P-GW-01 model gateway status + roles | PASS | role table live |
| P-OFFLINE-01 fully offline when configured | PASS (offline kernel) | remote providers disabled, remote role refused, local path streams; zero external TCP egress during a converse (R-MODEL-04) |
| P-LOOP-01 read-only tool | PASS | `system.info` real host state |
| P-LOOP-02 consequential approve + deny + verify | PASS | approved wrote note, denied refused |
| P-MEM-01 remember + retrieve preference | PASS | stored + read back |
| P-MEM-02 memory refuses secrets (R-MEM-06) | PASS | secret-shaped value refused |
| P-SEC-01 secrets vault names-only + value never leaks | PASS | listed name only, value absent from listing + audit; ciphertext at rest |
| P-CTX-01 situational context snapshot | PASS | `/context` snapshot injected into the loop |
| P-PRO-01 proactivity cycle + explained suppressions | PASS | surfaced + suppressed with gate reasons |
| P-CTRL-01 computer control via gated loop (SIMULATION) | PASS | listApps + setValue, provenance SIMULATION |
| P-CTRL-02 REAL macOS control | **NEEDS-MAC** | AX/CGEvent adapter builds on Mac; activated at D-0022 |
| P-DEV-01 HIGH_RISK_PHYSICAL single-use interlock (SIMULATION) | PASS | no-interlock refused, armed→ok, reuse refused |
| P-DEV-02 REAL Home Assistant devices | **NEEDS-MAC** | vault-backed adapter; bound at D-0025 on the LAN |
| P-EXT-01 self-extension hard limit (R-CAP-08) | PASS | benign→awaiting_review, trust-core write→rejected |
| P-MCP-01 MCP host discover + trust-gated call (T2) | PASS | untrusted default, approved runs, denied refused |
| P-AGENT (agent runtime) | see below | multi-step plan-and-act through the gated loop |
| P-ENC-01 field encryption at rest | VERIFIED-ELSEWHERE | vault/memory tests: DB holds `v1.gcm.*` only, 0 plaintext, wrong-key fatal |
| P-PERSIST-01 trust/memory survive restart | VERIFIED-ELSEWHERE | memory + MCP-registry tests hydrate after restart |
| P-VOICE-01 live full-duplex voice | **NEEDS-MAC** | wake/VAD/STT/TTS + turn-taking verified in-container; live mic/speaker + VPIO = Swift `JarvisAudio` on the Mac |
| P-UI-01 natively-packaged app (Tauri) | **NEEDS-MAC** | Command Center runs in the browser; packaged `.app` built on the Mac |

## Automated test suites
- **kernel:** 123 tests pass (`services/kernel` — config, migrate, audit, policy,
  vault, memory, control, devices, selfext, proactive, mcp (+ persistence),
  secrets, gateway-secrets, homeassistant, context, router, **agent**).
- **ears:** 9 tests pass (engines, turn-taking, audio-io).

## Live end-to-end verifications (this environment)
- **Voice pipeline** (AT1.12): wake → STT → gated loop → TTS, fully offline, zero
  egress (`PHASE_1_ACCEPTANCE.md`).
- **Model gateway**: neutral schema against a real local model; local-first
  routing; LOCAL_ONLY + offline gating; fallback pre-stream only.
- **Trust core**: hash-chained audit, prohibited-first policy, e-stop latch — live.
- **Encrypted memory**: DB grep = 0 plaintext; survives restart; wrong KEK fatal.
- **Secrets vault**: store → ciphertext at rest; list names-only; value never in
  audit; MCP `secretEnv` resolves by name (fail-closed).
- **MCP host**: real stdio server — discover, gated call, rug-pull quarantine,
  name-shadow prevention, trust persisted across restart.
- **Self-extension Stage A**: malicious capability (trust-core write +
  `approval:bypass` + `eval`) rejected with named violations; benign parks at
  `awaiting_review`; no activation path.
- **Proactivity**: fresh cycle surfaces overdue items with "why"; quiet-hours
  suppresses with reasons; dedup holds back already-surfaced items.
- **Agent runtime**: objective → model tool-call → gated execution → synthesized
  answer; consequential step denied → tool never ran; e-stop halts; step budget
  bounds; audit `agent_run_started → policy_decision → tool_call → verification →
  agent_run_finished`, intact.
- **Command Center** (headless-browser verified, all real kernel state): dashboard
  (13/13 panels), interactive secret/MCP controls (5/5), conversation `/chat`
  (7/7), proactivity `/proactive`, computer-control `/control` (8/8), device
  `/devices` (8/8, interlock), self-extension `/selfext` (10/10), agent `/agent`
  (6/6, inline approval — the approved step really wrote its file). Ambient Voice
  Orb tracks live activity + e-stop.

## What remains for the Mac (the 4 NEEDS-MAC rows)
Run `docs/MAC_BRINGUP.md` on the M3 Max, then open the gate for each:
1. **Live full-duplex voice** — `swift run JarvisAudio` (VPIO mic/speaker) + the voice identity pick (D-0004a).
2. **Packaged app** — the Tauri build (slice 1.8).
3. **Real macOS control** — enable the `JarvisControl` adapter at **D-0022**.
4. **Real Home Assistant** — bind `homeAssistantFromVault(...)` at **D-0025**.

Every capability's typed contract and gated experience is already built and
verified against SIMULATION/local adapters here, so enabling the real adapter on
the Mac changes the backend, not the contract or the safety flow.
