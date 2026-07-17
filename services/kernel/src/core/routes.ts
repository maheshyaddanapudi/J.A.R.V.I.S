import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ActivityBus } from "./activity.js";
import type { ApprovalBroker, ApprovalResolution } from "./approvals.js";
import type { AuditLog } from "./audit.js";
import type { EmergencyStop } from "./estop.js";
import type { CoreLoop } from "./loop.js";
import type { ToolRegistry } from "./tools.js";

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
  },
): void {
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

  // Conversational answer through the core loop (objective → streamed tokens),
  // with activity + e-stop interruption. SSE.
  const ConverseSchema = z.object({
    text: z.string().min(1),
    source: z.string().default("api"),
    sessionId: z.string().uuid().optional(),
    privacyClass: z.enum(["LOCAL_ONLY", "STANDARD"]).default("LOCAL_ONLY"),
  });
  // Restrained British-butler persona (D-0004). The synthetic *voice* is chosen
  // at the Mac listening test; this fixes the textual manner.
  const BUTLER_PERSONA =
    "You are J.A.R.V.I.S., a composed, dry-witted British butler-assistant. Be concise, precise, and understated. Address the user as 'sir' sparingly. Never invent facts.";
  app.post("/core/converse", async (req, reply) => {
    const parsed = ConverseSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const body = parsed.data;
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    deps.activity.emit({ kind: "objective", text: body.text, at: new Date().toISOString() });
    try {
      for await (const token of deps.loop.runConversation({
        text: body.text,
        source: body.source,
        system: BUTLER_PERSONA,
        privacyClass: body.privacyClass,
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
