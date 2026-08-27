import type { WebBrowser } from "../web/contract.js";
import type {
  Evidence,
  GatherOptions,
  Researcher,
  ResearchFindings,
  SourceStatus,
  TargetCheck,
} from "./contract.js";

/**
 * Researcher backed by the REAL web browser. Opens each source through the same
 * network policy the web tools use (checkTarget), extracts the passages most
 * relevant to the query, and tags each with its source — the provenance
 * substrate. Sequential (one shared browser page); a failed/refused source is
 * recorded, never fabricated.
 */
export class WebResearcher implements Researcher {
  constructor(private readonly web: WebBrowser) {}

  checkTargets(urls: string[]): TargetCheck[] {
    return urls.map((url) => {
      const c = this.web.checkTarget(url);
      return c.allowed ? { url, allowed: true } : { url, allowed: false, ...(c.reason ? { reason: c.reason } : {}) };
    });
  }

  async gather(query: string, urls: string[], opts: GatherOptions = {}): Promise<ResearchFindings> {
    const perSource = Math.max(1, Math.min(opts.perSource ?? 3, 10));
    const maxSnippet = Math.max(40, Math.min(opts.maxSnippet ?? 240, 1000));
    const terms = queryTerms(query);
    const sources: SourceStatus[] = [];
    const evidence: Evidence[] = [];

    for (const url of urls) {
      const check = this.web.checkTarget(url);
      if (!check.allowed) {
        sources.push({ url, title: "", ok: false, error: check.reason ?? "refused by policy" });
        continue;
      }
      try {
        const nav = await this.web.open(url);
        const page = await this.web.readText(20_000);
        const passages = scorePassages(page.text, terms, perSource, maxSnippet);
        sources.push({ url: nav.url, title: nav.title, ok: true });
        for (const p of passages) evidence.push({ url: nav.url, title: nav.title, ...p });
      } catch (err) {
        sources.push({ url, title: "", ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // Most-relevant evidence first (ties keep source order, which is stable).
    evidence.sort((a, b) => b.score - a.score);
    return { query, sources, evidence };
  }
}

/** Significant lowercase query terms (drop very short/stop-ish tokens). */
function queryTerms(query: string): string[] {
  const stop = new Set(["the", "and", "for", "are", "was", "with", "that", "this", "from", "what", "who", "how", "why"]);
  return [...new Set(
    query
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !stop.has(t)),
  )];
}

/** Score each line by distinct query terms matched; return the top passages. */
function scorePassages(
  text: string,
  terms: string[],
  perSource: number,
  maxSnippet: number,
): { line: number; snippet: string; score: number }[] {
  if (terms.length === 0) return [];
  const lines = text.split("\n");
  const scored: { line: number; snippet: string; score: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!.trim();
    if (raw.length < 8) continue;
    const lower = raw.toLowerCase();
    let score = 0;
    for (const t of terms) if (lower.includes(t)) score++;
    if (score > 0) {
      scored.push({ line: i + 1, snippet: raw.length > maxSnippet ? `${raw.slice(0, maxSnippet)}…` : raw, score });
    }
  }
  scored.sort((a, b) => b.score - a.score || a.line - b.line);
  return scored.slice(0, perSource);
}
