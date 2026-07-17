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
import { StarkResidence } from "../devices/simulator.js";
import { InterlockManager } from "../devices/interlock.js";
import { deviceTools } from "../devices/tools.js";
import type { DeviceGateway } from "../devices/contract.js";
import { McpClientHost } from "../mcp/client.js";
import { McpRegistry } from "../mcp/registry.js";
import { mcpTools } from "../mcp/tools.js";
import type { McpServerConfig } from "../mcp/client.js";

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
  mcp: McpRegistry;
  /** discover a configured MCP server and register its (namespaced, gated) tools */
  connectMcp: (config: McpServerConfig) => Promise<{ serverId: string; tools: number; trust: string }>;
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
  /**
   * Device gateway. Defaults to the Stark-residence SIMULATION (safe in the
   * container / before the "enable physical-device control" check-in). The real
   * Home Assistant gateway is injected only on the Mac after that check-in.
   */
  devices?: DeviceGateway;
}): Promise<Core> {
  const audit = new AuditLog(opts.pool);
  const estop = new EmergencyStop(opts.pool, audit);
  await estop.load();

  const policy = new PolicyEngine(audit, estop);
  const approvals = new ApprovalBroker(audit);
  const activity = new ActivityBus();
  const memory = new MemoryService(opts.pool, audit, opts.vault);

  const control = opts.control ?? new SimulatedDesktop();
  const devices = opts.devices ?? new StarkResidence();
  const interlock = new InterlockManager(audit);

  const tools = new ToolRegistry();
  tools.register(systemInfoTool);
  tools.register(workspaceNoteTool);
  tools.register(rememberPreferenceTool(memory));
  for (const t of computerControlTools(control)) tools.register(t);
  for (const t of deviceTools(devices, interlock)) tools.register(t);

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

  // MCP client host — discover external servers on demand; their tools are
  // registered namespaced + trust-gated (untrusted by default, T2).
  const mcpHost = new McpClientHost();
  const mcp = new McpRegistry(audit, opts.pool);
  await mcp.load(); // hydrate persisted trust + manifest fingerprints (survives restart)
  const connectMcp = async (config: McpServerConfig) => {
    const { discovery, client } = await mcpHost.discover(config);
    const server = await mcp.register(discovery);
    for (const t of mcpTools(server, client, mcpHost)) tools.register(t);
    return { serverId: server.id, tools: server.tools.length, trust: server.trust };
  };

  return {
    audit, estop, policy, approvals, activity, tools, memory,
    capabilities, stageA, proactive, mcp, connectMcp, loop,
  };
}
