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
  8 web tests; **full suite 176 pass**; live end-to-end + harness `P-WEB-01`.
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
- Next: 1.3 Mac part (STT/barge-in/voice), 1.7 CC hardening + design-system
  check-in, 1.8 packaging (Tauri, Mac); Phase-2 continues (screen understanding —
  Mac ScreenCaptureKit, untrusted-content envelope + citation-check, full memory store set).

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
