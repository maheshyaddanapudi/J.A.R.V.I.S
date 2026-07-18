import { z } from "zod";
import type { Tool } from "../core/tools.js";
import type { SettingsRegistry } from "./registry.js";

/**
 * Conversational edit path for general settings (D-0058 + D-0053/D-0055): the
 * same knobs the UI edits are gated tools, so instructing J.A.R.V.I.S. ("keep
 * quiet hours until 8am") flows through policy → approval → execution → audit.
 * Editing a setting is CONSEQUENTIAL (changes system behaviour) → per-request
 * approval; resetting to default is LOW_REVERSIBLE. Both are ledgered.
 */
export function settingsTools(settings: SettingsRegistry): Tool[] {
  return [
    {
      name: "settings.set",
      description:
        "Set a catalogued runtime setting (e.g. proactive.confidenceThreshold). " +
        "Editable at runtime; the change is ledgered with the reason and is reversible via settings.reset.",
      riskClass: "CONSEQUENTIAL",
      action: "configure",
      inputSchema: {
        type: "object",
        properties: {
          key: { type: "string" },
          value: {},
          reason: { type: "string" },
        },
        required: ["key", "value", "reason"],
      },
      disclose(args) {
        const a = z.object({ key: z.string(), value: z.unknown(), reason: z.string().min(1) }).parse(args);
        return {
          whatWillHappen: `runtime setting '${a.key}' will be set to ${JSON.stringify(a.value)}`,
          affected: [`setting '${a.key}'`],
          proposedCommands: [`PUT /settings/${a.key} ${JSON.stringify(a.value)}`],
          reason: a.reason,
          riskClass: "CONSEQUENTIAL",
          reversible: true,
          rollbackPlan: `settings.reset '${a.key}' restores the current default`,
        };
      },
      async run(args) {
        const a = z.object({ key: z.string(), value: z.unknown(), reason: z.string().min(1).max(300) }).parse(args);
        if (!settings.has(a.key)) {
          return { ok: false, summary: `unknown setting '${a.key}' (not in the editable catalog)` };
        }
        try {
          const eff = await settings.set(a.key, a.value, "jarvis", a.reason);
          return {
            ok: true,
            summary: `set '${a.key}' = ${JSON.stringify(eff.value)} ("${a.reason}")`,
            data: eff,
            rollback: async () => { await settings.reset(a.key); },
          };
        } catch (err) {
          return { ok: false, summary: err instanceof Error ? err.message : String(err) };
        }
      },
    },
    {
      name: "settings.reset",
      description: "Reset a runtime setting to its current default (or, for a dynamic setting, delete it entirely).",
      riskClass: "LOW_REVERSIBLE",
      action: "configure",
      inputSchema: {
        type: "object",
        properties: { key: { type: "string" } },
        required: ["key"],
      },
      async run(args) {
        const a = z.object({ key: z.string() }).parse(args);
        if (!settings.has(a.key)) return { ok: false, summary: `unknown setting '${a.key}'` };
        const r = await settings.remove(a.key);
        return {
          ok: true,
          summary: r.action === "deleted" ? `'${a.key}' deleted (dynamic setting)` : `'${a.key}' reset to default`,
          data: r,
        };
      },
    },
    {
      name: "settings.register",
      description:
        "Register a NEW configurable setting J.A.R.V.I.S. has discovered, so the user can see/edit/delete it. " +
        "Persisted + surfaced in the settings panel. Cannot name a protected trust-core concern.",
      riskClass: "CONSEQUENTIAL",
      action: "configure",
      inputSchema: {
        type: "object",
        properties: {
          key: { type: "string" },
          label: { type: "string" },
          category: { type: "string" },
          type: { type: "string", enum: ["number", "boolean", "string", "enum", "hour"] },
          default: {},
          description: { type: "string" },
          min: { type: "number" },
          max: { type: "number" },
          step: { type: "number" },
          options: { type: "array", items: { type: "string" } },
        },
        required: ["key", "label", "type", "default"],
      },
      disclose(args) {
        const a = z.object({ key: z.string(), label: z.string(), type: z.string() }).parse(args);
        return {
          whatWillHappen: `a new editable setting '${a.key}' (${a.type}) will be surfaced in the settings panel`,
          affected: [`settings catalog (dynamic): ${a.key}`],
          proposedCommands: [`POST /settings ${a.key}`],
          reason: `J.A.R.V.I.S. discovered a configurable value: ${a.label}`,
          riskClass: "CONSEQUENTIAL",
          reversible: true,
          rollbackPlan: `settings.reset '${a.key}' removes the dynamic setting`,
        };
      },
      async run(args) {
        const a = args as import("./registry.js").DynamicSpecInput;
        try {
          const eff = await settings.register(a, "jarvis");
          return {
            ok: true,
            summary: `registered new setting '${eff.key}' (${eff.type}, default ${JSON.stringify(eff.default)})`,
            data: eff,
            rollback: async () => { await settings.remove(eff.key); },
          };
        } catch (err) {
          return { ok: false, summary: err instanceof Error ? err.message : String(err) };
        }
      },
    },
  ];
}
