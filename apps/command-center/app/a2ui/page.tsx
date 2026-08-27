"use client";

import { useEffect, useState, useCallback } from "react";

const KERNEL_URL = process.env.NEXT_PUBLIC_JARVIS_KERNEL_URL ?? "http://127.0.0.1:4150";

interface Component {
  type: "heading" | "text" | "setting" | "settingsGroup" | "action";
  text?: string; key?: string; category?: string; label?: string; tool?: string; args?: Record<string, unknown>; confirm?: string;
}
interface Panel { id: string; title: string; spec: { title: string; description?: string; components: Component[] }; createdBy: string }
interface Setting { key: string; label: string; category: string; type: string; value: number | boolean | string; default: number | boolean | string; source: string; options?: string[]; min?: number; max?: number; step?: number }

/**
 * A2UI renderer (D-0061): renders J.A.R.V.I.S.-generated declarative panels
 * through a SANDBOXED renderer. Only the whitelisted component types are ever
 * rendered — an unknown type shows an inert "unsupported" chip, never executes.
 * `setting`/`settingsGroup` edit via the same PUT /settings contract; `action`
 * invokes a REGISTERED gated tool through /core/run-tool (approval applies).
 * The spec carries no HTML/URL/code, so nothing here can run arbitrary content.
 */
export default function A2uiPage() {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [settings, setSettings] = useState<Record<string, Setting>>({});
  const [note, setNote] = useState("loading…");

  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([
        fetch(`${KERNEL_URL}/a2ui/panels`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`${KERNEL_URL}/settings`, { cache: "no-store" }).then((r) => r.json()),
      ]);
      setPanels(p.panels ?? []);
      const byKey: Record<string, Setting> = {};
      for (const x of s.settings ?? []) byKey[x.key] = x;
      setSettings(byKey);
      setNote((p.panels ?? []).length ? "" : "no panels yet — J.A.R.V.I.S. composes these with the ui.compose tool");
    } catch { setNote("kernel unreachable"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function saveSetting(key: string, value: number | boolean | string) {
    await fetch(`${KERNEL_URL}/settings/${encodeURIComponent(key)}`, {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ value, reason: "edited via A2UI panel" }),
    });
    await load();
  }
  async function runAction(c: Component) {
    if (c.confirm && !window.confirm(c.confirm)) return;
    setNote(`sending "${c.label}" for approval…`);
    try {
      const r = await fetch(`${KERNEL_URL}/core/run-tool`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ tool: c.tool, args: c.args ?? {}, source: "a2ui" }),
        signal: AbortSignal.timeout(4000),
      }).then((x) => x.json());
      setNote(r.ok ? `✓ ${r.summary}` : `${r.summary ?? "sent — resolve on the dashboard"}`);
    } catch { setNote(`"${c.label}" sent through the gated loop — approve it on the dashboard`); }
    await load();
  }

  function renderSetting(s: Setting | undefined, key: string) {
    if (!s) return <div key={key} style={chip("var(--critical)")}>unknown setting {key}</div>;
    return (
      <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4rem 0", borderTop: "1px solid var(--line)" }}>
        <div><span style={{ color: "var(--focal)", fontSize: "0.85rem" }}>{s.label}</span>
          <span style={{ color: "var(--dim)", fontSize: "0.7rem", marginLeft: "0.5rem" }}>{s.key} · {s.source}</span></div>
        {s.type === "boolean" ? (
          <button onClick={() => saveSetting(s.key, !s.value)} aria-label={s.key} style={ctl(Boolean(s.value))}>{String(s.value)}</button>
        ) : s.type === "enum" ? (
          <select aria-label={s.key} value={String(s.value)} onChange={(e) => saveSetting(s.key, e.target.value)} style={input}>
            {s.options?.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input aria-label={s.key} key={`${s.key}:${s.value}`} type="number" defaultValue={String(s.value)} min={s.min} max={s.max} step={s.step ?? 1}
            onBlur={(e) => { const v = Number(e.target.value); if (v !== Number(s.value)) void saveSetting(s.key, v); }}
            style={{ ...input, width: 78 }} />
        )}
      </div>
    );
  }

  function renderComponent(c: Component, i: number) {
    switch (c.type) {
      case "heading": return <h3 key={i} style={{ color: "var(--operational)", fontSize: "0.9rem", letterSpacing: "0.1em", margin: "0.6rem 0 0.3rem" }}>{c.text}</h3>;
      case "text": return <p key={i} style={{ color: "var(--dim)", fontSize: "0.82rem", margin: "0.2rem 0" }}>{c.text}</p>;
      case "setting": return renderSetting(settings[c.key ?? ""], c.key ?? "");
      case "settingsGroup":
        return <div key={i}>{Object.values(settings).filter((s) => s.category === c.category).map((s) => renderSetting(s, s.key))}</div>;
      case "action":
        return <button key={i} onClick={() => runAction(c)} aria-label={`action ${c.tool}`} style={{ ...ctl(false), color: "var(--advisory)", margin: "0.4rem 0.4rem 0 0" }}>{c.label} →</button>;
      default:
        return <div key={i} style={chip("var(--critical)")}>unsupported component: {(c as { type?: string }).type}</div>;
    }
  }

  return (
    <main style={{ padding: "1.5rem", maxWidth: 900, margin: "0 auto" }}>
      <header style={{ marginBottom: "0.6rem" }}>
        <h1 style={{ fontSize: "1.05rem", letterSpacing: "0.2em", color: "var(--operational)", margin: 0 }}>J.A.R.V.I.S. — A2UI PANELS</h1>
        <p style={{ color: "var(--dim)", margin: "0.2rem 0 0", fontSize: "0.8rem" }}>
          panels J.A.R.V.I.S. composed (sandboxed renderer · whitelisted components · edits go through /settings + gated tools, D-0061) · <a href="/settings" style={{ color: "var(--operational)" }}>settings</a> · <a href="/" style={{ color: "var(--operational)" }}>dashboard</a>
        </p>
      </header>
      {note && <div style={{ color: note.startsWith("✓") ? "var(--operational)" : "var(--advisory)", fontSize: "0.8rem", marginBottom: "0.6rem" }}>{note}</div>}
      {panels.map((p) => (
        <section key={p.id} style={{ marginBottom: "1rem", background: "var(--surface)", border: "1px solid var(--line)", borderLeft: "3px solid var(--advisory)", padding: "0.7rem 1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 style={{ margin: 0, fontSize: "0.85rem", color: "var(--focal)", letterSpacing: "0.05em" }}>{p.spec.title}
              <span style={{ color: "var(--dim)", fontSize: "0.68rem", marginLeft: "0.5rem" }}>composed by {p.createdBy}</span></h2>
            <button onClick={async () => { await fetch(`${KERNEL_URL}/a2ui/panels/${p.id}`, { method: "DELETE" }); await load(); }}
              aria-label={`remove ${p.id}`} style={{ ...ctl(false), color: "var(--critical)", fontSize: "0.68rem" }}>remove</button>
          </div>
          {p.spec.description && <p style={{ color: "var(--dim)", fontSize: "0.8rem", margin: "0.2rem 0 0.4rem" }}>{p.spec.description}</p>}
          {p.spec.components.map((c, i) => renderComponent(c, i))}
        </section>
      ))}
    </main>
  );
}

const input: React.CSSProperties = { background: "var(--bg)", border: "1px solid var(--line)", color: "var(--focal)", fontFamily: "var(--mono)", fontSize: "0.75rem", padding: "0.3rem 0.45rem" };
function ctl(active: boolean): React.CSSProperties {
  return { background: "transparent", border: `1px solid ${active ? "var(--operational)" : "var(--line)"}`, color: active ? "var(--operational)" : "var(--focal)", padding: "0.3rem 0.7rem", fontFamily: "var(--mono)", fontSize: "0.73rem", cursor: "pointer" };
}
function chip(color: string): React.CSSProperties {
  return { color, border: `1px solid ${color}`, padding: "0.15rem 0.5rem", fontSize: "0.72rem", display: "inline-block", margin: "0.2rem 0" };
}
