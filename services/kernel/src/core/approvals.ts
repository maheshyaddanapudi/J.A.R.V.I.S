import { randomUUID } from "node:crypto";
import type { AuditLog } from "./audit.js";

/**
 * Z1 TRUST CORE — PROTECTED PATH (R-CAP-08).
 *
 * Approval broker. A needs-approval decision creates a pending request the user
 * resolves (allow-once / deny / etc.) from any interface. Grants returned here
 * feed back into the policy engine (PRODUCT_SPEC §6.2).
 */
export type ApprovalResolution =
  | "allow-once"
  | "allow-for-task"
  | "allow-for-session"
  | "always-allow-in-scope"
  | "deny";

interface PendingApproval {
  id: string;
  tool: string;
  resourceScope: string | null;
  createdAt: number;
  resolve: (r: ApprovalResolution) => void;
}

export class ApprovalBroker {
  private pending = new Map<string, PendingApproval>();

  constructor(private readonly audit: AuditLog) {}

  create(tool: string, resourceScope: string | null): { id: string; wait: Promise<ApprovalResolution> } {
    const id = randomUUID();
    let resolveFn!: (r: ApprovalResolution) => void;
    const wait = new Promise<ApprovalResolution>((res) => {
      resolveFn = res;
    });
    this.pending.set(id, { id, tool, resourceScope, createdAt: Date.now(), resolve: resolveFn });
    return { id, wait };
  }

  async resolve(id: string, resolution: ApprovalResolution, via: string): Promise<boolean> {
    const req = this.pending.get(id);
    if (!req) return false;
    this.pending.delete(id);
    await this.audit.append({
      actor: "user",
      event: "approval_resolved",
      payload: { requestId: id, tool: req.tool, resolution, via },
    });
    req.resolve(resolution);
    return true;
  }

  list(): { id: string; tool: string; resourceScope: string | null; createdAt: number }[] {
    return [...this.pending.values()].map(({ id, tool, resourceScope, createdAt }) => ({
      id,
      tool,
      resourceScope,
      createdAt,
    }));
  }

  /** Deny everything pending — used when the emergency stop engages. */
  denyAll(via: string): void {
    for (const req of this.pending.values()) {
      this.pending.delete(req.id);
      void this.audit.append({
        actor: "kernel",
        event: "approval_auto_denied",
        payload: { requestId: req.id, tool: req.tool, reason: `estop:${via}` },
      });
      req.resolve("deny");
    }
  }
}
