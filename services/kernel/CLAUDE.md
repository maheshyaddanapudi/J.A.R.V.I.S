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
  `JARVIS_OFFLINE=1` refuses all remote providers.
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
- Next: 1.3 Mac part (STT/barge-in/voice), 1.7 CC hardening + design-system
  check-in, 1.8 packaging (Tauri, Mac).

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
