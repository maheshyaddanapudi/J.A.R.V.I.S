import type pg from "pg";
import type { AuditLog } from "../core/audit.js";
import type { McpDiscovery, McpToolSpec } from "./client.js";

/**
 * MCP server registry + trust model (THREAT_MODEL T2). The user assigns each
 * server a trust level; default is `untrusted`. Trust level maps to how the
 * server's tools may run:
 *   - untrusted : every tool call is CONSEQUENTIAL → requires approval
 *   - limited   : read-shaped tools may auto-run when delegated; writes approve
 *   - trusted   : tools run per their own declared risk
 *
 * Manifest fingerprint: the tool set is hashed at registration. If a later
 * discovery's hash differs (a rug pull — the server changed its tools after we
 * trusted it), the server is QUARANTINED and its tools are disabled pending
 * re-review. This is the "changed manifest disables the server" rule.
 */

export type TrustLevel = "untrusted" | "limited" | "trusted";

export interface RegisteredServer {
  id: string;
  trust: TrustLevel;
  manifestHash: string;
  serverInfo: { name: string; version: string };
  tools: McpToolSpec[];
  quarantined: boolean;
  registeredAt: number;
}

interface McpServerRow {
  id: string;
  trust: TrustLevel;
  manifest_hash: string;
  server_info: { name: string; version: string };
  tools: McpToolSpec[];
  quarantined: boolean;
  registered_at: string;
}

export class McpRegistry {
  private servers = new Map<string, RegisteredServer>();

  /**
   * `pool` is optional: when present, trust + manifest fingerprint + quarantine
   * state are persisted (migration 0007) so they survive a kernel restart —
   * without it the registry is purely in-memory (used by the unit tests). The
   * DB is the source of truth for the security-relevant fields; the in-memory
   * map is a hydrated cache loaded by `load()` at startup.
   */
  constructor(
    private readonly audit: AuditLog,
    private readonly pool?: pg.Pool,
  ) {}

  /** Hydrate the in-memory map from the persisted registry (call once at startup). */
  async load(): Promise<void> {
    if (!this.pool) return;
    const { rows } = await this.pool.query<McpServerRow>(
      `SELECT id, trust, manifest_hash, server_info, tools, quarantined,
              registered_at::text AS registered_at
         FROM mcp_servers`,
    );
    for (const r of rows) {
      this.servers.set(r.id, {
        id: r.id,
        trust: r.trust,
        manifestHash: r.manifest_hash,
        serverInfo: r.server_info,
        tools: r.tools,
        quarantined: r.quarantined,
        registeredAt: Date.parse(r.registered_at),
      });
    }
  }

  private async persist(server: RegisteredServer): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO mcp_servers
         (id, trust, manifest_hash, server_info, tools, quarantined, registered_at, updated_at)
       VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6, to_timestamp($7/1000.0), now())
       ON CONFLICT (id) DO UPDATE SET
         trust = EXCLUDED.trust,
         manifest_hash = EXCLUDED.manifest_hash,
         server_info = EXCLUDED.server_info,
         tools = EXCLUDED.tools,
         quarantined = EXCLUDED.quarantined,
         updated_at = now()`,
      [
        server.id,
        server.trust,
        server.manifestHash,
        JSON.stringify(server.serverInfo),
        JSON.stringify(server.tools),
        server.quarantined,
        server.registeredAt,
      ],
    );
  }

  /**
   * Register (or re-verify) a discovered server. If the id is known and the
   * manifest hash changed, quarantine it. New servers default to `untrusted`.
   * The known-server comparison uses the persisted fingerprint, so a manifest
   * change that occurred while the kernel was down is still caught on reconnect.
   */
  async register(discovery: McpDiscovery, trust: TrustLevel = "untrusted"): Promise<RegisteredServer> {
    const existing = this.servers.get(discovery.serverId);
    if (existing && existing.manifestHash !== discovery.manifestHash) {
      existing.quarantined = true;
      existing.tools = discovery.tools;
      existing.manifestHash = discovery.manifestHash;
      await this.persist(existing);
      await this.audit.append({
        actor: "kernel",
        event: "mcp_server_quarantined",
        payload: {
          serverId: discovery.serverId,
          reason: "manifest hash changed after registration (possible rug pull)",
        },
      });
      return existing;
    }

    const server: RegisteredServer = {
      id: discovery.serverId,
      trust: existing?.trust ?? trust,
      manifestHash: discovery.manifestHash,
      serverInfo: discovery.serverInfo,
      tools: discovery.tools,
      quarantined: false,
      registeredAt: existing?.registeredAt ?? Date.now(),
    };
    this.servers.set(server.id, server);
    await this.persist(server);
    await this.audit.append({
      actor: "kernel",
      event: "mcp_server_registered",
      payload: {
        serverId: server.id,
        trust: server.trust,
        toolCount: server.tools.length,
        manifestHash: server.manifestHash,
      },
    });
    return server;
  }

  /** User sets the trust level (a check-in decision for anything above untrusted). */
  async setTrust(serverId: string, trust: TrustLevel): Promise<boolean> {
    const server = this.servers.get(serverId);
    if (!server) return false;
    server.trust = trust;
    server.quarantined = false; // re-approving clears quarantine
    await this.persist(server);
    await this.audit.append({
      actor: "user",
      event: "mcp_trust_set",
      payload: { serverId, trust },
    });
    return true;
  }

  get(serverId: string): RegisteredServer | undefined {
    return this.servers.get(serverId);
  }

  list(): RegisteredServer[] {
    return [...this.servers.values()];
  }
}

/** Risk class for an MCP tool given the server's trust level. */
export function mcpToolRisk(
  trust: TrustLevel,
): "READ_ONLY" | "CONSEQUENTIAL" {
  // Even a "read-shaped" tool from an untrusted server is treated as
  // consequential — the server could do anything behind the call. Only a
  // trusted server's tools may run without per-call approval.
  return trust === "trusted" ? "READ_ONLY" : "CONSEQUENTIAL";
}
