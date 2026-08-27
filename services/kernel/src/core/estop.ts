import type pg from "pg";
import type { AuditLog } from "./audit.js";

/**
 * Z1 TRUST CORE — PROTECTED PATH (R-CAP-08).
 *
 * Emergency-stop latch (R-AUTO-03): engaging halts all execution; state is
 * persisted (survives restart) and requires an explicit resume. In-process
 * checks are synchronous reads of a cached flag refreshed from Postgres, and
 * every engage/resume is audited and pushed to subscribers.
 */
export class EmergencyStop {
  private engaged = false;
  private listeners = new Set<(engaged: boolean) => void>();

  constructor(
    private readonly pool: pg.Pool,
    private readonly audit: AuditLog,
  ) {}

  async load(): Promise<void> {
    const { rows } = await this.pool.query<{ engaged: boolean }>(
      "SELECT engaged FROM estop WHERE id = true",
    );
    this.engaged = rows[0]?.engaged ?? false;
  }

  get isEngaged(): boolean {
    return this.engaged;
  }

  /** Synchronous gate used before/inside every executor step. */
  assertClear(): void {
    if (this.engaged) throw new Error("EMERGENCY STOP engaged — all execution halted");
  }

  onChange(fn: (engaged: boolean) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  async engage(via: string): Promise<void> {
    this.engaged = true; // latch locally FIRST — halt must not wait on the DB
    for (const fn of this.listeners) fn(true);
    await this.pool.query(
      "UPDATE estop SET engaged = true, engaged_at = now(), engaged_via = $1 WHERE id = true",
      [via],
    );
    await this.audit.append({ actor: "user", event: "estop_engaged", payload: { via } });
  }

  async resume(via: string): Promise<void> {
    await this.pool.query(
      "UPDATE estop SET engaged = false, resumed_at = now() WHERE id = true",
    );
    this.engaged = false;
    for (const fn of this.listeners) fn(false);
    await this.audit.append({ actor: "user", event: "estop_resumed", payload: { via } });
  }
}
