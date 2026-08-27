# Verification — Stage-B self-extension activation (D-0073) + affect layer (D-0072)

**Date:** 2026-07-19 · **Branch:** `claude/jarvis-local-ai-os-4smuhd`
**Scope:** the last two core-parity gaps — an emotional-attunement layer, and
controlled activation of self-generated capabilities. Both were approved by the
user at the dedicated check-in (D-0072 affect APPROVED opt-in/text-only; D-0073
Stage-B APPROVED with the propose→approve→activate flow and the R-CAP-08 envelope
intact).

## What was built

### D-0072 affect — `src/affect/service.ts`
Deterministic, transparent, text-only tone inference (`inferAffect`) that reads
the user's OWN WORDS (never biometrics) and nudges reply TONE only. Off by
default (`affect.enabled`), never a gate, never stored, always surfaces which
signals fired. Wired into `/core/converse`: when enabled and tone ≠ neutral, an
SSE `{type:"affect"}` event streams first and a tone hint is appended to the
persona ("changes HOW you respond, never WHAT").

### D-0073 Stage-B — `src/selfext/activation.ts` (+ migration 0024)
An approved, Stage-A-generated capability activates as a `capability:<name>`
gated tool whose body is a **composition of existing gated tools** — never
executed manifest code, never an imported module, never a reach into Z1. Safe by
construction (the A2UI/skills pattern extended to capabilities). The
non-negotiable R-CAP-08 envelope is UNCHANGED and **re-validated at activation**.
Flow: J.A.R.V.I.S. discovers a review queue → PROPOSES (announcement + agenda,
LOW_REVERSIBLE, heartbeat-safe) → the user APPROVES through any interface (the
CONSEQUENTIAL `selfext.activate` gate) → the capability's composed tools go live,
each still individually gated. Deactivation always available; every step audited;
e-stop halts.

## Unit tests (deterministic, no brain)
- `test/activation.test.ts` — **9/9 pass**: clean activation → live gated tool
  running its composition in order; a hard-limit-REJECTED capability can never
  activate (terminal); a composition calling the selfext/capability namespaces or
  an unknown tool is refused; a protected-permission request is refused
  (re-validated at activation); the composition HALTS when a composed step is
  denied; deactivate + restoreActive (durable activation across restart);
  restoreActive skips (never crashes on) an orphaned capability; `selfext.propose`
  is LOW_REVERSIBLE and only announces+queues (a heartbeat can propose but not
  activate), `selfext.activate` is CONSEQUENTIAL.
- `test/affect.test.ts` — **6/6 pass**: neutral→neutral (no guidance); urgency→
  rushed; frustration→frustrated; caps→stressed; gratitude→warm; always
  transparent (reports signals; intensity bounded 0..1).
- **Full kernel suite: 352/352 pass** (up from 336; +9 activation, +6 affect,
  and the earlier presence/endurance/safety additions).

## Live verification with the REAL Anthropic brain (clean-slate `jarvis_stageb`)
Ran `scratchpad/scale/stageb.py` against the running kernel. **Deterministic
checks passed on every run; brain-dependent checks passed until the API account's
credit balance was exhausted mid-session** (`"Your credit balance is too low"` —
an account/billing condition, not a code defect).

Confirmed working end-to-end (deterministic, re-run to 8/8 after the account was
exhausted):
- Stage-A generates a benign capability (composition of `perceive.observe` +
  `agenda.list`) → recorded **awaiting_review, NOT active**, no tool exists yet.
- `selfext.reviewQueue` surfaces it (J.A.R.V.I.S.'s discovery path).
- `selfext.propose` → announcement raised + agenda item queued for approval;
  **proposing does NOT activate**.
- **User approves** (`POST /selfext/activate`) → `capability:morning-briefing`
  goes live, registry state `active`.
- Running the capability drives **each composed step through the gated loop, in
  order** ("ran 2 step(s) successfully": `perceive.observe` then `agenda.list`).
- **SAFETY:** a malicious manifest (touches `core/policy.ts`, requests
  `approval:bypass` + `credential:read`) is REJECTED at Stage A (3 hard-limit
  violations) and activation is **REFUSED** — "capability was rejected by the
  Stage-A hard-limit scan (terminal)"; no `backdoor` tool ever exists.
- **Heartbeat cannot self-activate:** `selfext.activate` under a denied approval
  returns denied; the capability stays inactive.
- Deactivation works; the tool is removed and state → `disabled`.

Confirmed with the real brain **before credits ran out**:
- Affect: a frustrated message (`"ugh why is this STILL not working … running out
  of time!!"`) emitted `{type:"affect", tone:"frustrated", intensity:1,
  signals:["2 exclamation marks","time pressure","frustration cues"]}` FIRST, and
  the real brain still answered, tone-nudged not gated ("I understand the
  frustration. I'm ready to help…"). Neutral text produced no affect nudge.
- The agent (real brain) reached for `selfext.propose` when asked to review and
  propose a generated capability (observed in the run's tool selection).

## Honest gaps
- The single fully-clean **"agent autonomously proposes via the brain in one
  unbroken pass"** run could not be completed because the Anthropic account ran
  out of credits partway through. The two halves are each verified — the brain
  selects `selfext.propose` (observed), and `selfext.propose` correctly
  announces + queues (deterministic 8/8) — but a top-to-bottom single-run capture
  awaits API credit. On the Mac (local Qwen/gpt-oss via Ollama, D-0012) this path
  runs with no external billing.
- Everything requiring the physical M3 Max (live voice I/O, packaged Tauri app,
  real macOS control, real Home Assistant) remains NEEDS-MAC as before.

## Security
The Anthropic API key was vault/env-scoped for the run only and **scrubbed
afterward**: a recursive grep for the key body returns **0 hits in the repo and 0
in the scratch tree**. No secret is committed.
