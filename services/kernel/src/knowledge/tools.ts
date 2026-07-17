import type { ActionDisclosure } from "../core/activity.js";
import type { Tool, ToolResult } from "../core/tools.js";
import type { SearchOptions, WorkspaceFiles } from "./contract.js";

/**
 * Knowledge / files tools (Phase 2 — "files" + "repo/document analysis"),
 * policy-gated (R-CTRL-03/04). Reading and searching the workspace is READ_ONLY
 * and runs automatically; editing a file is CONSEQUENTIAL — it carries a
 * pre-action disclosure, is approval-gated, captures a rollback BEFORE writing,
 * and is independently verified (the loop re-reads the file off disk).
 *
 * These operate on a REAL local filesystem confined to the workspace root
 * (`WorkspaceFiles` — no traversal, no absolute escape). Fully local and offline:
 * no network access at all. The backend is the same in-container and on the Mac;
 * only the scoped root differs.
 */
export function knowledgeTools(files: WorkspaceFiles): Tool[] {
  const listFiles: Tool = {
    name: "files.list",
    description:
      "List the contents of a directory inside the J.A.R.V.I.S. workspace (defaults to the workspace root). Read-only.",
    riskClass: "READ_ONLY",
    action: "list workspace directory",
    inputSchema: {
      type: "object",
      properties: { dir: { type: "string", description: "relative directory (default: workspace root)" } },
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const { dir } = (args ?? {}) as { dir?: string };
      const entries = await files.list(dir ?? "");
      const dirs = entries.filter((e) => e.kind === "dir").length;
      const fileCount = entries.length - dirs;
      return {
        ok: true,
        summary: `${dir ? dir : "(root)"}: ${dirs} dir(s), ${fileCount} file(s)`,
        data: { dir: dir ?? "", entries },
        detail: entries.map((e) => `${e.kind === "dir" ? "d" : "-"} ${e.path}${e.kind === "file" ? ` (${e.size}b)` : ""}`).join("\n") || "(empty)",
      };
    },
  };

  const readFileTool: Tool = {
    name: "files.read",
    description:
      "Read a UTF-8 text file inside the workspace (binary and oversize files are refused, not corrupted). Read-only.",
    riskClass: "READ_ONLY",
    action: "read workspace file",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "relative file path inside the workspace" },
        maxBytes: { type: "number", description: "cap the number of bytes returned" },
      },
      required: ["path"],
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const { path, maxBytes } = args as { path: string; maxBytes?: number };
      const fc = await files.read(path, maxBytes);
      return {
        ok: true,
        summary: `read ${fc.path} (${fc.bytes} bytes${fc.truncated ? ", truncated" : ""})`,
        data: fc,
        detail: fc.content, // the file's text — what the agent needs to reason over
      };
    },
  };

  const statFile: Tool = {
    name: "files.stat",
    description: "Get metadata (kind, size, modified/created time) for a workspace file or directory. Read-only.",
    riskClass: "READ_ONLY",
    action: "stat workspace path",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string", description: "relative path inside the workspace" } },
      required: ["path"],
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const { path } = args as { path: string };
      const info = await files.stat(path);
      return {
        ok: true,
        summary: `${info.path}: ${info.kind}, ${info.size} bytes`,
        data: info,
        detail: `path=${info.path} kind=${info.kind} size=${info.size} modified=${info.modified}`,
      };
    },
  };

  const searchFiles: Tool = {
    name: "files.search",
    description:
      "Search file contents across the workspace for a literal substring (or a regex with regex=true), returning file:line matches. Read-only.",
    riskClass: "READ_ONLY",
    action: "search workspace contents",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "text (or regex) to find" },
        regex: { type: "boolean", description: "treat query as a JS regular expression" },
        maxMatches: { type: "number", description: "stop after N matches (default 100)" },
        glob: { type: "string", description: "restrict to paths matching a simple glob, e.g. *.ts" },
      },
      required: ["query"],
      additionalProperties: false,
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as { query: string } & SearchOptions;
      const opts: SearchOptions = {};
      if (a.regex !== undefined) opts.regex = a.regex;
      if (a.maxMatches !== undefined) opts.maxMatches = a.maxMatches;
      if (a.glob !== undefined) opts.glob = a.glob;
      const res = await files.search(a.query, opts);
      return {
        ok: true,
        summary: `${res.matches.length}${res.truncated ? "+" : ""} match(es) for '${res.query}' across ${res.filesScanned} file(s)`,
        data: res,
        detail: res.matches.map((m) => `${m.path}:${m.line}: ${m.preview}`).join("\n") || "(no matches)",
      };
    },
  };

  const editFile: Tool = {
    name: "files.edit",
    description:
      "Apply an exact-string replacement to an existing workspace file (reversible). 'find' must occur once unless all=true. Consequential — requires approval.",
    riskClass: "CONSEQUENTIAL",
    action: "edit workspace file",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "relative file path inside the workspace" },
        find: { type: "string", description: "exact text to replace" },
        replace: { type: "string", description: "replacement text" },
        all: { type: "boolean", description: "replace every occurrence (default: require a unique match)" },
      },
      required: ["path", "find", "replace"],
      additionalProperties: false,
    },
    disclose(args: unknown): ActionDisclosure {
      const a = args as { path: string; find: string; replace: string; all?: boolean };
      // Reject an out-of-scope path here so it's a clean denial before approval
      // is ever requested (the core loop treats a disclose throw as a refusal).
      const abs = files.resolveInScope(a.path);
      return {
        whatWillHappen: `Replace ${a.all ? "every occurrence of" : "a unique occurrence of"} ${a.find.length}-char text in ${a.path}.`,
        affected: [abs],
        proposedCommands: [`edit ${a.path}: "${clip(a.find)}" → "${clip(a.replace)}"${a.all ? " (all)" : ""}`],
        reason: "User asked J.A.R.V.I.S. to modify a file.",
        riskClass: "CONSEQUENTIAL",
        reversible: true,
        rollbackPlan: "Prior file content is captured before the write and restored on rollback.",
      };
    },
    async run(args: unknown): Promise<ToolResult> {
      const a = args as { path: string; find: string; replace: string; all?: boolean };
      const outcome = await files.edit(a.path, a.find, a.replace, a.all ?? false);
      const rollback = async (): Promise<void> => {
        // Restore the captured prior content. `contentAfter` is the exact text we
        // just wrote, so it anchors uniquely; if the file was changed externally
        // since, this throws rather than clobbering those changes (safe by design).
        await files.edit(outcome.path, outcome.contentAfter, outcome.priorContent, false);
      };
      return {
        ok: true,
        summary: `edited ${outcome.path}: ${outcome.replacements} replacement(s), ${outcome.bytesBefore}→${outcome.bytesAfter} bytes`,
        // path + contentAfter drive the loop's independent re-read verification.
        data: { path: outcome.path, contentAfter: outcome.contentAfter, replacements: outcome.replacements },
        rollback,
      };
    },
  };

  return [listFiles, readFileTool, statFile, searchFiles, editFile];
}

function clip(s: string): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > 40 ? `${flat.slice(0, 40)}…` : flat;
}
