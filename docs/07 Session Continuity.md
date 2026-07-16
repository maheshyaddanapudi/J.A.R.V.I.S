# 07 — Session Continuity

This build spans many sessions. At the start of every session after Phase 0, re-read `docs/IMPLEMENTATION_PLAN.md`, `docs/DECISION_LOG.md`, `docs/CAPABILITY_PARITY_MATRIX.md`, and the relevant `CLAUDE.md` before doing anything, and resume from the recorded current phase/slice — do not restart, re-scaffold, or re-propose already-approved decisions.

Treat the DECISION_LOG as binding unless I explicitly reopen a decision.

At the end of every session and every phase, update the implementation plan (current phase, current slice, what's done, what's next), decision log, parity matrix, traceability, and CLAUDE.md files so the next session can continue in-place.

If a new session's understanding conflicts with a recorded decision, surface the conflict at a check-in rather than silently diverging.

Start with Phase 0. Do not write production code until the architecture and parity matrix are approved at the first check-in.
