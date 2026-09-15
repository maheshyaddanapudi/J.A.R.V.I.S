import type pg from "pg";
import { redactSecrets } from "../core/audit.js";
import type { AuditLog } from "../core/audit.js";
import type { SettingsRegistry } from "../settings/registry.js";
import type { ActivityBus } from "../core/activity.js";
import type { Tool, ToolResult } from "../core/tools.js";

/**
 * Initiative to SPEAK (D-0068) — the outbound half of presence. Movie
 * J.A.R.V.I.S. decides "this warrants telling Sir" and says it; ours only ever
 * waited to be asked. Two kinds share the queue: an unprompted `say`, and an
 * advisory `concern` (dissent about an action J.A.R.V.I.S. thinks unwise — it
 * voices the objection, the user still decides; the action itself is unaffected
 * and still goes through the normal gate).
 *
 * Quiet-hours courtesy: non-urgent items are DEFERRED (queued, not surfaced)
 * while the household is asleep; `urgent` breaks through. Delivery (Mac TTS / UI
 * + notification) marks an item delivered; here we queue + surface to the
 * activity timeline and expose a pending feed. Never invents — a redacted,
 * non-secret line only.
 */
export type Urgency = "info" | "advisory" | "urgent";

export interface Announcement {
  id: string;
  at: string;
  kind: "say" | "concern";
  urgency: Urgency;
  text: string;
  about: string;
  recommendation: string;
  source: string;
  deferred: boolean;
  deliveredAt: string | null;
  dismissedAt: string | null;
}

export class Announcer {
  constructor(
    private readonly pool: pg.Pool,
    private readonly audit: AuditLog,
    private readonly settings: SettingsRegistry,
    private readonly activity: ActivityBus,
  ) {}

  private hydrate(r: Record<string, unknown>): Announcement {
    return {
      id: r.id as string, at: r.at as string, kind: r.kind as Announcement["kind"],
      urgency: r.urgency as Urgency, text: r.text as string, about: r.about as string,
      recommendation: r.recommendation as string, source: r.source as string,
      deferred: r.deferred as boolean, deliveredAt: (r.delivered_at as string) ?? null,
      dismissedAt: (r.dismissed_at as string) ?? null,
    };
  }

  private async inQuietHours(now: Date): Promise<boolean> {
    // quiet hours the user has switched off entirely hold nothing back
    // (found live 2026-08-28: only the window was consulted, so disabling
    // quiet hours didn't release deferred announcements)
    if (!(await this.settings.bool("proactive.quietHours.enabled", true))) return false;
    const start = await this.settings.num("proactive.quietHours.start", 22);
    const end = await this.settings.num("proactive.quietHours.end", 7);
    const h = now.getHours();
    return start <= end ? h >= start && h < end : h >= start || h < end;
  }

  /** Raise an announcement / concern. Dedupes by key within the last hour. */
  async raise(input: {
    text: string;
    urgency?: Urgency;
    kind?: "say" | "concern";
    about?: string;
    recommendation?: string;
    source: string;
    dedupeKey?: string;
    now?: Date;
  }): Promise<Announcement & { suppressed?: string }> {
    const text = redactSecrets(input.text.trim());
    if (!text) throw new Error("an announcement needs something to say");
    const urgency = input.urgency ?? "info";
    const now = input.now ?? new Date();

    if (input.dedupeKey) {
      const { rows } = await this.pool.query(
        `SELECT * FROM announcements WHERE dedupe_key = $1 AND at > now() - interval '1 hour'
           AND dismissed_at IS NULL ORDER BY at DESC LIMIT 1`,
        [input.dedupeKey],
      );
      if (rows[0]) return { ...this.hydrate(rows[0]), suppressed: "deduped" };
    }
    // quiet-hours courtesy: hold non-urgent until morning
    const deferred = urgency !== "urgent" && (await this.settings.bool("announce.holdInQuietHours", true)) && (await this.inQuietHours(now));

    const { rows } = await this.pool.query(
      `INSERT INTO announcements (kind, urgency, text, about, recommendation, source, dedupe_key, deferred)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [input.kind ?? "say", urgency, text, redactSecrets(input.about ?? ""), redactSecrets(input.recommendation ?? ""), input.source, input.dedupeKey ?? null, deferred],
    );
    const a = this.hydrate(rows[0]);
    await this.audit.append({ actor: "kernel", event: "announcement_raised", payload: { id: a.id, kind: a.kind, urgency: a.urgency, source: a.source } });
    if (!deferred) {
      this.activity.emit({ kind: "decision", summary: `${a.kind === "concern" ? "⚠ concern" : "◎ J.A.R.V.I.S. says"} [${a.urgency}]: ${a.text}`, at: a.at });
    }
    return a;
  }

  /** What J.A.R.V.I.S. wants to say now — undelivered, undismissed; deferred
   *  items are withheld while still in quiet hours, released afterwards. */
  async pending(now: Date = new Date()): Promise<Announcement[]> {
    const quiet = await this.inQuietHours(now);
    const { rows } = await this.pool.query(
      `SELECT * FROM announcements
        WHERE delivered_at IS NULL AND dismissed_at IS NULL
          AND (deferred = false OR $1 = false OR urgency = 'urgent')
        ORDER BY (urgency='urgent') DESC, at ASC LIMIT 50`,
      [quiet],
    );
    return rows.map((r) => this.hydrate(r));
  }

  async list(limit = 50): Promise<Announcement[]> {
    const { rows } = await this.pool.query(`SELECT * FROM announcements ORDER BY at DESC LIMIT $1`, [limit]);
    return rows.map((r) => this.hydrate(r));
  }

  async markDelivered(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(`UPDATE announcements SET delivered_at = now() WHERE id = $1 AND delivered_at IS NULL`, [id]);
    return (rowCount ?? 0) > 0;
  }
  async dismiss(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(`UPDATE announcements SET dismissed_at = now() WHERE id = $1 AND dismissed_at IS NULL`, [id]);
    return (rowCount ?? 0) > 0;
  }
}

/** Gated tools: how J.A.R.V.I.S. chooses to speak up or to dissent. Both are
 *  LOW_REVERSIBLE (they only queue a message — the ACTION being advised against
 *  is separate and still gated). */
export function announceTools(announcer: Announcer): Tool[] {
  const say: Tool = {
    name: "notify.announce",
    description:
      "Speak up to the user on your own initiative — an announcement they should hear now (e.g. something you noticed, a reminder coming due). " +
      "Use urgency 'urgent' ONLY for time-critical safety/security; 'info'/'advisory' are held quietly during the user's quiet hours.",
    riskClass: "LOW_REVERSIBLE",
    action: "announce to the user",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        urgency: { type: "string", enum: ["info", "advisory", "urgent"] },
        dedupeKey: { type: "string", description: "optional: collapse repeats of the same announcement" },
      },
      required: ["text"],
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as { text: string; urgency?: Urgency; dedupeKey?: string };
      const r = await announcer.raise({ text: a.text, ...(a.urgency ? { urgency: a.urgency } : {}), ...(a.dedupeKey ? { dedupeKey: a.dedupeKey } : {}), source: "jarvis" });
      return { ok: true, summary: r.suppressed ? `already announced (${r.suppressed})` : r.deferred ? `queued for after quiet hours: "${r.text}"` : `announced: "${r.text}"`, data: r };
    },
  };
  const concern: Tool = {
    name: "advise.concern",
    description:
      "Voice a CONCERN / advise against an action before it happens — your professional dissent. State what it's about, the concern, and what you'd recommend instead. " +
      "This does NOT block the action (the user decides and it still goes through approval); it makes sure your objection is heard.",
    riskClass: "LOW_REVERSIBLE",
    action: "advise a concern",
    inputSchema: {
      type: "object",
      properties: {
        about: { type: "string", description: "the action/decision you're concerned about" },
        concern: { type: "string", description: "why you'd advise against it" },
        recommendation: { type: "string", description: "what you'd do instead" },
      },
      required: ["about", "concern"],
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as { about: string; concern: string; recommendation?: string };
      const r = await announcer.raise({
        text: `I'd advise against ${a.about}: ${a.concern}`,
        kind: "concern", urgency: "advisory", about: a.about,
        ...(a.recommendation ? { recommendation: a.recommendation } : {}),
        source: "jarvis",
      });
      return { ok: true, summary: `concern raised about "${a.about}"`, data: r };
    },
  };
  return [say, concern];
}
