# Chat-parity audit — what is guaranteed, what was verified, what is not

**Date:** 2026-07-19 · **Trigger:** the user asked three hard questions: (1) can
1-1 parity to movie J.A.R.V.I.S. be *guaranteed* over chat, (2) where are the
Command Center screenshots and does every action button really work — normal UI
**and** A2UI, (3) what was *truly* verified vs. still gapped, especially
self-evolution. This document is the evidence-backed answer, including the gaps
the audit itself found and closed.

---

## 1. Can 1-1 chat parity be "guaranteed"? The honest answer

**What CAN be stated as verified fact:** every *behavior class* movie
J.A.R.V.I.S. exhibits that is expressible over a chat interface exists here as a
real, tested mechanism, reachable from chat, all funneling through ONE gated
loop (`runTool`/`runConversation` — chat, voice, UI panels, A2UI actions, HTTP
API, and heartbeat are all the same choke point, so "the other interfaces are
just interfaces" is architecturally true and test-enforced):

| Movie behavior | Mechanism | Evidence |
|---|---|---|
| Converses with personality, remembers you | persona registry + conversation/semantic/episodic/graph memory, encrypted at rest | 355-test suite; UI audit rows 5, 16–18; earlier 106-session/744-turn evolution run |
| Acts (files, terminal, web, research, computer, devices, MCP) | gated tools, REAL where honest, SIMULATION labeled where hardware-dependent | audit rows 8–15 (real file edit verified on disk; dangerous command refused; interlock enforced) |
| Multi-step agency | agent runtime through the gated loop | audit row 7; agent tests |
| Speaks up unprompted, dissents, keeps long-horizon projects, self-schedules | announcer/concern, projects, agenda + heartbeat | D-0068/69/64 records; pulse UI audit |
| Reads your tone | affect layer (opt-in, text-only, transparent) | D-0072 record, 24/25 live run with real brain |
| Learns and self-tunes | reasoning tuner, sleep-cycle consolidation, D-0052 override contract | D-0050/51/63 records |
| **Extends itself** | full loop: gap → draft → scan → propose → approve → activate → use | **11/11 live run, this audit (below)** |

**What CANNOT be honestly guaranteed, by anyone:** the fictional character's
*intelligence quality* — omniscient wit, perfect judgment, superhuman speed. The
real system's judgment quality equals whatever model serves its gateway roles.
With Sonnet-class models it was verified good (earlier live runs); with the
container's test stub it is plumbing-grade only. Physical-world behaviors
(holograms, suit ops, real home control) are HARDWARE-DEPENDENT or SIMULATION by
the user-approved five-state matrix (D-0003) — that is parity *of scope
labeling*, not pretense. **Claim, precisely: 1-1 parity of chat-expressible
behavior mechanisms — verified. Parity of fictional intelligence — not
guaranteeable, model-bound.**

Constraint at audit time: the Anthropic account ran out of credits mid-session,
so this audit's UI/agent runs used the labeled openai-compat **test stub** (real
SSE server, canned reply) for the brain. All gating/memory/activation machinery
is model-independent and was driven for real; brain-choice behaviors (agent
*choosing* selfext tools, affect-nudged replies) were verified with the real
Anthropic brain earlier this same day (STAGE_B_AFFECT record) before credits ran
out.

---

## 2. Screenshots + does every button work?

**Where:** committed in-repo. `docs/screenshots/` (19 panels, 2026-07-17/18
eras, incl. `final/` from the 106-session run) and now
**`docs/screenshots/audit/` — 21 fresh full-page screenshots (00–20), one per
Command Center page**, taken during this audit while the buttons were being
driven.

**Button audit result: 46 checks + 8-check focused retest → every flow passes.**
Highlights (each cross-checked against kernel state, not just pixels):

- Dashboard: secret stored → name-only listing (value never returned) → forgot;
  **e-stop button really engages the kernel latch, RESUME clears it**.
- Chat: real `/core/converse` SSE streamed a reply; reasoning badge shown.
- Files: search → view → propose edit → inline approve → **file on disk really
  changed** (kernel re-read: `MARK ALPHA → MARK BRAVO`).
- Terminal: read-only inspect returned real output; `sudo rm -rf /` **refused
  outright**. Web: `file://` refused by scheme guard.
- Devices: unlock without interlock **refused**; arm → unlock → approve worked.
- Settings: edit → "set by user" ledger badge → kernel value really changed →
  reset restored default. Models: live role re-route applied + cleared from UI.
- Memory/graph/reasoning/proactive/skills/persona/pulse: all CRUD + run flows
  drove real kernel state (topic taught + forgotten, rule created + deleted,
  skill saved/ran/deleted, persona activated/deleted, agenda item added).
- **Self-extension (new Stage-B surface)**: benign proposal → review queue →
  **approve + activate click → capability live (kernel-confirmed) → run
  executed its composition → deactivate**; malicious proposal → REJECTED with
  named violations.
- **A2UI generated panel — the key parity question**: `setting` and
  `settingsGroup` editors mutate the real settings ledger, and the `action`
  button **files a pending approval through the same broker** (it does NOT
  execute directly); approving on the dashboard then really ran the tool
  (announcement landed in the kernel). Generated UI is neither weaker nor more
  privileged than the built-in UI — same gate, verified end-to-end.

4 first-pass failures were investigated, not waved off: 3 were audit-script
selector/assertion errors (reasoning's forget is a ✕ button; orb's idle label is
"Standing by"; skills' run needed row-scoping), 1 was the A2UI approval design
(above) asserted too early. All 4 re-driven to pass with the full flows.

---

## 3. Self-evolution: what the audit found missing, and what runs now

**Found missing (real gap):** Stage-A/Stage-B could scan, propose, and activate
capabilities — but nothing in the container let J.A.R.V.I.S. *author* one. The
"generator" was Mac-deferred, so the loop's first link didn't exist over chat.
Also, no gated tool let it record capability gaps itself (HTTP route only).

**Closed this session (within the approved D-0073 envelope):**
- `selfext.draft` (LOW_REVERSIBLE): J.A.R.V.I.S. composes a NEW named capability
  from its existing gated tools — composition-only (`files:[]`,
  `permissions:[]` forced — strictly narrower than what Stage A already
  accepted); unknown/denylisted tools and secret-shaped args refused; declared
  risk = honest ceiling of its steps; guard-scanned; lands `awaiting_review`,
  never activates.
- `selfext.recordGap` (LOW_REVERSIBLE): records genuine gaps, redacted.
- Hard-limit hardening: `findHardLimitViolations` now scans compositions
  (`protected_composition`) — a denylisted composition is **terminally rejected
  at Stage A**, not merely refused at activation.
- Command Center `/selfext` rebuilt for Stage B: review queue with **approve +
  activate** (the click IS the approval, through the CONSEQUENTIAL gate), active
  list with run/deactivate.

**Live end-to-end run (11/11, this kernel, gated chat path):** gap recorded →
capability drafted by J.A.R.V.I.S. itself → hostile draft refused → review queue
→ proposed (announcement + agenda) → *not* active → heartbeat activation attempt
DENIED → user approval → ACTIVATED → the new `capability:situation-report` tool
ran its composition through the gated loop → audit hash-chain intact.

**Still honestly gapped (self-evolution):**
1. **Novel-code capabilities**: drafts compose *existing* tools. A capability
   needing genuinely new code (new API integration, new algorithm) still needs
   the Mac-hosted out-of-process sandboxed generator + dep/SBOM/license scans
   (planned, R-CAP-05 scope). In-container, such needs land in the gap ledger.
2. **Observe-first-executions with auto-rollback, signed artifacts, capability
   versioning/upgrade** — activation hardening still to build.
3. **Unbroken real-brain demonstration** of the agent spontaneously drafting +
   proposing in one pass — blocked only by API credits; both halves verified
   (brain selects selfext tools: earlier live run; machinery: 11/11 now).
4. Beyond self-evolution: the 4 NEEDS-MAC rows (live voice, packaged app, real
   macOS control, real Home Assistant) and Mac-only perception/affect-prosody.

## Test/build state
355/355 kernel tests (12 activation incl. draft/gap/hard-limit-composition).
No secrets used this run (stub brain); earlier key remains scrubbed (0 hits).
