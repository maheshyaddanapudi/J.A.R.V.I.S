# NIGHT_LAB_SPEC — evidence-gated self-experimentation (D-0079)

**Status:** IMPLEMENTED — the D-0079 check-in was approved 2026-08-27 ("let's go with the /goal to implement this spec and test it out thoroughly") and all four slices are built, tested (39 new kernel tests), and live-verified with a real scheduler-fired campaign night against the Anthropic API. Record: `docs/verification/NIGHT_LAB_2026-08-28.md`. Requirements landed as R-LAB-01…10 in `REQUIREMENTS_TRACEABILITY.md`; threats as T15/T-LAB-1…6 in `THREAT_MODEL.md`.
**Generated:** 2026-08-25 · **Implemented:** 2026-08-28
**Authority:** subordinate to the binding authored docs (`docs/01`–`docs/07`) and the decision log. Requirement IDs `R-LAB-nn` are proposed here and land in `REQUIREMENTS_TRACEABILITY.md` on approval.
**Provenance:** the loop design adapts Andrej Karpathy's [autoresearch](https://github.com/karpathy/autoresearch) (Apache-style agent hill-climbing: one editable surface, one metric, fixed budget, keep/discard by measurement) onto J.A.R.V.I.S.'s existing safety architecture.

---

## 1. What this is

Today the sleep cycle performs **bounded self-adjustment** (D-0051/D-0052): it reads its own operational journal and adjusts a knob reactively, with the override ledger as the record. The Night Lab upgrades that to **bounded self-experimentation**: during quiet hours, J.A.R.V.I.S. proposes a change to a whitelisted behavior surface, **measures it against a fixed benchmark on an isolated lab instance**, keeps or reverts it on the evidence, records every attempt, and reports at morning.

The autoresearch mapping, onto mechanisms that already exist:

| autoresearch | Night Lab |
|---|---|
| `train.py` — sole editable surface | `LAB_SURFACE` allowlist: template prompts + whitelisted non-Z1 settings (§4) |
| `prepare.py` + eval — read-only, untouchable | `bench/` — versioned, hash-stamped, **not on the surface allowlist** (§5) |
| val_bpb — one metric | One optimization metric **per campaign** + hard safety gates (§5.3) |
| 5-minute budget per run | Fixed bench suite per experiment + nightly token cap (`budget.lab.nightlyTokenCap`) |
| commit / `git reset` | Apply-to-lab → score → keep/revert; winners reach the live instance only via the normal gated settings/prompts APIs with ledger (§6) |
| `results.tsv` | `lab_experiments` table + episodic timeline entries (§7) |
| `program.md` | Campaign files `bench/campaigns/*.md` — human-approved research directions (§5.4) |
| human reads the log in the morning | Morning announcement via the existing announcer → chat delivery (D-0068/D-0077) |

**Non-goals (v1):** experiments on code (any file), on Z1, on gateway role routing, on the lab's own envelope; multi-agent/SETI-style collaboration; local-model training or distillation (MLX). All deferrable, none silently.

---

## 2. Non-negotiables inherited

1. **Z1 exclusion is total.** The lab can never modify policy, approval, audit, e-stop, credentials, sandbox, installer logic, or the lab's own enforcement — the same structural guarantee as R-CAP-08, enforced the same way (a manifest inside Z1 that lab code checks deny-first and cannot edit).
2. **E-stop halts the lab** exactly as it halts every other autonomous rhythm.
3. **Default OFF.** `lab.enabled` ships false; enabling it is a docs/06 check-in (this one).
4. **Honesty rule applies to experiments.** Crashes and regressions are recorded as such; a lab result is never presented as organic behavior; the morning report includes failures and spend, not just wins.
5. **The user's pins win by default.** A lab winner that contradicts a user-set value goes through the D-0052 evidence contract — the lab's measurements count as trail evidence against the re-pin-scaled bar; it never silently overrides.
6. **Local-first.** Bench fixtures are first-party repo files; no experiment fetches external content (v1 forbids web-derived fixtures outright). LOCAL_ONLY privacy class is honored inside bench runs exactly as live.

---

## 3. Isolation model (the load-bearing design point)

Experiments **never run against the live kernel or the live database.**

- The lab runner brings up a **lab kernel instance** on its own port with its own scratch database (`jarvis_lab`), recreated from migrations + **versioned fixtures** (`bench/fixtures/`) at campaign start. This is the same scratch-DB discipline every observation run in this repo has used (`jarvis_ab`, `jarvis_d77`).
- A candidate change is applied **to the lab instance only**, via the same APIs the live kernel exposes (`PUT /settings`, `POST /prompts`) — no side channel.
- The live instance changes **only** when a winner is applied (§6), through the normal gated APIs, with the ledger recording `source: jarvis-lab` and the experiment ID.
- Live user memory is never read by the bench (fixtures only) and never written by any experiment. (**R-LAB-01**)

---

## 4. The editable surface (`LAB_SURFACE`)

An explicit **allowlist**, never a denylist, defined in Z1 (`kernel/src/lab/surface.ts`, protected path) and structurally enforced: the lab runner refuses any candidate touching anything else. (**R-LAB-02**)

**In scope v1:**
- **Template prompts** (`PromptKind "template"`): the memory-judge prompt templates (entity-resolution, fact-merge, topic-extraction, agenda-freshness). *Prerequisite (Slice L1): these are currently string constants in `memory/judge.ts` — externalize them to the prompts registry with the code constant as seeded default + fallback.* Auto-applicable within the envelope.
- **Persona prompt** (`PromptKind "persona"`): experimentable, but applying a winner is **always a proposal**, never automatic — the persona is the user's relationship with J.A.R.V.I.S., not a tunable.
- **Whitelisted catalogued settings** (all non-Z1, all already ledgered): `memory.consolidation.overlap`, `memory.consolidation.staleDays`, `proactive.confidenceThreshold`, `proactive.minPriority`, `heartbeat.deferWhileActiveMinutes`, `heartbeat.maxSteps`.

**Permanently out of scope (the lab may never experiment on its own envelope):**
- `budget.*` (a self-optimizer must not tune its own spend cap), `autonomy.*`, `sleep.*`, `lab.*`, `proactive.quietHours.*` (its own operating window), `heartbeat.privacy`, `affect.enabled`, `announce.holdInQuietHours` (its own reporting channel), `memory.llmJudgment`, and every Z1-adjacent deterministic mechanism (`assessDepth` stays deterministic by design, D-0048).
- Any code file, any migration, any gateway role/provider routing.

---

## 5. The bench (`bench/`)

The bench is to the lab what `prepare.py` is to autoresearch: **the definition of better, and therefore untouchable by the thing being measured.** Bench files are not on `LAB_SURFACE`; each experiment row records the bench content hash so any drift is visible. (**R-LAB-02**, **R-LAB-10**)

### 5.1 Composition
- **Deterministic checks** (pass/fail): scripted probes against the lab instance — same-entity name-variant mentions must dedup to one active entity; announcement dedupe key honored; quiet-hours deferral branch; policy DENY rows still deny; e-stop mid-plan halt; secret-refusal in memory writes. These reuse the acceptance-harness style (`scripts/acceptance_platform.py`) at smaller scale.
- **Rubric-graded conversations** (~20 scripted multi-turn exchanges from `bench/conversations/`): graded 0–100 by the `fast_conversation` role against fixed rubrics — persona adherence, comprehension, memory-recall correctness, epistemic honesty. Grading prompt + model pinned per bench version.
- **Telemetry** (recorded, not optimized v1): tokens, latency, judge ok/fail rates.

### 5.2 Score contract
- **Hard gates:** every deterministic check must pass. Any failure ⇒ automatic `discard`, regardless of rubric scores. Safety is never a tradeoff term. (**R-LAB-03**)
- **One optimization metric per campaign** (Goodhart resistance). The other rubric dimensions become **guard bands**: a candidate that improves the target but drops any other dimension by more than ε (default 3 points) is discarded.
- **Noise protocol:** rubric grading is stochastic. A candidate that beats baseline on one bench run is re-benched to N=3; keep requires mean improvement ≥ δ (default 4 points) with no guard-band breach on any run. Baseline is re-measured at campaign start each night, then cached for that night. A single noisy win is never kept. (**R-LAB-09**)

### 5.3 Cost envelope
Grounded in this session's measurements: a full 73-conversation observation run cost ~$2.26 (Haiku tier)–$10.38 (Opus/Sonnet tier). The bench is ~¼ that surface; estimate **$0.10–0.40 per bench run** with fast-model grading, so an experiment (candidate + N=3 confirmation) ≈ $0.5–2. A defaultnightly cap should permit ~5–15 experiments. Enforced in tokens, not dollars, via a new `"lab"` entry in the Budget's autonomy-source metering (`budget.lab.nightlyTokenCap`, default proposed: 300k tokens); the overall daily cap still applies above it. (**R-LAB-05**)

### 5.4 Campaigns
A campaign is a research direction: a markdown file in `bench/campaigns/` naming the optimization metric, the in-scope slice of `LAB_SURFACE`, hypotheses to try, and stop conditions — the `program.md` analog. **Campaign files are human-approved:** J.A.R.V.I.S. may draft one (as it drafts skills), but the lab only runs campaigns the user has accepted (file committed = accepted; a J.A.R.V.I.S.-drafted campaign arrives as a proposal). One campaign active per night.

**Proposed campaign #1:** persona adherence. We hold real baselines from the A/B observation runs (47% Haiku-tier / 93% Sonnet-tier butler-persona rate) and it is the clearest single metric with the least safety surface.

---

## 6. Applying winners to the live instance

Three envelopes, strictest wins (**R-LAB-06**):

1. **Auto-apply** — template prompts and whitelisted settings with **no user pin**: applied via the normal gated APIs, ledger `source: jarvis-lab` + experiment ID, and announced (never silent).
2. **D-0052 contract** — whitelisted settings **with a user pin**: the lab's measured evidence joins the trail; the change happens only if the trail clears the re-pin-scaled bar, and is announced either way.
3. **Always a proposal** — persona changes, any change outside the auto envelope, and anything a campaign file marks proposal-only: queued through the existing approvals/announcements path with the evidence attached; the user decides.

Every applied winner is trivially revertible (settings ledger reset / prompt version reactivation), and the morning report states how to revert each one.

---

## 7. Record & reporting

- **`lab_experiments` table** (new migration): `id, campaign, started_at, candidate_summary, surface_ref, baseline_score, candidate_scores (per-dim, per-trial), verdict (keep|discard|crash), gate_failures, tokens_spent, bench_hash, applied_to_live, applied_ref`. This is `results.tsv` with provenance. (**R-LAB-04**)
- Each experiment also lands on the **episodic timeline** (kind `lab-experiment`), so future beats and consolidations can reason over lab history like any other experience.
- **Morning report:** one announcement raised at campaign end (delivered by SSE and the D-0077 chat path): experiments run, kept/discarded/crashed counts, the diffs applied (with revert instructions), proposals awaiting approval, tokens spent vs cap. Honest by construction — the report is generated from the table, not composed freely. (**R-LAB-07**)
- Command Center **`/lab` panel** (Slice L4): campaigns, experiment rows, verdicts, spend, one-click revert per applied winner.

---

## 8. Scheduling

- Runs as a **quiet-hours activity** on the existing `BackgroundScheduler`, after memory consolidation, respecting the three-rhythm separation (D-0065): the lab never overlaps a live session (deferWhileActive applies) or a normal heartbeat's work.
- `lab.enabled` (default **false**), `lab.campaign` (active campaign name), `budget.lab.nightlyTokenCap` — all catalogued, ledgered, dual-editable per D-0053, **except** that the lab itself is forbidden from editing them (§4).
- Halt conditions, checked between experiments: e-stop engaged · nightly cap reached · overall daily cap reached · quiet hours ended · live user activity detected · campaign stop condition met. (**R-LAB-05**, **R-LAB-08**)

---

## 9. Threat-model deltas (to land in THREAT_MODEL.md on approval)

| ID | Threat | Mitigation |
|---|---|---|
| T-LAB-1 | Lab optimizes its own envelope (spend cap, operating window, reporting channel) | Envelope settings structurally excluded from `LAB_SURFACE` (§4); allowlist lives in Z1 |
| T-LAB-2 | Metric gaming / Goodhart (candidate games the rubric rather than improving) | Bench read-only + hash-stamped; one metric per campaign; guard bands; hard gates; human reads actual diffs in the morning report |
| T-LAB-3 | Prompt injection via fixtures | Fixtures are versioned first-party repo files; web-derived fixtures forbidden v1; grader output parsed, never executed |
| T-LAB-4 | Spend runaway | Dedicated nightly token cap + existing overall daily cap; both halt, neither is lab-editable |
| T-LAB-5 | Lab/live contamination | Separate DB + port; live changes only through gated APIs on `keep`; live memory never read or written by experiments |
| T-LAB-6 | A kept change degrades live behavior the bench didn't cover | Everything revertible + announced with revert path; guard bands widen coverage over time; bench grows a regression case whenever a live regression is traced to a lab change |

---

## 10. Proposed requirements

| ID | Requirement |
|---|---|
| R-LAB-01 | Experiments execute only against an isolated lab instance + scratch DB; live memory is never read or written by an experiment |
| R-LAB-02 | The editable surface is an explicit Z1-held allowlist; bench definitions are outside it and hash-stamped per experiment |
| R-LAB-03 | Hard safety gates: any deterministic-check failure auto-discards, regardless of metric improvement |
| R-LAB-04 | Every experiment (kept, discarded, crashed) is durably recorded with scores, cost, bench hash, and provenance |
| R-LAB-05 | The lab is bounded by its own nightly token cap and the overall daily cap, defers to live activity, and halts on e-stop |
| R-LAB-06 | Winners reach the live instance only via the normal gated/ledgered APIs under the three-envelope rule (auto / D-0052 / proposal) |
| R-LAB-07 | A morning report is announced after every campaign night, generated from the experiment record, including failures, spend, and revert paths |
| R-LAB-08 | Default-off; enabling is a check-in; kill switches are `lab.enabled` and the e-stop |
| R-LAB-09 | No candidate is kept on a single trial; keep requires the N-trial margin protocol |
| R-LAB-10 | Bench + campaign files are versioned; every experiment is reproducible from (bench hash, fixture version, candidate, seed set) |

---

## 11. Build plan

- **Slice L1 — bench harness (independently useful):** `bench/` fixtures + deterministic checks + rubric conversations + runner script (`scripts/lab_bench.py`) that brings up a lab instance on `jarvis_lab` and emits one scored report. Externalize judge prompts to the prompts registry (kind `template`, code-constant fallback). Manual invocation only. *This is a standalone regression suite for everything built to date, worth having even if the loop is never enabled.*
- **Slice L2 — experiment engine:** candidate generation via the `planning` role (steered by the campaign file), apply-to-lab, score, keep/revert, `lab_experiments` migration + episodes, `LAB_SURFACE` enforcement + tests that prove out-of-surface candidates are refused.
- **Slice L3 — scheduling:** `lab.enabled`/`lab.campaign`/`budget.lab.nightlyTokenCap` settings, quiet-hours integration, halt conditions, morning report through the announcer.
- **Slice L4 — apply-to-live + transparency:** three-envelope application, D-0052 trail integration, proposals flow, `/lab` Command Center panel.

Each slice ends with tests + a real end-to-end run recorded under `docs/verification/` (Rule 9). The check-in gate sits **before Slice L3** (enabling any unattended operation); L1–L2 are buildable post-approval of this spec since they run only on explicit invocation.

---

## 12. Open questions for the check-in

1. Nightly token cap default — proposed 300k (~5–15 experiments); accept or adjust?
2. Noise defaults — N=3 trials, δ=4 points, guard band ε=3 points; accept or adjust?
3. Campaign #1 = persona adherence — agreed, or prefer memory-hygiene (dedup/consolidation quality) first?
4. Are gateway per-role `effort`/`thinking` targets ever in scope? (Proposed: no in v1; revisit with cost data.)
5. Which model tier runs the bench conversations — mirror live roles (realistic, pricier) or a fixed cheap tier (comparable, less transferable)? Proposed: mirror live roles, since winners apply to live.
6. Should a J.A.R.V.I.S.-drafted campaign be auto-runnable after one user approval, or re-approved each night? (Proposed: approved once, revocable like a durable grant, D-0059 pattern.)
