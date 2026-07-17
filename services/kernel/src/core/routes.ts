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

  // Conversational answer through the core loop (objective → streamed tokens),
  // with activity + e-stop interruption. SSE.
  const ConverseSchema = z.object({
    text: z.string().min(1),
    source: z.string().default("api"),
    privacyClass: z.enum(["LOCAL_ONLY", "STANDARD"]).default("LOCAL_ONLY"),
  });
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
        messages: [{ role: "user", content: [{ type: "text", text: body.text }] }],
        source: body.source,
        privacyClass: body.privacyClass,
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
