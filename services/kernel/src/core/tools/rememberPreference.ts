import type { MemoryService } from "../../memory/memory.js";
import type { Tool, ToolResult } from "../tools.js";

interface RememberArgs {
  key: string;
  value: string;
}

/**
 * Phase-1 memory tool (AT1.9). Remembering a non-sensitive preference is a
 * LOW_REVERSIBLE local action — reversible (deletable) and low-impact — so it
 * may run automatically when the user has delegated automation, else it prompts.
 * The memory service redacts/refuses secrets on write (R-MEM-06).
 */
export function rememberPreferenceTool(memory: MemoryService): Tool {
  return {
    name: "memory.remember",
    description: "Remember a non-sensitive user preference (key + value). Reversible.",
    riskClass: "LOW_REVERSIBLE",
    action: "store preference in local memory",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string" },
        value: { type: "string" },
      },
      required: ["key", "value"],
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const { key, value } = args as RememberArgs;
      const pref = await memory.remember({
        key,
        value,
        status: "user_statement",
        provenance: "conversation (user asked me to remember)",
      });
      return {
        ok: true,
        summary: `Remembered '${key}' = '${value}' (${pref.status})`,
        data: { id: pref.id, key: pref.key },
        rollback: async () => {
          await memory.delete(key);
        },
      };
    },
  };
}
