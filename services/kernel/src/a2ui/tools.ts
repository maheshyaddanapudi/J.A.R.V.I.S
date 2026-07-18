import type { Tool } from "../core/tools.js";
import type { A2uiRegistry } from "./registry.js";

/**
 * `ui.compose` (D-0061): J.A.R.V.I.S. generates a declarative UI panel. It is
 * CONSEQUENTIAL (it surfaces a new UI to the user) → per-request approval; the
 * spec is validated (whitelist schema + real references) before it is stored, so
 * only a safe panel can ever be created. Reversible via ui.remove.
 */
export function a2uiTools(a2ui: A2uiRegistry): Tool[] {
  return [
    {
      name: "ui.compose",
      description:
        "Compose a declarative Command Center panel (A2UI) from a whitelisted spec " +
        "(heading/text/setting/settingsGroup/action). Actions may reference only registered tools; " +
        "settings only catalogued keys. No HTML/URL/code is possible. Reversible via ui.remove.",
      riskClass: "CONSEQUENTIAL",
      action: "configure",
      inputSchema: {
        type: "object",
        properties: {
          spec: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              components: { type: "array", items: { type: "object" } },
            },
            required: ["title", "components"],
          },
        },
        required: ["spec"],
      },
      disclose(args) {
        const spec = (args as { spec?: { title?: string; components?: unknown[] } }).spec;
        return {
          whatWillHappen: `a new Command Center panel "${spec?.title ?? "?"}" (${spec?.components?.length ?? 0} components) will be surfaced`,
          affected: ["Command Center /a2ui"],
          proposedCommands: ["POST /a2ui/panels"],
          reason: "J.A.R.V.I.S. composed a UI panel",
          riskClass: "CONSEQUENTIAL",
          reversible: true,
          rollbackPlan: "ui.remove deletes the panel",
        };
      },
      async run(args) {
        const spec = (args as { spec?: unknown }).spec;
        try {
          const panel = await a2ui.create(spec, "jarvis");
          return {
            ok: true,
            summary: `composed panel "${panel.title}" (${panel.spec.components.length} components) — id ${panel.id}`,
            data: { id: panel.id, title: panel.title },
            rollback: async () => { await a2ui.remove(panel.id); },
          };
        } catch (err) {
          return { ok: false, summary: err instanceof Error ? err.message : String(err) };
        }
      },
    },
    {
      name: "ui.remove",
      description: "Remove an A2UI panel by id.",
      riskClass: "LOW_REVERSIBLE",
      action: "configure",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      async run(args) {
        const id = (args as { id?: string }).id ?? "";
        const removed = await a2ui.remove(id);
        return { ok: removed, summary: removed ? `panel ${id} removed` : `panel ${id} not found` };
      },
    },
  ];
}
