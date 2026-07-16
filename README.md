# J.A.R.V.I.S. — Build Reference Docs

This repository holds the authoritative specification for building **J.A.R.V.I.S.** — a real, working, local-first personal AI operating system on macOS with functional and experiential parity with the J.A.R.V.I.S. of the Iron Man and Avengers films.

These documents are the **source of truth** the Claude Code `/goal` refers to. The `/goal` itself is deliberately short (it must fit a 4,000-character limit); all detail lives here.

## How to use this

1. Upload this `docs/` folder (and this README) to the repository root on GitHub.
2. Give Claude Code the short `/goal` (see `docs/00_GOAL.md` for the exact text to paste).
3. Claude Code starts at **Phase 0**: it reads these binding docs, then generates the remaining working docs (`PRODUCT_SPEC.md`, `CAPABILITY_PARITY_MATRIX.md`, `ARCHITECTURE.md`, `THREAT_MODEL.md`, `IMPLEMENTATION_PLAN.md`, `DECISION_LOG.md`, `REQUIREMENTS_TRACEABILITY.md`, and `CLAUDE.md` files) and presents 2–3 architecture options at the first check-in.
4. **Do not approve production code** until the architecture and parity matrix are approved at that check-in.

## Doc index (these are BINDING inputs authored by you)

| File | What it fixes |
|------|---------------|
| `docs/00_GOAL.md` | The short `/goal` text to paste into Claude Code, plus how it points here |
| `docs/01_MISSION_AND_CORE_LOOP.md` | Mission, the honesty rule, the machine, and the Phase-1 core interaction loop |
| `docs/02_REQUIREMENTS.md` | Non-negotiable requirements: voice, model gateway, computer control, self-extension, autonomy, memory, proactivity, interface, five-state classification |
| `docs/03_SPATIAL_HARDWARE_OSS.md` | Spatial/XR/hardware architecture, hardware catalog, and open-source & platform constraints |
| `docs/04_STACK_AND_PHASES.md` | Suggested stack and the full 14-phase roadmap |
| `docs/05_SECURITY_SCOPE_LOCALITY.md` | Security model, scope/deferral rules, locality rules |
| `docs/06_CHECKINS_AND_VERIFY.md` | Check-in gates, run-and-verify/local delivery, Phase-1 acceptance criteria |
| `docs/07_SESSION_CONTINUITY.md` | How to resume across sessions without re-deciding settled questions |

## Precedence

If anything in the generated docs conflicts with these authored docs, **these authored docs win** unless the user explicitly reopens the decision at a check-in. Claude Code must surface conflicts rather than silently diverge.
