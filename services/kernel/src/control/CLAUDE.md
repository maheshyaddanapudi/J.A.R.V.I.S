# kernel/src/control — computer-control HAL (Phase 2 foundation)

Typed macOS computer-control abstraction (R-CTRL). Two backends behind one
contract (`contract.ts`); the kernel is backend-agnostic.

## Files
- `contract.ts` — `ComputerControl` interface: listApps/listWindows/uiTree/
  screenshot/readClipboard (READ_ONLY), activateApp/performAction/setValue/
  typeText/writeClipboard (actions). Semantic-first selectors (AX id/title/role),
  coordinates only as a flagged fallback. Every result carries `provenance`.
- `simulator.ts` — `SimulatedDesktop`: labeled SIMULATION over a real, mutable
  in-memory virtual desktop (Notes/Settings apps). Verification observes actual
  state change. Used in-container and CI. **Never presented as a real machine.**
- `tools.ts` — 5 policy-gated control tools: control.listApps/uiTree/screenshot
  (READ_ONLY, auto-run) and control.pressElement/setValue (CONSEQUENTIAL —
  disclosure + approval + audit + verification). Provenance surfaced on each call.

## Real macOS adapter
`apps/companion/swift/Sources/JarvisControl/MacDesktop.swift` — AXUIElement +
CGEvent + NSWorkspace, same operations. Builds on macOS; requires the
Accessibility TCC grant.

## GATE (docs/06)
Wiring the REAL macOS adapter as the live backend requires the **"before
enabling computer control" check-in** (DECISION_LOG D-0022). In-container the
kernel defaults to `SimulatedDesktop`; the real adapter is injected via
`buildCore({control})` only on the Mac after that check-in.

## Status
Phase 2 slice 2.1 foundation — SIMULATION path built + tested + verified through
the gated loop (10 control tests; live approve/deny/audit verified). Real adapter
source written. Screen understanding, browser automation, terminal, files, and
the AX adapter's live activation are the rest of Phase 2.
