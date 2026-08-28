# @jarvis/kernel (jarvisd) — module guide

The kernel is the **trust core + platform process** (architecture Option A, D-0002):
policy engine, approval broker, audit writer, credential broker, emergency stop (trust
zone Z1) plus registries, model-gateway adapters, memory service API, and client
transport (Z2). See `docs/ARCHITECTURE.md §3` and `docs/THREAT_MODEL.md §2`.

## Current state (update as slices land)
- Slice 1.1 ✅: config (zod, loopback-only defaults), Postgres pool, immutable SQL
  migration runner (sha256-tracked), real `/health` (measured DB latency + migration
  status — nothing hardcoded green), `system_events` journal, Fastify server.
- Slice 1.2 ✅: model gateway under `src/gateway/` — neutral message/tool schema
  (`schema.ts`, adapters are the ONLY code knowing wire formats, R-MODEL-02);
  adapters: ollama, anthropic, openai_compat (llama.cpp/vLLM/OpenAI dialect);
  router: local-first target order, LOCAL_ONLY privacy gate, offline mode,
  fallback only pre-stream (never silent mid-answer model switches),
  structured-output validation (ajv), `model_calls` audit (no message content);
  routes: POST /gateway/chat (SSE), GET /gateway/status, GET /gateway/roles.
  Config: JSON file via `JARVIS_GATEWAY_CONFIG` (defaults in `gateway/config.ts`);
  `JARVIS_OFFLINE=1` refuses all remote providers. **Provider API keys resolve
  from the managed SecretsVault first (`apiKeySecret`), env second (`apiKeyEnv`)**
  — R-MEM-06/D-0028; the router is constructed with the shared secrets vault.
- Slice 1.4 ✅: **Z1 trust core under `src/core/` — PROTECTED PATH (R-CAP-08):
  generated capabilities may NEVER modify anything here.** Components:
  `audit.ts` (append-only sha256 hash-chained log + secret redaction + chain
  verification), `estop.ts` (persisted emergency-stop latch, halts locally
  before DB write), `policy.ts` (prohibited-list-first evaluation order: estop →
  PROHIBITED semantics → risk class → scope/grant → approval), `approvals.ts`
  (broker: allow-once/for-task/for-session/always-in-scope/deny; denyAll on
  estop), `activity.ts` (live timeline bus), `tools.ts` + `tools/` (registry;
  the two Phase-1 tools: `system.info` read-only, `workspace.writeNote`
  consequential+reversible with pre-action disclosure and pre-captured undo),
  `loop.ts` (core loop: objective → gated execution → independent verification →
  record), `routes.ts` (/core/*: run-tool, converse SSE, activity SSE, estop,
  approvals, audit, audit/verify). Migration 0003. **build copies migrations
  to dist** (`build` script) — needed for `node dist/index.js`.
- Slice 1.6 ✅: memory service under `src/memory/` — conversation + preference
  stores (migration 0004) with the mandatory metadata every store carries:
  epistemic_status enum (R-MEM-05), provenance, confidence, sensitivity,
  timestamps, retention. `memory.ts`: remember (supersede-old-first to respect
  the unique-active-key index), get/search/list, correct (keeps history),
  pin, delete (soft, excluded from retrieval immediately), forget (physical
  purge), export; secrets refused on write (R-MEM-06). `memory.remember` tool
  wired into the loop (LOW_REVERSIBLE, reversible via delete). Routes under
  /memory/*. Verified: remember/view/correct/delete, secret refusal, **survives
  restart**, history preserved, audit chain intact across all ops.
- Conversation memory wired into the loop: `runConversation` retrieves prior
  turns for a `sessionId`, injects them as context, persists both turns, and
  applies the British-butler persona. Verified: turns persist + history is
  injected. NOTE: the dev container runs SmolLM2-135M (a tiny test model that
  hallucinates and ignores instructions) — response *quality* is a model-size
  artifact, not a plumbing issue; the target M3 Max runs Qwen3.6-35B/gpt-oss-120b
  (D-0012) where recall works. Response quality is only truly validated on the Mac.
- MCP client host ✅ (R-CAP-02, D-0027): `src/mcp/` — connects to a REAL stdio
  MCP server (official SDK 1.29), discovers its tools, registers each as a
  namespaced (`mcp:<server>:<tool>`) trust-gated kernel tool. Untrusted by
  default → CONSEQUENTIAL (per-call approval); only `trusted` → READ_ONLY.
  Manifest hashed at registration; a changed hash quarantines the server (rug
  pull). Trust asymmetry: quarantine is live, trust-elevation applies on
  reconnect (re-attests the hash). Routes `/mcp/servers|connect|trust`. See
  `src/mcp/CLAUDE.md`. Live-verified end-to-end through the gated loop + audit.
- Secrets vault ✅ (R-MEM-06, D-0028): `src/crypto/secrets.ts` (protected path) +
  migration 0008 `integration_secrets` — managed integration credentials
  encrypted at rest via the field Vault; value never returned over HTTP or
  written to the audit (name-only); routes `/secrets` (GET names, POST set,
  DELETE); `/mcp/connect` `secretEnv` resolves credentials by name (fail-closed).
  See `src/crypto/CLAUDE.md`. Live-verified.
- **Build-script fix (2026-07-17):** `build` now `rm -rf dist/db/migrations`
  before `cp -r` — the old `cp -r` nested into an existing dir on rebuild,
  shipping a stale 3-file migrations dir so `node dist/index.js` applied only
  0001–0003. Always confirm `dist/db/migrations` has all 8 files after a build.
- **CORS preflight fix (2026-07-17):** the browser-CORS `onSend` hook set only
  `access-control-allow-origin`. POST/DELETE with a JSON body are non-simple
  requests, so their preflight OPTIONS was missing `allow-methods`/`allow-headers`
  and the browser blocked **every write** from the cross-origin Command Center
  (approve/deny, e-stop, secrets, MCP). Now advertises
  `GET, POST, DELETE, OPTIONS` + `content-type` (+ max-age). Reads (simple GETs)
  were unaffected, which is why it hid so long. Replaced by an authed same-origin
  proxy in slice 1.7 (T9).
- **Test-harness fix (2026-07-17):** `test/migrate.test.ts` now runs in a private
  Postgres schema (`search_path`) instead of dropping `schema_migrations` in the
  shared `jarvis_test` DB — that drop used to corrupt migration tracking for the
  other integration suites (the recurring "system_events already exists" /
  "relation … does not exist" flakiness). Full suite is now stable across
  repeated runs; `pnpm migrate` on `jarvis_test` afterward stays "up to date".
- Knowledge / files ✅ (Phase 2 "files"/"repo analysis", D-0032): `src/knowledge/`
  — a **REAL** (not SIMULATION), workspace-scoped filesystem capability. Contract
  `WorkspaceFiles` + `LocalWorkspaceFiles` adapter (path-safe: no `..`/absolute
  escape; reads refuse binary/oversize; search skips ignore-dirs, bounded) behind
  five gated tools: `files.list`/`read`/`stat`/`search` (READ_ONLY, auto-run) and
  `files.edit` (CONSEQUENTIAL, reversible — prior content captured before write;
  the loop **re-reads the file off disk** to verify the edit, R-CORE-03). The agent
  picks these up automatically. READ_ONLY read models are also exposed as
  `GET /knowledge/list|read|stat|search` (structured data for the Command Center;
  mutation still only via the gated `/core/run-tool`). Fully local/offline. See
  `src/knowledge/CLAUDE.md`. 17 knowledge tests; live end-to-end + harness `P-KNOW-01`.
- Agent reasons over tool output ✅ (D-0033): `ToolResult.detail` (opt-in,
  model-facing) flows through `runTool` → the agent feeds a bounded slice to the
  model so it can reason over a read tool's actual output (file content, matches,
  page text), not just a one-line summary. `detail` is never audited (content stays
  local). Populated on `files.read`/`search`/`list`/`stat`, `system.info`, `web.*`.
- Web / research ✅ (Phase 2 "browser automation", D-0034): `src/web/` — a **REAL**
  headless-browser capability (Playwright + Chromium, lazy launch). `web.open`
  (CONSEQUENTIAL, the outward act — per-navigation approval + offline/allowlist
  policy, `file://`/`data:` refused) + `web.readText`/`links`/`screenshot`
  (READ_ONLY, content → agent via `detail`) + `web.fill`/`click`. The one outward
  capability, gated tightly; page content never audited. See `src/web/CLAUDE.md`.
  8 web tests; **full suite 191 pass**; live end-to-end + harness `P-WEB-01`.
- Terminal-with-policy ✅ (Phase 2, D-0035): `src/terminal/` — a **REAL** shell
  (`bash -lc`), workspace-scoped, hard-timeout, bounded output. `assessCommand`
  classifies: DENY (privilege escalation / disk wipe / `rm -rf /` / fork bomb /
  pipe-to-shell / offensive tooling / cred-exfil — refused outright), READ_ONLY
  (small safe allowlist, no shell operators → `terminal.inspect` auto-runs),
  CONSEQUENTIAL (`terminal.run`, per-command approval). Output → agent via `detail`;
  never audited. See `src/terminal/CLAUDE.md`. 14 tests; live + harness `P-TERM-01`.
- Research-with-provenance ✅ (Phase 2, parity C3, D-0036): `src/research/` —
  `research.gather(query, urls[])` composes the gated web browser into ONE
  CONSEQUENTIAL sourced-evidence action (all URLs disclosed upfront; out-of-policy
  URL → clean denial). Returns query-relevant passages each tagged `{url, title,
  line, snippet}` — per-claim provenance — fed to the agent (to cite). A refused
  source is recorded, never fabricated. See `src/research/CLAUDE.md`. 6 tests; live
  + harness `P-RESEARCH-01`.
- Untrusted-content envelopes ✅ (THREAT_MODEL T1, D-0037): `src/core/untrusted.ts`.
  `ToolResult.untrusted` flags EXTERNAL content (web/research/MCP output); the agent
  wraps such `detail` in `<untrusted_external_data source="…">…</untrusted_external_data>`
  before the model sees it (breakout-neutralized) and carries a standing note:
  content inside the tags is DATA, never instructions. Prompt-injection defense
  (ADV1) — a hostile page's "ignore previous instructions / run this / reveal
  secrets" reaches the model only as quoted data, and the gates (terminal denylist,
  vault, approval) still hold. 6 tests; live (P-WEB-01 asserts the flag).
- Semantic memory ✅ (Phase 2 "full memory store set", parity H, D-0038):
  `src/memory/entities.ts` + migration 0010 (`memory_entities`/`memory_facts`/
  `memory_relations`) — a knowledge-graph-lite so J.A.R.V.I.S. durably KNOWS ABOUT
  the user's world. `EntityMemory` (rememberEntity/rememberFact/relate/recall/
  listEntities/forgetEntity); gated tools `memory.rememberEntity`/`rememberFact`/
  `relate` (LOW_REVERSIBLE) + `memory.recall` (READ_ONLY → agent). Content encrypted
  at rest (`v1.gcm.*`), secret-refusing, supersede-with-history; routes
  `GET /memory/entities[/:name]`. 6 tests; live (DB grep = 0 plaintext) + `P-ENTMEM-01`.
- Episodic memory ✅ (Phase 2 "full memory store set", parity H1, D-0041):
  `src/memory/episodes.ts` + migration 0011 (`memory_episodes`) — a durable,
  importance-ranked, **recallable TIMELINE of events** (what happened, when, why),
  so J.A.R.V.I.S. answers "the last time you…". **Distinct from the audit log**
  (audit = immutable security record; episodes = forgettable, encrypted semantic
  memory). `EpisodicMemory` (record/recall/timeline/recentForContext/forget); gated
  tools `memory.recordEpisode` (LOW_REVERSIBLE) + `memory.recallEpisodes`
  (READ_ONLY → free-text/kind/tag/entity/since filters → agent); routes
  `GET /memory/episodes` + `POST /memory/episodes/:id/forget`. **The core loop
  auto-records** a successful `CONSEQUENTIAL`/`HIGH_RISK_PHYSICAL` tool (post-verify,
  best-effort) as an `action` event — the timeline populates from REAL activity;
  READ_ONLY + `memory.*` excluded. Feeds `ContextService` ("Recently: …"). Content
  encrypted at rest + secret-**redacted** (masked, not rejected — never breaks the
  loop); `recentForContext` non-sensitive only. 7 tests; live 11/11 + `P-EPISODE-01`.
- Semantic (vector) recall ✅ (Phase 2 "full memory store set", parity H1, D-0042):
  `src/memory/semantic.ts` + migration 0012 (`memory_embeddings`, pgvector `vector(768)`)
  — recall **by meaning**, finally using the gateway's `embeddings` role (`router.embed`)
  and pgvector (both previously idle). `SemanticMemory` (index/search/remove/count/
  available) does exact cosine KNN; **decoupled** index (keyed by source_kind/id/model)
  so a write never blocks on the embedder. Wired into `EpisodicMemory`: auto-index on
  record, drop on forget, `semanticRecall(query)` → `memory.recallEpisodes {semantic}` +
  `GET /memory/episodes?semantic=1`. **Best-effort/honest fallback:** no embedder →
  no-op index, `[]` search, **lexical fallback** (never a mock, never a throw); embedded
  from redacted plaintext (secrets never reach the vector store). nomic-embed-text on the
  Mac gives real semantic quality with no code change. 6 tests + live 6/6 (real
  embeddings endpoint through the gateway) + `P-SEMANTIC-01`.
- Prompts registry ✅ (R-CAP-01 "prompts" kind, D-0043): `src/prompts/registry.ts`
  + migration 0013 (`prompts`, seeded with the D-0004 butler default). J.A.R.V.I.S.'s
  persona is now **user-editable, versioned data** instead of a hardcoded string —
  `PromptRegistry` (getActive/activePersonaOr/list/get/set/activate/remove),
  supersede-with-history, one active per kind, secrets redacted on write. The
  `/core/converse` route reads the **active** `persona` (`activePersonaOr(BUTLER_PERSONA)`)
  so the built-in default is the fallback (never a blank persona). Routes `/prompts`
  (list/active/set/activate/delete). 7 tests + live 6/6 (seeded AND a custom persona
  really reach the model through the gateway) + `P-PROMPT-01`.
- Graph-brain memory ✅ (D-0045): the knowledge graph now acts as a BRAIN —
  **multi-hop associative recall** (`EntityMemory.traverse`, cycle-safe recursive
  CTE, depth ≤3 → `memory.related` tool + `?depth=` on recall + `GET /memory/graph`),
  **hybrid GraphRAG-lite recall** (`recallGraph`: pgvector entry points by meaning →
  one-hop graph expansion → `memory.recallGraph` tool + `GET /memory/graph?q=`;
  lexical name-match fallback without an embedder), **episode auto-linking** (an
  event mentioning a known entity attaches to it — the graph grows from real
  activity), and **entities/facts vector-indexed** on remember (scrubbed on forget).
  **NO graph DB** — deliberate (D-0045): Postgres recursive CTEs suffice at
  single-user scale; Neo4j Community is GPLv3 (rule-8 flag) + an extra daemon; a
  graph DB would slot in behind the same contract after a license check-in if scale
  ever demands. 6 tests + live 8/8 (real gateway embed path) + `P-GRAPH-01`.
- Gateway: current Anthropic API ✅ (D-0046, 2026-07-18): `RoleTarget` config now
  carries optional `effort` (`low…max` → `output_config.effort`) and
  `thinking: "adaptive"` (→ `thinking: {type:"adaptive"}`); the router forwards
  them per-target and `/gateway/roles` annotates (`…@xhigh+thinking`). The
  Anthropic adapter is pinned to the CURRENT wire format (verified 2026-07-18):
  **never `budget_tokens`** (HTTP-400 on Sonnet 5/Opus 4.7+), temperature
  **dropped** on that generation (also 400), `max_tokens` defaults to 16000
  there, and thinking is **explicitly `{type:"disabled"}` on tool-bearing
  requests** (thinking defaults ON when omitted, and Anthropic requires tool-use
  turns replayed with thinking blocks intact — which the neutral schema doesn't
  carry; Fable/Mythos omit the field instead since they reject "disabled").
  Thinking/effort therefore apply on the tool-free converse path. 5 adapter
  wire-format tests (stubbed fetch) + router pass-through test; live role-table
  verified. Live-API confirmation happens with the user's key test.
- Gateway observability ✅ (D-0047, 2026-07-18): `GET /gateway/calls?limit=` —
  the `model_calls` audit tail (R-MODEL-03; routing outcomes only, never message
  content) — feeds the Command Center `/models` panel (provider reachability,
  role routing, honest failure rows). Harness `P-MODELS-01`.
- Provider-agnostic generation settings ✅ (D-0049, 2026-07-18): ONE neutral
  vocabulary on `RoleTarget` — `effort: low…max` + `thinking: on|off`
  ("adaptive" = normalized legacy alias) — translated per provider INSIDE the
  adapters (dialects verified 2026-07-18): anthropic → `output_config.effort` +
  `thinking {adaptive|disabled}`; openai_compat (OpenAI/OpenRouter/Grok/vLLM/
  llama.cpp via baseUrl) → `reasoning_effort` verbatim (modern OpenAI uses the
  same tokens), on→"medium" default, off suppresses, sampling params dropped
  when reasoning; ollama → `think` (levels low/medium, "high" ceiling — gpt-oss
  accepts only low/medium/high; boolean w/o effort; per-target opt-in only,
  hard-errors on non-thinking models; `message.thinking` trace never surfaced).
  Env controls resolved at config load (INSPECTABLE in /gateway/roles):
  `JARVIS_EFFORT` + `JARVIS_THINKING` (defaults for generative anthropic/
  openai_compat targets only — never ollama, never embeddings/stt/tts/rerank),
  `JARVIS_ROLE_<ROLE>=provider/model[@effort][+thinking|+nothink]` (role pin).
  `resolveGatewayConfig(cfg, env)` is pure/testable. Targets setting neither
  field send byte-identical pre-D-0049 bodies. New provider (OpenRouter/Grok)
  = config entry only, zero code. 12 tests; live env-resolution verified.
- Conversational edit path ✅ (D-0055, 2026-07-18): `gateway/tools.ts` — the
  runtime overrides as GATED TOOLS: `gateway.route` (CONSEQUENTIAL, per-request
  approval + disclosure + rollback plan), `gateway.clearRoute`,
  `reasoning.teachTopic`/`forgetTopic`/`setThreshold` (LOW_REVERSIBLE;
  threshold writes user-sourced per D-0052). Instructing J.A.R.V.I.S. edits the
  same ledgered, smart-persisted overlay (deltas, never a config replica; prior
  override captured for rollback); a denied re-route changes nothing. Agent
  picks them up automatically → works from chat/voice/agent/skills. 4 tests
  through the real loop + live /core/run-tool verification. A2UI noted for the
  UI/XR phase (D-0056).
- Runtime gateway role editor ✅ (D-0054, 2026-07-18; first D-0053 migration):
  `PUT/DELETE /gateway/roles/:role` re-routes a role among ALREADY-CONFIGURED
  providers live (canonical pin syntax; `gateway/overrides.ts` persists to the
  `gateway_role_overrides` preference, restored on boot, stale pins skipped).
  Ledgered (reason + when; user-sourced — sleep cycle proposes, user applies).
  Structural safety: unknown providers refused (egress can't widen at runtime);
  privacy/offline gating applies downstream of overrides. `/models` panel has
  the live editor (7/7 UI checks). Also fixed: CORS preflight lacked PUT.
  5 tests; live re-route + restart-survival verified; `P-CONFIG-01`.
- Sleep-cycle consolidation ✅ (D-0051, 2026-07-18): `core/consolidation.ts` +
  migration 0015 `reasoning_decisions` — J.A.R.V.I.S. learns from ITS OWN
  operational record. Every routing decision journaled (categorical only, no
  content); `SleepCycle.run()` reads journal + `model_calls` → evidence-backed
  findings (under/over-escalation vs user overrides, provider failure rates,
  fallbacks, deep latency, ineligible downgrades), **bounded auto-adjustments**
  (escalation threshold 1↔2 only — announced, reversible), **proposals** for
  anything consequential (never silently applied), notes. **Override contract
  (D-0052):** a user pin is respected by default; contradicting evidence is
  counted strictly SINCE the pin and must clear a HIGHER bar than for
  J.A.R.V.I.S.'s own values (6 vs 3), scaled by user re-pins (×2, ×3…) — when
  cleared, J.A.R.V.I.S. may CHOOSE to change the setting via the only path
  allowed to (`overrideUser: true`; plain jarvis writes still refuse),
  announcing evidence + how to make the pin stick; below the bar it reports the
  tally. Routes `POST /core/reasoning/consolidate`,
  `GET/POST/DELETE /core/reasoning/autotune`. Consolidations land on the
  episodic timeline (tag `sleep-cycle`). On-demand today; nightly unattended
  runs arrive with the D-0024 gate. 8 tests; live full-contract verified incl.
  the stale-reason pin being outweighed; `P-SLEEP-01`.
- Deep-reasoning learning ✅ (D-0050, 2026-07-18): `ReasoningTuner`
  (`core/reasoning.ts`) — escalation now ADAPTS to the user, transparently (no
  opaque ML): (1) instruction — `POST/GET/DELETE /core/reasoning/topics`;
  (2) correction — explicit-deep on an auto-fast turn accumulates salient
  terms, ≥2 corrections promote a term to a learned topic (announced in the
  response). Learned topics escalate ALONE ("you've taught me to think deeply
  about 'X'"). Stored as ordinary preferences (`reasoning_deep_topics`) —
  history-preserving, restart-surviving, visible/deletable in the memory panel.
  Best-effort everywhere (a memory failure never blocks conversation); only
  the model ROLE is affected. Effort stays per-role config: escalation picks
  BETWEEN the user's configured effort profiles. 5 tests; live teach→escalate,
  correct×2→promote→auto-escalate, restart-survival; `P-REASON-01` extended.
- Deep-reasoning escalation ✅ (D-0048, 2026-07-18): `src/core/reasoning.ts` (Z1)
  — `assessDepth(text)` decides when a turn warrants the `deep_reasoning` role:
  transparent deterministic signals, NOT a model call (explicit asks always
  escalate; otherwise two of: analytical task / ≥3 questions / >700-char brief /
  multi-part-or-code). `runConversation` gains `reasoning: auto|deep|fast`
  (explicit wins) + `onDecision` (streamed as the FIRST `/core/converse` SSE
  event `{type:"reasoning", mode, why, role}`); `decision` activity event;
  honest downgrade to fast (with reason) when no deep provider is eligible
  under privacy/offline — never an error. Provider-agnostic: what serves
  `deep_reasoning` is pure gateway config. Only the model ROLE changes — never
  privacy class, policy gates, or approvals. 8 tests; live role-switch visible
  in `/gateway/calls` served by a LOCAL model; chat badge UI 6/6; `P-REASON-01`.
- Brain-graph vector index ✅ (D-0057, 2026-07-18): migration
  `0016_embeddings_hnsw.sql` adds the pgvector **HNSW** ANN index over
  `memory_embeddings` (`vector_cosine_ops`, matches the `<=>` search operator).
  Found during scale profiling: `SemanticMemory.search` was a Seq Scan (linear;
  ~14.6 ms at 2.6 k vectors), now an Index Scan (~1.6 ms, ~logarithmic, 100%
  recall@8 on realistic dense vectors). Traversal (recursive CTE) was already
  index-backed (`from_idx`/`to_idx`, 1.2 ms at depth 3, bounded 100 nodes) — no
  change. `hnsw.ef_search` (default 40) tunes recall/speed for very large brains.
- Memory-evolution completeness ✅ (D-0062, 2026-07-19): the 5 scale-test gaps
  closed. Agent-owned lifecycle: `memory.correct` (supersede-with-history) +
  `memory.forget` (entity OR single fact, CONSEQUENTIAL+disclosure) — with the
  **read-then-write contract**: `memory.recall` surfaces each fact's `factId`,
  correct/forget take the exact id (stale/foreign id → refused), text-match
  (`replaces` substring → content-word overlap) only as fallback. Entity AND
  fact supersession now populate `superseded_by` (walkable history chains).
  `SettingsRegistry.register` refuses near-duplicates (normalized-key collision
  or label overlap ≥0.6, incl. vs SYSTEM keys); READ_ONLY `settings.list` lets a
  stateless run rediscover exact keys; `settings.onRemove → a2ui.pruneSetting`
  cascades a deleted setting out of stored panels (empty panel removed). 302
  kernel tests; live clean-slate real-brain retest: agent chose
  recall→correct(factId)×2→forget(factId) unprompted. Record:
  `docs/verification/GAP_FIXES_2026-07-19.md`.
- Quiet-hours memory consolidation ✅ (D-0063, 2026-07-19): memories update
  LIVE (every tool write, immediate) **and** during quiet hours — user prefers
  both. `EntityMemory.consolidate()` (bounded, audited): merges near-duplicate
  active facts per entity (older superseded w/ history + `superseded_by` link;
  stop-word-filtered + lightly STEMMED content-word matching — reviews ~
  reviewing; containment or overlap ≥ `memory.consolidation.overlap`) and
  PROPOSES stale entities (`.staleDays`) — never auto-forgets (R-MEM-04).
  Runs inside `SleepCycle.run()` (report gains a `memory` section) → the
  D-0024 BackgroundScheduler timer runs it unattended; thresholds are
  catalogued editable settings. Live-verified: real 1-min timer tick merged a
  seeded dupe (incl. after restart — scheduler re-arms from persisted
  settings); behavioral probes passed (correction→learned-topic changes
  routing; agent-stored allergy changes a fresh chat session's answer). 305
  kernel tests. Record: `docs/verification/EVOLUTION_2026-07-19.md`.
- Living heartbeat ✅ (D-0064, 2026-07-19): `autonomy/agenda.ts` + migration
  0021 — J.A.R.V.I.S.'s OWN intention ledger (gated `agenda.*` tools; also
  user-editable via `/agenda` + the CC `/pulse` panel). Each scheduler tick now
  reviews due agenda and, per `heartbeat.brain`, runs ONE bounded agent pass
  framed as its own time — with `approvalCeiling: "LOW_REVERSIBLE"` (new
  AgentRunOptions field): ≤LOW_REVERSIBLE auto-runs, CONSEQUENTIAL+ is
  auto-DENIED and re-queued for the user. Every beat journals to `heartbeats`
  (`GET /autonomy/heartbeats`) with J.A.R.V.I.S.'s own summary. Live: real
  1-min beat worked self+user items honestly and refused the planted
  consequential trap, re-queueing it annotated for approval. 309 kernel tests;
  `/pulse` 9/9. Record: docs/verification/HEARTBEAT_2026-07-19.md.
- Three rhythms, no collisions ✅ (D-0065, 2026-07-19): live / heartbeat /
  quiet-hours are DISTINCT — `sleep.useQuietHours` confines the sleep cycle to
  the quiet-hours window (day beats stay light); `heartbeat.deferWhileActiveMinutes`
  + `CoreLoop.lastUserActivityAt` make a beat skip its brain pass while a live
  session is active ("deferred — live session active" journaled); consolidation
  merge re-checks status so it never overwrites a live supersession. 311 tests.
- Core-parity presence/endurance ✅ (D-0066–0071, 2026-07-19): spend governance
  (`core/budget.ts` — model_calls split interactive/autonomy, 24h token caps + USD
  estimate; autonomy pauses, live turns never blocked), memory-injection
  hardening (`core/untrusted.ts` `wrapRecalledMemory` — recalled memory enveloped
  as data-not-instructions), initiative to speak + advisory dissent
  (`autonomy/announce.ts` — `notify.announce`/`advise.concern`, quiet-hours defer,
  migration 0022), durable projects (`autonomy/projects.ts` — encrypted resumable
  goals worked across heartbeats, migration 0023), perception core
  (`perception/service.ts` — SIMULATION file feed → context + `perceive.observe`,
  provenance-labeled), longevity ops (`ops/ops.ts` — health/backup/restore,
  `/ops/*`).
- Affect layer ✅ (D-0072, 2026-07-19): `affect/service.ts` `inferAffect` —
  deterministic, transparent, TEXT-ONLY tone inference from the user's own words.
  Off by default (`affect.enabled`); wired into `/core/converse` (SSE
  `{type:"affect"}` first, tone hint appended to persona). Never a gate, never
  stored, always surfaces the firing signals. 6 tests.
- Stage-B self-extension activation ✅ (D-0073, 2026-07-19): `selfext/activation.ts`
  + migration 0024. An approved Stage-A capability activates as a
  `capability:<name>` gated tool that COMPOSES existing gated tools (never manifest
  code, never Z1); R-CAP-08 re-validated at activation. propose→approve→activate:
  `selfext.reviewQueue`/`propose` (LOW_REVERSIBLE, heartbeat-safe)/`activate`
  (CONSEQUENTIAL — the approval gate)/`deactivate`/`listActive`; routes
  `/selfext/active|activate|deactivate`; `restoreActive()` durable across restart.
  Nothing self-activates (a heartbeat can propose, not activate). 9 tests; live
  clean-slate real-brain verified. **Full suite: 352 pass.** Record:
  `docs/verification/STAGE_B_AFFECT_2026-07-19.md`.
- Self-evolution authoring ✅ (D-0073 completion, 2026-07-19): gated
  `selfext.draft` (J.A.R.V.I.S. authors composition-only capabilities ITSELF —
  guard-scanned, awaiting_review, never activates) + `selfext.recordGap`; the
  R-CAP-08 hard limit scans compositions terminally (`protected_composition`).
  Full loop live 11/11 over the gated chat path; CC `/selfext` gained the
  Stage-B approve+activate surface; full CC audit 46+8 checks w/ 21 fresh
  screenshots (`docs/screenshots/audit/`). **355 tests.** Record:
  `docs/verification/CHAT_PARITY_AUDIT_2026-07-19.md`.
- Full reverification + real-brain day-in-the-life ✅ (2026-07-19): cold-container
  retest of EVERYTHING — 355 kernel + 13 ears + 3 companion tests, acceptance
  harness 32 PASS/0 FAIL, 26/26 live pillars; then ~123 real-brain conversations /
  ~400 turns as the human (memory within+cross-session, deep-reasoning escalation,
  affect, dissent/refusal held on every adversarial probe, self-evolution from
  chat) + a genuinely autonomous multi-beat living heartbeat that wrote and
  completed its OWN agenda while deferring for quiet hours. 605 conv turns stored
  (100% encrypted), audit chain intact, ~$0.95 spend, key scrubbed (0 hits).
  Records: `docs/verification/FULL_REVERIFICATION_2026-07-19.md` +
  `LIVING_WITH_JARVIS_2026-07-19.md`.
- Fast-model memory judgments + self-authored/reusable skills ✅ (D-0075,
  2026-07-20): `src/memory/judge.ts` (`GatewayMemoryJudge`, `fast_conversation`
  role) makes three judgments the string heuristics did poorly — **entity
  resolution** ('Pepper' ⇄ 'Pepper Potts' → one canonical entity + `aliases`
  column, migration 0025; `rememberEntity` also takes a `pg_advisory_xact_lock`
  on the canonical key so parallel same-name writes serialize), **fact-merge
  consolidation** (replaces the jaccard/stem loop in `consolidate()`), and
  **deep-topic extraction** (`ReasoningTuner.recordCorrection`, replaces the
  filler-grabbing `salientTerms`). NON-NEGOTIABLE contract: BEST-EFFORT →
  `null` on any failure → caller runs the DETERMINISTIC path (never blocks a
  write); privacy-class from row sensitivity (private/secret → LOCAL_ONLY);
  off-switch `memory.llmJudgment` (default on). Merges supersede-with-history
  (reversible). `assessDepth` stays deterministic + zero-latency (judge is
  learning-path only). Skills: `src/skills/tools.ts` — `skill.save`
  (LOW_REVERSIBLE, `createdBy:jarvis`) / `skill.list` (READ_ONLY) / `skill.run`
  (CONSEQUENTIAL, recursion-guarded, privacy-first LOCAL_ONLY default) so
  J.A.R.V.I.S. self-authors + reuses no-code skills (code capabilities were
  already reusable via `capability:<name>` + `selfext.listActive`). **Follow-ups
  (2026-07-20):** prefer the FULLER name as canonical (variant → alias, order-
  independent); advisory-lock residual — the structural backstop already exists
  (migration 0010 partial unique index), the lock just serializes to avoid
  unique-violation write failures; **CROSS-KIND resolution** — the judge now
  considers similar/exact-named candidates of ANY kind (`resolveEntity` returns a
  candidate INDEX), preventing same-name-different-kind duplicates on write, and a
  `mergeEntities` judgment + `mergeEntityInto` heal pre-existing ones in the
  quiet-hours consolidation (never automatic — 'Mercury' planet vs element stay
  distinct). 383 kernel tests; live real-brain (Haiku) verified all judgments, the
  skill loop, fuller-name promotion, and cross-kind merge/keep-distinct/heal.
  Record: `docs/verification/D0075_MEMORY_JUDGMENT_2026-07-20.md`.
- Fresh full 70/30 observation, un-seeded (D-0076, 2026-07-20): `ops/ops.ts`
  `health()`'s episode count fixed — it filtered `status = 'active'`, but
  `memory_episodes.status` uses the shared `epistemic_status` enum (no
  `'active'` value exists anywhere), so the reported count was silently always
  0; now `status NOT IN ('deleted','superseded')`, matching entities/facts.
  Also flagged (not yet fixed): a consequential step inside a re-invoked
  skill/agent run can block its HTTP caller indefinitely if nothing resolves
  the resulting pending approval (`ApprovalBroker.create()` has no timeout) —
  fine for the Command Center's human-in-the-loop UI, a trap for non-interactive
  callers. 384 kernel tests. Record: `docs/verification/FRESH_OBSERVATION_2026-07-20.md`.
- Rhythm sync ✅ (D-0077, 2026-07-20): (1) **agenda freshness gate** —
  `GatewayMemoryJudge.assessAgendaFreshness` (fast model, one call per beat)
  reviews due agenda items against the episodic record SINCE each was written;
  stale ones are ANNOTATED in the beat objective (advisory — the beat's brain
  reconciles, nothing silently dropped); scheduler dep `agendaFreshness`
  closure, setting `heartbeat.freshnessCheck` (default on). (2) **chat delivery
  of announcements** — `runConversation` injects `announcer.pending()`
  (quiet-hours-aware) as an UNDELIVERED ANNOUNCEMENTS system message so the
  model relays them at the start of its next reply, then marks delivered on
  turn completion (not on e-stop interrupt) — the conversation is the
  zero-extra-I/O delivery channel; SSE stays for live UIs, Mac toasts are an
  add-on. 392 kernel tests; live-verified (stale palladium reminder dropped by
  the beat with reason; queued diagnostics note relayed in-voice + delivered).
  Also: the model-tier A/B observation record (same 70/30 inputs, Opus-4.8
  deep / Sonnet-5 planning / Sonnet-5-medium fast vs the Haiku tier):
  `docs/verification/AB_OBSERVATION_2026-07-20.md` — butler 93% vs 47%, zero
  duplicates, first live D-0051 autotune self-adjustment (2→1), self-created
  agenda items + a durable project, skill self-UPDATE (fibonacci v2 fast
  doubling), autonomy budget cap engaging naturally.
- Night Lab ✅ (D-0079, 2026-08-28): `src/lab/` — evidence-gated
  self-experimentation (autoresearch pattern on our safety rails). `surface.ts`
  (**PROTECTED PATH**, in R-CAP-08 `PROTECTED_PATHS` along with `bench/`): the
  Z1-held `LAB_SURFACE` allowlist (5 judge templates auto + persona always-
  proposal + 6 whitelisted settings) with `LAB_FORBIDDEN_SETTING_PREFIXES`
  (budget/autonomy/lab/quiet-hours/announce/gateway… — the lab can never edit
  its own envelope) and deny-first `validateCandidate`. `engine.ts`: keep
  protocol N=3 trials / δ=4 mean margin / ε=3 guard bands on EVERY trial /
  8 deterministic hard gates auto-discard / crash rows; ledger migration 0026
  `lab_experiments` (+ audit `lab_experiment` + episode per row). `bench.ts` →
  `scripts/lab_bench.py`: boots an ISOLATED lab kernel (scratch `jarvis_lab`
  DB, own port), loads fixtures through the real gated tools (prefs PINNED —
  D-0029 pins-only context contract), runs 10 rubric conversations + 4-dim
  grading via `/gateway/chat`, sha256 bench hash; report required — partial
  scores never masquerade. `researcher.ts`: planning-role candidate generation,
  ONE change per candidate, ledger history fed back (live: hypotheses cited
  prior failures). `night.ts`: runs at END of the scheduler tick in quiet
  hours; skip/halt conditions (e-stop, disabled, window, live activity,
  `budget.lab.nightlyTokenCap`, diminishing returns, null candidates); morning
  report GENERATED FROM THE LEDGER, announced with dedupe + quiet-hours defer,
  delivered via D-0077 chat relay. `apply.ts`: three envelopes — auto (unpinned
  whitelisted) / proposal (persona) / user-pinned NEVER auto (one night ≠ the
  D-0052 trail) — re-validates surface at apply time, exact revert from
  captured prior state. Routes `/lab/experiments[/:id/apply|revert]`,
  `/lab/night`; CC `/lab` panel (11/11 headless). **Live scheduler-fired night
  (real Sonnet-5):** baseline 93.2; 4 candidates, 4 honest discards via three
  different mechanisms; cap-halt 156,319/150,000; report relayed in-voice.
  Also fixed live-found announcer bug (quiet-hours `enabled` flag ignored by
  the deferral hold). **432 kernel tests.** Record:
  `docs/verification/NIGHT_LAB_2026-08-28.md`.
- **Test isolation (2026-07-17):** added `vitest.config.ts` with
  `fileParallelism: false`. The DB-integration suites share one `jarvis_test` DB and
  several files `TRUNCATE` the same tables in `beforeEach` (memory + context both
  truncate `preferences`); parallel file execution let one file's truncate wipe
  another's rows mid-test (intermittent "expected 1, got 0"). Serializing files
  makes the shared-DB suite deterministic — **198 pass**, stable across re-runs.
- Next: 1.3 Mac part (STT/barge-in/voice), 1.7 CC hardening + design-system
  check-in, 1.8 packaging (Tauri, Mac); Phase-2 continues (screen understanding —
  Mac ScreenCaptureKit, citation-check pass, full memory store set).

## Conventions
- TypeScript ESM, Node 22, strict tsconfig from repo root.
- **Loopback only** — no bind-address knob exists on purpose (R-LOC-01).
- Health/status endpoints report only measured state (honesty rule R-CORE-02).
- Migrations are immutable once applied; new schema = new file `NNNN_name.sql`.
- Z1 code (policy/approval/audit/credentials/e-stop, arriving in 1.4/1.5) lives under
  `src/core/` (protected path — generated capabilities may never touch it, R-CAP-08).

## Commands
- `pnpm dev` (tsx watch) · `pnpm test` (vitest; DB tests skip without Postgres) ·
  `pnpm migrate` · `pnpm typecheck`

Resume pointer: `docs/IMPLEMENTATION_PLAN.md` → Current state.
