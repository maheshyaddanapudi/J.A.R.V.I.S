/**
 * Contextual awareness (R-CTX). J.A.R.V.I.S. answers with situational awareness:
 * time of day, what the user has committed to, what is pending, what was just
 * happening. This is the typed contract; `service.ts` aggregates the signals
 * available in the kernel, and additional providers (Mac-only signals like the
 * focused app or foreground document — HARDWARE-DEPENDENT) plug in behind
 * `ContextProvider` without changing the loop.
 *
 * SECURITY: context is REFERENCE data for the local model only. It carries the
 * user's own local data (never external/untrusted content as instructions — T2),
 * defaults to the LOCAL_ONLY privacy class, and is labeled in the prompt as
 * reference, not commands.
 */

export interface CommitmentContext {
  title: string;
  dueAt: string;
  domain: string;
  overdue: boolean;
  dueSoon: boolean; // within the soon-window
}

export interface ProactiveContext {
  title: string;
  priority: string;
  domain: string;
}

export interface PinnedFact {
  key: string;
  value: string; // never a `secret`/`private` value — those are excluded
}

/** A recently-referenced entity from semantic memory (non-sensitive facts only). */
export interface KnownEntity {
  name: string;
  kind: string;
  facts: string[]; // public/personal facts only — private/secret excluded
}

/** Read model over the semantic memory for context (only non-sensitive content). */
export interface KnowledgeSource {
  recentForContext(limit: number): Promise<KnownEntity[]>;
}

export interface ContextSnapshot {
  now: string; // ISO
  partOfDay: "night" | "morning" | "afternoon" | "evening";
  commitments: CommitmentContext[];
  proactive: ProactiveContext[];
  pinnedFacts: PinnedFact[];
  /** recently-referenced entities J.A.R.V.I.S. knows about (non-sensitive) */
  knownEntities: KnownEntity[];
  pendingApprovals: { count: number; tools: string[] };
  emergencyStop: boolean;
  mcpServers: number;
  /** contributions from optional providers (e.g. Mac focused-app), by name */
  extra: Record<string, string>;
}

/**
 * A pluggable context source. Kernel-internal aggregation is built in; Mac-only
 * signals implement this and are injected on the Mac (never faked in-container).
 * `key` is the field name in `ContextSnapshot.extra`.
 */
export interface ContextProvider {
  key: string;
  /** Provenance so the snapshot never presents inferred/simulated as real. */
  provenance: "REAL" | "SIMULATION" | "INFERRED";
  get(now: Date): Promise<string | null>;
}
