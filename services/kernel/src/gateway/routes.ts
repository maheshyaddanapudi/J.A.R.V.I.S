import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { z } from "zod";
import { parseRolePin } from "./config.js";
import { persistRoleOverrides } from "./overrides.js";
import type { GatewayRouter } from "./router.js";
import { ModelRoles, type ChatRequest, type ModelRole, type NeutralMessage } from "./schema.js";

const ChatBodySchema = z.object({
  role: z.enum(ModelRoles).default("fast_conversation"),
  messages: z.array(z.unknown()).min(1),
  privacyClass: z.enum(["LOCAL_ONLY", "STANDARD"]).default("LOCAL_ONLY"),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  source: z.string().default("api"),
});

/**
 * Gateway HTTP surface (localhost only):
 *  POST /gateway/chat    — SSE stream of neutral ChatEvents
 *  GET  /gateway/status  — live provider reachability (measured, never cached)
 *  GET  /gateway/roles   — current role routing table + offline flag
 *  GET  /gateway/calls   — recent model_calls audit rows (R-MODEL-03; the table
 *                          holds routing outcomes only — never message content)
 */
export function registerGatewayRoutes(
  app: FastifyInstance,
  router: GatewayRouter,
  pool?: pg.Pool,
  /** preference store for persisting runtime role overrides (D-0054) */
  overridesStore?: {
    get(key: string): Promise<{ value: string } | null>;
    remember(input: { key: string; value: string; provenance: string }): Promise<unknown>;
  },
): void {
  app.get("/gateway/status", async () => ({
    offline: router.isOffline,
    providers: await router.status(),
  }));

  app.get("/gateway/roles", async () => ({
    offline: router.isOffline,
    roles: router.roleTable(),
    overrides: router.overrides(),
  }));

  // Runtime role overrides (D-0054): re-route a role among configured
  // providers without a restart. Pins use the one canonical syntax
  // (provider/model[@effort][+thinking|+nothink]); every override carries its
  // ledger (reason + when) and persists across restarts.
  if (overridesStore) {
    const RolePinSchema = z.object({
      pins: z.array(z.string().min(3)).min(1).max(4),
      reason: z.string().min(1).max(300),
    });
    app.put("/gateway/roles/:role", async (req, reply) => {
      const role = (req.params as { role: string }).role;
      if (!(ModelRoles as readonly string[]).includes(role)) {
        return reply.code(400).send({ error: `unknown role '${role}'` });
      }
      const parsed = RolePinSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
      try {
        const targets = parsed.data.pins.map((p) => parseRolePin(role, p));
        const entry = router.overrideRole(role as ModelRole, targets, {
          reason: parsed.data.reason,
        });
        await persistRoleOverrides(router, overridesStore);
        return { role, override: { pins: parsed.data.pins, reason: entry.reason, at: entry.at }, roles: router.roleTable() };
      } catch (err) {
        return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
      }
    });
    app.delete("/gateway/roles/:role", async (req, reply) => {
      const role = (req.params as { role: string }).role;
      if (!(ModelRoles as readonly string[]).includes(role)) {
        return reply.code(400).send({ error: `unknown role '${role}'` });
      }
      const removed = router.clearRoleOverride(role as ModelRole);
      await persistRoleOverrides(router, overridesStore);
      return { role, removed, roles: router.roleTable() };
    });
  }

  if (pool) {
    app.get("/gateway/calls", async (req) => {
      const q = req.query as { limit?: string };
      const limit = Math.min(Math.max(Number(q.limit) || 30, 1), 200);
      const { rows } = await pool.query(
        `SELECT at, role, provider, model, privacy_class, source, ok, error,
                input_tokens, output_tokens, latency_ms, fallback_from, offline_mode
           FROM model_calls ORDER BY at DESC LIMIT $1`,
        [limit],
      );
      return { calls: rows };
    });
  }

  app.post("/gateway/chat", async (req, reply) => {
    const parsed = ChatBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.message });
    }
    const body = parsed.data;

    const chatReq: ChatRequest = {
      role: body.role,
      messages: body.messages as NeutralMessage[],
      privacyClass: body.privacyClass,
      source: body.source,
      ...(body.maxTokens !== undefined ? { maxTokens: body.maxTokens } : {}),
      ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
    };

    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      ...(req.headers.origin &&
      /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(req.headers.origin)
        ? { "access-control-allow-origin": req.headers.origin }
        : {}),
    });

    const abort = new AbortController();
    // client disconnect = response socket closed before we finished writing
    reply.raw.on("close", () => {
      if (!reply.raw.writableEnded) abort.abort();
    });

    try {
      const gen = router.chatStream(chatReq, abort.signal);
      while (true) {
        const step = await gen.next();
        if (step.done) {
          reply.raw.write(`event: result\ndata: ${JSON.stringify(step.value)}\n\n`);
          break;
        }
        reply.raw.write(`data: ${JSON.stringify(step.value)}\n\n`);
      }
    } catch (err) {
      reply.raw.write(
        `event: error\ndata: ${JSON.stringify({
          message: err instanceof Error ? err.message : String(err),
        })}\n\n`,
      );
    }
    reply.raw.end();
    return reply;
  });
}
