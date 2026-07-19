import { readFile } from "node:fs/promises";
import type { ContextProvider } from "../context/contract.js";
import type { Tool, ToolResult } from "../core/tools.js";

/**
 * Perception core (D-0070) — the inbound half of presence. The SERVICE
 * (consume a feed → situational observation → context + active "look") is core
 * and verifiable here; only the FEED itself (screen via ScreenCaptureKit, camera,
 * mic-derived scene) is Mac-bound hardware. Sources declare provenance
 * (REAL / SIMULATION / INFERRED) and are NEVER faked as REAL in the container —
 * the in-container feed is an explicit SIMULATION file source, swapped for the
 * real ScreenCaptureKit source on the Mac behind the same contract.
 *
 * Safety: observations are situational DATA fed to context as reference, never
 * instructions (same T2 discipline as the rest of context). Perception is
 * READ_ONLY — it observes, it never acts.
 */
export type Provenance = "REAL" | "SIMULATION" | "INFERRED";

export interface Observation {
  modality: string;      // screen | scene | audio-scene | …
  summary: string;       // one-line situational read
  detail?: string;       // optional richer description
  at: string;
  provenance: Provenance;
}

export interface PerceptionSource {
  key: string;
  modality: string;
  provenance: Provenance;
  observe(now: Date): Promise<Observation | null>;
}

export class PerceptionService {
  private readonly sources: PerceptionSource[] = [];

  register(src: PerceptionSource): void { this.sources.push(src); }

  /** Current observations from every source (best-effort; a failing source is skipped). */
  async observe(now: Date = new Date()): Promise<Observation[]> {
    const out: Observation[] = [];
    for (const src of this.sources) {
      try {
        const o = await src.observe(now);
        if (o) out.push({ ...o, provenance: src.provenance });
      } catch { /* a failing perception source must never break the loop */ }
    }
    return out;
  }

  /** A ContextProvider so what J.A.R.V.I.S. perceives flows into situational context. */
  contextProvider(): ContextProvider {
    return {
      key: "perceiving",
      provenance: "SIMULATION", // overridden per-observation label below
      get: async (now: Date) => {
        const obs = await this.observe(now);
        if (!obs.length) return null;
        // label each observation with its own provenance so a SIMULATION feed is
        // never presented as REAL awareness (honesty rule).
        return obs.map((o) => `${o.summary} [${o.provenance}]`).join(" · ");
      },
    };
  }
}

/**
 * SIMULATION feed: reads a JSON observation from a local file (the "screen").
 * The file is written by a test/dev harness; on the Mac this whole source is
 * replaced by a ScreenCaptureKit source implementing the same contract.
 * Shape: {"modality":"screen","summary":"…","detail":"…"} or an array of those.
 */
export class FilePerceptionSource implements PerceptionSource {
  readonly provenance: Provenance = "SIMULATION";
  constructor(readonly key: string, readonly modality: string, private readonly path: string) {}
  async observe(now: Date): Promise<Observation | null> {
    let raw: string;
    try { raw = await readFile(this.path, "utf8"); } catch { return null; } // no feed = nothing perceived
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return null; }
    const one = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!one || typeof one !== "object") return null;
    const o = one as { modality?: string; summary?: string; detail?: string };
    if (!o.summary) return null;
    return {
      modality: o.modality ?? this.modality,
      summary: String(o.summary).slice(0, 400),
      ...(o.detail ? { detail: String(o.detail).slice(0, 2000) } : {}),
      at: now.toISOString(),
      provenance: this.provenance,
    };
  }
}

/** Gated READ_ONLY tool: J.A.R.V.I.S. actively "looks" at the current scene. */
export function perceptionTools(perception: PerceptionService): Tool[] {
  return [{
    name: "perceive.observe",
    description: "Look at what is currently perceivable (screen/scene). Read-only. Returns situational observations with their provenance (REAL vs SIMULATION). In the container this is a SIMULATION feed; on the Mac it is the real screen.",
    riskClass: "READ_ONLY",
    action: "observe the current scene",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async run(): Promise<ToolResult> {
      const obs = await perception.observe();
      if (!obs.length) return { ok: true, summary: "nothing perceivable right now", data: [], detail: "No perception feed is active." };
      return {
        ok: true,
        summary: `${obs.length} observation(s): ${obs[0]!.summary}`,
        data: obs,
        detail: obs.map((o) => `[${o.modality}/${o.provenance}] ${o.summary}${o.detail ? ` — ${o.detail}` : ""}`).join("\n"),
      };
    },
  }];
}
