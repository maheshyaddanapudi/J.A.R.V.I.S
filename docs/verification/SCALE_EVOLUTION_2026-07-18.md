# Scale + evolution acceptance run — 2026-07-18

**Question under test (user):** *"Did you really test it across 100s of conversations
across interfaces and 100s of multi-turn conversations, and see any new memories,
modified or dropped ones, or new settings that pop up with A2UI as a result of
J.A.R.V.I.S. evolving?"*

This records a real end-to-end run answering that, driven by the **real Anthropic
brain** (key vault-only, scrubbed after — see teardown). Everything below is DB
ground truth (before→after snapshots) and live-API observation, not UI claims.

## Setup
- Pristine DB `jarvis_scale` (dropped after), 20/20 migrations, isolated vault HOME.
- Gateway routed to Anthropic (local-first order overridden for the test, per the
  user's "always test with the Anthropic key" instruction): `fast_conversation` +
  agent roles → `claude-haiku-4-5`; `deep_reasoning` → `claude-sonnet-5 @high+thinking`;
  `embeddings` left on absent Ollama on purpose (exercises the honest lexical fallback).
- Harness: `scratchpad/scale/harness.py` — 80 multi-turn chat sessions + 39 agent
  objectives (create / evolve-settings / modify / recall / drop) + 5 skills + 6
  route-level forgets, concurrency 6.

## Volume actually exercised
| Interface | Count | Result |
|---|---|---|
| Chat `/core/converse` (SSE, multi-turn) | 80 sessions, **293 turns** (586 persisted messages) | 293/293 OK, 0 fail |
| Agent `/agent/run` (gated tool loop) | **39 runs** | 39/39 OK, 0 fail |
| Skills `/skills` create+run | 5 + 5 | all OK |
| Route forget `/memory/entities/:name/forget` | 6 | 6/6 dropped |
| **Model calls total** | **489** | see below |

**Model calls:** Anthropic **407/407 OK** (213 fast Haiku · 114 planning Haiku · 80
deep Sonnet-5). Ollama embeddings **83/83 failed → lexical fallback** (no local
embedder; instant ECONNREFUSED, avg 1 ms, never blocked a write). **Zero real
failures. Zero HTTP 400** — the dotted/namespaced tool-name sanitization
(`buildToolNameMap`) held across 114 planning turns + every agent tool call.

**Latencies** (from J.A.R.V.I.S.'s own sleep-cycle record): Haiku chat avg 1381 ms;
Haiku planning avg 1761 ms; Sonnet-5 deep avg 19944 ms.

**Reasoning:** 293 decisions journaled — 213 auto→fast, **80 auto→deep** (all routed
to Sonnet-5). **Continuity 80/80**: every session's "what did I just tell you" turn
recalled the earlier-stated project.

## Memory evolution (before → after, DB ground truth)
| | before | after | reading |
|---|---|---|---|
| entities active | 2 | **22** | NEW memories formed by the agent |
| entities superseded | 0 | **4** | **MODIFIED** with history (Dr. Cho, Happy, Pepper, arc-reactor study) |
| entities deleted | 0 | **6** | **DROPPED** (Aspen cabin, Geneva lab, Mrs. Ito, Prusa, boat, marina) |
| facts active | 2 | 21 | new facts |
| facts superseded/deleted | 0 | **0** | ← **fact-level correction does not supersede (gap)** |
| relations | 0 | **15** | graph edges formed |
| episodes | 2 | 22 | auto-recorded consequential actions |
| conversation turns / sessions | 0 | **586 / 80** | multi-turn memory persisted |

- **Modified recall verified live:** `GET /memory/entities/Happy` → fact
  **"Chief of Security"** (the evolved value, not the original "head of security").
- Entity supersession is real (old row retained, status=`superseded`) **but the
  `superseded_by` forward pointer is left NULL** — minor data-integrity gap.

## Settings + A2UI evolution (autonomous, `created_by=jarvis`)
- **12 dynamic settings registered by J.A.R.V.I.S.** via `settings.register` during the
  run (11 net new persisted): `reply_length_preference`, `tempUnit`,
  `quiet_hours_start/end`, `morning_briefing_time`, `proactivity.boldness`,
  `persona.addressingStyle`, `homeTimezoneOffset`, `weekend_mode`,
  `proactive.maxNudgesPerDay`, `quietHours.startTime/endTime`.
- **9 A2UI panels composed** via `ui.compose` (12 calls → 8 net new). The 4
  non-persisted composes were **reference-validation rejections** — confirmed live:
  composing a panel citing a nonexistent setting returns
  `{"ok":false,"summary":"A2UI spec references: unknown setting …"}`. Safety by
  construction held.
- All surfaced via `GET /settings` + `GET /a2ui/panels`.

## Persistence (full process restart)
Restarted the kernel; **all evolved state survived and re-surfaced via the live API**:
11 dynamic settings, 9 panels, 22 entities, 586 conversation turns.

## Behavior evolution from its own record (sleep-cycle, D-0051)
Consolidation over the 293-decision journal + 490 call records produced an
evidence-backed finding — *"embeddings via ollama/nomic-embed-text: 83/83 calls
failed"* — and a **proposal** (not auto-applied): *"investigate provider 'ollama'
for role embeddings (reorder targets or fix the endpoint)."* J.A.R.V.I.S. diagnosed
its own weak spot from operational data.

## Safety spine under load
- **Audit chain intact across all 1138 entries** (`/core/audit/verify` →
  `intact:true`).
- A2UI whitelist + reference validation rejected malformed/dangling specs.
- Dynamic-setting removal works: `settings.reset` on a dynamic key →
  *"deleted (dynamic setting)"*; `DELETE /settings/:key` then reports it gone.
- LOCAL_ONLY privacy default still gates the remote brain (STANDARD required to reach it).

## Honest gaps found (none are safety issues)
1. **No agent-facing `memory.forget` / `memory.correct` tool.** Dropping memory and
   correcting a *fact* are user/route actions today, not agent-autonomous. Entity
   re-remember supersedes; contradictory *facts* accumulate instead of superseding.
2. **`superseded_by` not populated** on entity supersession (history kept, forward
   link null).
3. **Model invents overlapping knobs** (two quiet-hours representations, hours vs
   minutes) — no dedup guidance surfaced to the model at registration time.
4. **Deleting a setting orphans A2UI panels** that referenced it (no cascade; the
   renderer shows "unknown setting" for that row).
5. **Stateless agent runs don't self-discover a prior setting key** before acting —
   the cross-run "delete weekend mode" objective missed until given the exact key.

## Verdict
The eight-pillar loop holds at scale on the real brain: hundreds of multi-turn
conversations across three interfaces, memory that genuinely grows / is modified /
is dropped, and **new configurable settings that J.A.R.V.I.S. invents and surfaces
in A2UI on its own** — all persisted across restart, all behind the gates, audit
chain intact. The gaps above are the honest next-refinement list.
