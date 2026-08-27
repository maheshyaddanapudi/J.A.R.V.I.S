import type { AuditLog } from "../core/audit.js";

/**
 * Hardware interlock (R-AUTO-01). HIGH_RISK_PHYSICAL device actions (locks,
 * garage, utilities) require, IN ADDITION to per-action approval, an independent
 * interlock confirmation — a second, physical-world safety gate so a single
 * mistaken approval can't move matter with meaningful energy.
 *
 * In the container the interlock is a policy object the user arms explicitly
 * (arm(deviceId) for a short window). On the Mac it can be backed by a real
 * physical control (a hardware key, a phone-side confirmation, a wired switch)
 * behind this same interface. An action whose interlock is not armed is refused
 * even if approved.
 */
export class InterlockManager {
  private armed = new Map<string, number>(); // deviceId -> expiry epoch ms

  constructor(
    private readonly audit: AuditLog,
    private readonly windowMs = 30_000,
  ) {}

  async arm(deviceId: string, now: number): Promise<{ expiresAt: number }> {
    const expiresAt = now + this.windowMs;
    this.armed.set(deviceId, expiresAt);
    await this.audit.append({ actor: "user", event: "interlock_armed", payload: { deviceId, expiresAt } });
    return { expiresAt };
  }

  /** Consume the interlock for a device — one-shot; returns false if not armed. */
  async consume(deviceId: string, now: number): Promise<boolean> {
    const expiry = this.armed.get(deviceId);
    if (!expiry || expiry < now) {
      await this.audit.append({ actor: "kernel", event: "interlock_denied", payload: { deviceId } });
      return false;
    }
    this.armed.delete(deviceId); // single-use
    await this.audit.append({ actor: "kernel", event: "interlock_consumed", payload: { deviceId } });
    return true;
  }

  isArmed(deviceId: string, now: number): boolean {
    const expiry = this.armed.get(deviceId);
    return !!expiry && expiry >= now;
  }
}
