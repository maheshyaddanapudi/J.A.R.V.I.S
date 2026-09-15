/**
 * Night-Lab candidate generation (D-0079 Slice L2): the `planning` role drafts
 * ONE candidate change per experiment, steered by the campaign file and the
 * night's experiment history. Output is deny-first validated against
 * LAB_SURFACE by the caller — a model may PROPOSE anything, but nothing out of
 * surface ever runs (the violation is ledgered as a discard instead).
 */

import type { ChatRequest, ChatResult } from "../gateway/schema.js";
import type { LabCandidate } from "./surface.js";
import type { CampaignSpec } from "./engine.js";

interface GatewayLike {
  chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResult>;
}

function parseJson<T>(text: string): T | null {
  const fenced = text.replace(/```(?:json)?/gi, "").trim();
  const a = fenced.indexOf("{");
  const b = fenced.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try {
    return JSON.parse(fenced.slice(a, b + 1)) as T;
  } catch {
    return null;
  }
}

const SYSTEM =
  "You are the researcher of J.A.R.V.I.S.'s Night Lab. Each night you run controlled experiments " +
  "on a small whitelisted surface (prompt templates, a few settings) to improve ONE metric without " +
  "regressing the others. Propose exactly ONE candidate change: a full replacement text for one " +
  "in-scope prompt, or new values for in-scope settings — never both kinds at once, never more than " +
  "one prompt. Ground the change in the campaign's hypotheses and what previous experiments showed; " +
  "do not repeat a discarded idea unchanged. Reply with ONLY JSON: " +
  '{"summary": "<one line>", "hypothesis": "<which hypothesis and why>", ' +
  '"prompts": [{"name": "...", "kind": "template|persona", "content": "<full new text>"}], ' +
  '"settings": {}}. Omit "prompts" or leave "settings" empty as appropriate.';

export async function generateCandidate(
  gateway: GatewayLike,
  spec: CampaignSpec,
  history: { summary: string; verdict: string; reason: string }[],
  currentSurface: { prompts: { name: string; kind: string; content: string }[]; settings?: Record<string, unknown> },
  timeoutMs = 60000,
): Promise<LabCandidate | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const user = JSON.stringify({
      campaign: {
        name: spec.name,
        optimizationMetric: spec.metric,
        guardBands: spec.guardBands,
        hypotheses: spec.hypotheses,
        surface: spec.surface,
      },
      currentSurfaceContent: currentSurface.prompts,
      currentSurfaceSettings: currentSurface.settings ?? {},
      previousExperimentsNewestFirst: history.slice(0, 12),
    });
    const res = await gateway.chat(
      {
        role: "planning",
        privacyClass: "STANDARD",
        source: "night-lab-researcher",
        maxTokens: 4000,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: [{ type: "text", text: user }] },
        ],
      },
      ac.signal,
    );
    const out = parseJson<LabCandidate>(res.text);
    if (!out || typeof out.summary !== "string") return null;
    return out;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
