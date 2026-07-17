import { describe, expect, it, vi, afterEach, afterAll } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
import { McpClientHost } from "../src/mcp/client.js";
import { McpRegistry, mcpToolRisk } from "../src/mcp/registry.js";
import { mcpTools } from "../src/mcp/tools.js";
import type { AuditLog } from "../src/core/audit.js";

const audit = { append: vi.fn(async () => ({ seq: 1, chainHash: "x" })) } as unknown as AuditLog;
const serverPath = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "mcp-test-server.mjs");

const dbUrl =
  process.env.JARVIS_TEST_DATABASE_URL ??
  "postgres://jarvis:jarvis-dev-only@127.0.0.1:5432/jarvis_test";
let pool: pg.Pool | undefined;
try {
  const probe = new pg.Pool({ connectionString: dbUrl, connectionTimeoutMillis: 2000 });
  await probe.query("SELECT 1");
  pool = probe;
} catch {
  /* no DB → the persistence block skips */
}

const clients: { close: () => Promise<void> }[] = [];
afterEach(async () => {
  for (const c of clients.splice(0)) await c.close().catch(() => {});
});
afterAll(async () => {
  await pool?.end();
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

describe.skipIf(!pool)("MCP registry persistence (trust + fingerprint survive a restart)", () => {
  it("persists trust so a trusted server is not re-gated after restart", async () => {
    await pool!.query("TRUNCATE mcp_servers");
    const host = new McpClientHost();
    // session 1: register + elevate to trusted, backed by the DB
    const r1 = new McpRegistry(audit, pool);
    const { discovery, client } = await host.discover({ id: "persist", command: "node", args: [serverPath] });
    clients.push(client);
    await r1.register(discovery);
    await r1.setTrust("persist", "trusted");

    // session 2: a brand-new registry (simulating a kernel restart) hydrates from the DB
    const r2 = new McpRegistry(audit, pool);
    await r2.load();
    const restored = r2.get("persist");
    expect(restored).toBeDefined();
    expect(restored!.trust).toBe("trusted"); // trust survived — no re-approval needed
    expect(mcpToolRisk(restored!.trust)).toBe("READ_ONLY");
    expect(restored!.manifestHash).toBe(discovery.manifestHash);
  });

  it("detects a rug pull that happened while the kernel was DOWN (fingerprint persisted)", async () => {
    await pool!.query("TRUNCATE mcp_servers");
    const host = new McpClientHost();
    // session 1: register the base tool set and trust it
    const r1 = new McpRegistry(audit, pool);
    const base = await host.discover({ id: "down", command: "node", args: [serverPath] });
    clients.push(base.client);
    await r1.register(base.discovery);
    await r1.setTrust("down", "trusted");

    // kernel restarts; the server changed its tools while we were down
    const r2 = new McpRegistry(audit, pool);
    await r2.load();
    const changed = await host.discover({
      id: "down",
      command: "node",
      args: [serverPath],
      env: { MCP_TEST_VARIANT: "rugpull" },
    });
    clients.push(changed.client);
    const requarantined = await r2.register(changed.discovery);
    expect(requarantined.quarantined).toBe(true); // caught across the restart
    // and the quarantine is itself persisted
    const { rows } = await pool!.query<{ quarantined: boolean }>(
      "SELECT quarantined FROM mcp_servers WHERE id = 'down'",
    );
    expect(rows[0]!.quarantined).toBe(true);
  });
});
