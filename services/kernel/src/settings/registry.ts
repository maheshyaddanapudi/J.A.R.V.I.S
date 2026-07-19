import type pg from "pg";
import type { AuditLog } from "../core/audit.js";

/**
 * General runtime settings registry (D-0058) + dynamic settings (D-0060) — the
 * mechanism behind "edit any and all possible things through the UI," including
 * knobs J.A.R.V.I.S. DISCOVERS at runtime.
 *
 * Two origins:
 *  - SYSTEM settings come from the static code catalog. They are the mandatory
 *    floor: always present, editable; "delete" just RESETS them to their default
 *    (they can't be removed — the default kicks back in).
 *  - DYNAMIC settings are registered at runtime (by J.A.R.V.I.S. or the user)
 *    and persisted (migration 0019). They are fully removable.
 *
 * The effective value of any setting is the persisted override (D-0058
 * `runtime_settings`) ?? its current default. Every write is ledgered
 * (source/reason/when). Z1 trust-core keys are refused on register — the
 * catalog + dynamic specs together are the allowlist (R-CAP-08).
 */

export type SettingType = "number" | "boolean" | "string" | "enum" | "hour";
export type SettingValue = number | boolean | string;
export type SettingOrigin = "system" | "dynamic";

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

/** Shape used to register a NEW dynamic setting at runtime. */
export interface DynamicSpecInput {
  key: string;
  label: string;
  category?: string;
  type: SettingType;
  default: SettingValue;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}

export interface EffectiveSetting {
  key: string;
  label: string;
  category: string;
  type: SettingType;
  value: SettingValue;
  default: SettingValue;
  source: "default" | "user" | "jarvis";
  origin: SettingOrigin;
  /** true = fully deletable (dynamic); false = system floor (delete = reset) */
  removable: boolean;
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

/** Z1 trust-core concerns may never become a setting (R-CAP-08). */
const Z1_KEY = /policy|approval|audit|estop|e-stop|credential|secret|vault|sandbox/i;

/** Normalize a key for near-duplicate detection (case/separator-insensitive). */
const normKey = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");
/** Word tokens of a label, for overlap-based duplicate detection. */
const tokens = (s: string): Set<string> => new Set(s.toLowerCase().match(/[a-z0-9]+/g) ?? []);
/** Jaccard overlap of two token sets (0..1). */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / new Set([...a, ...b]).size;
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
  private readonly origins = new Map<string, SettingOrigin>();
  private changeListener?: (key: string) => void;
  private removeListener?: (key: string) => void;

  constructor(
    private readonly pool: pg.Pool,
    private readonly audit: AuditLog,
    catalog: SettingSpec[],
  ) {
    for (const s of catalog) {
      this.specs.set(s.key, s);
      this.origins.set(s.key, "system");
    }
  }

  /** Load persisted dynamic specs (call once at startup). Best-effort. */
  async init(): Promise<void> {
    try {
      const { rows } = await this.pool.query<{
        key: string; label: string; category: string; type: SettingType;
        default_val: SettingValue; description: string;
        min_val: number | null; max_val: number | null; step_val: number | null; options: string[] | null;
      }>(`SELECT key, label, category, type, default_val, description, min_val, max_val, step_val, options FROM setting_specs`);
      for (const r of rows) {
        if (this.origins.get(r.key) === "system") continue; // never shadow a system key
        this.specs.set(r.key, {
          key: r.key, label: r.label, category: r.category, type: r.type,
          default: () => r.default_val, description: r.description,
          ...(r.min_val !== null ? { min: r.min_val } : {}),
          ...(r.max_val !== null ? { max: r.max_val } : {}),
          ...(r.step_val !== null ? { step: r.step_val } : {}),
          ...(r.options ? { options: r.options } : {}),
        });
        this.origins.set(r.key, "dynamic");
      }
    } catch { /* dynamic specs are additive — boot works without them */ }
  }

  onChange(fn: (key: string) => void): void { this.changeListener = fn; }
  private notify(key: string): void {
    try { this.changeListener?.(key); } catch { /* best-effort */ }
  }
  /** Fired when a setting is actually DELETED (dynamic removal), so dependents
   *  (e.g. A2UI panels referencing it) can prune themselves — D-0060 cascade. */
  onRemove(fn: (key: string) => void): void { this.removeListener = fn; }
  private notifyRemove(key: string): void {
    try { this.removeListener?.(key); } catch { /* best-effort */ }
  }

  has(key: string): boolean { return this.specs.has(key); }
  origin(key: string): SettingOrigin | undefined { return this.origins.get(key); }

  private async override(key: string): Promise<Override | null> {
    try {
      const { rows } = await this.pool.query<Override>(
        `SELECT value, source, reason, updated_at::text FROM runtime_settings WHERE key = $1`,
        [key],
      );
      return rows[0] ?? null;
    } catch {
      return null;
    }
  }

  async get(key: string): Promise<SettingValue | undefined> {
    const spec = this.specs.get(key);
    if (!spec) return undefined;
    const o = await this.override(key);
    return o ? o.value : spec.default();
  }

  async num(key: string, fallback: number): Promise<number> {
    const v = await this.get(key); return typeof v === "number" ? v : fallback;
  }
  async bool(key: string, fallback: boolean): Promise<boolean> {
    const v = await this.get(key); return typeof v === "boolean" ? v : fallback;
  }
  async str(key: string, fallback: string): Promise<string> {
    const v = await this.get(key); return typeof v === "string" ? v : fallback;
  }

  private row(spec: SettingSpec, o: Override | null): EffectiveSetting {
    const def = spec.default();
    const origin = this.origins.get(spec.key) ?? "system";
    return {
      key: spec.key, label: spec.label, category: spec.category, type: spec.type,
      value: o ? o.value : def, default: def,
      source: o ? o.source : "default", origin, removable: origin === "dynamic",
      reason: o?.reason ?? "", updatedAt: o?.updated_at ?? null, description: spec.description,
      ...(spec.min !== undefined ? { min: spec.min } : {}),
      ...(spec.max !== undefined ? { max: spec.max } : {}),
      ...(spec.step !== undefined ? { step: spec.step } : {}),
      ...(spec.options ? { options: spec.options } : {}),
    };
  }

  /** The full catalog (system + dynamic) with effective values — the UI renders this. */
  async effective(): Promise<EffectiveSetting[]> {
    const out: EffectiveSetting[] = [];
    for (const spec of this.specs.values()) out.push(this.row(spec, await this.override(spec.key)));
    return out;
  }

  async set(key: string, rawValue: unknown, source: "user" | "jarvis", reason: string): Promise<EffectiveSetting> {
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
    await this.audit.append({ actor: source === "user" ? "user" : "kernel", event: "setting_set", payload: { key, source, reason } });
    this.notify(key);
    return this.row(spec, await this.override(key));
  }

  /** Clear an override → the current default kicks back in. */
  async reset(key: string): Promise<EffectiveSetting> {
    const spec = this.specs.get(key);
    if (!spec) throw new Error(`unknown setting '${key}'`);
    await this.pool.query(`DELETE FROM runtime_settings WHERE key = $1`, [key]);
    await this.audit.append({ actor: "user", event: "setting_reset", payload: { key } });
    this.notify(key);
    return this.row(spec, await this.override(key));
  }

  /**
   * Register a NEW dynamic setting at runtime (J.A.R.V.I.S.'s own evolution or
   * the user). Persisted so it survives restart; refuses Z1 keys and collisions
   * with system keys.
   */
  async register(input: DynamicSpecInput, createdBy: "jarvis" | "user"): Promise<EffectiveSetting> {
    const key = input.key.trim();
    if (!/^[a-z][a-z0-9_.-]{1,80}$/i.test(key)) throw new Error(`invalid setting key '${key}'`);
    if (Z1_KEY.test(key)) throw new Error(`refused: '${key}' names a protected trust-core concern (R-CAP-08)`);
    if (this.origins.get(key) === "system") throw new Error(`'${key}' is a system setting — cannot redefine`);
    if (!["number", "boolean", "string", "enum", "hour"].includes(input.type)) throw new Error(`bad type '${input.type}'`);
    if (input.type === "enum" && !(input.options && input.options.length)) throw new Error(`enum '${key}' needs options`);
    // Near-duplicate guard (D-0060 gap fix): refuse a knob that is effectively the
    // same as one that already exists — a normalized-key collision (quiet_hours vs
    // quietHours) or a high label-token overlap (≥0.6, e.g. "Quiet Hours Start" vs
    // "Quiet Hours Start Time"). Re-registering the SAME key is allowed (upsert).
    // The remedy the message points to is settings.list → edit/remove the existing.
    const nkey = normKey(key);
    const nlabel = tokens(input.label);
    for (const [k, sp] of this.specs) {
      if (k === key) continue;
      if (normKey(k) === nkey || jaccard(nlabel, tokens(sp.label)) >= 0.6) {
        throw new Error(
          `refused: a very similar setting already exists — '${k}' ("${sp.label}"). ` +
          `Edit or remove it (see settings.list) instead of creating a near-duplicate.`,
        );
      }
    }
    // validate the declared default against its own spec
    const spec: SettingSpec = {
      key, label: input.label, category: input.category ?? "Discovered", type: input.type,
      default: () => input.default, description: input.description ?? "",
      ...(input.min !== undefined ? { min: input.min } : {}),
      ...(input.max !== undefined ? { max: input.max } : {}),
      ...(input.step !== undefined ? { step: input.step } : {}),
      ...(input.options ? { options: input.options } : {}),
    };
    validate(spec, input.default);
    await this.pool.query(
      `INSERT INTO setting_specs (key, label, category, type, default_val, description, min_val, max_val, step_val, options, created_by)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10::jsonb,$11)
       ON CONFLICT (key) DO UPDATE SET label=EXCLUDED.label, category=EXCLUDED.category, type=EXCLUDED.type,
         default_val=EXCLUDED.default_val, description=EXCLUDED.description, min_val=EXCLUDED.min_val,
         max_val=EXCLUDED.max_val, step_val=EXCLUDED.step_val, options=EXCLUDED.options`,
      [key, spec.label, spec.category, spec.type, JSON.stringify(input.default), spec.description,
       input.min ?? null, input.max ?? null, input.step ?? null,
       input.options ? JSON.stringify(input.options) : null, createdBy],
    );
    this.specs.set(key, spec);
    this.origins.set(key, "dynamic");
    await this.audit.append({ actor: createdBy === "user" ? "user" : "kernel", event: "setting_registered", payload: { key, createdBy } });
    this.notify(key);
    return this.row(spec, await this.override(key));
  }

  /**
   * Delete a setting. SYSTEM settings are the floor — "delete" resets them to
   * default (they cannot be removed). DYNAMIC settings are removed entirely
   * (spec + any override). Returns which happened.
   */
  async remove(key: string): Promise<{ action: "reset" | "deleted"; setting?: EffectiveSetting }> {
    const spec = this.specs.get(key);
    if (!spec) throw new Error(`unknown setting '${key}'`);
    if (this.origins.get(key) === "system") {
      return { action: "reset", setting: await this.reset(key) };
    }
    await this.pool.query(`DELETE FROM setting_specs WHERE key = $1`, [key]);
    await this.pool.query(`DELETE FROM runtime_settings WHERE key = $1`, [key]);
    this.specs.delete(key);
    this.origins.delete(key);
    await this.audit.append({ actor: "user", event: "setting_deleted", payload: { key } });
    this.notify(key);
    this.notifyRemove(key); // cascade: let A2UI prune panels referencing this key
    return { action: "deleted" };
  }
}
