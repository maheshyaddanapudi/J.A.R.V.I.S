import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalWorkspaceFiles } from "../src/knowledge/workspace.js";
import { knowledgeTools } from "../src/knowledge/tools.js";
import { CoreLoop } from "../src/core/loop.js";
import { PolicyEngine } from "../src/core/policy.js";
import { ApprovalBroker } from "../src/core/approvals.js";
import { ActivityBus, type ActivityEvent } from "../src/core/activity.js";
import { ToolRegistry } from "../src/core/tools.js";
import type { AuditLog } from "../src/core/audit.js";
import type { EmergencyStop } from "../src/core/estop.js";
import type { GatewayRouter } from "../src/gateway/router.js";
import type { MemoryService } from "../src/memory/memory.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "jarvis-knowledge-"));
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "node_modules", "pkg"), { recursive: true });
  await writeFile(join(root, "README.md"), "# Project\nJ.A.R.V.I.S. workspace.\nTODO: wire it up.\n");
  await writeFile(join(root, "src", "index.ts"), "export const answer = 42;\n// TODO: refine\n");
  await writeFile(join(root, "src", "util.ts"), "export function add(a, b) { return a + b; }\n");
  await writeFile(join(root, "node_modules", "pkg", "index.js"), "// TODO from a dependency (should be ignored)\n");
  // a binary file (NUL byte)
  await writeFile(join(root, "blob.bin"), Buffer.from([0x00, 0x01, 0x02, 0x03, 0x00]));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("LocalWorkspaceFiles (REAL workspace-scoped filesystem)", () => {
  it("lists a directory with dirs sorted before files", async () => {
    const fs = new LocalWorkspaceFiles(root);
    const entries = await fs.list();
    const names = entries.map((e) => e.name);
    expect(names).toContain("src");
    expect(names).toContain("README.md");
    // directories come first
    const firstFileIdx = entries.findIndex((e) => e.kind === "file");
    const lastDirIdx = entries.map((e) => e.kind).lastIndexOf("dir");
    expect(lastDirIdx).toBeLessThan(firstFileIdx);
    const readme = entries.find((e) => e.name === "README.md")!;
    expect(readme.kind).toBe("file");
    expect(readme.size).toBeGreaterThan(0);
  });

  it("reads a UTF-8 text file", async () => {
    const fs = new LocalWorkspaceFiles(root);
    const fc = await fs.read("src/index.ts");
    expect(fc.content).toContain("answer = 42");
    expect(fc.path).toBe("src/index.ts");
    expect(fc.truncated).toBe(false);
    expect(fc.bytes).toBeGreaterThan(0);
  });

  it("truncates at the byte cap", async () => {
    const fs = new LocalWorkspaceFiles(root);
    const fc = await fs.read("README.md", 6);
    expect(fc.truncated).toBe(true);
    expect(Buffer.byteLength(fc.content, "utf8")).toBe(6);
    expect(fc.content).toBe("# Proj");
  });

  it("refuses to read a binary file (does not corrupt it into text)", async () => {
    const fs = new LocalWorkspaceFiles(root);
    await expect(fs.read("blob.bin")).rejects.toThrow(/binary/i);
  });

  it("stats a file and a directory", async () => {
    const fs = new LocalWorkspaceFiles(root);
    expect((await fs.stat("src")).kind).toBe("dir");
    const info = await fs.stat("README.md");
    expect(info.kind).toBe("file");
    expect(info.size).toBeGreaterThan(0);
  });

  it("searches file contents and returns file:line matches", async () => {
    const fs = new LocalWorkspaceFiles(root);
    const res = await fs.search("TODO");
    const paths = res.matches.map((m) => m.path);
    expect(paths).toContain("README.md");
    expect(paths).toContain("src/index.ts");
    // node_modules is never descended into
    expect(paths.some((p) => p.includes("node_modules"))).toBe(false);
    const readmeHit = res.matches.find((m) => m.path === "README.md")!;
    expect(readmeHit.line).toBe(3);
    expect(readmeHit.preview).toContain("TODO");
  });

  it("supports regex search and a glob filter", async () => {
    const fs = new LocalWorkspaceFiles(root);
    const re = await fs.search("answer\\s*=\\s*\\d+", { regex: true });
    expect(re.matches.some((m) => m.path === "src/index.ts")).toBe(true);
    const globbed = await fs.search("TODO", { glob: "*.md" });
    expect(globbed.matches.every((m) => m.path.endsWith(".md"))).toBe(true);
  });

  it("caps the number of matches and flags truncation", async () => {
    const fs = new LocalWorkspaceFiles(root);
    const res = await fs.search("e", { maxMatches: 1 });
    expect(res.matches).toHaveLength(1);
    expect(res.truncated).toBe(true);
  });

  it("edits a unique occurrence and captures rollback + verification data", async () => {
    const fs = new LocalWorkspaceFiles(root);
    const outcome = await fs.edit("src/index.ts", "answer = 42", "answer = 43");
    expect(outcome.replacements).toBe(1);
    expect(outcome.priorContent).toContain("answer = 42");
    expect(outcome.contentAfter).toContain("answer = 43");
    const onDisk = await readFile(join(root, "src", "index.ts"), "utf8");
    expect(onDisk).toBe(outcome.contentAfter);
  });

  it("refuses an edit whose 'find' is absent", async () => {
    const fs = new LocalWorkspaceFiles(root);
    await expect(fs.edit("src/index.ts", "not-present", "x")).rejects.toThrow(/not present/i);
  });

  it("refuses an ambiguous edit unless all=true", async () => {
    const fs = new LocalWorkspaceFiles(root);
    await writeFile(join(root, "dup.txt"), "x\nx\n");
    await expect(fs.edit("dup.txt", "x", "y")).rejects.toThrow(/occurs 2 times/i);
    const outcome = await fs.edit("dup.txt", "x", "y", true);
    expect(outcome.replacements).toBe(2);
    expect(outcome.contentAfter).toBe("y\ny\n");
  });

  it("confines every operation to the workspace (no traversal, no absolute escape)", async () => {
    const fs = new LocalWorkspaceFiles(root);
    await expect(fs.read("../secret")).rejects.toThrow(/outside the workspace/i);
    await expect(fs.read("/etc/passwd")).rejects.toThrow(/absolute path/i);
    await expect(fs.list("../..")).rejects.toThrow(/outside the workspace/i);
    await expect(fs.edit("../x", "a", "b")).rejects.toThrow(/outside the workspace/i);
  });
});

// ---- Gated-loop integration (the tools go through the real policy/approval/verify path) ----

const audit = { append: vi.fn(async () => ({ seq: 1, chainHash: "x" })) } as unknown as AuditLog;

function makeEstop() {
  return {
    get isEngaged() {
      return false;
    },
    assertClear() {},
    onChange() {
      return () => {};
    },
  } as unknown as EmergencyStop;
}

function makeLoop() {
  const estop = makeEstop();
  const policy = new PolicyEngine(audit, estop);
  const approvals = new ApprovalBroker(audit);
  const activity = new ActivityBus();
  const tools = new ToolRegistry();
  for (const t of knowledgeTools(new LocalWorkspaceFiles(root))) tools.register(t);
  const loop = new CoreLoop({
    gateway: {} as unknown as GatewayRouter,
    policy,
    tools,
    audit,
    estop,
    approvals,
    activity,
    memory: {} as unknown as MemoryService,
    toolCtx: { workspaceRoot: root },
  });
  return { loop, activity };
}

describe("knowledge tools through the gated core loop", () => {
  it("files.read is READ_ONLY and runs automatically (no approval)", async () => {
    const { loop } = makeLoop();
    const res = await loop.runTool({ tool: "files.read", args: { path: "README.md" }, source: "test" });
    expect(res.ok).toBe(true);
    expect(res.summary).toMatch(/read README\.md/);
  });

  it("files.search is READ_ONLY and runs automatically", async () => {
    const { loop } = makeLoop();
    const res = await loop.runTool({ tool: "files.search", args: { query: "TODO" }, source: "test" });
    expect(res.ok).toBe(true);
    expect(res.summary).toMatch(/match/);
  });

  it("files.read returns the file content as detail (so the agent can read it)", async () => {
    const { loop } = makeLoop();
    const res = await loop.runTool({ tool: "files.read", args: { path: "src/index.ts" }, source: "test" });
    expect(res.ok).toBe(true);
    expect(res.detail).toBeDefined();
    expect(res.detail).toContain("answer = 42"); // real file content flows back, not just a one-line summary
  });

  it("files.search returns matches (file:line: preview) as detail", async () => {
    const { loop } = makeLoop();
    const res = await loop.runTool({ tool: "files.search", args: { query: "TODO" }, source: "test" });
    expect(res.detail).toBeDefined();
    expect(res.detail).toMatch(/README\.md:\d+:/);
    expect(res.detail).not.toContain("node_modules");
  });

  it("files.edit is CONSEQUENTIAL — denied means the file is NOT modified", async () => {
    const { loop } = makeLoop();
    const before = await readFile(join(root, "src", "index.ts"), "utf8");
    const res = await loop.runTool({
      tool: "files.edit",
      args: { path: "src/index.ts", find: "answer = 42", replace: "answer = 99" },
      source: "test",
      autoApprove: "deny",
    });
    expect(res.denied).toBe(true);
    expect(res.ok).toBe(false);
    const after = await readFile(join(root, "src", "index.ts"), "utf8");
    expect(after).toBe(before); // the gate stopped the write
  });

  it("files.edit applies + passes independent verification when approved", async () => {
    const { loop, activity } = makeLoop();
    const events: ActivityEvent[] = [];
    activity.subscribe((e) => events.push(e));
    const res = await loop.runTool({
      tool: "files.edit",
      args: { path: "src/index.ts", find: "answer = 42", replace: "answer = 99" },
      source: "test",
      autoApprove: "allow-once",
    });
    expect(res.ok).toBe(true);
    const onDisk = await readFile(join(root, "src", "index.ts"), "utf8");
    expect(onDisk).toContain("answer = 99");
    // the loop's independent re-read verification ran and passed
    const verified = events.find((e) => e.kind === "verified");
    expect(verified).toBeDefined();
    expect((verified as { ok: boolean }).ok).toBe(true);
    expect((verified as { summary: string }).summary).toMatch(/matches the applied edit/);
  });

  it("a rejected-scope edit is a clean denial, not a server error", async () => {
    const { loop } = makeLoop();
    const res = await loop.runTool({
      tool: "files.edit",
      args: { path: "../escape", find: "a", replace: "b" },
      source: "test",
      autoApprove: "allow-once",
    });
    expect(res.ok).toBe(false);
    expect(res.denied).toBe(true);
  });
});
