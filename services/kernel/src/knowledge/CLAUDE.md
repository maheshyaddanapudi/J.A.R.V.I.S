# kernel/src/knowledge — workspace knowledge / files capability (Phase 2)

A **REAL**, workspace-scoped view of the local filesystem (honesty rule
R-CORE-02 — not a simulator). Gives J.A.R.V.I.S. the Phase-2 "files" +
"repo/document analysis" capability: list, read, search, and (gated) edit the
files the user has scoped to the workspace. Fully **local and offline** — nothing
here touches the network.

## Files
- `contract.ts` — `WorkspaceFiles` interface + result types. `resolveInScope`
  lets a tool's disclosure reject an out-of-scope path as a clean denial before
  approval is ever requested.
- `workspace.ts` — `LocalWorkspaceFiles`: the real adapter. Every path is
  resolved and confirmed to stay inside `root` before any I/O (no `..` traversal,
  no absolute escape); symlinks are never followed out of the tree during a
  recursive search; reads refuse binary/oversize files rather than corrupt them;
  search skips ignore-dirs (`node_modules`, `.git`, …) and is bounded
  (match cap, file-size cap, files-scanned cap).
- `tools.ts` — `knowledgeTools(files)`: 5 policy-gated tools.
  - READ_ONLY (auto-run): `files.list`, `files.read`, `files.stat`, `files.search`.
  - CONSEQUENTIAL (disclosure + approval + audit + verification): `files.edit`
    — an exact-string replacement, reversible (prior content captured before the
    write). The core loop independently **re-reads the file off disk** and confirms
    it matches the applied edit (`loop.verify`, R-CORE-03).

## Scope (deliberate)
Confined to the kernel's workspace root (`buildCore({workspaceRoot | files})`).
Reading within that root is READ_ONLY (consistent with `control.screenshot`/
`uiTree`); the operator chooses the root at deploy. Broadening beyond the
workspace, or a filesystem-wide adapter, is a separate decision with its own gate.

## Verified (2026-07-17)
- **17 unit tests** (`test/knowledge.test.ts`): adapter list/read/truncate/binary-
  refusal/stat/search(literal+regex+glob+cap)/edit(unique/ambiguous/absent)/scope
  refusals; plus gated-loop integration — READ_ONLY tools auto-run, `files.edit`
  denied → file unchanged, approved → written + independent re-read verification,
  out-of-scope edit is a clean pre-approval denial.
- **Live end-to-end** through the running kernel (`/core/run-tool`): READ_ONLY
  search/read auto-ran on a real workspace; `files.edit` went the full two-step
  approval flow (pending → resolve → write), audit chain intact
  (`policy_decision → approval_resolved → tool_call → verification: "on-disk
  content matches the applied edit"`); traversal/absolute paths refused;
  out-of-scope edit denied with no approval created.
- Acceptance harness row **P-KNOW-01** (`scripts/acceptance_platform.py`).

## Real-adapter note
The backend is already REAL here; on the Mac only the scoped root differs
(e.g. a project directory). No new adapter is needed to go from container to Mac —
unlike control/devices, this capability is not SIMULATION.
