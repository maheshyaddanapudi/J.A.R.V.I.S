import Fastify, { type FastifyInstance } from "fastify";
import type pg from "pg";
import type { KernelConfig } from "../config.js";
import type { GatewayRouter } from "../gateway/router.js";
import { registerGatewayRoutes } from "../gateway/routes.js";
import type { Core } from "../core/index.js";
import { registerCoreRoutes } from "../core/routes.js";
import { registerMemoryRoutes } from "../memory/routes.js";
import { buildHealthReport } from "./health.js";

export function createServer(opts: {
  config: KernelConfig;
  pool: pg.Pool;
  migrationsDir: string;
  version: string;
  startedAt: number;
  gateway?: GatewayRouter;
  core?: Core;
}): FastifyInstance {
  const app = Fastify({
    logger: { level: opts.config.logLevel },
  });

  // Browser Command Center (localhost, different port) needs CORS for now.
  // Replaced by an authenticated same-origin proxy in slice 1.7 (T9).
  // POST/DELETE with a JSON body are non-simple requests, so the preflight must
  // advertise the allowed methods + headers or the browser blocks every write.
  app.addHook("onSend", async (req, reply) => {
    const origin = req.headers.origin;
    if (origin && /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
      reply.header("access-control-allow-origin", origin);
      reply.header("access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS");
      reply.header("access-control-allow-headers", "content-type");
      reply.header("access-control-max-age", "600");
    }
  });
  app.options("/*", async (_req, reply) => reply.code(204).send());

  app.get("/health", async () =>
    buildHealthReport({
      pool: opts.pool,
      migrationsDir: opts.migrationsDir,
      version: opts.version,
      env: opts.config.env,
      startedAt: opts.startedAt,
    }),
  );

  if (opts.gateway) {
    // memory (when present) persists runtime role overrides (D-0054)
    registerGatewayRoutes(app, opts.gateway, opts.pool, opts.core?.memory);
  }

  if (opts.core) {
    registerCoreRoutes(app, {
      loop: opts.core.loop,
      tools: opts.core.tools,
      audit: opts.core.audit,
      estop: opts.core.estop,
      approvals: opts.core.approvals,
      activity: opts.core.activity,
      capabilities: opts.core.capabilities,
      stageA: opts.core.stageA,
      proactive: opts.core.proactive,
      proactiveRules: opts.core.proactiveRules,
      mcp: opts.core.mcp,
      connectMcp: opts.core.connectMcp,
      ...(opts.core.secrets ? { secrets: opts.core.secrets } : {}),
      context: opts.core.context,
      agent: opts.core.agent,
      skills: opts.core.skills,
      files: opts.core.files,
      prompts: opts.core.prompts,
      reasoningTuner: opts.core.reasoningTuner,
      sleepCycle: opts.core.sleepCycle,
      settings: opts.core.settings,
    });
    registerMemoryRoutes(app, opts.core.memory, opts.core.entityMemory, opts.core.episodicMemory);
  }

  return app;
}
