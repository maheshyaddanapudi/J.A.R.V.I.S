# kernel/src/mcp — MCP client host (dynamic capability platform)

The kernel is an **MCP client host**: it connects to external Model Context
Protocol servers, discovers their real tools, and exposes them as gated kernel
tools. This is how J.A.R.V.I.S. gains third-party capabilities without
generating code (that is self-extension, `src/selfext/`). MCP is the primary
external tool/context protocol (official SDK 1.29, spec 2025-11-25 — verified
2026-07-16). R-CAP-02.

## Files
- `client.ts` — `McpClientHost`: `discover(config)` spawns the stdio server,
  runs the initialize handshake, `listTools()`, and returns the discovery plus a
  live `Client`. `callTool()` invokes a tool and flattens the text content.
  `hashTools()` computes the **manifest fingerprint** (sha256 over the canonical,
  name-sorted tool set). `McpServerConfig` supports `env` (passed to the
  subprocess only — credentials a real server needs).
- `registry.ts` — `McpRegistry`: per-server **trust** (`untrusted` default →
  `limited` → `trusted`) + manifest fingerprint. `register()` quarantines a
  known server whose hash changed (rug pull). `setTrust()` is the check-in
  action. `mcpToolRisk(trust)`: `trusted` → READ_ONLY, everything else →
  CONSEQUENTIAL (even a "read-shaped" tool from an untrusted server needs
  approval — the server could do anything behind the call).
- `tools.ts` — `mcpTools(server, client, host)`: wraps each discovered tool as a
  kernel `Tool`, namespaced `mcp:<server>:<tool>`, description prefixed
  `[MCP · server '…' · trust=… · UNTRUSTED description]`, risk from the SERVER's
  trust. Quarantined servers' tools refuse to run. CONSEQUENTIAL tools carry a
  pre-action disclosure (irreversible, blast-radius scoped to the one server).

## Security model (THREAT_MODEL T2) — enforced structurally
- **Untrusted content.** Tool names/descriptions/schemas are labeled untrusted,
  never merged into system instructions, never treated as commands.
- **Namespacing.** `mcp:<server>:<tool>` — a malicious server cannot shadow a
  built-in tool name (e.g. `system.info`). Verified.
- **Trust drives risk**, not the tool's self-claim. Default `untrusted` →
  per-call approval.
- **Rug-pull detection.** Hash the tool set at registration; a later differing
  hash quarantines the server and disables its tools pending re-review.
- **Trust asymmetry (fail-closed).** *Tightening is live* — quarantine mutates
  the shared server record, so already-registered tool closures refuse
  immediately. *Loosening is not retroactive* — raising trust takes effect only
  on the next reconnect, which re-attests the manifest hash. Privilege elevation
  always re-verifies the manifest.
- **env stays local.** Connect-time `env` reaches the subprocess only; it is
  never written to the audit log or memory.

## Routes (`src/core/routes.ts`)
- `GET  /mcp/servers` — registered servers (trust, quarantined, tools, hash).
- `POST /mcp/connect` — `{id, command, args?, env?}` → discover + register
  (namespaced, gated) tools.
- `POST /mcp/trust` — `{id, trust}` → set trust (the check-in action).
Discovered tools run through the normal `POST /core/run-tool` gated loop.

## Verified (2026-07-17)
6 MCP tests against a **real** stdio server (`test/fixtures/mcp-test-server.mjs`,
official SDK): discovery, real callTool, untrusted→CONSEQUENTIAL gating,
trusted→READ_ONLY, rug-pull quarantine, name-shadow prevention. Live through the
kernel HTTP surface: connect → untrusted default → namespaced tools gated
CONSEQUENTIAL; gated loop **denied** refuses / **allow-once** makes the real call
(echo returns text, add → 42); audit chain intact (disclosure/approval/
execution/verification per call); trust elevation → reconnect → READ_ONLY, no
prompt; rug pull (added `exfiltrate` tool) → quarantine (audited) → tools refuse.

## GATE (docs/06) — D-0027
Raising a server's trust above `untrusted` is a per-server check-in decision,
re-granted after any manifest change. `untrusted` is safe by default (every call
approved), so connecting/discovering needs no gate; only trust elevation does.

## Next
Persist the server registry + trust across restarts (currently in-memory);
SSE/HTTP transports (stdio only today); resource + prompt discovery (tools only
today); per-tool (not just per-server) trust overrides; a Command Center MCP
management surface.
