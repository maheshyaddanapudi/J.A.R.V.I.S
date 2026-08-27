import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { Vault } from "../src/crypto/vault.js";

describe("Vault (field encryption)", () => {
  let dir: string;
  let kek: Buffer;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "jarvis-vault-"));
    kek = randomBytes(32);
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("round-trips a value and hides the plaintext in ciphertext", async () => {
    const v = await Vault.open(join(dir, "dek.json"), kek);
    const ct = v.encrypt("my private note: teal");
    expect(ct).toMatch(/^v1\.gcm\./);
    expect(ct).not.toContain("teal");
    expect(v.decrypt(ct)).toBe("my private note: teal");
  });

  it("produces a distinct nonce/ciphertext each time (semantic security)", async () => {
    const v = await Vault.open(join(dir, "dek.json"), kek);
    const a = v.encrypt("same");
    const b = v.encrypt("same");
    expect(a).not.toBe(b);
    expect(v.decrypt(a)).toBe("same");
    expect(v.decrypt(b)).toBe("same");
  });

  it("persists the wrapped DEK and re-opens with the same KEK", async () => {
    const keyfile = join(dir, "persist.json");
    const v1 = await Vault.open(keyfile, kek);
    const ct = v1.encrypt("survives restart");
    const v2 = await Vault.open(keyfile, kek); // simulates process restart
    expect(v2.decrypt(ct)).toBe("survives restart");
  });

  it("a wrong KEK cannot unwrap the DEK", async () => {
    const keyfile = join(dir, "wrongkek.json");
    await Vault.open(keyfile, kek); // creates + wraps under kek
    const wrongKek = randomBytes(32);
    await expect(Vault.open(keyfile, wrongKek)).rejects.toThrow();
  });

  it("detects tampering with the ciphertext (GCM auth)", async () => {
    const v = await Vault.open(join(dir, "dek.json"), kek);
    const ct = v.encrypt("integrity-protected");
    const parts = ct.split(".");
    // flip a byte in the base64 ciphertext body
    const body = Buffer.from(parts[3]!, "base64");
    body[0] = body[0]! ^ 0xff;
    parts[3] = body.toString("base64");
    expect(() => v.decrypt(parts.join("."))).toThrow();
  });

  it("the wrapped-DEK file on disk contains no plaintext key material", async () => {
    const keyfile = join(dir, "ondisk.json");
    const v = await Vault.open(keyfile, kek);
    const secret = "topsecret-marker-9931";
    const ct = v.encrypt(secret);
    const fileText = await readFile(keyfile, "utf8");
    expect(fileText).not.toContain(secret);
    expect(fileText).not.toContain(kek.toString("base64"));
    expect(ct).not.toContain(secret);
  });

  it("kekFromEnv derives a stable 32-byte key", () => {
    const k1 = Vault.kekFromEnv("passphrase");
    const k2 = Vault.kekFromEnv("passphrase");
    expect(k1.length).toBe(32);
    expect(k1.equals(k2)).toBe(true);
    expect(k1.equals(Vault.kekFromEnv("different"))).toBe(false);
  });
});
