import type pg from "pg";
import type { GatewayRouter } from "../gateway/router.js";
import { ActivityBus } from "./activity.js";
import { ApprovalBroker } from "./approvals.js";
import { AuditLog } from "./audit.js";
import { EmergencyStop } from "./estop.js";
import { CoreLoop } from "./loop.js";
import { PolicyEngine } from "./policy.js";
import { ToolRegistry } from "./tools.js";
import { systemInfoTool } from "./tools/systemInfo.js";
import { workspaceNoteTool } from "./tools/workspaceNote.js";

export interface Core {
  audit: AuditLog;
  estop: EmergencyStop;
  policy: PolicyEngine;
  approvals: ApprovalBroker;
  activity: ActivityBus;
  tools: ToolRegistry;
  loop: CoreLoop;
}

/** Assemble the Z1 trust core + core loop. */
export async function buildCore(opts: {
  pool: pg.Pool;
  gateway: GatewayRouter;
  workspaceRoot: string;
}): Promise<Core> {
  const audit = new AuditLog(opts.pool);
  const estop = new EmergencyStop(opts.pool, audit);
  await estop.load();

  const policy = new PolicyEngine(audit, estop);
  const approvals = new ApprovalBroker(audit);
  const activity = new ActivityBus();

  const tools = new ToolRegistry();
  tools.register(systemInfoTool);
  tools.register(workspaceNoteTool);

  // When e-stop engages, deny everything pending and announce it.
  estop.onChange((engaged) => {
    if (engaged) approvals.denyAll("estop");
    activity.emit({ kind: "estop", engaged, at: new Date().toISOString() });
  });

  const loop = new CoreLoop({
    gateway: opts.gateway,
    policy,
    tools,
    audit,
    estop,
    approvals,
    activity,
    toolCtx: { workspaceRoot: opts.workspaceRoot },
  });

  return { audit, estop, policy, approvals, activity, tools, loop };
}
