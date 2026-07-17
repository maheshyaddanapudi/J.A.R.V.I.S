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

export class McpRegistry {
  private servers = new Map<string, RegisteredServer>();

  constructor(private readonly audit: AuditLog) {}

  /**
   * Register (or re-verify) a discovered server. If the id is known and the
   * manifest hash changed, quarantine it. New servers default to `untrusted`.
   */
  async register(discovery: McpDiscovery, trust: TrustLevel = "untrusted"): Promise<RegisteredServer> {
    const existing = this.servers.get(discovery.serverId);
    if (existing && existing.manifestHash !== discovery.manifestHash) {
      existing.quarantined = true;
      existing.tools = discovery.tools;
      existing.manifestHash = discovery.manifestHash;
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
