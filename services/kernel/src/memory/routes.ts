import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { MemoryService, EpistemicStatus, Sensitivity } from "./memory.js";

/** Memory HTTP surface (localhost only) — the user-control panel for AT1.9/1.10. */
export function registerMemoryRoutes(app: FastifyInstance, memory: MemoryService): void {
  app.get("/memory/preferences", async (req) => {
    const q = (req.query as { q?: string }).q;
    return { preferences: q ? await memory.search(q) : await memory.list() };
  });

  app.get("/memory/preferences/:key", async (req, reply) => {
    const key = (req.params as { key: string }).key;
    const pref = await memory.get(key);
    if (!pref) return reply.code(404).send({ error: "not found" });
    return pref;
  });

  const RememberSchema = z.object({
    key: z.string().min(1),
    value: z.string().min(1),
    status: z
      .enum([
        "verified_fact",
        "user_statement",
        "external_claim",
        "inferred_preference",
        "temporary_context",
        "simulated_data",
        "uncertain",
      ])
      .optional(),
    provenance: z.string().default("user"),
    confidence: z.number().min(0).max(1).optional(),
    sensitivity: z.enum(["public", "personal", "private", "secret"]).optional(),
  });
  app.post("/memory/preferences", async (req, reply) => {
    const parsed = RememberSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    try {
      return await memory.remember({
        key: parsed.data.key,
        value: parsed.data.value,
        provenance: parsed.data.provenance,
        ...(parsed.data.status ? { status: parsed.data.status as EpistemicStatus } : {}),
        ...(parsed.data.confidence !== undefined ? { confidence: parsed.data.confidence } : {}),
        ...(parsed.data.sensitivity
          ? { sensitivity: parsed.data.sensitivity as Sensitivity }
          : {}),
      });
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  const CorrectSchema = z.object({ value: z.string().min(1), provenance: z.string().optional() });
  app.post("/memory/preferences/:key/correct", async (req, reply) => {
    const key = (req.params as { key: string }).key;
    const parsed = CorrectSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    try {
      const updated = await memory.correct(
        key,
        parsed.data.value,
        parsed.data.provenance ?? "user correction",
      );
      if (!updated) return reply.code(404).send({ error: "not found" });
      return updated;
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/memory/preferences/:key/pin", async (req) => {
    const key = (req.params as { key: string }).key;
    const pinned = Boolean((req.body as { pinned?: boolean } | undefined)?.pinned ?? true);
    return { pinned: await memory.pin(key, pinned) };
  });

  app.delete("/memory/preferences/:key", async (req) => {
    const key = (req.params as { key: string }).key;
    return { deleted: await memory.delete(key) };
  });

  app.post("/memory/preferences/:key/forget", async (req) => {
    const key = (req.params as { key: string }).key;
    return { purged: await memory.forget(key) };
  });

  app.get("/memory/export", async () => memory.export());
}
