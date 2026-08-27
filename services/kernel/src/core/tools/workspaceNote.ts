import { mkdir, readFile, rm, writeFile, stat } from "node:fs/promises";
import { isAbsolute, join, normalize, relative, resolve } from "node:path";
import type { ActionDisclosure } from "../activity.js";
import type { Tool, ToolContext, ToolResult } from "../tools.js";

interface WorkspaceNoteArgs {
  filename: string;
  content: string;
}

function safeTarget(ctx: ToolContext, filename: string): string {
  // Scope enforcement (R-CTRL-03): resolve and confirm the path stays inside
  // the workspace root — no traversal, no absolute escape.
  const root = resolve(ctx.workspaceRoot);
  const target = resolve(root, filename);
  const rel = relative(root, target);
  if (isAbsolute(filename) || rel.startsWith("..") || rel === "") {
    throw new Error(`refused: '${filename}' is outside the workspace scope`);
  }
  return normalize(target);
}

/**
 * Phase-1 REVERSIBLE Mac action (AT1.7). Writes a note file inside the scoped
 * workspace. CONSEQUENTIAL class => requires approval, with full pre-action
 * disclosure and a rollback captured BEFORE execution (restores prior content,
 * or deletes the file if it did not previously exist).
 */
export const workspaceNoteTool: Tool = {
  name: "workspace.writeNote",
  description: "Create or overwrite a text note inside the J.A.R.V.I.S. workspace (reversible).",
  riskClass: "CONSEQUENTIAL",
  action: "write file in workspace",
  inputSchema: {
    type: "object",
    properties: {
      filename: { type: "string", description: "relative filename inside the workspace" },
      content: { type: "string" },
    },
    required: ["filename", "content"],
    additionalProperties: false,
  },

  disclose(args: unknown, ctx: ToolContext): ActionDisclosure {
    const { filename, content } = args as WorkspaceNoteArgs;
    const target = safeTarget(ctx, filename);
    return {
      whatWillHappen: `Write ${content.length} characters to a note file.`,
      affected: [target],
      proposedCommands: [`write ${relative(resolve(ctx.workspaceRoot), target)} (${content.length} bytes)`],
      reason: "User asked J.A.R.V.I.S. to save a note.",
      riskClass: "CONSEQUENTIAL",
      reversible: true,
      rollbackPlan: "Restore the file's prior content, or delete it if it did not exist before.",
    };
  },

  async run(args: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { filename, content } = args as WorkspaceNoteArgs;
    const target = safeTarget(ctx, filename);
    await mkdir(resolve(ctx.workspaceRoot), { recursive: true });

    // Capture undo state BEFORE mutating.
    let priorContent: string | null = null;
    try {
      await stat(target);
      priorContent = await readFile(target, "utf8");
    } catch {
      priorContent = null; // did not exist
    }

    await writeFile(target, content, "utf8");

    const rollback = async (): Promise<void> => {
      if (priorContent === null) {
        await rm(target, { force: true });
      } else {
        await writeFile(target, priorContent, "utf8");
      }
    };

    return {
      ok: true,
      summary: `Wrote ${content.length} bytes to ${join(relative(resolve(ctx.workspaceRoot), target))}${priorContent === null ? " (new file)" : " (overwrote)"}`,
      data: { path: target, existedBefore: priorContent !== null },
      rollback,
    };
  },
};
