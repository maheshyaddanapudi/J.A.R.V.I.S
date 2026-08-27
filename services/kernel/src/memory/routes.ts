import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { MemoryService, EpistemicStatus, Sensitivity } from "./memory.js";
import type { EntityMemory } from "./entities.js";
import type { EpisodicMemory, EpisodeKind } from "./episodes.js";

/** Memory HTTP surface (localhost only) — the user-control panel for AT1.9/1.10. */
export function registerMemoryRoutes(
  app: FastifyInstance,
  memory: MemoryService,
  entities?: EntityMemory,
  episodes?: EpisodicMemory,
): void {
  // Episodic timeline (read + user control). Recall decrypts on read; free-text
  // `q` filters after decryption. Forget soft-deletes (excluded immediately).
  if (episodes) {
    app.get("/memory/episodes", async (req) => {
      const q = req.query as { q?: string; semantic?: string; kind?: string; tag?: string; since?: string; entity?: string; limit?: string };
      const since = q.since ? new Date(q.since) : undefined;
      const limit = q.limit ? Number(q.limit) : undefined;
      // Semantic (recall-by-meaning) mode falls back to lexical inside semanticRecall.
      if (q.semantic && q.semantic !== "0" && q.q) {
        return { episodes: await episodes.semanticRecall(q.q, limit && !Number.isNaN(limit) ? limit : 10), mode: "semantic" };
      }
      return {
        episodes: await episodes.recall({
          ...(q.q ? { query: q.q } : {}),
          ...(q.kind ? { kind: q.kind as EpisodeKind } : {}),
          ...(q.tag ? { tag: q.tag } : {}),
          ...(q.entity ? { entityName: q.entity } : {}),
          ...(since && !Number.isNaN(since.getTime()) ? { since } : {}),
          ...(limit !== undefined && !Number.isNaN(limit) ? { limit } : {}),
        }),
      };
    });
    app.post("/memory/episodes/:id/forget", async (req) => {
      const id = (req.params as { id: string }).id;
      return { forgotten: await episodes.forget(id) };
    });
  }
  // Semantic knowledge store (read + user control). Recall decrypts on read.
  if (entities) {
    app.get("/memory/entities", async (req) => {
      const kind = (req.query as { kind?: string }).kind;
      return { entities: await entities.listEntities(kind) };
    });
    app.get("/memory/entities/:name", async (req, reply) => {
      const name = decodeURIComponent((req.params as { name?: string }).name ?? "");
      const r = await entities.recall(name);
      if (!r) return reply.code(404).send({ error: `no memory of '${name}'` });
      // ?depth=N adds the multi-hop graph neighborhood (D-0045)
      const depth = Number((req.query as { depth?: string }).depth);
      if (Number.isFinite(depth) && depth > 0) {
        return { ...r, graph: await entities.traverse(name, depth) };
      }
      return r;
    });
    // Hybrid graph recall: ?q= finds entry points by meaning (lexical fallback) and
    // expands one hop; ?name=&depth= walks the neighborhood of a named entity.
    app.get("/memory/graph", async (req, reply) => {
      const q = req.query as { q?: string; name?: string; depth?: string };
      if (q.q) return entities.recallGraph(q.q);
      if (q.name) {
        const g = await entities.traverse(q.name, Number(q.depth) || 2);
        if (!g) return reply.code(404).send({ error: `no memory of '${q.name}'` });
        return g;
      }
      return reply.code(400).send({ error: "q or name required" });
    });
    app.post("/memory/entities/:name/forget", async (req) => {
      const name = decodeURIComponent((req.params as { name?: string }).name ?? "");
      return { forgotten: await entities.forgetEntity(name) };
    });
  }
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
