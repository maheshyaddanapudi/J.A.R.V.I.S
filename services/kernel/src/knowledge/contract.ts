/**
 * Workspace knowledge / files capability (Phase 2 — "files" + "repo/document
 * analysis"). A typed, workspace-scoped view of a REAL local filesystem: the
 * kernel can list, read, search, and (gated) edit files the user has scoped to
 * J.A.R.V.I.S.'s workspace.
 *
 * This is a REAL capability (honesty rule R-CORE-02) — it operates on the actual
 * filesystem, not a simulator — and it is fully LOCAL and offline: nothing here
 * touches the network. The one contract, one adapter (`LocalWorkspaceFiles`);
 * every operation is confined to `root` (no traversal, no absolute escape).
 */

export type FileKind = "file" | "dir" | "symlink" | "other";

export interface DirEntry {
  /** basename */
  name: string;
  /** path relative to the workspace root (POSIX-style) */
  path: string;
  kind: FileKind;
  /** size in bytes (0 for directories) */
  size: number;
  /** ISO-8601 modification time */
  modified: string;
}

export interface FileContent {
  path: string;
  content: string;
  bytes: number;
  /** true when the file was longer than the requested byte cap and was cut */
  truncated: boolean;
  encoding: "utf8";
}

export interface FileInfo {
  path: string;
  kind: FileKind;
  size: number;
  modified: string;
  created: string;
}

export interface SearchMatch {
  path: string;
  line: number;
  /** trimmed content of the matching line */
  preview: string;
}

export interface SearchResult {
  query: string;
  regex: boolean;
  matches: SearchMatch[];
  filesScanned: number;
  /** true when the match cap was reached (more matches exist) */
  truncated: boolean;
}

export interface EditOutcome {
  path: string;
  replacements: number;
  bytesBefore: number;
  bytesAfter: number;
  /** content of the file BEFORE the edit — captured for rollback */
  priorContent: string;
  /** content of the file AFTER the edit — used for independent verification */
  contentAfter: string;
}

export interface SearchOptions {
  /** treat `query` as a JS regular expression instead of a literal substring */
  regex?: boolean;
  /** stop after this many matches (default 100) */
  maxMatches?: number;
  /** simple glob (`*`, `?`) matched against the relative path, e.g. `*.ts` */
  glob?: string;
}

/**
 * Workspace-scoped filesystem. Read operations are READ_ONLY; `edit` is the only
 * mutation and is surfaced through a CONSEQUENTIAL, reversible, verified tool.
 */
export interface WorkspaceFiles {
  /** absolute workspace root every operation is confined to */
  readonly root: string;
  /**
   * Resolve a caller-supplied relative path to an absolute one, throwing if it
   * escapes the workspace. Lets a tool's pre-action disclosure reject an
   * out-of-scope path as a clean denial before any approval is requested.
   */
  resolveInScope(path: string, opts?: { allowRoot?: boolean }): string;
  /** list a directory (default: the workspace root). */
  list(dir?: string): Promise<DirEntry[]>;
  /** read a UTF-8 text file (binary/oversize files are refused, not corrupted). */
  read(path: string, maxBytes?: number): Promise<FileContent>;
  /** metadata for a file or directory. */
  stat(path: string): Promise<FileInfo>;
  /** recursively search file contents across the workspace. */
  search(query: string, opts?: SearchOptions): Promise<SearchResult>;
  /**
   * Exact-string replacement in a file. `find` must occur exactly once unless
   * `all` is set. Returns the prior content (for rollback) and the resulting
   * content (for independent verification). Never creates a file.
   */
  edit(path: string, find: string, replace: string, all?: boolean): Promise<EditOutcome>;
}
