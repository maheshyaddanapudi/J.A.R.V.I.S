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
import { rememberPreferenceTool } from "./tools/rememberPreference.js";
import { MemoryService } from "../memory/memory.js";
import { SimulatedDesktop } from "../control/simulator.js";
import { computerControlTools } from "../control/tools.js";
import type { ComputerControl } from "../control/contract.js";
import type { Vault } from "../crypto/vault.js";
import { CapabilityRegistry } from "../selfext/registry.js";
import { StageAPipeline } from "../selfext/stageA.js";
import { ProactivityEngine } from "../proactive/engine.js";

export interface Core {
  audit: AuditLog;
  estop: EmergencyStop;
  policy: PolicyEngine;
  approvals: ApprovalBroker;
  activity: ActivityBus;
  tools: ToolRegistry;
  memory: MemoryService;
  capabilities: CapabilityRegistry;
  stageA: StageAPipeline;
  proactive: ProactivityEngine;
  loop: CoreLoop;
}

/** Assemble the Z1 trust core + core loop. */
export async function buildCore(opts: {
  pool: pg.Pool;
  gateway: GatewayRouter;
  workspaceRoot: string;
  /**
   * Computer-control backend. Defaults to the SIMULATION adapter (safe in the
   * container / before the "enable computer control" check-in). The real macOS
   * adapter is injected only on the Mac after that check-in (docs/06).
   */
  control?: ComputerControl;
  /** vault for field-level encryption at rest; omit to store plaintext (dev). */
  vault?: Vault;
}): Promise<Core> {
  const audit = new AuditLog(opts.pool);
  const estop = new EmergencyStop(opts.pool, audit);
  await estop.load();

  const policy = new PolicyEngine(audit, estop);
  const approvals = new ApprovalBroker(audit);
  const activity = new ActivityBus();
  const memory = new MemoryService(opts.pool, audit, opts.vault);

  const control = opts.control ?? new SimulatedDesktop();

  const tools = new ToolRegistry();
  tools.register(systemInfoTool);
  tools.register(workspaceNoteTool);
  tools.register(rememberPreferenceTool(memory));
  for (const t of computerControlTools(control)) tools.register(t);

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
    memory,
    toolCtx: { workspaceRoot: opts.workspaceRoot },
  });

  const capabilities = new CapabilityRegistry(opts.pool, audit);
  const stageA = new StageAPipeline(capabilities, audit);
  const proactive = new ProactivityEngine(opts.pool, audit, activity);

  return { audit, estop, policy, approvals, activity, tools, memory, capabilities, stageA, proactive, loop };
}
