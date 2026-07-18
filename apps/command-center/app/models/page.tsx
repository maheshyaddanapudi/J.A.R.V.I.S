"use client";

import { useEffect, useState } from "react";

const KERNEL_URL = process.env.NEXT_PUBLIC_JARVIS_KERNEL_URL ?? "http://127.0.0.1:4150";

interface ProviderRow { provider: string; kind: string; local: boolean; ok: boolean; detail: string }
interface CallRow {
  at: string; role: string; provider: string | null; model: string | null;
  privacy_class: string; source: string; ok: boolean; error: string | null;
  input_tokens: number; output_tokens: number; latency_ms: number;
  fallback_from: string[]; offline_mode: boolean;
}

/**
 * Model-gateway panel (D-0047): SEE the local-first routing brain. Everything
 * shown is measured kernel state — live provider reachability (real pings),
 * the role→target routing table (order = preference, local first; targets are
 * annotated `@effort+thinking` when configured, D-0046), and the model_calls
 * audit tail (R-MODEL-03: routing outcomes only, never message content).
 */
export default function ModelsPage() {
  const [offline, setOffline] = useState<boolean | null>(null);
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [roles, setRoles] = useState<Record<string, string[]>>({});
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [callsAvailable, setCallsAvailable] = useState(true);
  const [estop, setEstop] = useState(false);

  useEffect(() => {
    async function refresh() {
      try {
        const s = await fetch(`${KERNEL_URL}/gateway/status`, { cache: "no-store" }).then((r) => r.json());
        setOffline(Boolean(s.offline));
        setProviders(s.providers ?? []);
      } catch { /* kernel down — sections stay empty */ }
      try {
        const r = await fetch(`${KERNEL_URL}/gateway/roles`, { cache: "no-store" }).then((r) => r.json());
        setRoles(r.roles ?? {});
      } catch { /* */ }
      try {
        const c = await fetch(`${KERNEL_URL}/gateway/calls?limit=25`, { cache: "no-store" });
        if (c.ok) setCalls((await c.json()).calls ?? []);
        else setCallsAvailable(false);
      } catch { setCallsAvailable(false); }
    }
    void refresh();
    const id = setInterval(refresh, 5000);
    const eid = setInterval(async () => {
      try { setEstop(Boolean((await fetch(`${KERNEL_URL}/core/estop`, { cache: "no-store" }).then((r) => r.json())).engaged)); } catch { /* */ }
    }, 3000);
    return () => { clearInterval(id); clearInterval(eid); };
  }, []);

  return (
    <main style={{ padding: "1.5rem", maxWidth: 980, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
        <div>
          <h1 style={{ fontSize: "1.05rem", letterSpacing: "0.2em", color: "var(--operational)", margin: 0 }}>J.A.R.V.I.S. — MODEL GATEWAY</h1>
          <p style={{ color: "var(--dim)", margin: "0.2rem 0 0", fontSize: "0.8rem" }}>
            local-capable-first routing, measured live · <a href="/" style={{ color: "var(--operational)" }}>dashboard</a>
          </p>
        </div>
        <button onClick={() => fetch(`${KERNEL_URL}/core/estop/${estop ? "resume" : "engage"}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ via: "command-center" }) })}
          style={{ background: "transparent", border: "1px solid var(--critical)", color: "var(--critical)", padding: "0.6rem 1rem", fontFamily: "var(--mono)", fontWeight: 700, cursor: "pointer" }}>
          {estop ? "⏹ STOPPED — RESUME" : "⏹ EMERGENCY STOP"}
        </button>
      </header>

      {offline && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--advisory)", color: "var(--advisory)", padding: "0.5rem 0.9rem", marginBottom: "0.7rem", fontSize: "0.8rem" }}>
          OFFLINE MODE — every remote provider is refused; only local providers serve.
        </div>
      )}

      <section style={sec("--operational")}>
        <h2 style={h2("--operational")}>PROVIDERS (live reachability — measured, never cached)</h2>
        {providers.length === 0 ? (
          <div style={{ color: "var(--dim)", fontSize: "0.8rem" }}>kernel unreachable or no gateway configured</div>
        ) : (
          providers.map((p) => (
            <div key={p.provider} style={{ display: "flex", gap: "0.7rem", alignItems: "baseline", fontSize: "0.8rem", marginBottom: "0.25rem" }}>
              <b style={{ color: "var(--focal)", minWidth: 110 }}>{p.provider}</b>
              <span style={{ color: "var(--dim)", minWidth: 100 }}>{p.kind}</span>
              <span style={{ color: p.local ? "var(--operational)" : "var(--advisory)", minWidth: 70 }}>{p.local ? "LOCAL" : "REMOTE"}</span>
              <span style={{ color: p.ok ? "var(--operational)" : "var(--critical)", minWidth: 90 }}>{p.ok ? "● reachable" : "○ down"}</span>
              <span style={{ color: "var(--dim)" }}>{p.detail}</span>
            </div>
          ))
        )}
      </section>

      <section style={sec("--focal")}>
        <h2 style={h2("--focal")}>ROLE ROUTING (order = preference; local targets first · <code>@effort+thinking</code> from config)</h2>
        {Object.keys(roles).length === 0 ? (
          <div style={{ color: "var(--dim)", fontSize: "0.8rem" }}>no roles configured</div>
        ) : (
          Object.entries(roles).map(([role, targets]) => (
            <div key={role} style={{ display: "flex", gap: "0.6rem", alignItems: "baseline", fontSize: "0.8rem", marginBottom: "0.3rem", flexWrap: "wrap" }}>
              <b style={{ color: "var(--focal)", minWidth: 150 }}>{role}</b>
              {targets.map((t, i) => (
                <span key={i} style={{ border: "1px solid var(--line)", padding: "0.1rem 0.5rem", color: t.includes("@") || t.includes("+thinking") ? "var(--advisory)" : "var(--dim)", fontFamily: "var(--mono)" }}>
                  {i > 0 && <span style={{ color: "var(--dim)" }}>↓ </span>}{t}
                </span>
              ))}
            </div>
          ))
        )}
      </section>

      <section style={sec("--advisory")}>
        <h2 style={h2("--advisory")}>RECENT MODEL CALLS (routing audit R-MODEL-03 — outcomes only, never message content)</h2>
        {!callsAvailable ? (
          <div style={{ color: "var(--dim)", fontSize: "0.8rem" }}>call audit unavailable</div>
        ) : calls.length === 0 ? (
          <div style={{ color: "var(--dim)", fontSize: "0.8rem" }}>no model calls yet</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.74rem", fontFamily: "var(--mono)" }}>
              <thead>
                <tr>{["at", "role", "target", "privacy", "ok", "tokens in/out", "ms", "fallbacks"].map((h) => (
                  <th key={h} style={{ textAlign: "left", color: "var(--dim)", borderBottom: "1px solid var(--line)", padding: "0.25rem 0.5rem", fontWeight: 400 }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {calls.map((c, i) => (
                  <tr key={i}>
                    <td style={td}>{new Date(c.at).toLocaleTimeString()}</td>
                    <td style={{ ...td, color: "var(--focal)" }}>{c.role}</td>
                    <td style={td}>{c.provider ? `${c.provider}/${c.model}` : "—"}</td>
                    <td style={{ ...td, color: c.privacy_class === "LOCAL_ONLY" ? "var(--operational)" : "var(--advisory)" }}>{c.privacy_class}</td>
                    <td style={{ ...td, color: c.ok ? "var(--operational)" : "var(--critical)" }} title={c.error ?? ""}>{c.ok ? "ok" : `fail: ${(c.error ?? "").slice(0, 42)}`}</td>
                    <td style={td}>{c.input_tokens}/{c.output_tokens}</td>
                    <td style={td}>{c.latency_ms}</td>
                    <td style={td}>{c.fallback_from.length ? c.fallback_from.join(" → ") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function sec(accent: string): React.CSSProperties {
  return { background: "var(--surface)", border: "1px solid var(--line)", borderLeft: `3px solid var(${accent})`, padding: "0.9rem 1.1rem", marginBottom: "0.7rem" };
}
function h2(accent: string): React.CSSProperties {
  return { margin: "0 0 0.5rem", fontSize: "0.78rem", letterSpacing: "0.12em", color: `var(${accent})` };
}
const td: React.CSSProperties = { padding: "0.25rem 0.5rem", borderBottom: "1px solid var(--line)", color: "var(--dim)", whiteSpace: "nowrap" };
