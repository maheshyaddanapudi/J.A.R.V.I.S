import type pg from "pg";
import type { AuditLog } from "../core/audit.js";

/**
 * General runtime settings registry (D-0058) — the mechanism behind "edit any
 * and all possible things through the UI." A CATALOG of typed settings, each
 * with a *current* default; the effective value is the persisted override if
 * one exists, else the current default. Both the user (UI/API) and J.A.R.V.I.S.
 * (gated tool) can set/clear any catalogued key; every write is ledgered
 * (source/reason/when). New knobs become UI-editable simply by being added to
 * the catalog — the panel renders whatever is registered.
 *
 * Z1 trust-core values are NEVER catalogued (R-CAP-08): the catalog is the
 * allowlist, so there is no key through which policy/approval/audit/e-stop/
 * credentials/sandbox could be edited here.
 */

export type SettingType = "number" | "boolean" | "string" | "enum" | "hour";
export type SettingValue = number | boolean | string;

export interface SettingSpec {
  key: string;
  label: string;
  category: string;
  type: SettingType;
  /** current default (evaluated live so it tracks code/config, never a snapshot) */
  default: () => SettingValue;
  description: string;
  min?: number;
  max?: number;
  step?: number;
  options?: readonly string[];
}

export interface EffectiveSetting {
  key: string;
  label: string;
  category: string;
  type: SettingType;
  value: SettingValue;
  default: SettingValue;
  source: "default" | "user" | "jarvis";
  reason: string;
  updatedAt: string | null;
  description: string;
  min?: number;
  max?: number;
  step?: number;
  options?: readonly string[];
}

interface Override {
  value: SettingValue;
  source: "user" | "jarvis";
  reason: string;
  updated_at: string;
}

function validate(spec: SettingSpec, raw: unknown): SettingValue {
  switch (spec.type) {
    case "number":
    case "hour": {
      const n = Number(raw);
      if (!Number.isFinite(n)) throw new Error(`${spec.key}: expected a number`);
      if (spec.min !== undefined && n < spec.min) throw new Error(`${spec.key}: min ${spec.min}`);
      if (spec.max !== undefined && n > spec.max) throw new Error(`${spec.key}: max ${spec.max}`);
      return n;
    }
    case "boolean":
      if (typeof raw === "boolean") return raw;
      if (raw === "true" || raw === "false") return raw === "true";
      throw new Error(`${spec.key}: expected a boolean`);
    case "enum": {
      const s = String(raw);
      if (!spec.options?.includes(s)) throw new Error(`${spec.key}: one of ${spec.options?.join("|")}`);
      return s;
    }
    case "string":
      return String(raw);
  }
}

export class SettingsRegistry {
  private readonly specs = new Map<string, SettingSpec>();

  /** notified after any set/reset so live consumers (e.g. the autonomy
   *  scheduler) can reconcile — set via onChange() */
  private changeListener?: (key: string) => void;

  constructor(
    private readonly pool: pg.Pool,
    private readonly audit: AuditLog,
    catalog: SettingSpec[],
  ) {
    for (const s of catalog) this.specs.set(s.key, s);
  }

  /** Register a listener called (best-effort) after a setting changes. */
  onChange(fn: (key: string) => void): void {
    this.changeListener = fn;
  }
  private notify(key: string): void {
    try { this.changeListener?.(key); } catch { /* listener is best-effort */ }
  }

  has(key: string): boolean {
    return this.specs.has(key);
  }

  private async override(key: string): Promise<Override | null> {
    try {
      const { rows } = await this.pool.query<Override>(
        `SELECT value, source, reason, updated_at::text FROM runtime_settings WHERE key = $1`,
        [key],
      );
      return rows[0] ?? null;
    } catch {
      return null; // settings are an overlay — a read failure falls back to defaults
    }
  }

  /** Effective typed value of a single setting (override ?? current default). */
  async get(key: string): Promise<SettingValue | undefined> {
    const spec = this.specs.get(key);
    if (!spec) return undefined;
    const o = await this.override(key);
    return o ? o.value : spec.default();
  }

  /** Convenience typed getters (fall back to the default's type). */
  async num(key: string, fallback: number): Promise<number> {
    const v = await this.get(key);
    return typeof v === "number" ? v : fallback;
  }
  async bool(key: string, fallback: boolean): Promise<boolean> {
    const v = await this.get(key);
    return typeof v === "boolean" ? v : fallback;
  }
  async str(key: string, fallback: string): Promise<string> {
    const v = await this.get(key);
    return typeof v === "string" ? v : fallback;
  }

  /** The full catalog with effective values — what the UI renders. */
  async effective(): Promise<EffectiveSetting[]> {
    const out: EffectiveSetting[] = [];
    for (const spec of this.specs.values()) {
      const o = await this.override(spec.key);
      const def = spec.default();
      out.push({
        key: spec.key,
        label: spec.label,
        category: spec.category,
        type: spec.type,
        value: o ? o.value : def,
        default: def,
        source: o ? o.source : "default",
        reason: o?.reason ?? "",
        updatedAt: o?.updated_at ?? null,
        description: spec.description,
        ...(spec.min !== undefined ? { min: spec.min } : {}),
        ...(spec.max !== undefined ? { max: spec.max } : {}),
        ...(spec.step !== undefined ? { step: spec.step } : {}),
        ...(spec.options ? { options: spec.options } : {}),
      });
    }
    return out;
  }

  /** Set a catalogued setting (user or J.A.R.V.I.S.); validated + ledgered. */
  async set(
    key: string,
    rawValue: unknown,
    source: "user" | "jarvis",
    reason: string,
  ): Promise<EffectiveSetting> {
    const spec = this.specs.get(key);
    if (!spec) throw new Error(`unknown setting '${key}' (not in the editable catalog)`);
    const value = validate(spec, rawValue);
    await this.pool.query(
      `INSERT INTO runtime_settings (key, value, source, reason, updated_at)
       VALUES ($1, $2::jsonb, $3, $4, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source,
                                       reason = EXCLUDED.reason, updated_at = now()`,
      [key, JSON.stringify(value), source, reason],
    );
    await this.audit.append({
      actor: source === "user" ? "user" : "kernel",
      event: "setting_set",
      payload: { key, source, reason },
    });
    this.notify(key);
    return (await this.effective()).find((e) => e.key === key)!;
  }

  /** Clear an override → the key returns to its current default. */
  async reset(key: string): Promise<EffectiveSetting> {
    if (!this.specs.has(key)) throw new Error(`unknown setting '${key}'`);
    await this.pool.query(`DELETE FROM runtime_settings WHERE key = $1`, [key]);
    await this.audit.append({ actor: "user", event: "setting_reset", payload: { key } });
    this.notify(key);
    return (await this.effective()).find((e) => e.key === key)!;
  }
}
