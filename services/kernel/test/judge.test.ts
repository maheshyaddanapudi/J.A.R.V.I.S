import { describe, expect, it } from "vitest";
import { GatewayMemoryJudge, privacyForSensitivities } from "../src/memory/judge.js";
import type { ChatResult } from "../src/gateway/schema.js";

/** A stub gateway whose reply text we control, to test parsing + validation +
 *  the best-effort fallback contract WITHOUT any real provider. */
function stubGateway(reply: string | (() => Promise<string>)) {
  return {
    chat: async (): Promise<ChatResult> => ({
      text: typeof reply === "string" ? reply : await reply(),
      toolCalls: [],
      finishReason: "stop" as const,
      usage: { inputTokens: 0, outputTokens: 0 },
      provider: "stub",
      model: "stub",
      latencyMs: 1,
    }),
  };
}

describe("GatewayMemoryJudge (D-0075 fast-model memory judgments)", () => {
  it("resolveEntity returns the matched candidate index (tolerates code fences)", async () => {
    const j = new GatewayMemoryJudge(stubGateway('```json\n{"sameAs":0,"reason":"same person"}\n```'));
    const out = await j.resolveEntity(
      { name: "Pepper", kind: "person" },
      [{ name: "Pepper Potts", kind: "person" }],
      "STANDARD",
    );
    expect(out).toEqual({ sameAs: 0, reason: "same person" });
  });

  it("resolveEntity rejects an out-of-range candidate index", async () => {
    const j = new GatewayMemoryJudge(stubGateway('{"sameAs":9,"reason":"x"}'));
    const out = await j.resolveEntity(
      { name: "Pepper", kind: "person" },
      [{ name: "Pepper Potts", kind: "person" }],
      "STANDARD",
    );
    expect(out).toEqual({ sameAs: null, reason: "no candidate matched" });
  });

  it("mergeEntities validates indices, dropping out-of-range (cross-kind)", async () => {
    const j = new GatewayMemoryJudge(stubGateway('{"merges":[{"keep":0,"merge":[1,7]}]}'));
    const out = await j.mergeEntities(
      "arc reactor",
      [{ idx: 0, kind: "thing", facts: [] }, { idx: 1, kind: "project", facts: [] }],
      "STANDARD",
    );
    expect(out).toEqual([{ keep: 0, merge: [1] }]); // index 7 dropped
  });

  it("resolveEntity short-circuits (no model call) when there are no candidates", async () => {
    const j = new GatewayMemoryJudge(stubGateway(() => { throw new Error("must not call the model"); }));
    const out = await j.resolveEntity({ name: "X", kind: "thing" }, [], "STANDARD");
    expect(out).toEqual({ sameAs: null, reason: "no similar entity known" });
  });

  it("mergeFacts validates indices, dropping out-of-range ones", async () => {
    const j = new GatewayMemoryJudge(stubGateway('{"merges":[{"keep":0,"supersede":[1,9]}]}'));
    const out = await j.mergeFacts("E", [{ idx: 0, text: "a" }, { idx: 1, text: "b" }], "STANDARD");
    expect(out).toEqual([{ keep: 0, supersede: [1] }]); // index 9 dropped
  });

  it("extractTopics lowercases and drops sub-3-char noise", async () => {
    const j = new GatewayMemoryJudge(stubGateway('{"topics":["Palladium","Metallurgy","x"]}'));
    const out = await j.extractTopics("quick one-line intuition about palladium", "STANDARD");
    expect(out).toEqual(["palladium", "metallurgy"]);
  });

  it("is best-effort — a provider error yields null so the caller falls back", async () => {
    const j = new GatewayMemoryJudge(stubGateway(() => { throw new Error("no eligible provider"); }));
    expect(await j.mergeFacts("E", [{ idx: 0, text: "a" }, { idx: 1, text: "b" }], "LOCAL_ONLY")).toBeNull();
    expect(await j.extractTopics("text", "STANDARD")).toBeNull();
    expect(
      await j.resolveEntity({ name: "a", kind: "thing" }, [{ name: "b", kind: "thing" }], "STANDARD"),
    ).toBeNull();
  });

  it("unparseable model output yields null (never throws)", async () => {
    const j = new GatewayMemoryJudge(stubGateway("I think these are probably the same, honestly."));
    expect(await j.mergeFacts("E", [{ idx: 0, text: "a" }, { idx: 1, text: "b" }], "STANDARD")).toBeNull();
  });

  it("gate off → every method returns null (no model call)", async () => {
    const j = new GatewayMemoryJudge(stubGateway(() => { throw new Error("must not call the model"); }), {
      enabled: () => false,
    });
    expect(
      await j.resolveEntity({ name: "Pepper", kind: "person" }, [{ name: "Pepper Potts", kind: "person" }], "STANDARD"),
    ).toBeNull();
    expect(await j.extractTopics("t", "STANDARD")).toBeNull();
  });

  it("privacyForSensitivities: private/secret → LOCAL_ONLY, else STANDARD", () => {
    expect(privacyForSensitivities(["personal", "public"])).toBe("STANDARD");
    expect(privacyForSensitivities(["personal", "private"])).toBe("LOCAL_ONLY");
    expect(privacyForSensitivities(["secret"])).toBe("LOCAL_ONLY");
    expect(privacyForSensitivities([undefined])).toBe("STANDARD");
  });
});
