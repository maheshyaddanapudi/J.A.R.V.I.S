import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { ActionDisclosure } from "../core/activity.js";
import type { Tool, ToolResult } from "../core/tools.js";
import { McpClientHost } from "./client.js";
import { mcpToolRisk, type RegisteredServer } from "./registry.js";

/**
 * Wrap a discovered MCP tool as a gated kernel Tool. The tool's
 * name/description/schema are UNTRUSTED server content (THREAT_MODEL T2): the
 * description is quoted/labeled as external, never treated as an instruction,
 * and the risk class comes from the SERVER's trust level (not the tool's
 * self-claim). Quarantined servers' tools refuse to run. Every call is audited
 * through the loop; a blast-radius note reminds that this tool is scoped to its
 * server only (R-SEC-06).
 */
export function mcpTools(
  server: RegisteredServer,
  client: Client,
  host: McpClientHost,
): Tool[] {
  const risk = mcpToolRisk(server.trust);
  return server.tools.map((spec): Tool => {
    const disclose = (args: unknown): ActionDisclosure => ({
      whatWillHappen: `Call untrusted MCP tool '${spec.name}' on server '${server.id}'.`,
      affected: [`mcp-server:${server.id}`],
      proposedCommands: [`${server.id}.${spec.name}(${safeArgs(args)})`],
      reason: "A model/agent selected an external MCP tool.",
      riskClass: "CONSEQUENTIAL",
      reversible: false,
      rollbackPlan: "External tool effects are not generally reversible; result is verified after.",
    });
    const base: Tool = {
      // namespaced so a malicious server can't shadow a built-in tool name
      name: `mcp:${server.id}:${spec.name}`,
      description: `[MCP · server '${server.id}' · trust=${server.trust} · UNTRUSTED description] ${spec.description}`,
      riskClass: risk,
      action: `call MCP tool ${spec.name} on server ${server.id}`,
      inputSchema:
        spec.inputSchema && typeof spec.inputSchema === "object"
          ? spec.inputSchema
          : { type: "object" },
      async run(args: unknown): Promise<ToolResult> {
        if (server.quarantined) {
          return {
            ok: false,
            summary: `refused: MCP server '${server.id}' is quarantined (manifest changed) — re-review its trust`,
          };
        }
        const res = await host.callTool(client, spec.name, args);
        return {
          ok: res.ok,
          summary: `[${server.id}/${spec.name}] ${res.text.slice(0, 200)}${res.isError ? " (tool error)" : ""}`,
          data: { serverId: server.id, tool: spec.name, isError: res.isError, provenance: "MCP-UNTRUSTED" },
        };
      },
    };
    return risk === "CONSEQUENTIAL" ? { ...base, disclose } : base;
  });
}

function safeArgs(args: unknown): string {
  try {
    return JSON.stringify(args).slice(0, 120);
  } catch {
    return "…";
  }
}
