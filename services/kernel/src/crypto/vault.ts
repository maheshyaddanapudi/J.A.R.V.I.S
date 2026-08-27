import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  hkdfSync,
  timingSafeEqual,
} from "node:crypto";
import { readFile, writeFile, mkdir, chmod, access } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Local encrypted secrets vault + field-level encryption (R-MEM-03, R-MEM-06).
 *
 * Key hierarchy (nothing sensitive is ever stored in Postgres):
 *   KEK  — key-encryption-key. On macOS it comes from the Keychain; in the dev
 *          container it's derived from JARVIS_MASTER_KEY via HKDF. Never written
 *          to disk in the clear.
 *   DEK  — 256-bit data-encryption-key, generated once, AES-256-GCM-wrapped by
 *          the KEK and stored at `keyfile` (0600). Loaded + unwrapped in memory.
 *
 * Field encryption: AES-256-GCM with a random 96-bit nonce per value; output is
 * a self-describing string `v1.gcm.<nonce_b64>.<ct_b64>.<tag_b64>`. Ciphertext
 * carries its own integrity tag, so tampering is detected on decrypt.
 *
 * The DB only ever holds these opaque strings for sensitive fields — grep the
 * table and you find no plaintext (tested).
 */

const WRAP_INFO = Buffer.from("jarvis-dek-wrap-v1");
const PREFIX = "v1.gcm.";

export class Vault {
  private constructor(private readonly dek: Buffer) {}

  /**
   * Open (or initialize) the vault.
   * @param keyfile path to the wrapped-DEK file (local, 0600)
   * @param kek 32-byte key-encryption-key (from Keychain on Mac, HKDF(env) in dev)
   */
  static async open(keyfile: string, kek: Buffer): Promise<Vault> {
    if (kek.length !== 32) throw new Error("KEK must be 32 bytes");

    const exists = await access(keyfile).then(
      () => true,
      () => false,
    );

    if (exists) {
      // Keyfile present → the KEK MUST unwrap it. A failure here means the wrong
      // KEK: throw rather than silently re-keying (which would orphan all
      // existing ciphertext).
      const wrapped = JSON.parse(await readFile(keyfile, "utf8")) as {
        nonce: string;
        ct: string;
        tag: string;
      };
      let dek: Buffer;
      try {
        dek = gcmDecrypt(kek, WRAP_INFO, wrapped);
      } catch {
        throw new Error(
          "vault: cannot unwrap the data key — wrong KEK (Keychain/JARVIS_MASTER_KEY mismatch)",
        );
      }
      return new Vault(dek);
    }

    // First run: generate a fresh DEK and wrap it under the KEK.
    const dek = randomBytes(32);
    const wrapped = gcmEncrypt(kek, WRAP_INFO, dek);
    await mkdir(dirname(keyfile), { recursive: true });
    await writeFile(keyfile, JSON.stringify(wrapped), { mode: 0o600 });
    await chmod(keyfile, 0o600).catch(() => {});
    return new Vault(dek);
  }

  /** Derive the KEK from an env master key (dev/container path). */
  static kekFromEnv(masterKey: string): Buffer {
    return Buffer.from(
      hkdfSync("sha256", Buffer.from(masterKey), Buffer.alloc(0), Buffer.from("jarvis-kek-v1"), 32),
    );
  }

  /** Encrypt a plaintext field → opaque self-describing ciphertext string. */
  encrypt(plaintext: string): string {
    const { nonce, ct, tag } = gcmEncrypt(this.dek, Buffer.alloc(0), Buffer.from(plaintext, "utf8"));
    return `${PREFIX}${nonce}.${ct}.${tag}`;
  }

  /** Decrypt a ciphertext string produced by encrypt(). Throws on tamper/wrong key. */
  decrypt(value: string): string {
    if (!value.startsWith(PREFIX)) throw new Error("not a vault ciphertext");
    const [nonce, ct, tag] = value.slice(PREFIX.length).split(".");
    if (!nonce || !ct || !tag) throw new Error("malformed vault ciphertext");
    return gcmDecrypt(this.dek, Buffer.alloc(0), { nonce, ct, tag }).toString("utf8");
  }

  /** True if a stored value is vault-encrypted (vs plaintext legacy). */
  static isCiphertext(value: string): boolean {
    return value.startsWith(PREFIX);
  }
}

function gcmEncrypt(key: Buffer, aad: Buffer, plaintext: Buffer) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  if (aad.length) cipher.setAAD(aad);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { nonce: nonce.toString("base64"), ct: ct.toString("base64"), tag: tag.toString("base64") };
}

function gcmDecrypt(
  key: Buffer,
  aad: Buffer,
  wrapped: { nonce: string; ct: string; tag: string },
): Buffer {
  const nonce = Buffer.from(wrapped.nonce, "base64");
  const tag = Buffer.from(wrapped.tag, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  if (aad.length) decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(wrapped.ct, "base64")), decipher.final()]);
}

/** Constant-time compare helper (used by callers verifying wrapped material). */
export function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}
