import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Vault } from "./vault.js";

const exec = promisify(execFile);

/**
 * Provides the 32-byte key-encryption-key (KEK) for the vault.
 *
 * - macOS: from the login Keychain (`security`), generated once on first run.
 *   The KEK never leaves the machine and is protected by the OS keychain (ACL +
 *   FileVault at rest).
 * - dev/container: derived from JARVIS_MASTER_KEY via HKDF. Refuses to run in
 *   prod without an explicit key (no silent insecure default).
 */
export async function resolveKek(env: NodeJS.ProcessEnv = process.env): Promise<Buffer> {
  const isMac = process.platform === "darwin";
  const service = "jarvis-vault-kek";
  const account = "jarvis";

  if (isMac && env.JARVIS_KEK_FROM_KEYCHAIN !== "0") {
    try {
      const { stdout } = await exec("security", [
        "find-generic-password",
        "-s",
        service,
        "-a",
        account,
        "-w",
      ]);
      return Buffer.from(stdout.trim(), "base64");
    } catch {
      // not present yet — generate, store, and return
      const kek = randomKek();
      await exec("security", [
        "add-generic-password",
        "-s",
        service,
        "-a",
        account,
        "-w",
        kek.toString("base64"),
        "-U",
      ]);
      return kek;
    }
  }

  const master = env.JARVIS_MASTER_KEY;
  if (!master) {
    if (env.JARVIS_ENV === "prod") {
      throw new Error(
        "no vault KEK: set JARVIS_MASTER_KEY (dev) or run on macOS with Keychain access (prod)",
      );
    }
    // dev-only deterministic fallback so `make dev` works out of the box; loudly
    // non-secret. Real deployments must set JARVIS_MASTER_KEY or use Keychain.
    return Vault.kekFromEnv("dev-insecure-master-key-set-JARVIS_MASTER_KEY");
  }
  return Vault.kekFromEnv(master);
}

function randomKek(): Buffer {
  // 32 random bytes; import lazily to keep this module light
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { randomBytes } = require("node:crypto") as typeof import("node:crypto");
  return randomBytes(32);
}
