import type pg from "pg";
import type { Candidate, Priority } from "./types.js";

/**
 * Candidate generators — turn real stored data (commitments, calendar events)
 * into proactive candidates. These read only; they never act. Timestamps are
 * passed in (`now`) for deterministic testing.
 */

/** Upcoming/overdue commitments → deadline candidates. */
export async function commitmentCandidates(pool: pg.Pool, now: Date): Promise<Candidate[]> {
  const { rows } = await pool.query<{
    id: string;
    title: string;
    due_at: Date;
    domain: string;
  }>("SELECT id, title, due_at, domain FROM commitments WHERE status = 'open' ORDER BY due_at");

  const out: Candidate[] = [];
  for (const c of rows) {
    const hoursUntil = (c.due_at.getTime() - now.getTime()) / 3_600_000;
    if (hoursUntil < 0) {
      out.push({
        kind: "commitment_overdue",
        priority: "high",
        domain: c.domain,
        title: `Overdue: ${c.title}`,
        detail: `Was due ${fmt(c.due_at)} (${Math.round(-hoursUntil)}h ago).`,
        confidence: 0.95,
        dedupKey: `overdue:${c.id}`,
      });
    } else if (hoursUntil <= 24) {
      const priority: Priority = hoursUntil <= 2 ? "high" : "normal";
      out.push({
        kind: "deadline_due",
        priority,
        domain: c.domain,
        title: `Due soon: ${c.title}`,
        detail: `Due ${fmt(c.due_at)} (in ${Math.round(hoursUntil)}h).`,
        confidence: 0.85,
        dedupKey: `due:${c.id}:${dayKey(c.due_at)}`,
      });
    }
  }
  return out;
}

/** Overlapping calendar events → conflict candidates. */
export async function calendarConflictCandidates(pool: pg.Pool, now: Date): Promise<Candidate[]> {
  const horizon = new Date(now.getTime() + 14 * 24 * 3_600_000);
  const { rows } = await pool.query<{
    id: string;
    title: string;
    starts_at: Date;
    ends_at: Date;
    domain: string;
  }>(
    `SELECT id, title, starts_at, ends_at, domain FROM calendar_events
     WHERE ends_at >= $1 AND starts_at <= $2 ORDER BY starts_at`,
    [now, horizon],
  );

  const out: Candidate[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i]!;
      const b = rows[j]!;
      if (a.starts_at < b.ends_at && b.starts_at < a.ends_at) {
        const key = [a.id, b.id].sort().join("|");
        out.push({
          kind: "calendar_conflict",
          priority: "high",
          domain: "calendar",
          title: `Calendar conflict`,
          detail: `'${a.title}' (${fmt(a.starts_at)}) overlaps '${b.title}' (${fmt(b.starts_at)}).`,
          confidence: 0.9,
          dedupKey: `conflict:${key}`,
        });
      }
    }
  }
  return out;
}

/** A morning briefing candidate composed from the day's items. */
export async function briefingCandidate(pool: pg.Pool, now: Date): Promise<Candidate | null> {
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);
  const { rows: due } = await pool.query<{ n: string }>(
    "SELECT count(*)::text AS n FROM commitments WHERE status='open' AND due_at BETWEEN $1 AND $2",
    [now, dayEnd],
  );
  const { rows: events } = await pool.query<{ n: string }>(
    "SELECT count(*)::text AS n FROM calendar_events WHERE starts_at BETWEEN $1 AND $2",
    [now, dayEnd],
  );
  const dueN = Number(due[0]!.n);
  const evN = Number(events[0]!.n);
  if (dueN === 0 && evN === 0) return null;
  return {
    kind: "briefing",
    priority: "normal",
    domain: "briefing",
    title: "Today's briefing",
    detail: `${evN} event(s) and ${dueN} item(s) due today.`,
    confidence: 0.8,
    dedupKey: `briefing:${dayKey(now)}`,
  };
}

function fmt(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 16);
}
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
