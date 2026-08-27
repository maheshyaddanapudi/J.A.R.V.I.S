import { describe, expect, it } from "vitest";
import { inferAffect } from "../src/affect/service.js";

/** Affect (D-0072): deterministic, transparent, text-only. Every reading names
 *  the signals that fired; neutral text stays neutral; it only guides tone. */
describe("inferAffect (D-0072)", () => {
  it("neutral text → neutral, no guidance", () => {
    const r = inferAffect("Could you summarise the meeting notes when you have a moment?");
    expect(r.tone).toBe("neutral");
    expect(r.guidance).toBe("");
    expect(r.signals).toEqual([]);
  });

  it("urgency/time pressure → rushed (brief, direct)", () => {
    const r = inferAffect("I need the deck in 20 minutes, quickly");
    expect(r.tone).toBe("rushed");
    expect(r.signals).toContain("urgency words");
    expect(r.guidance).toMatch(/brief and direct/);
  });

  it("frustration cues → frustrated (acknowledge, stay calm)", () => {
    const r = inferAffect("ugh why isn't this working again, seriously");
    expect(r.tone).toBe("frustrated");
    expect(r.signals).toContain("frustration cues");
    expect(r.guidance).toMatch(/frustrated/);
  });

  it("shouting caps → stressed", () => {
    const r = inferAffect("THIS IS COMPLETELY BROKEN");
    expect(r.tone).toBe("stressed");
    expect(r.signals).toContain("shouting (mostly caps)");
  });

  it("gratitude → warm", () => {
    const r = inferAffect("thank you, that's perfect");
    expect(r.tone).toBe("warm");
    expect(r.signals).toContain("warmth/gratitude");
  });

  it("is TRANSPARENT — always reports which signals fired (nothing hidden)", () => {
    const r = inferAffect("I'm behind and this keeps failing!!");
    expect(r.signals.length).toBeGreaterThan(0);
    // intensity is bounded 0..1
    expect(r.intensity).toBeGreaterThanOrEqual(0);
    expect(r.intensity).toBeLessThanOrEqual(1);
  });
});
