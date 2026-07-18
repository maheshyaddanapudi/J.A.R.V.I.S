import type pg from "pg";
import type { AuditLog } from "../core/audit.js";
import type { SettingsRegistry } from "../settings/registry.js";
import type { ToolRegistry } from "../core/tools.js";
import { A2uiSpecSchema, validateReferences, type A2uiSpec } from "./schema.js";

export interface A2uiPanel {
  id: string;
  title: string;
  spec: A2uiSpec;
  createdBy: string;
  createdAt: string;
}

/**
 * A2UI panel store (D-0061). Validates every spec against the whitelist schema
 * AND checks that its references (settings/categories/tools) really exist before
 * persisting — so a stored panel can only target real, safe surfaces. Panels are
 * listable + deletable (agent-generated UI is never permanent or unremovable).
 */
export class A2uiRegistry {
  constructor(
    private readonly pool: pg.Pool,
    private readonly audit: AuditLog,
    private readonly settings: SettingsRegistry,
    private readonly tools: ToolRegistry,
  ) {}

  /** Validate a spec fully (schema + references). Throws on any problem. */
  async validate(raw: unknown): Promise<A2uiSpec> {
    const parsed = A2uiSpecSchema.safeParse(raw);
    if (!parsed.success) throw new Error(`invalid A2UI spec: ${parsed.error.message}`);
    const spec = parsed.data;
    const effective = await this.settings.effective();
    const keys = new Set(effective.map((e) => e.key));
    const cats = new Set(effective.map((e) => e.category));
    const toolNames = new Set(this.tools.list().map((t) => t.name));
    const refErrors = validateReferences(spec, {
      hasSetting: (k) => keys.has(k),
      hasCategory: (c) => cats.has(c),
      hasTool: (n) => toolNames.has(n),
    });
    if (refErrors.length) throw new Error(`A2UI spec references: ${refErrors.join("; ")}`);
    return spec;
  }

  async create(raw: unknown, createdBy: "jarvis" | "user"): Promise<A2uiPanel> {
    const spec = await this.validate(raw);
    const { rows } = await this.pool.query<{ id: string; created_at: string }>(
      `INSERT INTO ui_panels (title, spec, created_by) VALUES ($1, $2::jsonb, $3)
       RETURNING id, created_at::text`,
      [spec.title, JSON.stringify(spec), createdBy],
    );
    await this.audit.append({ actor: createdBy === "user" ? "user" : "kernel", event: "a2ui_panel_created", payload: { id: rows[0]!.id, title: spec.title } });
    return { id: rows[0]!.id, title: spec.title, spec, createdBy, createdAt: rows[0]!.created_at };
  }

  async list(): Promise<A2uiPanel[]> {
    const { rows } = await this.pool.query<{ id: string; title: string; spec: A2uiSpec; created_by: string; created_at: string }>(
      `SELECT id, title, spec, created_by, created_at::text FROM ui_panels ORDER BY created_at DESC`,
    );
    return rows.map((r) => ({ id: r.id, title: r.title, spec: r.spec, createdBy: r.created_by, createdAt: r.created_at }));
  }

  async get(id: string): Promise<A2uiPanel | null> {
    const { rows } = await this.pool.query<{ id: string; title: string; spec: A2uiSpec; created_by: string; created_at: string }>(
      `SELECT id, title, spec, created_by, created_at::text FROM ui_panels WHERE id = $1`,
      [id],
    );
    const r = rows[0];
    return r ? { id: r.id, title: r.title, spec: r.spec, createdBy: r.created_by, createdAt: r.created_at } : null;
  }

  async remove(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(`DELETE FROM ui_panels WHERE id = $1`, [id]);
    if (rowCount) await this.audit.append({ actor: "user", event: "a2ui_panel_deleted", payload: { id } });
    return Boolean(rowCount);
  }
}
