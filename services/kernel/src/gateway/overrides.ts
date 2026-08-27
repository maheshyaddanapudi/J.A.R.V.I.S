import { parseRolePin } from "./config.js";
import type { GatewayRouter } from "./router.js";
import { ModelRoles, type ModelRole } from "./schema.js";

/**
 * Runtime role-override persistence (D-0054). Overrides live as ONE ordinary
 * preference (`gateway_role_overrides`) — history-preserving, visible in the
 * memory panel, restored on boot — keyed by role with the canonical pin syntax
 * plus the override ledger (reason + when; source is always the user today:
 * the sleep cycle proposes pins, applying one is a user action).
 */

export const ROLE_OVERRIDES_KEY = "gateway_role_overrides";

export interface StoredRoleOverrides {
  [role: string]: { pins: string[]; reason: string; at: string };
}

interface Store {
  get(key: string): Promise<{ value: string } | null>;
  remember(input: { key: string; value: string; provenance: string }): Promise<unknown>;
}

/** Re-apply persisted overrides onto a freshly constructed router (boot).
 *  Best-effort per entry: a stale pin (provider removed from config) is
 *  skipped with its error returned — never a boot failure. */
export async function loadRoleOverrides(
  router: GatewayRouter,
  store: Store,
): Promise<{ applied: number; skipped: string[] }> {
  const skipped: string[] = [];
  let applied = 0;
  let stored: StoredRoleOverrides = {};
  try {
    const row = await store.get(ROLE_OVERRIDES_KEY);
    if (row) stored = JSON.parse(row.value) as StoredRoleOverrides;
  } catch {
    return { applied, skipped };
  }
  for (const [role, o] of Object.entries(stored)) {
    try {
      if (!(ModelRoles as readonly string[]).includes(role)) throw new Error(`unknown role`);
      router.overrideRole(
        role as ModelRole,
        o.pins.map((p) => parseRolePin(role, p)),
        { reason: o.reason, at: o.at },
      );
      applied++;
    } catch (err) {
      skipped.push(`${role}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { applied, skipped };
}

/** Persist the router's current overrides (called after every PUT/DELETE). */
export async function persistRoleOverrides(router: GatewayRouter, store: Store): Promise<void> {
  await store.remember({
    key: ROLE_OVERRIDES_KEY,
    value: JSON.stringify(router.overrides()),
    provenance: "user-override",
  });
}
