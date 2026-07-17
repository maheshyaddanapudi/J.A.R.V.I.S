import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { GatewayRouter } from "./router.js";
import { ModelRoles, type ChatRequest, type NeutralMessage } from "./schema.js";

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
 */
export function registerGatewayRoutes(app: FastifyInstance, router: GatewayRouter): void {
  app.get("/gateway/status", async () => ({
    offline: router.isOffline,
    providers: await router.status(),
  }));

  app.get("/gateway/roles", async () => ({
    offline: router.isOffline,
    roles: router.roleTable(),
  }));

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
