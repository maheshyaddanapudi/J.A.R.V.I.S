import { z } from "zod";
import type { Tool } from "../core/tools.js";
import type { ReasoningTuner } from "../core/reasoning.js";
import { parseRolePin } from "./config.js";
import { persistRoleOverrides } from "./overrides.js";
import type { GatewayRouter } from "./router.js";
import { ModelRoles, type ModelRole } from "./schema.js";

/**
 * Conversational edit path for the D-0053 dual-editability principle: the
 * SAME overrides the user can make in the UI are exposed as GATED TOOLS, so
 * "route deep reasoning to sonnet-5" or "undo that routing change" spoken/
 * typed to J.A.R.V.I.S. flows through the normal loop — policy → approval →
 * execution → audit — and lands in the same ledgered, smart-persisted overlay
 * (deltas + reason, never a config copy). Re-routing is CONSEQUENTIAL
 * (cost/privacy surface → per-request approval with full disclosure);
 * clearing back to the config base and the bounded reasoning knobs are
 * LOW_REVERSIBLE. Every apply persists; every change is undoable by the
 * matching counter-tool, the UI, or the API.
 */

const RouteArgs = z.object({
  role: z.enum(ModelRoles),
  /** canonical pins: provider/model[@effort][+thinking|+nothink] */
  pins: z.array(z.string().min(3)).min(1).max(4),
  reason: z.string().min(1).max(300),
});

const ClearRouteArgs = z.object({ role: z.enum(ModelRoles) });

interface Store {
  get(key: string): Promise<{ value: string } | null>;
  remember(input: { key: string; value: string; provenance: string }): Promise<unknown>;
}

export function gatewayTools(router: GatewayRouter, store: Store): Tool[] {
  return [
    {
      name: "gateway.route",
      description:
        "Re-route a model role at runtime among the ALREADY-CONFIGURED providers " +
        "(canonical pin syntax provider/model[@effort][+thinking|+nothink]). " +
        "Ledgered (reason recorded), persisted, reversible via gateway.clearRoute.",
      riskClass: "CONSEQUENTIAL",
      action: "configure",
      inputSchema: {
        type: "object",
        properties: {
          role: { type: "string", enum: [...ModelRoles] },
          pins: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 4 },
          reason: { type: "string" },
        },
        required: ["role", "pins", "reason"],
      },
      disclose(args) {
        const a = RouteArgs.parse(args);
        return {
          whatWillHappen: `role '${a.role}' will be served by ${a.pins.join(" then ")} from now on`,
          affected: [`model routing for '${a.role}'`],
          proposedCommands: [`PUT /gateway/roles/${a.role} ${JSON.stringify(a.pins)}`],
          reason: a.reason,
          riskClass: "CONSEQUENTIAL",
          reversible: true,
          rollbackPlan: `gateway.clearRoute '${a.role}' restores the config base`,
        };
      },
      async run(args) {
        const a = RouteArgs.parse(args);
        const prior = router.overrides()[a.role];
        const targets = a.pins.map((p) => parseRolePin(a.role, p));
        router.overrideRole(a.role, targets, { reason: a.reason });
        await persistRoleOverrides(router, store);
        return {
          ok: true,
          summary: `role '${a.role}' re-routed to ${a.pins.join(" → ")} ("${a.reason}")`,
          data: { role: a.role, pins: a.pins },
          rollback: async () => {
            if (prior) {
              router.overrideRole(a.role, prior.pins.map((p) => parseRolePin(a.role, p)), {
                reason: prior.reason,
                at: prior.at,
              });
            } else {
              router.clearRoleOverride(a.role);
            }
            await persistRoleOverrides(router, store);
          },
        };
      },
    },
    {
      name: "gateway.clearRoute",
      description:
        "Clear a runtime role override — the role returns to the config-file base routing.",
      riskClass: "LOW_REVERSIBLE",
      action: "configure",
      inputSchema: {
        type: "object",
        properties: { role: { type: "string", enum: [...ModelRoles] } },
        required: ["role"],
      },
      async run(args) {
        const a = ClearRouteArgs.parse(args);
        const prior = router.overrides()[a.role];
        const removed = router.clearRoleOverride(a.role);
        await persistRoleOverrides(router, store);
        return {
          ok: true,
          summary: removed
            ? `override on '${a.role}' cleared — config base routing restored`
            : `'${a.role}' had no override — config base already active`,
          data: { role: a.role, removed },
          ...(prior
            ? {
                rollback: async () => {
                  router.overrideRole(a.role, prior.pins.map((p) => parseRolePin(a.role, p)), {
                    reason: prior.reason,
                    at: prior.at,
                  });
                  await persistRoleOverrides(router, store);
                },
              }
            : {}),
        };
      },
    },
  ];
}

/** Reasoning knobs as tools (same instrument panel, conversational handle). */
export function reasoningTools(tuner: ReasoningTuner): Tool[] {
  return [
    {
      name: "reasoning.teachTopic",
      description:
        "Teach J.A.R.V.I.S. a topic that should ALWAYS get deep reasoning (learned topics " +
        "escalate alone; visible and deletable in the memory panel).",
      riskClass: "LOW_REVERSIBLE",
      action: "write",
      inputSchema: {
        type: "object",
        properties: { topic: { type: "string" } },
        required: ["topic"],
      },
      async run(args) {
        const topic = z.object({ topic: z.string().min(2).max(60) }).parse(args).topic;
        const topics = await tuner.teach(topic);
        return {
          ok: true,
          summary: `noted — I'll think deeply about '${topic.toLowerCase()}' from now on`,
          data: { topics },
          rollback: async () => { await tuner.forget(topic); },
        };
      },
    },
    {
      name: "reasoning.forgetTopic",
      description: "Remove a learned deep-reasoning topic.",
      riskClass: "LOW_REVERSIBLE",
      action: "write",
      inputSchema: {
        type: "object",
        properties: { topic: { type: "string" } },
        required: ["topic"],
      },
      async run(args) {
        const topic = z.object({ topic: z.string().min(2).max(60) }).parse(args).topic;
        const topics = await tuner.forget(topic);
        return { ok: true, summary: `forgotten — '${topic.toLowerCase()}' no longer auto-escalates`, data: { topics } };
      },
    },
    {
      name: "reasoning.setThreshold",
      description:
        "Set the auto-escalation sensitivity (1 = one strong signal escalates, 2 = conservative). " +
        "Recorded as YOUR setting with your reason — the sleep cycle respects it per the D-0052 contract.",
      riskClass: "LOW_REVERSIBLE",
      action: "configure",
      inputSchema: {
        type: "object",
        properties: {
          signalThreshold: { type: "number", enum: [1, 2] },
          reason: { type: "string" },
        },
        required: ["signalThreshold", "reason"],
      },
      async run(args) {
        const a = z
          .object({ signalThreshold: z.union([z.literal(1), z.literal(2)]), reason: z.string().min(1).max(300) })
          .parse(args);
        const res = await tuner.setThreshold(a.signalThreshold, "user", a.reason);
        return {
          ok: true,
          summary: `escalation threshold set to ${a.signalThreshold} ("${a.reason}") — recorded as your setting`,
          data: res.autotune,
        };
      },
    },
  ];
}
