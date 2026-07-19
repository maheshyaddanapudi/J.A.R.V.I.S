import { describe, expect, it, beforeEach } from "vitest";
import { writeFile, rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PerceptionService, FilePerceptionSource, perceptionTools } from "../src/perception/service.js";

/** Perception core (D-0070): the SERVICE + a SIMULATION file feed are core;
 *  observations are provenance-labeled (never faked REAL) and flow into context. */
let dir = "";
const feed = () => join(dir, "perception.json");

describe("PerceptionService (D-0070)", () => {
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), "jarvis-perc-")); });

  it("no feed → perceives nothing (never invents)", async () => {
    const p = new PerceptionService();
    p.register(new FilePerceptionSource("screen", "screen", feed()));
    expect(await p.observe()).toEqual([]);
  });

  it("reads the SIMULATION feed and labels provenance (never REAL in the container)", async () => {
    await writeFile(feed(), JSON.stringify({ modality: "screen", summary: "VS Code open on reactor.py", detail: "line 42 has an error" }));
    const p = new PerceptionService();
    p.register(new FilePerceptionSource("screen", "screen", feed()));
    const obs = await p.observe();
    expect(obs).toHaveLength(1);
    expect(obs[0]).toMatchObject({ modality: "screen", summary: "VS Code open on reactor.py", provenance: "SIMULATION" });
  });

  it("flows into context via a provider, each observation tagged with provenance", async () => {
    await writeFile(feed(), JSON.stringify({ summary: "incoming call from Pepper" }));
    const p = new PerceptionService();
    p.register(new FilePerceptionSource("screen", "screen", feed()));
    const provider = p.contextProvider();
    expect(provider.key).toBe("perceiving");
    const line = await provider.get(new Date());
    expect(line).toMatch(/incoming call from Pepper \[SIMULATION\]/);
  });

  it("perceive.observe tool returns the current scene (READ_ONLY)", async () => {
    await writeFile(feed(), JSON.stringify({ modality: "scene", summary: "workshop, lights dimmed" }));
    const p = new PerceptionService();
    p.register(new FilePerceptionSource("screen", "screen", feed()));
    const tool = perceptionTools(p)[0]!;
    expect(tool.riskClass).toBe("READ_ONLY");
    const r = await tool.run({}, {} as never);
    expect(r.ok).toBe(true);
    expect(String(r.detail)).toMatch(/workshop, lights dimmed/);
    expect(String(r.detail)).toMatch(/SIMULATION/);
  });

  it("a malformed feed never throws (best-effort)", async () => {
    await writeFile(feed(), "not json{{{");
    const p = new PerceptionService();
    p.register(new FilePerceptionSource("screen", "screen", feed()));
    expect(await p.observe()).toEqual([]);
    await rm(dir, { recursive: true, force: true });
  });
});
