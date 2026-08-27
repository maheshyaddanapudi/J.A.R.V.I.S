/**
 * Research-with-provenance capability (Phase 2 — "research pipeline with per-claim
 * provenance", parity C3). Gathers evidence across web sources so that every
 * finding is traceable to the exact source it came from — no unsourced claims
 * (honesty rule R-CORE-02; the spec's "per-claim provenance").
 *
 * It composes the REAL web browser (gated): one research action opens the named
 * sources, extracts the passages most relevant to the query, and returns them
 * each tagged with {url, title, line, snippet}. Synthesis into an answer is the
 * agent's job — it receives the sourced evidence and must cite it.
 */

export interface Evidence {
  /** source URL the passage came from */
  url: string;
  /** page title of the source */
  title: string;
  /** 1-based line index within the extracted page text */
  line: number;
  /** the passage text (trimmed/capped) */
  snippet: string;
  /** relevance score (count of distinct query terms matched) */
  score: number;
}

export interface SourceStatus {
  url: string;
  title: string;
  ok: boolean;
  /** why a source was skipped (policy refusal, fetch error) */
  error?: string;
}

export interface ResearchFindings {
  query: string;
  sources: SourceStatus[];
  /** evidence across all sources, most-relevant first */
  evidence: Evidence[];
}

export interface GatherOptions {
  /** max passages kept per source (default 3) */
  perSource?: number;
  /** max snippet length in chars (default 240) */
  maxSnippet?: number;
}

export interface TargetCheck {
  url: string;
  allowed: boolean;
  reason?: string;
}

export interface Researcher {
  /** Policy-check every target URL WITHOUT fetching (for a tool's disclosure). */
  checkTargets(urls: string[]): TargetCheck[];
  /** Open each source (gated), extract query-relevant passages with provenance. */
  gather(query: string, urls: string[], opts?: GatherOptions): Promise<ResearchFindings>;
}
