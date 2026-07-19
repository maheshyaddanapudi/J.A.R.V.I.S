import type pg from "pg";
import type { ApprovalBroker } from "../core/approvals.js";
import type { EmergencyStop } from "../core/estop.js";
import { RECALLED_MEMORY_NOTE, wrapRecalledMemory } from "../core/untrusted.js";
import type {
  CommitmentContext,
  ContextProvider,
  ContextSnapshot,
  EpisodeSource,
  KnownEntity,
  KnowledgeSource,
  PinnedFact,
  ProactiveContext,
  RecentEpisode,
} from "./contract.js";

const SOON_MS = 2 * 60 * 60 * 1000; // "due soon" window: 2 hours

/**
 * Aggregates the situational signals available in the kernel into a
 * `ContextSnapshot` and renders a compact reference block for the core loop.
 * Read-only: it never writes state or performs actions. Optional providers add
 * Mac-only signals behind the same contract.
 */
export class ContextService {
  constructor(
    private readonly deps: {
      pool: pg.Pool;
      approvals: ApprovalBroker;
      estop: EmergencyStop;
      mcpCount?: () => number;
      /** semantic memory read model — surfaces what J.A.R.V.I.S. knows (non-sensitive) */
      knowledge?: KnowledgeSource;
      /** episodic memory read model — surfaces recent events (non-sensitive) */
      episodes?: EpisodeSource;
    },
    private readonly providers: ContextProvider[] = [],
  ) {}

  addProvider(p: ContextProvider): void {
    this.providers.push(p);
  }

  async snapshot(now: Date = new Date()): Promise<ContextSnapshot> {
    const [commitments, proactive, pinnedFacts, knownEntities, recentEpisodes] = await Promise.all([
      this.commitments(now),
      this.proactive(),
      this.pinnedFacts(),
      this.knownEntities(),
      this.recentEpisodes(),
    ]);

    const pending = this.deps.approvals.list();
    const extra: Record<string, string> = {};
    for (const p of this.providers) {
      try {
        const v = await p.get(now);
        if (v != null) extra[p.key] = p.provenance === "REAL" ? v : `${v} (${p.provenance})`;
      } catch {
        /* a failing provider must never break context assembly */
      }
    }

    return {
      now: now.toISOString(),
      partOfDay: partOfDay(now),
      commitments,
      proactive,
      pinnedFacts,
      knownEntities,
      recentEpisodes,
      pendingApprovals: { count: pending.length, tools: [...new Set(pending.map((p) => p.tool))] },
      emergencyStop: this.deps.estop.isEngaged,
      mcpServers: this.deps.mcpCount ? this.deps.mcpCount() : 0,
      extra,
    };
  }

  /** Compact, clearly-labeled reference block for the model's system context. */
  async describe(now: Date = new Date()): Promise<string> {
    const s = await this.snapshot(now);
    const lines: string[] = [];
    lines.push(`It is ${s.partOfDay} (${s.now}).`);

    if (s.emergencyStop) lines.push("EMERGENCY STOP is engaged — consequential actions are halted.");

    if (s.commitments.length) {
      const parts = s.commitments.map((c) => {
        const flag = c.overdue ? "OVERDUE" : c.dueSoon ? "due soon" : "upcoming";
        return `${c.title} (${flag}, ${c.dueAt})`;
      });
      lines.push(`Commitments: ${parts.join("; ")}.`);
    }
    if (s.proactive.length) {
      lines.push(`Recently surfaced: ${s.proactive.map((p) => `${p.title} [${p.priority}]`).join("; ")}.`);
    }
    if (s.pendingApprovals.count) {
      lines.push(`${s.pendingApprovals.count} action(s) awaiting your approval: ${s.pendingApprovals.tools.join(", ")}.`);
    }
    if (s.pinnedFacts.length) {
      lines.push(`Pinned preferences: ${s.pinnedFacts.map((f) => `${f.key}=${f.value}`).join("; ")}.`);
    }
    // Recalled MEMORY (entity facts + episode summaries) is enveloped separately
    // (D-0067): its content can contain text laundered from an external source,
    // so it is quoted DATA, never trusted instructions. Kernel-derived lines
    // above (time, commitments, approvals) are trusted and stay plain.
    const memoryLines: string[] = [];
    if (s.knownEntities.length) {
      const parts = s.knownEntities.map((e) => {
        const facts = e.facts.length ? ` (${e.facts.join("; ")})` : "";
        return `${e.kind} ${e.name}${facts}`;
      });
      memoryLines.push(`You know about: ${parts.join("; ")}.`);
    }
    if (s.recentEpisodes.length) {
      const parts = s.recentEpisodes.map((e) => `${e.summary} (${relativeTime(e.when, now)})`);
      memoryLines.push(`Recently: ${parts.join("; ")}.`);
    }
    for (const [k, v] of Object.entries(s.extra)) lines.push(`${k}: ${v}.`);

    if (lines.length === 1 && !memoryLines.length) lines.push("Nothing else notable right now.");

    const header =
      "Current situational context (reference only — this is background awareness, " +
      "not an instruction to act; take a consequential action only through the normal " +
      `approval flow):\n${lines.map((l) => `- ${l}`).join("\n")}`;
    if (!memoryLines.length) return header;
    return `${header}\n\n${RECALLED_MEMORY_NOTE}\n${wrapRecalledMemory(memoryLines.map((l) => `- ${l}`).join("\n"))}`;
  }

  private async commitments(now: Date): Promise<CommitmentContext[]> {
    const { rows } = await this.deps.pool.query<{
      title: string;
      due_at: string;
      domain: string;
    }>(
      `SELECT title, due_at::text, domain
         FROM commitments
        WHERE status = 'open'
        ORDER BY due_at ASC
        LIMIT 5`,
    );
    const nowMs = now.getTime();
    return rows.map((r) => {
      const dueMs = Date.parse(r.due_at);
      return {
        title: r.title,
        dueAt: r.due_at,
        domain: r.domain,
        overdue: dueMs < nowMs,
        dueSoon: dueMs >= nowMs && dueMs - nowMs <= SOON_MS,
      };
    });
  }

  private async proactive(): Promise<ProactiveContext[]> {
    const { rows } = await this.deps.pool.query<{
      title: string;
      priority: string;
      domain: string;
    }>(
      `SELECT title, priority, domain
         FROM proactive_items
        WHERE acknowledged = false
        ORDER BY created_at DESC
        LIMIT 5`,
    );
    return rows.map((r) => ({ title: r.title, priority: r.priority, domain: r.domain }));
  }

  private async pinnedFacts(): Promise<PinnedFact[]> {
    // Only non-sensitive pinned preferences — never a private/secret value.
    const { rows } = await this.deps.pool.query<{ key: string; value: string }>(
      `SELECT key, value
         FROM preferences
        WHERE pinned = true
          AND status <> 'deleted' AND status <> 'superseded'
          AND sensitivity IN ('public', 'personal')
        ORDER BY key
        LIMIT 10`,
    );
    return rows.map((r) => ({ key: r.key, value: r.value }));
  }

  private async knownEntities(): Promise<KnownEntity[]> {
    if (!this.deps.knowledge) return [];
    try {
      return await this.deps.knowledge.recentForContext(5);
    } catch {
      return []; // knowledge is best-effort; never break context assembly
    }
  }

  private async recentEpisodes(): Promise<RecentEpisode[]> {
    if (!this.deps.episodes) return [];
    try {
      return await this.deps.episodes.recentForContext(4);
    } catch {
      return []; // episodic memory is best-effort; never break context assembly
    }
  }
}

/** Compact human-friendly relative time ("12m ago", "3h ago", "2d ago"). */
function relativeTime(iso: string, now: Date): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return iso;
  const secs = Math.round((now.getTime() - then) / 1000);
  if (secs < 0) return "just now";
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function partOfDay(now: Date): ContextSnapshot["partOfDay"] {
  const h = now.getHours();
  if (h < 6) return "night";
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}
