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
- Next (1.3): voice pipeline (Python `jarvis-ears` + Swift audio path on Mac).

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
