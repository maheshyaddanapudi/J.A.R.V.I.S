/**
 * Night-Lab apply-to-live (D-0079 Slice L4, R-LAB-06) — the ONLY path by
 * which a lab result reaches the live instance, and it is the normal gated
 * one: prompts via the prompts registry (supersede-with-history), settings
 * via the settings registry (ledgered). Three envelopes, strictest wins:
 *
 *   auto      — unpinned whitelisted settings + judge templates: the lab may
 *               apply them itself; the application is announced with the
 *               revert path.
 *   pinned    — a USER-pinned setting is NEVER auto-applied by the lab. One
 *               night of measurements is evidence, not the sustained D-0052
 *               contradiction trail; the result downgrades to a proposal
 *               carrying the evidence, and the user decides. (The sleep
 *               cycle's own D-0052 machinery may weigh lab rows as trail
 *               evidence over time — deliberately out of scope here.)
 *   proposal  — persona changes and anything else marked proposal: applied
 *               only with explicit user approval (`approvedByUser`).
 *
 * Everything applied captures its PRIOR state first, so revert is exact.
 */

import type pg from "pg";
import { validateCandidate, type LabCandidate } from "./surface.js";

interface SettingsLike {
  set(key: string, value: unknown, source: "user" | "jarvis", reason: string): Promise<unknown>;
  reset(key: string): Promise<unknown>;
  effective(): Promise<{ key: string; value: unknown; source?: string; origin?: string }[]>;
}
interface PromptsLike {
  get(name: string, kind: "template" | "persona"): Promise<{ name: string; content: string } | null>;
  getActive(kind: "template" | "persona"): Promise<{ name: string; content: string } | null>;
  set(input: { name: string; kind: "template" | "persona"; content: string; provenance?: string }): Promise<unknown>;
}
interface AnnouncerLike {
  raise(input: {
    text: string;
    kind?: "say" | "concern";
    urgency?: "info" | "advisory" | "urgent";
    source: string;
    dedupeKey?: string;
  }): Promise<unknown>;
}

export interface ApplyResult {
  ok: boolean;
  reason: string;
  applied?: { prompts: string[]; settings: string[] };
}

interface PriorState {
  prompts: { name: string; kind: "template" | "persona"; content: string | null }[];
  settings: { key: string; value: unknown; source: string | null }[];
}

export class LabApplier {
  constructor(
    private readonly pool: pg.Pool,
    private readonly audit: { append(e: { actor: string; event: string; payload?: unknown }): Promise<unknown> },
    private readonly settings: SettingsLike,
    private readonly prompts: PromptsLike,
    private readonly announcer?: AnnouncerLike,
  ) {}

  private async loadRow(id: string): Promise<{
    id: string;
    campaign: string;
    candidate: LabCandidate;
    summary: string;
    verdict: string;
    envelope: "auto" | "proposal";
    applied: boolean;
    appliedRef: string;
  } | null> {
    const { rows } = await this.pool.query(
      `SELECT id, campaign, candidate, candidate_summary, verdict, envelope, applied_to_live, applied_ref
       FROM lab_experiments WHERE id = $1`,
      [id],
    );
    if (!rows[0]) return null;
    return {
      id: rows[0].id as string,
      campaign: rows[0].campaign as string,
      candidate: rows[0].candidate as LabCandidate,
      summary: rows[0].candidate_summary as string,
      verdict: rows[0].verdict as string,
      envelope: rows[0].envelope as "auto" | "proposal",
      applied: rows[0].applied_to_live as boolean,
      appliedRef: (rows[0].applied_ref as string) ?? "",
    };
  }

  /** Is any setting in the candidate currently USER-pinned? */
  private async userPinnedKeys(candidate: LabCandidate): Promise<string[]> {
    const keys = Object.keys(candidate.settings ?? {});
    if (keys.length === 0) return [];
    const eff = await this.settings.effective();
    return keys.filter((k) => {
      const row = eff.find((e) => e.key === k) as { key: string; source?: string; origin?: string } | undefined;
      const src = row?.source ?? row?.origin;
      return src === "user";
    });
  }

  /**
   * Apply a KEPT experiment to the live instance under the three-envelope
   * rule. `approvedByUser` is required for the proposal envelope AND for any
   * user-pinned setting.
   */
  async applyKept(id: string, opts: { approvedByUser?: boolean } = {}): Promise<ApplyResult> {
    const row = await this.loadRow(id);
    if (!row) return { ok: false, reason: "experiment not found" };
    if (row.verdict !== "keep") return { ok: false, reason: `verdict is '${row.verdict}' — only kept experiments apply` };
    if (row.applied) return { ok: false, reason: "already applied" };

    // Defense in depth: re-validate against the CURRENT surface at apply time.
    const surface = validateCandidate(row.candidate);
    if (!surface.ok) return { ok: false, reason: `no longer in LAB_SURFACE: ${surface.violations.join("; ")}` };

    const pinned = await this.userPinnedKeys(row.candidate);
    const needsUser = row.envelope === "proposal" || surface.envelope === "proposal" || pinned.length > 0;
    if (needsUser && !opts.approvedByUser) {
      const why =
        pinned.length > 0
          ? `setting(s) ${pinned.join(", ")} are user-pinned — one night of lab evidence does not clear a pin (D-0052)`
          : "proposal envelope (persona or campaign-marked)";
      return { ok: false, reason: `requires explicit user approval: ${why}` };
    }

    // Capture PRIOR state for exact revert.
    const prior: PriorState = { prompts: [], settings: [] };
    for (const p of row.candidate.prompts ?? []) {
      const existing =
        p.kind === "persona"
          ? await this.prompts.getActive("persona").catch(() => null)
          : await this.prompts.get(p.name, "template").catch(() => null);
      prior.prompts.push({ name: existing?.name ?? p.name, kind: p.kind, content: existing?.content ?? null });
    }
    const eff = Object.keys(row.candidate.settings ?? {}).length > 0 ? await this.settings.effective() : [];
    for (const key of Object.keys(row.candidate.settings ?? {})) {
      const e = eff.find((x) => x.key === key) as { value?: unknown; source?: string; origin?: string } | undefined;
      prior.settings.push({ key, value: e?.value ?? null, source: (e?.source ?? e?.origin ?? null) as string | null });
    }

    // Apply through the NORMAL registries (never a side door).
    const applied = { prompts: [] as string[], settings: [] as string[] };
    for (const p of row.candidate.prompts ?? []) {
      const name = p.kind === "persona" ? (prior.prompts.find((q) => q.kind === "persona")?.name ?? p.name) : p.name;
      await this.prompts.set({ name, kind: p.kind, content: p.content, provenance: `night-lab experiment ${row.id}` });
      applied.prompts.push(`${name} (${p.kind})`);
    }
    for (const [key, value] of Object.entries(row.candidate.settings ?? {})) {
      await this.settings.set(
        key,
        value,
        opts.approvedByUser ? "user" : "jarvis",
        `night-lab experiment ${row.id}: ${row.summary}`,
      );
      applied.settings.push(key);
    }

    await this.pool.query(`UPDATE lab_experiments SET applied_to_live = true, applied_ref = $2 WHERE id = $1`, [
      row.id,
      JSON.stringify({ prior, appliedAt: new Date().toISOString(), approvedByUser: Boolean(opts.approvedByUser) }),
    ]);
    await this.audit.append({
      actor: opts.approvedByUser ? "user" : "jarvis-lab",
      event: "lab_apply",
      payload: { id: row.id, campaign: row.campaign, applied, approvedByUser: Boolean(opts.approvedByUser) },
    });
    await this.announcer?.raise({
      kind: "say",
      urgency: "info",
      source: "night-lab",
      text:
        `Applied lab result '${row.summary}' to the live instance` +
        ` (${[...applied.prompts, ...applied.settings].join(", ")}).` +
        ` Revert any time: POST /lab/experiments/${row.id}/revert or the /lab panel.`,
      dedupeKey: `night-lab-apply-${row.id}`,
    });
    return { ok: true, reason: "applied", applied };
  }

  /** Exact revert of an applied experiment from its captured prior state. */
  async revert(id: string): Promise<ApplyResult> {
    const row = await this.loadRow(id);
    if (!row) return { ok: false, reason: "experiment not found" };
    if (!row.applied) return { ok: false, reason: "not applied — nothing to revert" };
    let prior: PriorState;
    try {
      prior = (JSON.parse(row.appliedRef) as { prior: PriorState }).prior;
    } catch {
      return { ok: false, reason: "no prior state captured — revert manually via /prompts and /settings" };
    }
    const reverted = { prompts: [] as string[], settings: [] as string[] };
    for (const p of prior.prompts) {
      if (p.content === null) continue; // nothing existed before — leave history visible
      await this.prompts.set({ name: p.name, kind: p.kind, content: p.content, provenance: `revert of night-lab ${row.id}` });
      reverted.prompts.push(`${p.name} (${p.kind})`);
    }
    for (const s of prior.settings) {
      if (s.source === "user" || s.source === "jarvis") {
        await this.settings.set(s.key, s.value, s.source, `revert of night-lab ${row.id}`);
      } else {
        await this.settings.reset(s.key); // was default before — back to default
      }
      reverted.settings.push(s.key);
    }
    await this.pool.query(`UPDATE lab_experiments SET applied_to_live = false WHERE id = $1`, [row.id]);
    await this.audit.append({ actor: "user", event: "lab_revert", payload: { id: row.id, reverted } });
    return { ok: true, reason: "reverted", applied: reverted };
  }
}
