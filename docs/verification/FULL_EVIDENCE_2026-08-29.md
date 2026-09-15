# FULL EVIDENCE RUN — from scratch, everything container-verifiable (2026-08-29)

**Question answered:** can the whole platform be run end-to-end from a cold start,
with measured evidence for every feature built over the project's life — and an
honest ledger of what cannot be evidenced in this environment?

**Environment:** Linux remote dev container (NOT the target Mac). Real Anthropic
Sonnet-5 served all model-dependent rows except where noted. Every kernel in this
run was booted COLD: fresh scratch database, migrations 0001→0026 applied from
zero, no seeded state beyond what boot itself seeds. All numbers below were
measured tonight; nothing is carried forward from older records.

**Honesty statement (R-CORE-02):** the four NEEDS-MAC rows are marked, never
faked. Where a local test-model stub stands in for a reasoning leg it is labeled,
exactly as in the 2026-07 records. The run's own operator errors are listed in §9.

## 1. Cold bring-up chain (proved by using it)

- The `SessionStart` hook auto-healed Postgres at this session's resume — its
  first natural firing: `[db-up] Postgres: up (native cluster)`.
- Every kernel below: `CREATE DATABASE` → `migrate-cli` (26 migrations) → boot →
  `/health` green. Eight cold boots this run (ev, off2, voice + suite DBs).

## 2. Test suites and builds (all from current HEAD)

| Surface | Result |
|---|---|
| Kernel (vitest, via `make test` — refuses skips) | **437/437** (51 files). One transient in the first pass — `semantic.test.ts` meaning-recall ranking, expected 3 got 2 — identified by name from the teed log, not reproduced on re-run |
| Ears (pytest, WITH model weights) | **13/13** — the 5 model-gated tests (wake-word hears TTS-spoken "hey jarvis", STT transcribes synthesized speech, Kokoro TTS, Silero VAD, turn-taking) ran for the first time since container recycling, on freshly fetched weights |
| Companion core (cargo) | **3/3** (health/e-stop parse, status line, unreachable-kernel error) |
| Typecheck (all packages) | clean |
| Command Center production build | clean |

Voice weights re-provisioned from the pinned sources in `scripts/fetch_models.py`
(389 MB: Kokoro-82M ONNX + 4 British male voices, Silero VAD v6, openwakeword
hey-jarvis, sherpa zipformer STT). The proxy truncated the 325 MB Kokoro download
via `urlretrieve`; resumable `curl -C -` completed it. sherpa-onnx needed an
unversioned `libonnxruntime.so` symlink (documented wheel quirk).

## 3. Platform acceptance harness (cold `jarvis_ev` kernel)

**32 PASS · 3 verified-elsewhere · 4 NEEDS-MAC · 0 SKIP · 0 FAIL** — the full
subsystem sweep: trust core, gateway, memory (semantic/episodic/graph/vector),
prompts, proactivity+rules, control/devices (SIMULATION), self-extension hard
limit, MCP host, skills, knowledge/web/terminal/research, reasoning escalation,
sleep-cycle, autonomy envelope, A2UI, runtime config, secrets, context.

## 4. Command Center: all 21 panels live (fresh screenshots committed)

**21/21 panels** render live kernel state with **0 console errors**
(`docs/screenshots/evidence-2026-08-29/`, one per panel). The one initial FAIL
was my needle word, disproved by inspection — `/settings` renders the full
catalog including `tools.validateArgs` and `lab.enabled`.

## 5. Night Lab, live again on the evidence kernel

Scheduler-fired (`POST /autonomy/tick` → labNight at tick end): baseline persona
93.9-region seeded butler; **2 experiments, both beat baseline on trial 1 and
earned full 3-trial confirmations (~104k tokens each), both honestly discarded**
(mean short of δ4 / guard); halted at the nightly cap with the documented
between-experiments semantics (237,458 counted vs 150,000 — an in-flight
experiment finishes, the next is refused). The one-night-per-window guard then
refused two later ticks. A first skip, `"live session active"`, was traced to
real residual MCP activity from the harness — the deferral gate doing its job
before the user (me) disabled deferral via the catalogued knob.

## 6. Offline mode + egress (cold keyless kernel, `JARVIS_OFFLINE=1`)

READ_ONLY tools and memory writes work; the gateway attempted ONLY the local
provider (honest unreachable error; no remote attempt). Per-process egress
measured by matching the kernel's socket fd inodes against `/proc/net/tcp`:
**1 socket total (its loopback listener), 0 established non-loopback
connections.** A first namespace-wide measurement was discarded as
methodologically wrong (it counted other processes' legitimate API traffic).

## 7. Voice round-trip, live (fresh weights, real daemon, real kernel)

`ears` daemon (all four engines loaded) + cold `jarvis_voice` kernel with a
LOCAL openai-compat stub serving `fast_conversation` (labeled, as in the 2026-07
records — the pipeline is the claim, not model intelligence):

> **Spoken in** (Kokoro, 2.9s): "Jarvis, what time is it right now?"
> **STT heard**: `JARVIS WHAT TIME IS IT RIGHT NOW` (270 ms)
> **Kernel loop**: D-0048 reasoning event `fast · routine conversational turn` (116 ms)
> **Spoken out** (Kokoro, 5.8s, 2.0 s synth): "It is just past three in the morning, sir…"
> **Kernel side**: 2 conversation rows persisted, **2/2 encrypted** (`v1.gcm.*`)

## 8. Living heartbeat, live — the ceiling holding

With a due agenda item and the privacy knob user-set to STANDARD (no local model
here), the beat ran ONE bounded brain pass: it drafted the requested note, its
CONSEQUENTIAL workspace write was **auto-denied by the ≤LOW_REVERSIBLE ceiling**
(verified: no file appeared), and the journal reported it honestly: *"I drafted
the workshop-readiness note but its workspace write was denied…, so I closed out
the original agenda item and re-queued a refined version to retry during normal
hours."* Also observed en route: `heartbeat.privacy=LOCAL_ONLY` correctly kept
the brain OFF a remote-only kernel until the user overrode it.

## 9. The run's own errors (all operator, none platform)

Non-UUID sessionIds silently emptied the voice answer (route validation correct,
my IDs wrong); a word-split bug in my settings loop made three PUTs fail — the
tick then skipped honestly (`disabled`), accidentally re-proving default-off;
my `pkill` patterns kept self-matching my own wrappers (exit 144s); one
namespace-wide egress measurement was wrong and was redone per-process.

## 10. NEEDS-MAC ledger (cannot be evidenced here, by honesty rule)

1. Live mic/speaker + VPIO echo-cancel (pipeline proven above; device I/O is Mac).
2. Packaged Tauri `.app` (client core tested; packaging is Mac).
3. Real macOS control via AX/CGEvent (SIMULATION adapter proven; D-0022 gate).
4. Real Home Assistant on the LAN (SIMULATION + contract proven; D-0025 gate).

## 11. Genealogy — 45 days, 81 decisions, 166 commits, 17 verification records

The platform grew 2026-07-16 → 2026-08-29: 81 logged decisions (47 implemented so
far), every capability five-state classified, every phase gated by check-ins.
Full decision-by-decision table:

| Decision | Date | Status | Title | Verification record(s) |
|---|---|---|---|---|
| D-0001 | 2026-07-16 | PROPOSED | Phase 0 document set & file naming | — |
| D-0002 | 2026-07-16 | APPROVED | Architecture option | — |
| D-0003 | 2026-07-16 | APPROVED | Capability parity matrix approval | — |
| D-0004 | 2026-07-16 | APPROVED | Voice stack picks | — |
| D-0005 | 2026-07-16 | PROPOSED | Module-level CLAUDE.md files deferred to Phase 1 | — |
| D-0006 | 2026-07-16 | PROPOSED | Valkey deferred until a real queue/cache need exists | — |
| D-0007 | 2026-07-16 | RECORDED | Valkey over Redis (when needed) | — |
| D-0008 | 2026-07-16 | PROPOSED | Model gateway approach: thin in-house gateway; LiteLLM optional adapter, pinned | — |
| D-0009 | 2026-07-16 | PROPOSED | Agent runtime: LangGraph (Python) behind our own AgentRuntime interface | — |
| D-0010 | 2026-07-16 | PROPOSED | Observability viewer: Jaeger v2 (Apache-2.0) | — |
| D-0011 | 2026-07-16 | PROPOSED | MCP spec target: 2025-11-25 | — |
| D-0012 | 2026-07-16 | PROPOSED | Local model baseline set (initial; revisited each phase) | — |
| D-0013 | 2026-07-16 | PROPOSED | Postgres encryption approach | — |
| D-0014 | 2026-07-16 | PROPOSED | Desktop shell: Tauri 2 | — |
| D-0015 | 2026-07-16 | PROPOSED | macOS control stack (Phase 2 surface) | — |
| D-0016 | 2026-07-16 | PROPOSED | Spatial input model pinned to verified platform constraints | — |
| D-0017 | 2026-07-16 | PROPOSED | Session continuity mechanics | — |
| D-0018 | 2026-07-17 | APPROVED | Simulator depth: full suite | — |
| D-0019 | 2026-07-17 | APPROVED | Affect/state inference (B4) scheduled as constrained opt-in | — |
| D-0020 | 2026-07-17 | RECORDED | User hardware inventory (2026-07-17) | — |
| D-0021 | 2026-07-17 | APPROVED | Memory architecture + local security model APPROVED | — |
| D-0022 | 2026-07-17 | PROPOSED | Computer-control foundation built SIMULATION-first; real-adapter activation gated on a che | — |
| D-0023 | 2026-07-17 | PROPOSED | Self-extension built safety-first; Stage B activation gated on the DEDICATED security chec | — |
| D-0024 | 2026-07-17 | PROPOSED | Proactivity engine built; live background delivery gated on the "enable proactive behavior | — |
| D-0024 | 2026-07-18 | APPROVED | Background autonomy: APPROVED (bounded, safe-cycles-only, default-off) | — |
| D-0025 | 2026-07-17 | PROPOSED | Device-control foundation built SIMULATION-first; real Home Assistant gateway gated on the | — |
| D-0026 | 2026-07-17 | PROPOSED | Visual design system proposed for the R-UI-01 check-in; Ambient Voice Orb built | — |
| D-0027 | 2026-07-17 | PROPOSED | MCP client host built; raising a server's trust above `untrusted` is a check-in (T2) | — |
| D-0028 | 2026-07-17 | IMPLEMENTED | Managed secrets vault: integration credentials live encrypted, never in memory or audit (R | — |
| D-0029 | 2026-07-17 | IMPLEMENTED | Contextual awareness: read-only ContextService injected into the loop (R-CTX, B1 substrate | — |
| D-0030 | 2026-07-17 | IMPLEMENTED | Agent runtime (jarvis-mind) foundation: built-in local runtime behind a replaceable interf | — |
| D-0031 | 2026-07-17 | IMPLEMENTED | Skills registry: user-defined named objectives run via the agent (R-CAP-01) | — |
| D-0032 | 2026-07-17 | IMPLEMENTED | Workspace knowledge / files capability: REAL, local, gated (Phase 2 "files") | — |
| D-0033 | 2026-07-17 | IMPLEMENTED | Tool results feed the agent's reasoning (read-tool `detail` → model) | — |
| D-0034 | 2026-07-17 | IMPLEMENTED | Web browsing / research capability: REAL headless browser, gated per navigation (Phase 2) | — |
| D-0035 | 2026-07-17 | IMPLEMENTED | Terminal-with-policy: REAL shell, command-safety policy + per-command approval (Phase 2) | — |
| D-0036 | 2026-07-17 | IMPLEMENTED | Research-with-provenance: sourced evidence over the gated web browser (Phase 2, parity C3) | — |
| D-0037 | 2026-07-17 | IMPLEMENTED | Untrusted-content envelopes: prompt-injection defense for external content (THREAT_MODEL T | — |
| D-0038 | 2026-07-17 | IMPLEMENTED | Semantic memory: entities/facts/relations store (Phase 2, "full memory store set", parity  | — |
| D-0039 | 2026-07-17 | IMPLEMENTED | Semantic memory feeds contextual awareness (the knowledge is USED, not just stored) | — |
| D-0040 | 2026-07-17 | IMPLEMENTED | Companion Tauri 2 app shell scaffolded; verified std-only kernel-client core (P-UI-01 prep | — |
| D-0041 | 2026-07-17 | IMPLEMENTED | Episodic memory: a recallable timeline of events, auto-recorded from real activity | — |
| D-0042 | 2026-07-17 | IMPLEMENTED | Semantic (vector) recall over memory — the last piece of "perfect recall" (H1) | — |
| D-0043 | 2026-07-17 | IMPLEMENTED | Prompts registry: J.A.R.V.I.S.'s persona is now user-editable data, not a hardcoded string | — |
| D-0044 | 2026-07-17 | IMPLEMENTED | User-defined proactivity rules: what J.A.R.V.I.S. is proactive about is now configurable ( | — |
| D-0045 | 2026-07-17 | IMPLEMENTED | Graph-brain memory: multi-hop traversal + hybrid vector+graph recall + auto-linking (no gr | — |
| D-0046 | 2026-07-18 | IMPLEMENTED | Gateway learns the current Anthropic API: per-target effort + adaptive thinking (corrects  | — |
| D-0047 | 2026-07-18 | IMPLEMENTED | Model-gateway observability: /gateway/calls + the Command Center Models panel | — |
| D-0048 | 2026-07-18 | IMPLEMENTED | Deep-reasoning escalation: J.A.R.V.I.S. decides when to think harder (provider-agnostic, u | — |
| D-0049 | 2026-07-18 | IMPLEMENTED | Provider-agnostic generation settings: one neutral vocabulary, translated per provider | — |
| D-0050 | 2026-07-18 | IMPLEMENTED | Deep-reasoning learning: J.A.R.V.I.S. adapts to what YOU need thought about (transparent,  | — |
| D-0051 | 2026-07-18 | IMPLEMENTED | Sleep-cycle consolidation: J.A.R.V.I.S. learns from its OWN operational record (bounded, u | — |
| D-0052 | 2026-07-18 | IMPLEMENTED | Reasoning panel: the learning contract made visible (+ harness learning-pollution fix) | — |
| D-0052 | 2026-07-18 | IMPLEMENTED | Override contract revised: the trail can outweigh a pin (either party's) | — |
| D-0053 | 2026-07-18 | RECORDED | BINDING PRINCIPLE: everything configurable is dual-editable under the override ledger | — |
| D-0054 | 2026-07-18 | IMPLEMENTED | Runtime gateway role editor: the first D-0053 migration (live re-route, ledgered, restart- | — |
| D-0055 | 2026-07-18 | IMPLEMENTED | Conversational edit path: instruct J.A.R.V.I.S. to change (or undo) its own settings — thr | — |
| D-0056 | 2026-07-18 | RECORDED | SUPERSEDED by D-0061 (A2UI now built): A2UI for fully dynamic 2D UI, extending to 3D/holog | — |
| D-0057 | 2026-07-18 | IMPLEMENTED | Brain-graph vector recall made scale-efficient: pgvector HNSW ANN index | — |
| D-0058 | 2026-07-18 | IMPLEMENTED | General runtime settings: edit any catalogued knob live (a real command center, not start- | — |
| D-0059 | 2026-07-18 | IMPLEMENTED | Persist everything that matters: standing consent survives restart (found gap fixed) | — |
| D-0060 | 2026-07-18 | IMPLEMENTED | Dynamic settings: J.A.R.V.I.S. can surface a NEW configurable knob at runtime (Step 1 of t | — |
| D-0061 | 2026-07-18 | IMPLEMENTED | A2UI built: agent-generated declarative UI, safe by construction (D-0056 realized, Step 2) | — |
| D-0062 | 2026-07-19 | IMPLEMENTED | Memory-evolution completeness: agent-owned correct/forget with read-then-write precision ( | `GAP_FIXES_2026-07-19.md`, `SCALE_EVOLUTION_2026-07-18.md` |
| D-0063 | 2026-07-19 | IMPLEMENTED | Memories update live AND during quiet hours (sleep-time memory consolidation) | `EVOLUTION_2026-07-19.md` |
| D-0064 | 2026-07-19 | IMPLEMENTED | The living heartbeat: J.A.R.V.I.S. writes its own agenda and works it between conversation | — |
| D-0065 | 2026-07-19 | IMPLEMENTED | Three rhythms, no collisions: live / heartbeat / quiet hours are distinct and never compet | — |
| D-0066 | 2026-07-19 | IMPLEMENTED | Spend governance: autonomy has self-restraint, a live turn is never blocked | — |
| D-0067 | 2026-07-19 | IMPLEMENTED | Memory-injection hardening: recalled memory is quoted data, never trusted instructions | — |
| D-0068 | 2026-07-19 | IMPLEMENTED | Initiative to speak + advisory dissent (presence, outbound) | — |
| D-0069 | 2026-07-19 | IMPLEMENTED | Durable projects: goals worked across heartbeats ("runs companies") | — |
| D-0070 | 2026-07-19 | IMPLEMENTED | Perception core: observe a feed → situational model → context | — |
| D-0071 | 2026-07-19 | IMPLEMENTED | Longevity ops: self-health/watchdog + brain backup/restore | — |
| D-0072 | 2026-07-19 | APPROVED | Affect layer APPROVED + built (opt-in, text-only, transparent) | — |
| D-0073 | 2026-07-19 | APPROVED | Stage-B self-extension APPROVED (activation, propose-and-approve, safety envelope intact) | `STAGE_B_AFFECT_2026-07-19.md` |
| D-0074 | 2026-07-19 | APPROVED | Code-authored capabilities run in-container; "novel code needs a Mac" was WRONG (corrected | — |
| D-0075 | 2026-07-20 | APPROVED | Fast-model memory judgments (entity resolution, fact merge, topic extraction) + self-autho | `D0075_MEMORY_JUDGMENT_2026-07-20.md` |
| D-0076 | 2026-07-20 | IMPLEMENTED | Fresh full 70/30 observation (un-seeded) — `ops.health()` episode-count bug found + fixed; | `FRESH_OBSERVATION_2026-07-20.md` |
| D-0077 | 2026-07-20 | IMPLEMENTED | Rhythm sync: agenda freshness gate + chat delivery of announcements | `AB_OBSERVATION_2026-07-20.md` |
| D-0078 | 2026-08-25 | IMPLEMENTED | graphify adopted as developer tooling; an API key on disk accepted OUTSIDE Z1 | — |
| D-0079 | 2026-08-25 | IMPLEMENTED | Night Lab: evidence-gated self-experimentation (APPROVED + IMPLEMENTED) | `NIGHT_LAB_2026-08-28.md` |