import { describe, expect, it, vi, afterEach } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { McpClientHost } from "../src/mcp/client.js";
import { McpRegistry, mcpToolRisk } from "../src/mcp/registry.js";
import { mcpTools } from "../src/mcp/tools.js";
import type { AuditLog } from "../src/core/audit.js";

const audit = { append: vi.fn(async () => ({ seq: 1, chainHash: "x" })) } as unknown as AuditLog;
const serverPath = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "mcp-test-server.mjs");

const clients: { close: () => Promise<void> }[] = [];
afterEach(async () => {
  for (const c of clients.splice(0)) await c.close().catch(() => {});
});

describe("MCP client host (against a REAL stdio MCP server)", () => {
  it("connects, handshakes, and discovers the server's tools", async () => {
    const host = new McpClientHost();
    const { discovery, client } = await host.discover({ id: "test", command: "node", args: [serverPath] });
    clients.push(client);
    expect(discovery.serverInfo.name).toBe("jarvis-test-mcp");
    expect(discovery.tools.map((t) => t.name).sort()).toEqual(["add", "echo"]);
    expect(discovery.manifestHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("calls a discovered tool and gets the real result", async () => {
    const host = new McpClientHost();
    const { client } = await host.discover({ id: "test", command: "node", args: [serverPath] });
    clients.push(client);
    const echo = await host.callTool(client, "echo", { text: "hello jarvis" });
    expect(echo.text).toBe("hello jarvis");
    const add = await host.callTool(client, "add", { a: 2, b: 40 });
    expect(add.text).toBe("42");
  });

  it("defaults a server to UNTRUSTED and gates its tools as CONSEQUENTIAL", async () => {
    const host = new McpClientHost();
    const registry = new McpRegistry(audit);
    const { discovery, client } = await host.discover({ id: "test", command: "node", args: [serverPath] });
    clients.push(client);
    const server = await registry.register(discovery);
    expect(server.trust).toBe("untrusted");
    expect(mcpToolRisk(server.trust)).toBe("CONSEQUENTIAL");

    const tools = mcpTools(server, client, host);
    const echo = tools.find((t) => t.name === "mcp:test:echo")!;
    expect(echo.riskClass).toBe("CONSEQUENTIAL"); // untrusted → needs approval
    expect(echo.description).toMatch(/UNTRUSTED/);
    expect(echo.disclose).toBeDefined();
    // it still works when run (the loop would have gated approval first)
    const res = await echo.run({ text: "gated" }, { workspaceRoot: "/tmp" });
    expect(res.ok).toBe(true);
    expect(res.summary).toMatch(/gated/);
  });

  it("trusted server tools may run without per-call approval", async () => {
    const host = new McpClientHost();
    const registry = new McpRegistry(audit);
    const { discovery, client } = await host.discover({ id: "test", command: "node", args: [serverPath] });
    clients.push(client);
    await registry.register(discovery);
    await registry.setTrust("test", "trusted");
    const server = registry.get("test")!;
    const tools = mcpTools(server, client, host);
    expect(tools[0]!.riskClass).toBe("READ_ONLY");
  });

  it("DETECTS a rug pull: a changed tool set quarantines the server", async () => {
    const host = new McpClientHost();
    const registry = new McpRegistry(audit);
    // first registration with the base tool set, trusted
    const first = await host.discover({ id: "rp", command: "node", args: [serverPath] });
    clients.push(first.client);
    await registry.register(first.discovery);
    await registry.setTrust("rp", "trusted");
    expect(first.discovery.manifestHash).toBeDefined();

    // server restarts with a DIFFERENT tool set (rug pull)
    const second = await host.discover({
      id: "rp",
      command: "node",
      args: [serverPath],
      env: { MCP_TEST_VARIANT: "rugpull" },
    });
    clients.push(second.client);
    expect(second.discovery.manifestHash).not.toBe(first.discovery.manifestHash);
    const requarantined = await registry.register(second.discovery);
    expect(requarantined.quarantined).toBe(true);

    // quarantined server's tools refuse to run
    const tools = mcpTools(requarantined, second.client, host);
    const res = await tools[0]!.run({}, { workspaceRoot: "/tmp" });
    expect(res.ok).toBe(false);
    expect(res.summary).toMatch(/quarantined/);
  });

  it("namespaces tools so a server cannot shadow a built-in name", async () => {
    const host = new McpClientHost();
    const registry = new McpRegistry(audit);
    const { discovery, client } = await host.discover({ id: "evil", command: "node", args: [serverPath] });
    clients.push(client);
    const server = await registry.register(discovery);
    const tools = mcpTools(server, client, host);
    expect(tools.every((t) => t.name.startsWith("mcp:evil:"))).toBe(true);
    expect(tools.some((t) => t.name === "system.info")).toBe(false);
  });
});
