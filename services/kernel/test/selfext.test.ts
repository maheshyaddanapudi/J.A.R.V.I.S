import { describe, expect, it, vi } from "vitest";
import { findHardLimitViolations, passesHardLimit, type CapabilityManifest } from "../src/selfext/protected.js";
import { CapabilityGuard } from "../src/selfext/guard.js";
import { StageAPipeline } from "../src/selfext/stageA.js";
import { CapabilityRegistry } from "../src/selfext/registry.js";
import type { AuditLog } from "../src/core/audit.js";

const audit = { append: vi.fn(async () => ({ seq: 1, chainHash: "x" })) } as unknown as AuditLog;

function manifest(over: Partial<CapabilityManifest>): CapabilityManifest {
  return {
    name: "test-cap",
    version: "0.1.0",
    riskClass: "READ_ONLY",
    permissions: [],
    files: [],
    ...over,
  };
}

describe("hard limit (R-CAP-08) — the non-negotiable structural enforcement", () => {
  it("accepts a benign capability that stays in its own namespace", () => {
    const m = manifest({
      permissions: ["net:read"],
      files: [
        { path: "services/kernel/src/capabilities/weather/index.ts", op: "create", content: "export const x = 1;" },
      ],
    });
    expect(passesHardLimit(m)).toBe(true);
  });

  it("REJECTS any write to the trust core (core/)", () => {
    const m = manifest({
      files: [{ path: "services/kernel/src/core/policy.ts", op: "modify", content: "// evil" }],
    });
    const v = findHardLimitViolations(m);
    expect(v.some((x) => x.kind === "protected_path")).toBe(true);
    expect(passesHardLimit(m)).toBe(false);
  });

  it("REJECTS touching the audit, e-stop, credential, and installer paths", () => {
    for (const path of [
      "services/kernel/src/crypto/vault.ts",
      "services/kernel/src/db/migrations/9999_evil.sql",
      "services/kernel/src/selfext/protected.ts",
      "services/kernel/src/config.ts",
    ]) {
      const m = manifest({ files: [{ path, op: "modify", content: "x" }] });
      expect(passesHardLimit(m), path).toBe(false);
    }
  });

  it("REJECTS path traversal escapes", () => {
    const m = manifest({
      files: [{ path: "services/kernel/src/capabilities/../core/audit.ts", op: "modify", content: "x" }],
    });
    expect(passesHardLimit(m)).toBe(false);
  });

  it("REJECTS requesting a protected permission (even with benign files)", () => {
    for (const perm of ["audit:disable", "estop:override", "credential:read", "capability:install", "permission:escalate"]) {
      const m = manifest({ permissions: [perm], files: [{ path: "services/kernel/src/capabilities/x/i.ts", op: "create", content: "y" }] });
      expect(passesHardLimit(m), perm).toBe(false);
    }
  });

  it("REJECTS code that references protected internals by symbol", () => {
    const m = manifest({
      files: [
        {
          path: "services/kernel/src/capabilities/x/i.ts",
          op: "create",
          content: "import { EmergencyStop } from '../../core/estop.js'; new EmergencyStop();",
        },
      ],
    });
    expect(passesHardLimit(m)).toBe(false);
  });

  it("REJECTS reading the master key or dropping tables", () => {
    const m1 = manifest({ files: [{ path: "services/kernel/src/capabilities/x/i.ts", op: "create", content: "process.env.JARVIS_MASTER_KEY" }] });
    const m2 = manifest({ files: [{ path: "services/kernel/src/capabilities/x/q.sql", op: "create", content: "DROP TABLE audit_log;" }] });
    expect(passesHardLimit(m1)).toBe(false);
    expect(passesHardLimit(m2)).toBe(false);
  });
});

describe("CapabilityGuard scan", () => {
  it("marks a hard-limit hit as terminally rejected", async () => {
    const g = new CapabilityGuard(audit);
    const v = await g.scan(manifest({ files: [{ path: "services/kernel/src/core/loop.ts", op: "modify", content: "x" }] }));
    expect(v.decision).toBe("rejected");
    expect(v.passedHardLimit).toBe(false);
  });

  it("rejects embedded secrets", async () => {
    const g = new CapabilityGuard(audit);
    const v = await g.scan(
      manifest({ files: [{ path: "services/kernel/src/capabilities/x/i.ts", op: "create", content: 'const k = "sk-abcdef0123456789";' }] }),
    );
    expect(v.decision).toBe("rejected");
    expect(v.findings.some((f) => f.kind.startsWith("secret"))).toBe(true);
  });

  it("warns (not rejects) on dangerous-but-sometimes-legit constructs", async () => {
    const g = new CapabilityGuard(audit);
    const v = await g.scan(
      manifest({ files: [{ path: "services/kernel/src/capabilities/x/i.ts", op: "create", content: "import cp from 'child_process';" }] }),
    );
    expect(v.decision).toBe("clean");
    expect(v.findings.some((f) => f.severity === "warn")).toBe(true);
  });

  it("passes a genuinely clean capability", async () => {
    const g = new CapabilityGuard(audit);
    const v = await g.scan(
      manifest({ permissions: ["net:read"], files: [{ path: "services/kernel/src/capabilities/weather/i.ts", op: "create", content: "export const f = () => 42;" }] }),
    );
    expect(v.decision).toBe("clean");
    expect(v.passedHardLimit).toBe(true);
  });
});

describe("StageA pipeline — generation WITHOUT activation", () => {
  function fakeRegistry() {
    const recorded: { state: string }[] = [];
    const reg = {
      recordStageA: vi.fn(async (_m, verdict) => {
        const state = verdict.decision === "rejected" ? "scanned_rejected" : "awaiting_review";
        recorded.push({ state });
        return { id: "cap-1", state };
      }),
    } as unknown as CapabilityRegistry;
    return { reg, recorded };
  }

  it("a clean capability reaches awaiting_review, never activated", async () => {
    const { reg } = fakeRegistry();
    const pipe = new StageAPipeline(reg, audit);
    const report = await pipe.run(
      manifest({ name: "weather", permissions: ["net:read"], files: [{ path: "services/kernel/src/capabilities/weather/i.ts", op: "create", content: "export const f = () => 1;" }] }),
      { need: "weather lookup", context: "user asked for the forecast" },
    );
    expect(report.activated).toBe(false);
    expect(report.verdict.decision).toBe("clean");
    expect(report.nextStep).toMatch(/security check-in/i);
    expect(reg.recordStageA).toHaveBeenCalledOnce();
  });

  it("a malicious capability is rejected and never advances", async () => {
    const { reg } = fakeRegistry();
    const pipe = new StageAPipeline(reg, audit);
    const report = await pipe.run(
      manifest({ name: "evil", files: [{ path: "services/kernel/src/core/policy.ts", op: "modify", content: "// disable approvals" }] }),
      { need: "x", context: "y" },
    );
    expect(report.activated).toBe(false);
    expect(report.verdict.decision).toBe("rejected");
    expect(report.summary).toMatch(/REJECTED/);
    expect(report.nextStep).toMatch(/never be installed/i);
  });

  it("has no method that installs, activates, or runs a capability", () => {
    const { reg } = fakeRegistry();
    const pipe = new StageAPipeline(reg, audit);
    // structural guarantee: the Stage-A surface exposes only run()
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(pipe));
    expect(methods).toContain("run");
    expect(methods).not.toContain("install");
    expect(methods).not.toContain("activate");
    expect(methods).not.toContain("execute");
  });
});
