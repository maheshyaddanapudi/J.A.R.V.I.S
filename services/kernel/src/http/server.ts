import Fastify, { type FastifyInstance } from "fastify";
import type pg from "pg";
import type { KernelConfig } from "../config.js";
import type { GatewayRouter } from "../gateway/router.js";
import { registerGatewayRoutes } from "../gateway/routes.js";
import type { Core } from "../core/index.js";
import { registerCoreRoutes } from "../core/routes.js";
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
  app.addHook("onSend", async (req, reply) => {
    const origin = req.headers.origin;
    if (origin && /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
      reply.header("access-control-allow-origin", origin);
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
    registerGatewayRoutes(app, opts.gateway);
  }

  if (opts.core) {
    registerCoreRoutes(app, {
      loop: opts.core.loop,
      tools: opts.core.tools,
      audit: opts.core.audit,
      estop: opts.core.estop,
      approvals: opts.core.approvals,
      activity: opts.core.activity,
    });
  }

  return app;
}
