import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("applies loopback-safe defaults", () => {
    const cfg = loadConfig({});
    expect(cfg.httpPort).toBe(4150);
    expect(cfg.env).toBe("dev");
    expect(cfg.databaseUrl).toContain("127.0.0.1");
    expect(cfg.otlpEndpoint).toBe("");
  });

  it("reads JARVIS_* environment variables", () => {
    const cfg = loadConfig({
      JARVIS_ENV: "test",
      JARVIS_KERNEL_PORT: "5000",
      JARVIS_LOG_LEVEL: "debug",
    });
    expect(cfg).toMatchObject({ env: "test", httpPort: 5000, logLevel: "debug" });
  });

  it("rejects invalid values", () => {
    expect(() => loadConfig({ JARVIS_KERNEL_PORT: "notaport" })).toThrow(/Invalid kernel/);
    expect(() => loadConfig({ JARVIS_ENV: "cloud" })).toThrow(/Invalid kernel/);
  });
});
