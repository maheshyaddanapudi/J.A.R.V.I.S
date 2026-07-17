import { describe, expect, it, vi } from "vitest";
import { PolicyEngine, type ActionRequest, type Grant } from "../src/core/policy.js";
import type { AuditLog } from "../src/core/audit.js";
import type { EmergencyStop } from "../src/core/estop.js";

const audit = { append: vi.fn(async () => ({ seq: 1, chainHash: "x" })) } as unknown as AuditLog;

function engine(estopEngaged = false): PolicyEngine {
  const estop = { isEngaged: estopEngaged } as unknown as EmergencyStop;
  return new PolicyEngine(audit, estop);
}

function req(o: Partial<ActionRequest>): ActionRequest {
  return { tool: "t", action: "do", reason: "r", source: "test", ...o };
}

describe("PolicyEngine evaluation order", () => {
  it("emergency stop denies everything", () => {
    const d = engine(true).classify(req({ tool: "system.info", action: "read", riskClass: "READ_ONLY" }));
    expect(d.effect).toBe("deny");
    expect(d.reason).toMatch(/emergency stop/);
  });

  it("PROHIBITED matches on semantics and denies before anything else", () => {
    const cases = [
      { action: "hack into the neighbor's wifi router" },
      { action: "exfiltrate the stored password vault" },
      { action: "disable the approval policy" },
      { action: "fire control for the targeting system" },
      { action: "set up covert surveillance of the room" },
    ];
    for (const c of cases) {
      const d = engine().classify(req({ ...c, riskClass: "READ_ONLY" }));
      expect(d.effect, c.action).toBe("deny");
      expect((d as { prohibited?: boolean }).prohibited, c.action).toBe(true);
    }
  });

  it("prohibited beats even a matching grant", () => {
    const grants: Grant[] = [{ tool: "*", scope: "*", riskCeiling: "HIGH_RISK_PHYSICAL", kind: "always-allow-in-scope" }];
    const d = engine().classify(req({ action: "install a keylogger", grants }));
    expect(d.effect).toBe("deny");
  });

  it("read-only runs automatically", () => {
    expect(engine().classify(req({ riskClass: "READ_ONLY" })).effect).toBe("allow");
  });

  it("unclassified defaults to CONSEQUENTIAL → needs approval", () => {
    const d = engine().classify(req({}));
    expect(d.effect).toBe("needs_approval");
  });

  it("low-reversible auto-runs only when automation delegated", () => {
    expect(engine().classify(req({ riskClass: "LOW_REVERSIBLE" })).effect).toBe("needs_approval");
    expect(
      engine().classify(req({ riskClass: "LOW_REVERSIBLE", delegatedAutomation: true })).effect,
    ).toBe("allow");
  });

  it("a covering grant auto-allows within its risk ceiling and scope", () => {
    const grants: Grant[] = [
      { tool: "workspace.writeNote", scope: "file:/ws/", riskCeiling: "CONSEQUENTIAL", kind: "allow-for-session" },
    ];
    const inScope = engine().classify(
      req({ tool: "workspace.writeNote", riskClass: "CONSEQUENTIAL", resourceScope: "file:/ws/note.txt", grants }),
    );
    expect(inScope.effect).toBe("allow");

    const outOfScope = engine().classify(
      req({ tool: "workspace.writeNote", riskClass: "CONSEQUENTIAL", resourceScope: "file:/etc/passwd", grants }),
    );
    expect(outOfScope.effect).toBe("needs_approval");
  });

  it("high-risk physical always needs approval + interlock note", () => {
    const grants: Grant[] = [{ tool: "*", scope: "*", riskCeiling: "CONSEQUENTIAL", kind: "always-allow-in-scope" }];
    const d = engine().classify(req({ riskClass: "HIGH_RISK_PHYSICAL", grants }));
    expect(d.effect).toBe("needs_approval");
    expect(d.reason).toMatch(/interlock/);
  });
});
