import { createHash } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * MCP client host (R-CAP-02). Connects to a configured MCP server over stdio,
 * runs the initialize handshake, and discovers its tools. MCP is the primary
 * external tool/context protocol (spec 2025-11-25, SDK 1.29 — verified 2026-07-16).
 *
 * SECURITY (THREAT_MODEL T2): everything a server returns is UNTRUSTED. Tool
 * names/descriptions/schemas are treated as untrusted content — never merged
 * into system instructions and never auto-trusted. The server's tool set is
 * hashed so a changed manifest (a "rug pull") is detected and the server is
 * quarantined. Per-server trust levels gate how the discovered tools may run.
 */

export interface McpToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpDiscovery {
  serverId: string;
  tools: McpToolSpec[];
  /** sha256 over the canonical tool set — the server's manifest fingerprint */
  manifestHash: string;
  serverInfo: { name: string; version: string };
}

export interface McpServerConfig {
  id: string;
  /** command + args to launch the stdio server (local process) */
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export class McpClientHost {
  /** Connect, handshake, and list tools. Returns the discovery + a live client. */
  async discover(config: McpServerConfig): Promise<{ discovery: McpDiscovery; client: Client }> {
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args ?? [],
      ...(config.env ? { env: { ...process.env, ...config.env } as Record<string, string> } : {}),
    });
    const client = new Client(
      { name: "jarvis-mcp-host", version: "0.1.0" },
      { capabilities: {} },
    );
    await client.connect(transport);

    const listed = await client.listTools();
    const tools: McpToolSpec[] = listed.tools.map((t) => ({
      name: t.name,
      description: t.description ?? "",
      inputSchema: (t.inputSchema ?? {}) as Record<string, unknown>,
    }));

    const version = client.getServerVersion();
    return {
      client,
      discovery: {
        serverId: config.id,
        tools,
        manifestHash: hashTools(tools),
        serverInfo: { name: version?.name ?? config.id, version: version?.version ?? "?" },
      },
    };
  }

  async callTool(
    client: Client,
    name: string,
    args: unknown,
  ): Promise<{ ok: boolean; text: string; isError: boolean }> {
    const result = await client.callTool({ name, arguments: (args ?? {}) as Record<string, unknown> });
    const content = (result.content ?? []) as { type: string; text?: string }[];
    const text = content
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n");
    return { ok: !result.isError, text, isError: Boolean(result.isError) };
  }
}

/** Canonical hash of a server's tool set — its manifest fingerprint. */
export function hashTools(tools: McpToolSpec[]): string {
  const canon = JSON.stringify(
    [...tools]
      .sort((a, b) => (a.name < b.name ? -1 : 1))
      .map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
  );
  return createHash("sha256").update(canon).digest("hex");
}
