"use client";

import { useEffect, useState } from "react";

const KERNEL_URL = process.env.NEXT_PUBLIC_JARVIS_KERNEL_URL ?? "http://127.0.0.1:4150";

interface Prompt { id?: string; name: string; kind: string; content: string; active: boolean; version?: number; fallback?: boolean }

/**
 * Persona panel (R-CAP-01 prompts kind, D-0043): view and edit how J.A.R.V.I.S.
 * speaks. The active persona is what /core/converse actually injects — real kernel
 * state over /prompts. Editing goes through POST /prompts (supersede-with-history);
 * activate/delete switch or remove saved personas. The built-in butler default is
 * the fallback, so there is never a blank persona.
 */
export default function PersonaPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [active, setActive] = useState<Prompt | null>(null);
  const [name, setName] = useState("butler");
  const [content, setContent] = useState("");
  const [note, setNote] = useState("");

  async function refresh() {
    try {
      const r = await fetch(`${KERNEL_URL}/prompts`, { cache: "no-store" }).then((x) => x.json());
      setPrompts(r.prompts ?? []);
      setActive(r.active ?? null);
      if (r.active && !content) { setName(r.active.name); setContent(r.active.content); }
    } catch { /* */ }
  }
  useEffect(() => { void refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!name.trim() || !content.trim()) return;
    setNote("");
    const r = await fetch(`${KERNEL_URL}/prompts`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), kind: "persona", content: content.trim() }),
    });
    setNote(r.ok ? `saved & activated '${name.trim()}'` : "save failed");
    await refresh();
  }
  async function activate(n: string) {
    await fetch(`${KERNEL_URL}/prompts/${encodeURIComponent(n)}/activate`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    await refresh();
  }
  async function remove(n: string) {
    await fetch(`${KERNEL_URL}/prompts/${encodeURIComponent(n)}`, { method: "DELETE" });
    await refresh();
  }

  const active_personas = prompts.filter((p) => p.kind === "persona");

  return (
    <main style={{ padding: "1.5rem", maxWidth: 860, margin: "0 auto" }}>
      <header style={{ marginBottom: "0.8rem" }}>
        <h1 style={{ fontSize: "1.05rem", letterSpacing: "0.2em", color: "var(--operational)", margin: 0 }}>J.A.R.V.I.S. — PERSONA</h1>
        <p style={{ color: "var(--dim)", margin: "0.2rem 0 0", fontSize: "0.8rem" }}>
          how J.A.R.V.I.S. speaks — user-editable (R-CAP-01, D-0043) · <a href="/" style={{ color: "var(--operational)" }}>dashboard</a> · <a href="/chat" style={{ color: "var(--operational)" }}>chat</a>
        </p>
      </header>

      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderLeft: "3px solid var(--operational)", padding: "0.6rem 1rem", marginBottom: "0.8rem", fontSize: "0.78rem" }}>
        <span style={{ color: "var(--dim)" }}>active persona: </span>
        <b style={{ color: "var(--focal)" }}>{active ? active.name : "(default)"}</b>
        {active?.fallback && <span style={{ color: "var(--advisory)" }}> · built-in default (no custom persona set)</span>}
        <div style={{ color: "var(--dim)", marginTop: "0.3rem", fontStyle: "italic" }}>{active?.content}</div>
      </div>

      <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderLeft: "3px solid var(--focal)", padding: "0.9rem 1.1rem", marginBottom: "0.8rem" }}>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "0.78rem", letterSpacing: "0.12em", color: "var(--focal)" }}>EDIT / CREATE</h2>
        <div style={{ display: "flex", gap: "0.3rem", marginBottom: "0.4rem" }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="persona name" style={{ ...inputStyle, width: 180 }} />
          <span style={{ color: "var(--dim)", fontSize: "0.72rem", alignSelf: "center" }}>saving creates a new version and makes it active</span>
        </div>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4}
          placeholder="You are J.A.R.V.I.S., a composed, dry-witted British butler-assistant…"
          style={{ width: "100%", ...inputStyle, resize: "vertical" }} />
        <div style={{ marginTop: "0.4rem", display: "flex", gap: "0.4rem", alignItems: "center" }}>
          <button onClick={save} disabled={!name.trim() || !content.trim()} style={{ ...btn("var(--operational)"), opacity: name.trim() && content.trim() ? 1 : 0.5 }}>save &amp; activate</button>
          {note && <span style={{ color: "var(--dim)", fontSize: "0.72rem" }}>{note}</span>}
        </div>
      </section>

      <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderLeft: "3px solid var(--advisory)", padding: "0.9rem 1.1rem" }}>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "0.78rem", letterSpacing: "0.12em", color: "var(--advisory)" }}>SAVED PERSONAS ({active_personas.length})</h2>
        {active_personas.length === 0 && <span style={{ color: "var(--dim)", fontSize: "0.8rem" }}>none yet — the built-in butler default is in use</span>}
        {active_personas.map((p) => (
          <div key={p.id ?? p.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0.25rem 0", borderBottom: "1px solid var(--line)", fontSize: "0.8rem" }}>
            <span>
              <span style={{ color: p.active ? "var(--operational)" : "var(--focal)" }}>{p.name}</span>
              {p.active && <span style={{ color: "var(--operational)", fontSize: "0.68rem" }}> · ACTIVE</span>}
              <span style={{ color: "var(--dim)", fontSize: "0.68rem" }}> v{p.version}</span>
            </span>
            <span style={{ display: "flex", gap: "0.3rem" }}>
              <button onClick={() => { setName(p.name); setContent(p.content); }} style={btn("var(--focal)")}>edit</button>
              {!p.active && <button onClick={() => activate(p.name)} style={btn("var(--operational)")}>activate</button>}
              <button onClick={() => remove(p.name)} style={btn("var(--critical)")}>delete</button>
            </span>
          </div>
        ))}
      </section>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--bg)", border: "1px solid var(--line)", color: "var(--focal)",
  fontFamily: "var(--mono)", fontSize: "0.76rem", padding: "0.4rem 0.5rem",
};
function btn(color: string): React.CSSProperties {
  return { background: "transparent", border: `1px solid ${color}`, color, padding: "0.2rem 0.55rem", fontFamily: "var(--mono)", fontSize: "0.72rem", cursor: "pointer" };
}
