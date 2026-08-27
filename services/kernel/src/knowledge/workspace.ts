import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import type {
  DirEntry,
  EditOutcome,
  FileContent,
  FileInfo,
  FileKind,
  SearchMatch,
  SearchOptions,
  SearchResult,
  WorkspaceFiles,
} from "./contract.js";

/** Directories never descended into during a recursive search. */
const IGNORE_DIRS = new Set([
  ".git", "node_modules", "dist", "build", ".next", ".venv", "venv",
  "__pycache__", ".turbo", ".cache", "coverage", ".pnpm-store",
]);

const DEFAULT_READ_CAP = 256 * 1024; // 256 KiB
const SEARCH_FILE_CAP = 2 * 1024 * 1024; // skip files larger than 2 MiB when searching
const SEARCH_FILES_CAP = 5000; // scan at most this many files
const PREVIEW_MAX = 200;

/**
 * REAL, workspace-scoped filesystem adapter. Every path is resolved and confirmed
 * to stay inside `root` before any I/O — no traversal (`..`), no absolute escape,
 * and symlinks are never followed out of the tree during recursion (R-CTRL-03,
 * R-LOC-01). Fully local; no network.
 */
export class LocalWorkspaceFiles implements WorkspaceFiles {
  readonly root: string;
  constructor(root: string) {
    this.root = resolve(root);
  }

  /** Resolve a caller-supplied relative path and confirm it stays inside root. */
  resolveInScope(rel: string, { allowRoot = false } = {}): string {
    const cleaned = (rel ?? "").trim();
    if (isAbsolute(cleaned)) {
      throw new Error(`refused: '${rel}' is an absolute path (outside the workspace scope)`);
    }
    const target = resolve(this.root, cleaned);
    const relToRoot = relative(this.root, target);
    if (relToRoot === "") {
      if (allowRoot) return this.root;
      throw new Error(`refused: '${rel}' resolves to the workspace root`);
    }
    if (relToRoot.startsWith("..") || relToRoot.startsWith(`..${sep}`)) {
      throw new Error(`refused: '${rel}' is outside the workspace scope`);
    }
    return normalize(target);
  }

  /** POSIX-style path relative to root, for stable cross-platform output. */
  private rel(abs: string): string {
    const r = relative(this.root, abs);
    return r.split(sep).join("/");
  }

  async list(dir = ""): Promise<DirEntry[]> {
    const target = this.resolveInScope(dir, { allowRoot: true });
    const dirents = await readdir(target, { withFileTypes: true });
    const out: DirEntry[] = [];
    for (const d of dirents) {
      const abs = join(target, d.name);
      let size = 0;
      let modified = "";
      try {
        const s = await stat(abs);
        size = s.isDirectory() ? 0 : s.size;
        modified = s.mtime.toISOString();
      } catch {
        // dangling symlink or race — report it with zeroed metadata rather than fail the listing
      }
      out.push({ name: d.name, path: this.rel(abs), kind: kindOf(d), size, modified });
    }
    out.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "dir" ? -1 : 1));
    return out;
  }

  async read(path: string, maxBytes = DEFAULT_READ_CAP): Promise<FileContent> {
    const target = this.resolveInScope(path);
    const s = await stat(target);
    if (s.isDirectory()) throw new Error(`refused: '${path}' is a directory, not a file`);
    const buf = await readFile(target);
    if (looksBinary(buf)) throw new Error(`refused: '${path}' appears to be binary`);
    const truncated = buf.length > maxBytes;
    const slice = truncated ? buf.subarray(0, maxBytes) : buf;
    return {
      path: this.rel(target),
      content: slice.toString("utf8"),
      bytes: buf.length,
      truncated,
      encoding: "utf8",
    };
  }

  async stat(path: string): Promise<FileInfo> {
    const target = this.resolveInScope(path, { allowRoot: true });
    const s = await stat(target);
    return {
      path: this.rel(target) || ".",
      kind: s.isDirectory() ? "dir" : s.isFile() ? "file" : s.isSymbolicLink() ? "symlink" : "other",
      size: s.isDirectory() ? 0 : s.size,
      modified: s.mtime.toISOString(),
      created: s.birthtime.toISOString(),
    };
  }

  async search(query: string, opts: SearchOptions = {}): Promise<SearchResult> {
    if (!query) throw new Error("refused: empty search query");
    const maxMatches = Math.max(1, Math.min(opts.maxMatches ?? 100, 1000));
    const matcher = opts.regex ? new RegExp(query) : null; // literal path otherwise
    const globRe = opts.glob ? globToRegExp(opts.glob) : null;
    const matches: SearchMatch[] = [];
    let filesScanned = 0;
    let truncated = false;

    const walk = async (absDir: string): Promise<void> => {
      if (truncated || filesScanned >= SEARCH_FILES_CAP) return;
      let dirents;
      try {
        dirents = await readdir(absDir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const d of dirents) {
        if (truncated || filesScanned >= SEARCH_FILES_CAP) return;
        const abs = join(absDir, d.name);
        if (d.isDirectory()) {
          if (IGNORE_DIRS.has(d.name) || d.name.startsWith(".")) continue;
          await walk(abs);
          continue;
        }
        if (!d.isFile()) continue; // don't follow symlinks out of the tree
        const relPath = this.rel(abs);
        if (globRe && !globRe.test(relPath)) continue;
        let s;
        try {
          s = await stat(abs);
        } catch {
          continue;
        }
        if (s.size > SEARCH_FILE_CAP) continue;
        let buf;
        try {
          buf = await readFile(abs);
        } catch {
          continue;
        }
        if (looksBinary(buf)) continue;
        filesScanned++;
        const lines = buf.toString("utf8").split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          const hit = matcher ? matcher.test(line) : line.includes(query);
          if (!hit) continue;
          matches.push({ path: relPath, line: i + 1, preview: trimPreview(line) });
          if (matches.length >= maxMatches) {
            truncated = true;
            return;
          }
        }
      }
    };

    await walk(this.root);
    return { query, regex: Boolean(opts.regex), matches, filesScanned, truncated };
  }

  async edit(path: string, find: string, replace: string, all = false): Promise<EditOutcome> {
    if (find === "") throw new Error("refused: empty 'find' string");
    const target = this.resolveInScope(path);
    const s = await stat(target);
    if (s.isDirectory()) throw new Error(`refused: '${path}' is a directory, not a file`);
    const buf = await readFile(target);
    if (looksBinary(buf)) throw new Error(`refused: '${path}' appears to be binary`);
    const priorContent = buf.toString("utf8");

    const occurrences = countOccurrences(priorContent, find);
    if (occurrences === 0) {
      throw new Error(`refused: 'find' text not present in ${this.rel(target)}`);
    }
    if (occurrences > 1 && !all) {
      throw new Error(
        `refused: 'find' occurs ${occurrences} times in ${this.rel(target)} — pass all=true to replace every occurrence, or give a more specific 'find'`,
      );
    }

    const contentAfter = all
      ? priorContent.split(find).join(replace)
      : priorContent.replace(find, replace);
    await writeFile(target, contentAfter, "utf8");

    return {
      path: this.rel(target),
      replacements: all ? occurrences : 1,
      bytesBefore: buf.length,
      bytesAfter: Buffer.byteLength(contentAfter, "utf8"),
      priorContent,
      contentAfter,
    };
  }
}

function kindOf(d: { isDirectory(): boolean; isFile(): boolean; isSymbolicLink(): boolean }): FileKind {
  if (d.isDirectory()) return "dir";
  if (d.isFile()) return "file";
  if (d.isSymbolicLink()) return "symlink";
  return "other";
}

/** A NUL byte in the first 8 KiB is a reliable, cheap binary heuristic. */
function looksBinary(buf: Buffer): boolean {
  const n = Math.min(buf.length, 8192);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

function trimPreview(line: string): string {
  const t = line.replace(/\t/g, "  ").trimEnd();
  return t.length > PREVIEW_MAX ? `${t.slice(0, PREVIEW_MAX)}…` : t;
}

function countOccurrences(haystack: string, needle: string): number {
  let n = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    n++;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return n;
}

/** Minimal glob → RegExp supporting `*` and `?` against the whole relative path. */
function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`(^|/)${escaped}$`);
}
