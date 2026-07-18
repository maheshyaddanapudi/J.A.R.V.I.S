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
import { LocalWorkspaceFiles } from "../knowledge/workspace.js";
import { knowledgeTools } from "../knowledge/tools.js";
import type { WorkspaceFiles } from "../knowledge/contract.js";
import { PlaywrightBrowser } from "../web/playwright.js";
import { webTools } from "../web/tools.js";
import type { WebBrowser } from "../web/contract.js";
import { LocalTerminal } from "../terminal/runner.js";
import { terminalTools } from "../terminal/tools.js";
import type { TerminalRunner } from "../terminal/contract.js";
import { WebResearcher } from "../research/gather.js";
import { researchTools } from "../research/tools.js";
import { EntityMemory } from "../memory/entities.js";
import { entityMemoryTools } from "../memory/entityTools.js";
import { EpisodicMemory } from "../memory/episodes.js";
import { episodeMemoryTools } from "../memory/episodeTools.js";
import { SemanticMemory } from "../memory/semantic.js";
import type { Vault } from "../crypto/vault.js";
import { SecretsVault } from "../crypto/secrets.js";
import { CapabilityRegistry } from "../selfext/registry.js";
import { StageAPipeline } from "../selfext/stageA.js";
import { ProactivityEngine } from "../proactive/engine.js";
import { ProactiveRules } from "../proactive/rules.js";
import { StarkResidence } from "../devices/simulator.js";
import { InterlockManager } from "../devices/interlock.js";
import { deviceTools } from "../devices/tools.js";
import type { DeviceGateway } from "../devices/contract.js";
import { McpClientHost } from "../mcp/client.js";
import { McpRegistry } from "../mcp/registry.js";
import { mcpTools } from "../mcp/tools.js";
import type { McpServerConfig } from "../mcp/client.js";
import { ContextService } from "../context/service.js";
import { LocalAgentRuntime } from "../agent/runtime.js";
import type { AgentRuntime } from "../agent/contract.js";
import { SkillRegistry } from "../skills/registry.js";
import { PromptRegistry } from "../prompts/registry.js";
import { ReasoningTuner } from "./reasoning.js";
import { DecisionLog, SleepCycle } from "./consolidation.js";
import { SettingsRegistry } from "../settings/registry.js";
import { SETTINGS_CATALOG } from "../settings/catalog.js";
import { settingsTools } from "../settings/tools.js";
import { DurableGrants } from "./grants.js";
import { BackgroundScheduler } from "../autonomy/scheduler.js";
import { loadRoleOverrides } from "../gateway/overrides.js";
import { gatewayTools, reasoningTools } from "../gateway/tools.js";

export interface Core {
  audit: AuditLog;
  estop: EmergencyStop;
  policy: PolicyEngine;
  approvals: ApprovalBroker;
  activity: ActivityBus;
  tools: ToolRegistry;
  memory: MemoryService;
  /** semantic knowledge store (entities/facts/relations), encrypted at rest */
  entityMemory: EntityMemory;
  /** episodic memory — the recallable timeline of notable events, encrypted at rest */
  episodicMemory: EpisodicMemory;
  reasoningTuner: ReasoningTuner;
  sleepCycle: SleepCycle;
  settings: SettingsRegistry;
  durableGrants: DurableGrants;
  autonomy: BackgroundScheduler;
  capabilities: CapabilityRegistry;
  stageA: StageAPipeline;
  proactive: ProactivityEngine;
  /** user-defined proactivity rules (what J.A.R.V.I.S. is proactive about) — R-CAP-01 */
  proactiveRules: ProactiveRules;
  mcp: McpRegistry;
  /** discover a configured MCP server and register its (namespaced, gated) tools */
  connectMcp: (config: McpServerConfig) => Promise<{ serverId: string; tools: number; trust: string }>;
  /** managed integration-credential store (encrypted at rest); undefined without a vault */
  secrets?: SecretsVault;
  /** situational-awareness aggregator (read-only) */
  context: ContextService;
  /** multi-step plan-and-act runtime (jarvis-mind); orchestrates through the gated loop */
  agent: AgentRuntime;
  /** user-defined skills (saved named objectives run via the agent) — R-CAP-01 */
  skills: SkillRegistry;
  /** prompts/personas registry — user-editable "how J.A.R.V.I.S. speaks" (R-CAP-01) */
  prompts: PromptRegistry;
  /** REAL workspace-scoped filesystem (read models for the /knowledge/* routes) */
  files: WorkspaceFiles;
  /** REAL headless browser for the web/research tools (gated per navigation) */
  web: WebBrowser;
  /** REAL terminal runner (workspace-scoped; commands gated by policy) */
  terminal: TerminalRunner;
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
   * Shared managed secrets vault. If provided (constructed at the process entry
   * so the model gateway can share it), it is used as-is; otherwise buildCore
   * creates one from `vault` when present.
   */
  secrets?: SecretsVault;
  /**
   * Device gateway. Defaults to the Stark-residence SIMULATION (safe in the
   * container / before the "enable physical-device control" check-in). The real
   * Home Assistant gateway is injected only on the Mac after that check-in.
   */
  devices?: DeviceGateway;
  /**
   * Workspace filesystem for the knowledge/files tools. Defaults to a
   * LocalWorkspaceFiles scoped to `workspaceRoot`. This is REAL (not simulated).
   */
  files?: WorkspaceFiles;
  /**
   * Offline mode (R-MODEL-04) — passed to the web browser's network policy so
   * external navigation is refused when configured offline.
   */
  offline?: boolean;
  /**
   * Optional host allowlist for web navigation (explicitly-configured targets).
   * Empty = any host reachable, still per-navigation approval-gated.
   */
  webAllowlist?: string[];
  /**
   * Headless browser for the web/research tools. Defaults to a REAL
   * PlaywrightBrowser (Chromium launches lazily on first navigation).
   */
  web?: WebBrowser;
  /**
   * Terminal runner for the terminal-with-policy tools. Defaults to a REAL
   * LocalTerminal scoped to `workspaceRoot`.
   */
  terminal?: TerminalRunner;
}): Promise<Core> {
  const audit = new AuditLog(opts.pool);
  const estop = new EmergencyStop(opts.pool, audit);
  await estop.load();

  const policy = new PolicyEngine(audit, estop);
  const approvals = new ApprovalBroker(audit);
  const activity = new ActivityBus();
  const memory = new MemoryService(opts.pool, audit, opts.vault);
  // Semantic (vector) index over memory — recall-by-meaning (H1). Embeds via the
  // model gateway's embeddings role; best-effort, so a missing embedder never
  // blocks a write (recall falls back to lexical). Verified in-container against a
  // live embeddings endpoint; nomic-embed-text on the Mac (D-0012).
  const semanticMemory = new SemanticMemory(
    opts.pool,
    (texts) => opts.gateway.embed(texts, "LOCAL_ONLY", "memory").then((r) => r.embeddings),
  );
  // Semantic knowledge store (entities/facts/relations) — encrypted at rest; the
  // vector index enables hybrid graph recall (entry points by meaning → one-hop
  // expansion, D-0045).
  const entityMemory = new EntityMemory(opts.pool, audit, opts.vault, semanticMemory);
  // Episodic memory — the recallable timeline of notable events, encrypted at rest.
  const episodicMemory = new EpisodicMemory(opts.pool, audit, opts.vault, semanticMemory);

  const control = opts.control ?? new SimulatedDesktop();
  const devices = opts.devices ?? new StarkResidence();
  const interlock = new InterlockManager(audit);

  // Real, workspace-scoped filesystem knowledge (Phase 2 "files"). Defaults to a
  // LocalWorkspaceFiles over the workspace root; a caller may inject a different
  // scope. This is a REAL capability (not simulated) and fully local/offline.
  const files = opts.files ?? new LocalWorkspaceFiles(opts.workspaceRoot);

  // Web/research browser (REAL Chromium, launched lazily). Network policy folds in
  // offline mode + an optional allowlist; every navigation is still approval-gated.
  const web =
    opts.web ??
    new PlaywrightBrowser({
      offline: opts.offline ?? false,
      ...(opts.webAllowlist ? { allowlist: opts.webAllowlist } : {}),
    });

  // Terminal-with-policy (REAL shell, workspace-scoped). Command safety is the
  // policy's job (assessCommand) enforced by the gated tools.
  const terminal = opts.terminal ?? new LocalTerminal(opts.workspaceRoot);

  // Deep-reasoning learning (D-0050): learned topics live as ordinary
  // preferences (history-preserving, visible/deletable in the memory panel).
  // Created before the tool registry so its conversational tools can register.
  const reasoningTuner = new ReasoningTuner(memory);
  // General runtime settings registry (D-0058): any catalogued knob is editable
  // at runtime (UI + J.A.R.V.I.S.), effective = override ?? current default.
  const settings = new SettingsRegistry(opts.pool, audit, SETTINGS_CATALOG);

  const tools = new ToolRegistry();
  tools.register(systemInfoTool);
  tools.register(workspaceNoteTool);
  tools.register(rememberPreferenceTool(memory));
  for (const t of computerControlTools(control)) tools.register(t);
  for (const t of deviceTools(devices, interlock)) tools.register(t);
  for (const t of knowledgeTools(files)) tools.register(t);
  for (const t of webTools(web)) tools.register(t);
  for (const t of terminalTools(terminal)) tools.register(t);
  // Research-with-provenance composes the (gated) web browser into one sourced-
  // evidence action; per-URL policy applies inside gather.
  for (const t of researchTools(new WebResearcher(web))) tools.register(t);
  for (const t of entityMemoryTools(entityMemory)) tools.register(t);
  for (const t of episodeMemoryTools(episodicMemory)) tools.register(t);
  // Conversational edit path (D-0055): the same runtime overrides the UI/API
  // offer, as gated tools — "route deep reasoning to X" / "undo that" spoken
  // to J.A.R.V.I.S. goes through policy → approval → audit like everything.
  for (const t of gatewayTools(opts.gateway, memory)) tools.register(t);
  for (const t of reasoningTools(reasoningTuner)) tools.register(t);
  for (const t of settingsTools(settings)) tools.register(t);

  // When e-stop engages, deny everything pending and announce it.
  estop.onChange((engaged) => {
    if (engaged) approvals.denyAll("estop");
    activity.emit({ kind: "estop", engaged, at: new Date().toISOString() });
  });

  // MCP client host — created before the loop so the context service can report
  // the connected-server count. Discovery still happens on demand via connectMcp.
  const mcpHost = new McpClientHost();
  const mcp = new McpRegistry(audit, opts.pool);
  await mcp.load(); // hydrate persisted trust + manifest fingerprints (survives restart)

  // Situational awareness (R-CTX): read-only aggregation injected into the loop.
  const context = new ContextService({
    pool: opts.pool,
    approvals,
    estop,
    mcpCount: () => mcp.list().length,
    knowledge: entityMemory, // J.A.R.V.I.S. draws on what it knows (non-sensitive) in conversation
    episodes: episodicMemory, // …and on what recently happened (non-sensitive)
  });

  // Restore persisted runtime role overrides onto the gateway (D-0054) —
  // best-effort: a stale pin is skipped and reported, never a boot failure.
  try {
    const { applied, skipped } = await loadRoleOverrides(opts.gateway, memory);
    if (applied || skipped.length) {
      console.log(`gateway role overrides restored: ${applied} applied${skipped.length ? `, skipped: ${skipped.join("; ")}` : ""}`);
    }
  } catch { /* overrides are an overlay — the config base always works */ }

  // Durable consent (D-0059): "always-allow-in-scope" grants persist + reload.
  const durableGrants = new DurableGrants(opts.pool, audit);
  // Decision journal + sleep-cycle consolidation (D-0051): J.A.R.V.I.S. learns
  // from its own routing record; bounded knobs only, user override wins.
  const decisions = new DecisionLog(opts.pool);
  const sleepCycle = new SleepCycle({
    pool: opts.pool,
    tuner: reasoningTuner,
    episodes: episodicMemory,
    store: memory,
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
    context,
    episodes: episodicMemory,
    reasoningTuner,
    decisions,
    durableGrants,
    toolCtx: { workspaceRoot: opts.workspaceRoot },
  });
  // Hydrate standing consent so durable grants survive restart (D-0059).
  try {
    const n = await loop.loadDurableGrants();
    if (n) console.log(`durable grants restored: ${n}`);
  } catch { /* best-effort — the config base always works */ }

  // Agent runtime (jarvis-mind) — multi-step plan-and-act over the gated loop.
  const agent = new LocalAgentRuntime({ gateway: opts.gateway, loop, tools, audit, activity, estop });
  // Skills registry — saved named objectives, run via the agent (still gated).
  const skills = new SkillRegistry(opts.pool, audit, agent);
  // Prompts registry — user-editable persona/system prompts (R-CAP-01). The
  // conversation loop reads the active persona; default seeded by migration 0013.
  const prompts = new PromptRegistry(opts.pool, audit);

  const capabilities = new CapabilityRegistry(opts.pool, audit);
  const stageA = new StageAPipeline(capabilities, audit);
  // User-defined proactivity rules (R-CAP-01 "rules" kind) — add candidates that
  // still pass the gate stack; the engine surfaces suggestions only, never acts.
  const proactiveRules = new ProactiveRules(opts.pool, audit);
  const proactive = new ProactivityEngine(opts.pool, audit, activity, undefined, proactiveRules, settings);

  // Background autonomy (D-0024, approved): bounded scheduler for the two safe
  // cycles (proactivity + sleep-cycle). Config is persisted D-0058 settings,
  // default OFF; the scheduler reconciles its timer whenever they change.
  const autonomy = new BackgroundScheduler({ settings, proactive, sleepCycle, estop, audit, activity });
  settings.onChange((key) => { if (key.startsWith("autonomy.")) void autonomy.reconcile(); });
  void autonomy.reconcile();

  // Managed integration-credential store (R-MEM-06). Only available when a vault
  // is present — secrets are never stored in the clear. Adapters (gateway, HA,
  // MCP) resolve credentials from here instead of raw process env. Prefer a
  // shared instance passed in (so the gateway and the core loop use the same
  // one); otherwise build from the vault.
  const secrets = opts.secrets ?? (opts.vault ? new SecretsVault(opts.pool, opts.vault, audit) : undefined);

  // Discover external MCP servers on demand; their tools are registered
  // namespaced + trust-gated (untrusted by default, T2). Host + registry were
  // created above (before the loop) so context can report the server count.
  const connectMcp = async (config: McpServerConfig) => {
    const { discovery, client } = await mcpHost.discover(config);
    const server = await mcp.register(discovery);
    for (const t of mcpTools(server, client, mcpHost)) tools.register(t);
    return { serverId: server.id, tools: server.tools.length, trust: server.trust };
  };

  return {
    audit, estop, policy, approvals, activity, tools, memory,
    capabilities, stageA, proactive, proactiveRules, mcp, connectMcp, context, agent, skills, prompts, files, web, terminal,
    entityMemory, episodicMemory, reasoningTuner, sleepCycle, settings, durableGrants, autonomy,
    ...(secrets ? { secrets } : {}),
    loop,
  };
}
