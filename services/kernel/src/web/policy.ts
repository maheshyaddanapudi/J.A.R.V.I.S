import type { WebTargetCheck } from "./contract.js";

export interface WebPolicyOptions {
  /** offline mode (R-MODEL-04): only loopback targets are permitted. */
  offline: boolean;
  /**
   * Optional host allowlist. When non-empty, only these hosts (plus loopback)
   * may be navigated to — the user's explicitly-configured integrations
   * (R-LOC: "outbound calls only to integrations I explicitly configure").
   * Empty/undefined = any host is reachable, still per-navigation approval-gated.
   */
  allowlist?: string[];
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * Network policy for web navigation. Enforced BEFORE any browser launch so an
 * out-of-policy URL is a clean pre-approval denial:
 *   - only http/https schemes (no file://, data:, etc. — no local-FS bypass);
 *   - loopback is always allowed (hermetic in-container verification, offline ok);
 *   - offline mode refuses any non-loopback host;
 *   - a non-empty allowlist refuses any host not on it (loopback exempt).
 */
export function checkWebTarget(rawUrl: string, opts: WebPolicyOptions): WebTargetCheck {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return { allowed: false, reason: `not a valid URL: '${rawUrl}'` };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { allowed: false, reason: `refused scheme '${u.protocol}' (only http/https)` };
  }
  const host = u.hostname.toLowerCase();
  const isLoopback = LOOPBACK.has(host);
  if (isLoopback) return { allowed: true };

  if (opts.offline) {
    return { allowed: false, reason: `offline mode: external host '${host}' refused (loopback only)` };
  }
  if (opts.allowlist && opts.allowlist.length > 0) {
    const ok = opts.allowlist.some((h) => host === h.toLowerCase() || host.endsWith(`.${h.toLowerCase()}`));
    if (!ok) return { allowed: false, reason: `host '${host}' is not on the configured web allowlist` };
  }
  return { allowed: true };
}
