import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ActivityBus } from "./activity.js";
import type { ApprovalBroker, ApprovalResolution } from "./approvals.js";
import type { AuditLog } from "./audit.js";
import type { EmergencyStop } from "./estop.js";
import type { CoreLoop } from "./loop.js";
import type { ToolRegistry } from "./tools.js";

/**
 * SSE responses write raw headers (bypassing the onSend CORS hook), so they must
 * echo the CORS header themselves for a cross-origin EventSource (the dev
 * Command Center / Voice Orb on a different localhost port). Localhost only.
 */
function sseCorsHeaders(origin: string | undefined): Record<string, string> {
  return origin && /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
    ? { "access-control-allow-origin": origin }
    : {};
}

/**
 * Z1 trust-core HTTP surface (localhost only). Wires the core loop, approvals,
 * e-stop, and audit to the Command Center. SSE for the live activity timeline.
 */
export function registerCoreRoutes(
  app: FastifyInstance,
  deps: {
    loop: CoreLoop;
    tools: ToolRegistry;
    audit: AuditLog;
    estop: EmergencyStop;
    approvals: ApprovalBroker;
    activity: ActivityBus;
    capabilities: import("../selfext/registry.js").CapabilityRegistry;
    stageA: import("../selfext/stageA.js").StageAPipeline;
    proactive: import("../proactive/engine.js").ProactivityEngine;
    proactiveRules?: import("../proactive/rules.js").ProactiveRules;
    mcp: import("../mcp/registry.js").McpRegistry;
    connectMcp: (config: import("../mcp/client.js").McpServerConfig) => Promise<{ serverId: string; tools: number; trust: string }>;
    secrets?: import("../crypto/secrets.js").SecretsVault;
    context: import("../context/service.js").ContextService;
    agent: import("../agent/contract.js").AgentRuntime;
    skills: import("../skills/registry.js").SkillRegistry;
    files: import("../knowledge/contract.js").WorkspaceFiles;
    prompts?: import("../prompts/registry.js").PromptRegistry;
    reasoningTuner?: import("./reasoning.js").ReasoningTuner;
    sleepCycle?: import("./consolidation.js").SleepCycle;
    settings?: import("../settings/registry.js").SettingsRegistry;
    durableGrants?: import("./grants.js").DurableGrants;
    autonomy?: import("../autonomy/scheduler.js").BackgroundScheduler;
  },
): void {
  // Background autonomy (D-0024): observe status + trigger a tick on demand.
  // Enabling/interval is via /settings (autonomy.*); this only reports + runs.
  if (deps.autonomy) {
    const autonomy = deps.autonomy;
    app.get("/autonomy/status", async () => await autonomy.status());
    app.post("/autonomy/tick", async () => await autonomy.tick());
  }
  // Standing consent (D-0059): "always-allow-in-scope" grants are durable and
  // therefore always visible + revocable (a persisted consent must be auditable).
  if (deps.durableGrants) {
    const grants = deps.durableGrants;
    app.get("/core/grants", async () => ({ grants: await grants.list() }));
    app.delete("/core/grants/:id", async (req) => {
      const id = (req.params as { id: string }).id;
      return { revoked: await grants.revoke(id) };
    });
  }
  // Runtime settings (D-0058): edit any catalogued knob live. Effective value =
  // persisted override ?? current default. GET the catalog, PUT to set (user),
  // DELETE to reset to default. The catalog is the allowlist — Z1 core excluded.
  if (deps.settings) {
    const settings = deps.settings;
    app.get("/settings", async () => ({ settings: await settings.effective() }));
    app.put("/settings/:key", async (req, reply) => {
      const key = decodeURIComponent((req.params as { key: string }).key);
      const body = req.body as { value?: unknown; reason?: string } | undefined;
      if (body?.value === undefined) return reply.code(400).send({ error: "value required" });
      try {
        return await settings.set(key, body.value, "user", body.reason ?? "set via Command Center");
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
      }
    });
    // DELETE: system settings RESET to default (the floor); dynamic settings are
    // removed entirely (D-0060).
    app.delete("/settings/:key", async (req, reply) => {
      const key = decodeURIComponent((req.params as { key: string }).key);
      try {
        return await settings.remove(key);
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
      }
    });
    // Register a NEW dynamic setting at runtime (user via UI/API).
    app.post("/settings", async (req, reply) => {
      const body = req.body as import("../settings/registry.js").DynamicSpecInput | undefined;
      if (!body?.key || !body?.type || body?.default === undefined || !body?.label) {
        return reply.code(400).send({ error: "key, label, type, default required" });
      }
      try {
        return await settings.register(body, "user");
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
      }
    });
  }
  // Sleep-cycle consolidation (D-0051): run on demand; read the last report.
  // Unattended nightly runs arrive with the D-0024 background gate.
  if (deps.sleepCycle) {
    const sleep = deps.sleepCycle;
    app.post("/core/reasoning/consolidate", async (req) => {
      const hours = Number((req.body as { windowHours?: number } | undefined)?.windowHours) || 24;
      return await sleep.run(Math.min(Math.max(hours, 1), 24 * 30));
    });
  }
  // Deep-reasoning learned topics (D-0050): what the user has taught (by
  // instruction or repeated correction). Read/teach/forget — always inspectable.
  if (deps.reasoningTuner) {
    const tuner = deps.reasoningTuner;
    app.get("/core/reasoning/topics", async () => ({ topics: await tuner.topics() }));
    app.post("/core/reasoning/topics", async (req, reply) => {
      const topic = (req.body as { topic?: string } | undefined)?.topic;
      if (!topic?.trim()) return reply.code(400).send({ error: "topic required" });
      return { topics: await tuner.teach(topic) };
    });
    app.delete("/core/reasoning/topics/:topic", async (req) => {
      const topic = decodeURIComponent((req.params as { topic: string }).topic);
      return { topics: await tuner.forget(topic) };
    });
    // Bounded autotune knobs (D-0051): GET current; POST = MANUAL override
    // (source "user") — the sleep cycle will respect it and say so.
    app.get("/core/reasoning/autotune", async () => await tuner.autotune());
    app.post("/core/reasoning/autotune", async (req, reply) => {
      const body = req.body as { signalThreshold?: number; reason?: string } | undefined;
      const v = body?.signalThreshold;
      if (v !== 1 && v !== 2) {
        return reply.code(400).send({ error: "signalThreshold must be 1 or 2" });
      }
      return await tuner.setThreshold(v, "user", body?.reason ?? "manual setting");
    });
    app.delete("/core/reasoning/autotune", async () => {
      return await tuner.reset();
    });
  }
  app.get("/core/tools", async () => ({
    tools: deps.tools.list().map((t) => ({
      name: t.name,
      description: t.description,
      riskClass: t.riskClass,
    })),
  }));

  // Live activity timeline (SSE).
  app.get("/core/activity", async (req, reply) => {
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      ...sseCorsHeaders(req.headers.origin),
    });
    const unsubscribe = deps.activity.subscribe((e) => {
      reply.raw.write(`data: ${JSON.stringify(e)}\n\n`);
    });
    reply.raw.write(`data: ${JSON.stringify({ kind: "hello", at: new Date().toISOString() })}\n\n`);
    req.raw.on("close", () => unsubscribe());
    return reply;
  });

  // Emergency stop.
  app.get("/core/estop", async () => ({ engaged: deps.estop.isEngaged }));
  app.post("/core/estop/engage", async (req) => {
    const via = (req.body as { via?: string } | undefined)?.via ?? "api";
    await deps.estop.engage(via);
    deps.approvals.denyAll(via);
    deps.activity.emit({ kind: "estop", engaged: true, at: new Date().toISOString() });
    return { engaged: true };
  });
  app.post("/core/estop/resume", async (req) => {
    const via = (req.body as { via?: string } | undefined)?.via ?? "api";
    await deps.estop.resume(via);
    deps.activity.emit({ kind: "estop", engaged: false, at: new Date().toISOString() });
    return { engaged: false };
  });

  // Approvals.
  app.get("/core/approvals", async () => ({ pending: deps.approvals.list() }));
  const ResolveSchema = z.object({
    id: z.string(),
    resolution: z.enum([
      "allow-once",
      "allow-for-task",
      "allow-for-session",
      "always-allow-in-scope",
      "deny",
    ]),
    via: z.string().default("api"),
  });
  app.post("/core/approvals/resolve", async (req, reply) => {
    const parsed = ResolveSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const ok = await deps.approvals.resolve(
      parsed.data.id,
      parsed.data.resolution as ApprovalResolution,
      parsed.data.via,
    );
    return { resolved: ok };
  });

  // Situational awareness (R-CTX) — "what does J.A.R.V.I.S. know right now".
  // Read-only aggregation; the same snapshot is injected into conversations.
  app.get("/context", async (req) => {
    const at = (req.query as { at?: string }).at;
    const now = at ? new Date(at) : new Date();
    return {
      snapshot: await deps.context.snapshot(now),
      describe: await deps.context.describe(now),
    };
  });

  // Audit trail + integrity.
  app.get("/core/audit", async (req) => {
    const limit = Number((req.query as { limit?: string }).limit ?? 100);
    return { entries: await deps.audit.recent(limit) };
  });
  app.get("/core/audit/verify", async () => deps.audit.verifyChain());

  // Self-extension (Phase 3 foundation) — Stage A only, NEVER activates.
  // control.stageA runs the guard + records to the registry; the response makes
  // the terminal decision + required check-in explicit.
  app.get("/selfext/capabilities", async () => ({
    capabilities: await deps.capabilities.list(),
    gaps: await deps.capabilities.listGaps(),
  }));
  app.post("/selfext/record-gap", async (req) => {
    const b = (req.body ?? {}) as { need?: string; context?: string };
    const id = await deps.capabilities.recordGap(b.need ?? "unspecified", b.context ?? "", false);
    return { id };
  });
  app.post("/selfext/stage-a", async (req, reply) => {
    const b = req.body as
      | { manifest?: unknown; need?: string; context?: string; sources?: string[] }
      | undefined;
    if (!b?.manifest) return reply.code(400).send({ error: "manifest required" });
    // Note: on the Mac the manifest comes from a sandboxed out-of-process
    // generator in an isolated git worktree; here we accept it directly to
    // exercise the guard. NO activation happens regardless.
    const report = await deps.stageA.run(b.manifest as never, {
      need: b.need ?? "unspecified",
      context: b.context ?? "",
      ...(b.sources ? { sources: b.sources } : {}),
    });
    return report;
  });

  // Proactivity (Phase 4 foundation). run() computes a cycle on demand and
  // records surfaced items; it surfaces information/suggestions only and never
  // performs a consequential action. Live background scheduling + notifications
  // are gated on the "enable proactive behavior" check-in (D-0024).
  app.get("/proactive/items", async () => ({ items: await deps.proactive.recent() }));
  app.post("/proactive/run", async (req) => {
    // optional `at` (ISO) lets the user preview "what would I be shown at <time>"
    const at = (req.body as { at?: string } | undefined)?.at;
    const now = at ? new Date(at) : new Date();
    const result = await deps.proactive.run(now);
    return {
      surfaced: result.surfaced,
      suppressedCount: result.suppressed.length,
      suppressed: result.suppressed.map((s) => ({ title: s.candidate.title, gate: s.gate, reason: s.reason })),
    };
  });
  app.post("/proactive/snooze", async (req) => {
    const b = (req.body ?? {}) as { dedupKey?: string; minutes?: number };
    if (!b.dedupKey) return { error: "dedupKey required" };
    await deps.proactive.snooze(b.dedupKey, new Date(Date.now() + (b.minutes ?? 60) * 60_000));
    return { snoozed: b.dedupKey };
  });
  app.post("/proactive/dismiss", async (req) => {
    const b = (req.body ?? {}) as { dedupKey?: string };
    if (!b.dedupKey) return { error: "dedupKey required" };
    await deps.proactive.dismiss(b.dedupKey);
    return { dismissed: b.dedupKey };
  });
  app.post("/proactive/domain", async (req) => {
    const b = (req.body ?? {}) as { domain?: string; enabled?: boolean };
    if (!b.domain) return { error: "domain required" };
    await deps.proactive.setDomainEnabled(b.domain, b.enabled ?? true);
    return { domain: b.domain, enabled: b.enabled ?? true };
  });

  // User-defined proactivity rules (R-CAP-01 "rules" kind) — configure WHAT
  // J.A.R.V.I.S. is proactive about. Rules add gated, suggestion-only candidates.
  if (deps.proactiveRules) {
    const rules = deps.proactiveRules;
    app.get("/proactive/rules", async () => ({ rules: await rules.list() }));
    app.post("/proactive/rules", async (req, reply) => {
      const b = (req.body ?? {}) as {
        name?: string; title?: string; condition?: unknown; detail?: string;
        domain?: string; priority?: string; confidence?: number;
      };
      if (!b.name || !b.title || b.condition === undefined) {
        return reply.code(400).send({ error: "name, title, and condition are required" });
      }
      try {
        return await rules.set({
          name: b.name,
          title: b.title,
          condition: b.condition,
          ...(b.detail !== undefined ? { detail: b.detail } : {}),
          ...(b.domain !== undefined ? { domain: b.domain } : {}),
          ...(b.priority !== undefined ? { priority: b.priority as "low" | "normal" | "high" | "critical" } : {}),
          ...(b.confidence !== undefined ? { confidence: b.confidence } : {}),
        });
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
      }
    });
    app.post("/proactive/rules/:name/enabled", async (req) => {
      const name = decodeURIComponent((req.params as { name: string }).name);
      const enabled = Boolean((req.body as { enabled?: boolean } | undefined)?.enabled ?? true);
      return { updated: await rules.setEnabled(name, enabled) };
    });
    app.delete("/proactive/rules/:name", async (req) => {
      const name = decodeURIComponent((req.params as { name: string }).name);
      return { removed: await rules.remove(name) };
    });
  }

  // MCP (R-CAP-02). Discover a configured server; its tools register namespaced
  // + trust-gated (untrusted by default). Everything a server returns is
  // untrusted content (T2). Trust changes above untrusted are a check-in.
  app.get("/mcp/servers", async () => ({
    servers: deps.mcp.list().map((s) => ({
      id: s.id, trust: s.trust, quarantined: s.quarantined,
      tools: s.tools.map((t) => t.name), manifestHash: s.manifestHash,
    })),
  }));
  app.post("/mcp/connect", async (req, reply) => {
    const b = req.body as
      | {
          id?: string;
          command?: string;
          args?: string[];
          env?: Record<string, string>;
          /** {ENV_VAR: secretName} — resolved from the encrypted secrets vault, so
           *  credentials never travel in the request body or the audit log */
          secretEnv?: Record<string, string>;
        }
      | undefined;
    if (!b?.id || !b?.command) return reply.code(400).send({ error: "id and command required" });
    try {
      let env = b.env ? { ...b.env } : undefined;
      if (b.secretEnv && Object.keys(b.secretEnv).length > 0) {
        if (!deps.secrets) return reply.code(400).send({ error: "secretEnv requires the secrets vault (no vault configured)" });
        const resolved = await deps.secrets.resolveEnv(b.secretEnv);
        env = { ...(env ?? {}), ...resolved };
      }
      // env is passed to the launched subprocess only (many real servers need
      // credentials/config here); it is never persisted to the audit or memory.
      return await deps.connectMcp({
        id: b.id,
        command: b.command,
        args: b.args ?? [],
        ...(env ? { env } : {}),
      });
    } catch (err) {
      return reply.code(502).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Managed integration-credential store (R-MEM-06). Secrets are encrypted at
  // rest and NEVER returned over HTTP or written to the audit as values — only
  // names/metadata are listed. Absent the secrets vault (no KEK/vault), these
  // routes report unavailable rather than storing anything in the clear.
  app.get("/secrets", async (_req, reply) => {
    if (!deps.secrets) return reply.code(503).send({ error: "secrets vault unavailable (no vault configured)" });
    return { secrets: await deps.secrets.list() };
  });
  app.post("/secrets", async (req, reply) => {
    if (!deps.secrets) return reply.code(503).send({ error: "secrets vault unavailable (no vault configured)" });
    const b = req.body as { name?: string; value?: string; description?: string } | undefined;
    if (!b?.name || typeof b.value !== "string") {
      return reply.code(400).send({ error: "name and value required" });
    }
    try {
      await deps.secrets.set(b.name, b.value, b.description ?? "");
      return { set: b.name };
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });
  app.delete("/secrets/:name", async (req, reply) => {
    if (!deps.secrets) return reply.code(503).send({ error: "secrets vault unavailable (no vault configured)" });
    const name = (req.params as { name?: string }).name ?? "";
    return { deleted: await deps.secrets.delete(name) };
  });
  app.post("/mcp/trust", async (req, reply) => {
    const b = req.body as { id?: string; trust?: "untrusted" | "limited" | "trusted" } | undefined;
    if (!b?.id || !b?.trust) return reply.code(400).send({ error: "id and trust required" });
    return { set: await deps.mcp.setTrust(b.id, b.trust) };
  });

  // Agent runtime (jarvis-mind) — multi-step plan-and-act for an objective. Every
  // tool step runs through the gated loop (approval + verify); bounded by a step
  // budget; e-stop halts mid-plan. Returns the plan trace + final answer.
  const AgentSchema = z.object({
    objective: z.string().min(1),
    maxSteps: z.number().int().min(1).max(20).optional(),
    privacyClass: z.enum(["LOCAL_ONLY", "STANDARD"]).default("LOCAL_ONLY"),
    autoApprove: z
      .enum(["allow-once", "allow-for-task", "allow-for-session", "always-allow-in-scope", "deny"])
      .optional(),
  });
  app.post("/agent/run", async (req, reply) => {
    const parsed = AgentSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const b = parsed.data;
    return deps.agent.run(b.objective, {
      privacyClass: b.privacyClass,
      source: "api",
      ...(b.maxSteps !== undefined ? { maxSteps: b.maxSteps } : {}),
      ...(b.autoApprove !== undefined ? { autoApprove: b.autoApprove } : {}),
    });
  });

  // Skills registry (R-CAP-01) — saved named objectives, run via the agent (still
  // gated). A skill grants no new capability; it reuses what the agent can do.
  app.get("/skills", async () => ({ skills: await deps.skills.list() }));
  const SkillSchema = z.object({
    name: z.string().min(1),
    objective: z.string().min(1),
    description: z.string().optional(),
    maxSteps: z.number().int().min(1).max(20).optional(),
  });
  app.post("/skills", async (req, reply) => {
    const parsed = SkillSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const d = parsed.data;
    try {
      return await deps.skills.create({
        name: d.name,
        objective: d.objective,
        ...(d.description !== undefined ? { description: d.description } : {}),
        ...(d.maxSteps !== undefined ? { maxSteps: d.maxSteps } : {}),
      });
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });
  app.delete("/skills/:id", async (req) => {
    const id = (req.params as { id?: string }).id ?? "";
    return { deleted: await deps.skills.delete(id) };
  });
  app.post("/skills/:id/run", async (req, reply) => {
    const id = (req.params as { id?: string }).id ?? "";
    const b = (req.body ?? {}) as { autoApprove?: ApprovalResolution; privacyClass?: "LOCAL_ONLY" | "STANDARD" };
    const result = await deps.skills.run(id, {
      ...(b.autoApprove ? { autoApprove: b.autoApprove } : {}),
      ...(b.privacyClass ? { privacyClass: b.privacyClass } : {}),
    });
    if (!result) return reply.code(404).send({ error: "skill not found or disabled" });
    return result;
  });

  // Workspace knowledge/files — READ-ONLY read models (D-0032). These surface the
  // structured data (listings, file content, search matches) the Command Center
  // needs; they are the READ_ONLY half of the capability and enforce workspace
  // scope in the adapter. MUTATION (files.edit) goes through the gated /core/run-tool
  // loop, never here. Out-of-scope / refused paths return 400 with the reason.
  app.get("/knowledge/list", async (req, reply) => {
    const dir = (req.query as { dir?: string }).dir ?? "";
    try {
      return { dir, entries: await deps.files.list(dir) };
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });
  app.get("/knowledge/read", async (req, reply) => {
    const q = req.query as { path?: string; maxBytes?: string };
    if (!q.path) return reply.code(400).send({ error: "path required" });
    try {
      return await deps.files.read(q.path, q.maxBytes ? Number(q.maxBytes) : undefined);
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });
  app.get("/knowledge/stat", async (req, reply) => {
    const q = req.query as { path?: string };
    if (!q.path) return reply.code(400).send({ error: "path required" });
    try {
      return await deps.files.stat(q.path);
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });
  app.get("/knowledge/search", async (req, reply) => {
    const q = req.query as { q?: string; regex?: string; glob?: string; maxMatches?: string };
    if (!q.q) return reply.code(400).send({ error: "q required" });
    try {
      const opts: import("../knowledge/contract.js").SearchOptions = {};
      if (q.regex === "1" || q.regex === "true") opts.regex = true;
      if (q.glob) opts.glob = q.glob;
      if (q.maxMatches) opts.maxMatches = Number(q.maxMatches);
      return await deps.files.search(q.q, opts);
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Conversational answer through the core loop (objective → streamed tokens),
  // with activity + e-stop interruption. SSE.
  const ConverseSchema = z.object({
    text: z.string().min(1),
    source: z.string().default("api"),
    sessionId: z.string().uuid().optional(),
    privacyClass: z.enum(["LOCAL_ONLY", "STANDARD"]).default("LOCAL_ONLY"),
    /** deep-reasoning escalation (D-0048): auto = J.A.R.V.I.S. assesses the turn */
    reasoning: z.enum(["auto", "deep", "fast"]).default("auto"),
  });
  // Restrained British-butler persona (D-0004) — the DEFAULT/fallback. The active
  // persona is now user-editable via the prompts registry (R-CAP-01, D-0043); the
  // loop reads the active one and falls back to this if the registry is empty or
  // unavailable (never a blank persona). The synthetic *voice* is chosen at the Mac
  // listening test; this fixes the textual manner.
  const BUTLER_PERSONA =
    "You are J.A.R.V.I.S., a composed, dry-witted British butler-assistant. Be concise, precise, and understated. Address the user as 'sir' sparingly. Never invent facts.";
  const activePersona = async (): Promise<string> =>
    deps.prompts ? deps.prompts.activePersonaOr(BUTLER_PERSONA) : BUTLER_PERSONA;

  // Prompts registry surface (localhost) — view/edit how J.A.R.V.I.S. speaks.
  if (deps.prompts) {
    const prompts = deps.prompts;
    app.get("/prompts", async (req) => {
      const kind = (req.query as { kind?: string }).kind as "persona" | "system" | "template" | undefined;
      return { prompts: await prompts.list(kind, true), active: await prompts.getActive("persona") };
    });
    app.get("/prompts/active", async (req) => {
      const kind = ((req.query as { kind?: string }).kind ?? "persona") as "persona" | "system" | "template";
      return (await prompts.getActive(kind)) ?? { name: "butler", kind: "persona", content: BUTLER_PERSONA, active: true, fallback: true };
    });
    const SetSchema = z.object({
      name: z.string().min(1),
      kind: z.enum(["persona", "system", "template"]).optional(),
      content: z.string().min(1),
    });
    app.post("/prompts", async (req, reply) => {
      const parsed = SetSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
      try {
        return await prompts.set({
          name: parsed.data.name,
          content: parsed.data.content,
          ...(parsed.data.kind ? { kind: parsed.data.kind } : {}),
        });
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
      }
    });
    app.post("/prompts/:name/activate", async (req) => {
      const name = decodeURIComponent((req.params as { name: string }).name);
      const kind = ((req.body as { kind?: string } | undefined)?.kind ?? "persona") as "persona" | "system" | "template";
      return { activated: await prompts.activate(name, kind) };
    });
    app.delete("/prompts/:name", async (req) => {
      const name = decodeURIComponent((req.params as { name: string }).name);
      const kind = ((req.query as { kind?: string }).kind ?? "persona") as "persona" | "system" | "template";
      return { removed: await prompts.remove(name, kind) };
    });
  }
  app.post("/core/converse", async (req, reply) => {
    const parsed = ConverseSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const body = parsed.data;
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      ...sseCorsHeaders(req.headers.origin),
    });
    deps.activity.emit({ kind: "objective", text: body.text, at: new Date().toISOString() });
    try {
      const persona = await activePersona();
      for await (const token of deps.loop.runConversation({
        text: body.text,
        source: body.source,
        system: persona,
        privacyClass: body.privacyClass,
        reasoning: body.reasoning,
        // the routing decision streams FIRST so the UI can show which brain
        // is answering (and why) before tokens arrive
        onDecision: (d) =>
          reply.raw.write(`data: ${JSON.stringify({ type: "reasoning", ...d })}\n\n`),
        ...(body.sessionId ? { sessionId: body.sessionId } : {}),
      })) {
        reply.raw.write(`data: ${JSON.stringify({ type: "token", text: token })}\n\n`);
      }
      reply.raw.write(`event: done\ndata: {}\n\n`);
    } catch (err) {
      reply.raw.write(
        `event: error\ndata: ${JSON.stringify({ message: err instanceof Error ? err.message : String(err) })}\n\n`,
      );
    }
    reply.raw.end();
    return reply;
  });

  // Run a tool through the full gated loop.
  const RunToolSchema = z.object({
    tool: z.string(),
    args: z.unknown().default({}),
    source: z.string().default("api"),
    resourceScope: z.string().optional(),
    delegatedAutomation: z.boolean().optional(),
    /** for scripted/testing flows: auto-resolution for any approval prompt */
    autoApprove: z
      .enum(["allow-once", "allow-for-task", "allow-for-session", "always-allow-in-scope", "deny"])
      .optional(),
  });
  app.post("/core/run-tool", async (req, reply) => {
    const parsed = RunToolSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const body = parsed.data;
    const result = await deps.loop.runTool({
      tool: body.tool,
      args: body.args,
      source: body.source,
      ...(body.resourceScope !== undefined ? { resourceScope: body.resourceScope } : {}),
      ...(body.delegatedAutomation !== undefined
        ? { delegatedAutomation: body.delegatedAutomation }
        : {}),
      ...(body.autoApprove !== undefined
        ? { autoApprove: body.autoApprove as ApprovalResolution }
        : {}),
    });
    return result;
  });
}
