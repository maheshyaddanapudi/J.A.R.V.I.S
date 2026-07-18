"use client";

import { useEffect, useState } from "react";

const KERNEL_URL = process.env.NEXT_PUBLIC_JARVIS_KERNEL_URL ?? "http://127.0.0.1:4150";

interface Setting {
  key: string;
  label: string;
  category: string;
  type: "number" | "boolean" | "string" | "enum" | "hour";
  value: number | boolean | string;
  default: number | boolean | string;
  source: "default" | "user" | "jarvis";
  reason: string;
  updatedAt: string | null;
  description: string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}

/**
 * Settings panel (D-0058): edit ANY catalogued runtime setting live — this is a
 * command center, not a start-time-only config screen. The list is whatever the
 * kernel registers, so new knobs appear here automatically. Each row shows the
 * effective value, who set it (default / you / J.A.R.V.I.S.) with the reason,
 * an editor, and reset-to-default. Z1 trust-core settings are deliberately not
 * in the catalog, so they never appear here.
 */
export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [note, setNote] = useState("loading…");
  const [estop, setEstop] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  async function load() {
    try {
      const r = await fetch(`${KERNEL_URL}/settings`, { cache: "no-store" }).then((x) => x.json());
      setSettings(r.settings ?? []);
      setNote((r.settings ?? []).length ? "" : "no editable settings registered");
    } catch {
      setNote("kernel unreachable");
    }
  }
  useEffect(() => {
    void load();
    const id = setInterval(async () => {
      try { setEstop(Boolean((await fetch(`${KERNEL_URL}/core/estop`, { cache: "no-store" }).then((r) => r.json())).engaged)); } catch { /* */ }
    }, 3000);
    return () => clearInterval(id);
  }, []);

  async function save(s: Setting, value: number | boolean | string) {
    const reason = draft[`${s.key}::reason`] || "changed via Command Center";
    const r = await fetch(`${KERNEL_URL}/settings/${encodeURIComponent(s.key)}`, {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ value, reason }),
    });
    if (!r.ok) { setNote(`rejected: ${(await r.json()).error ?? r.status}`); return; }
    setNote(""); await load();
  }
  async function reset(s: Setting) {
    await fetch(`${KERNEL_URL}/settings/${encodeURIComponent(s.key)}`, { method: "DELETE" });
    await load();
  }

  const categories = [...new Set(settings.map((s) => s.category))];
  const sourceColor = (src: string) => (src === "user" ? "var(--operational)" : src === "jarvis" ? "var(--advisory)" : "var(--dim)");

  return (
    <main style={{ padding: "1.5rem", maxWidth: 900, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
        <div>
          <h1 style={{ fontSize: "1.05rem", letterSpacing: "0.2em", color: "var(--operational)", margin: 0 }}>J.A.R.V.I.S. — SETTINGS</h1>
          <p style={{ color: "var(--dim)", margin: "0.2rem 0 0", fontSize: "0.8rem" }}>
            edit anything at runtime · effective = your value, else default (D-0058) · <a href="/" style={{ color: "var(--operational)" }}>dashboard</a>
          </p>
        </div>
        <button onClick={() => fetch(`${KERNEL_URL}/core/estop/${estop ? "resume" : "engage"}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ via: "command-center" }) })}
          style={{ background: "transparent", border: "1px solid var(--critical)", color: "var(--critical)", padding: "0.6rem 1rem", fontFamily: "var(--mono)", fontWeight: 700, cursor: "pointer" }}>
          {estop ? "⏹ STOPPED — RESUME" : "⏹ EMERGENCY STOP"}
        </button>
      </header>

      {note && <div style={{ color: "var(--advisory)", fontSize: "0.8rem", marginBottom: "0.6rem" }}>{note}</div>}

      {categories.map((cat) => (
        <section key={cat} style={{ marginBottom: "1rem", background: "var(--surface)", border: "1px solid var(--line)", borderLeft: "3px solid var(--operational)", padding: "0.6rem 0.9rem" }}>
          <h2 style={{ margin: "0 0 0.5rem", fontSize: "0.78rem", letterSpacing: "0.12em", color: "var(--operational)" }}>{cat.toUpperCase()}</h2>
          {settings.filter((s) => s.category === cat).map((s) => (
            <div key={s.key} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.4rem 0.8rem", alignItems: "center", padding: "0.45rem 0", borderTop: "1px solid var(--line)" }}>
              <div>
                <div style={{ color: "var(--focal)", fontSize: "0.85rem" }}>{s.label}
                  <span style={{ color: sourceColor(s.source), fontSize: "0.68rem", marginLeft: "0.5rem", border: `1px solid ${sourceColor(s.source)}`, padding: "0 0.35rem" }}>
                    {s.source === "default" ? "default" : `set by ${s.source}`}
                  </span>
                  {s.source !== "default" && s.reason && <span style={{ color: "var(--dim)", fontSize: "0.68rem", marginLeft: "0.4rem" }}>“{s.reason}”</span>}
                </div>
                <div style={{ color: "var(--dim)", fontSize: "0.72rem" }}>{s.description} <span style={{ opacity: 0.7 }}>({s.key}, default {String(s.default)})</span></div>
              </div>
              <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                {s.type === "boolean" ? (
                  <button onClick={() => save(s, !s.value)} aria-label={s.key} style={ctl(Boolean(s.value))}>{String(s.value)}</button>
                ) : s.type === "enum" ? (
                  <select aria-label={s.key} value={String(s.value)} onChange={(e) => save(s, e.target.value)} style={input}>
                    {s.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input aria-label={s.key} key={`${s.key}:${s.value}:${s.source}`} type="number" defaultValue={String(s.value)} min={s.min} max={s.max} step={s.step ?? 1}
                    onBlur={(e) => { const v = Number(e.target.value); if (v !== Number(s.value)) void save(s, v); }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    style={{ ...input, width: 78 }} />
                )}
                <button onClick={() => reset(s)} disabled={s.source === "default"} aria-label={`reset ${s.key}`}
                  style={{ ...ctl(false), opacity: s.source === "default" ? 0.35 : 1 }}>reset</button>
              </div>
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}

const input: React.CSSProperties = {
  background: "var(--bg)", border: "1px solid var(--line)", color: "var(--focal)",
  fontFamily: "var(--mono)", fontSize: "0.75rem", padding: "0.3rem 0.45rem",
};
function ctl(active: boolean): React.CSSProperties {
  return {
    background: "transparent", border: `1px solid ${active ? "var(--operational)" : "var(--line)"}`,
    color: active ? "var(--operational)" : "var(--focal)", padding: "0.3rem 0.7rem",
    fontFamily: "var(--mono)", fontSize: "0.73rem", cursor: "pointer",
  };
}
