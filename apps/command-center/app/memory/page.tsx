"use client";

import { useEffect, useState } from "react";

const KERNEL_URL = process.env.NEXT_PUBLIC_JARVIS_KERNEL_URL ?? "http://127.0.0.1:4150";

interface Entity { id: string; name: string; kind: string; attributes: string }
interface Fact { id: string; statement: string; status: string }
interface Rel { relation: string; toName?: string; toKind?: string; fromName?: string; fromKind?: string; note: string }
interface Recall { entity: Entity; facts: Fact[]; relationsOut: Rel[]; relationsIn: Rel[] }
interface Episode { id: string; occurred_at: string; kind: string; summary: string; detail: string; entity_name: string | null; importance: number; tags: string[]; provenance: string }

/**
 * Semantic-memory panel (R-MEM-04 user control): view what J.A.R.V.I.S. knows about
 * your world (entities, facts, relationships) and control it — recall, remember,
 * forget. All real kernel state over /memory/entities; remembering goes through the
 * gated loop (LOW_REVERSIBLE). Content is encrypted at rest; only non-secret facts
 * are ever surfaced in conversation context.
 */
export default function MemoryPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selected, setSelected] = useState<Recall | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("person");
  const [fact, setFact] = useState("");
  const [estop, setEstop] = useState(false);
  const [note, setNote] = useState("");
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [eq, setEq] = useState("");
  const [byMeaning, setByMeaning] = useState(false);
  const [semanticActive, setSemanticActive] = useState(false);
  const [evSummary, setEvSummary] = useState("");
  const [evKind, setEvKind] = useState("note");

  async function refresh() {
    try {
      const r = await fetch(`${KERNEL_URL}/memory/entities`, { cache: "no-store" }).then((x) => x.json());
      setEntities(r.entities ?? []);
    } catch { /* */ }
  }
  async function refreshEpisodes(q = eq, semantic = byMeaning) {
    try {
      const sem = semantic && q.trim() ? "&semantic=1" : "";
      const url = `${KERNEL_URL}/memory/episodes?limit=40${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}${sem}`;
      const r = await fetch(url, { cache: "no-store" }).then((x) => x.json());
      setEpisodes(r.episodes ?? []);
      setSemanticActive(r.mode === "semantic");
    } catch { /* */ }
  }
  async function recordEpisode() {
    if (!evSummary.trim()) return;
    await fetch(`${KERNEL_URL}/core/run-tool`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool: "memory.recordEpisode", args: { summary: evSummary.trim(), kind: evKind }, source: "command-center", delegatedAutomation: true }),
    });
    setEvSummary("");
    await refreshEpisodes();
  }
  async function forgetEpisode(id: string) {
    await fetch(`${KERNEL_URL}/memory/episodes/${id}/forget`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    await refreshEpisodes();
  }
  useEffect(() => { void refresh(); void refreshEpisodes(""); }, []);
  useEffect(() => {
    const id = setInterval(async () => {
      try { setEstop(Boolean((await fetch(`${KERNEL_URL}/core/estop`, { cache: "no-store" }).then((r) => r.json())).engaged)); } catch { /* */ }
    }, 2000);
    return () => clearInterval(id);
  }, []);

  async function recall(n: string) {
    setNote("");
    const r = await fetch(`${KERNEL_URL}/memory/entities/${encodeURIComponent(n)}`, { cache: "no-store" });
    if (!r.ok) { setSelected(null); setNote(`no memory of '${n}'`); return; }
    setSelected(await r.json());
  }
  async function remember() {
    if (!name.trim()) return;
    setNote("");
    await fetch(`${KERNEL_URL}/core/run-tool`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool: "memory.rememberEntity", args: { kind, name: name.trim() }, source: "command-center", delegatedAutomation: true }),
    });
    if (fact.trim()) {
      await fetch(`${KERNEL_URL}/core/run-tool`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ tool: "memory.rememberFact", args: { entity: name.trim(), kind, statement: fact.trim() }, source: "command-center", delegatedAutomation: true }),
      });
    }
    const n = name.trim();
    setName(""); setFact("");
    await refresh();
    await recall(n);
  }
  async function forget(n: string) {
    await fetch(`${KERNEL_URL}/memory/entities/${encodeURIComponent(n)}/forget`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    setSelected(null);
    await refresh();
  }
  async function toggleEstop() {
    await fetch(`${KERNEL_URL}/core/estop/${estop ? "resume" : "engage"}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ via: "command-center" }) });
  }

  return (
    <main style={{ padding: "1.5rem", maxWidth: 940, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
        <div>
          <h1 style={{ fontSize: "1.05rem", letterSpacing: "0.2em", color: "var(--operational)", margin: 0 }}>J.A.R.V.I.S. — MEMORY</h1>
          <p style={{ color: "var(--dim)", margin: "0.2rem 0 0", fontSize: "0.8rem" }}>
            what J.A.R.V.I.S. knows about your world — view &amp; control (R-MEM-04) · <a href="/" style={{ color: "var(--operational)" }}>dashboard</a>
          </p>
        </div>
        <button onClick={toggleEstop} style={{ ...btn("var(--critical)"), padding: "0.6rem 1rem", fontWeight: 700 }}>
          {estop ? "⏹ STOPPED — RESUME" : "⏹ EMERGENCY STOP"}
        </button>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
        <Panel tone="operational" title={`KNOWN ENTITIES (${entities.length})`}>
          <div style={{ maxHeight: 240, overflowY: "auto", fontSize: "0.8rem" }}>
            {entities.length === 0 && <span style={{ color: "var(--dim)" }}>nothing remembered yet — add one below</span>}
            {entities.map((e) => (
              <div key={e.id} onClick={() => recall(e.name)} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", padding: "0.15rem 0" }}>
                <span><span style={{ color: "var(--dim)" }}>{e.kind}</span> <span style={{ color: "var(--focal)" }}>{e.name}</span></span>
                <button onClick={(ev) => { ev.stopPropagation(); void forget(e.name); }} style={btn("var(--critical)")}>forget</button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "0.6rem", borderTop: "1px solid var(--line)", paddingTop: "0.5rem" }}>
            <div style={{ color: "var(--dim)", fontSize: "0.72rem", marginBottom: "0.3rem" }}>remember something new:</div>
            <div style={{ display: "flex", gap: "0.3rem", marginBottom: "0.25rem" }}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="name" style={{ flex: 1, ...inputStyle }} />
              <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ ...inputStyle }}>
                <option>person</option><option>project</option><option>place</option><option>org</option><option>thing</option><option>topic</option>
              </select>
            </div>
            <input value={fact} onChange={(e) => setFact(e.target.value)} placeholder="a fact about them (optional, encrypted at rest)" style={{ width: "100%", marginBottom: "0.35rem", ...inputStyle }} />
            <button onClick={remember} disabled={!name.trim()} style={{ ...btn("var(--operational)"), opacity: name.trim() ? 1 : 0.5 }}>remember</button>
            {note && <div style={{ marginTop: "0.3rem", color: "var(--dim)", fontSize: "0.72rem" }}>{note}</div>}
          </div>
        </Panel>

        <Panel tone="focal" title={selected ? `${selected.entity.kind.toUpperCase()} — ${selected.entity.name}` : "RECALL"}>
          {!selected && <span style={{ color: "var(--dim)" }}>click an entity to see what J.A.R.V.I.S. knows</span>}
          {selected && (
            <div style={{ fontSize: "0.8rem" }}>
              {selected.entity.attributes && <div style={{ color: "var(--dim)", marginBottom: "0.4rem" }}>{selected.entity.attributes}</div>}
              {selected.facts.length > 0 && (
                <>
                  <div style={{ color: "var(--operational)", fontSize: "0.72rem", letterSpacing: "0.1em" }}>FACTS</div>
                  {selected.facts.map((f) => (
                    <div key={f.id} style={{ marginBottom: "0.2rem" }}>• {f.statement} <span style={{ color: "var(--dim)", fontSize: "0.68rem" }}>[{f.status}]</span></div>
                  ))}
                </>
              )}
              {(selected.relationsOut.length > 0 || selected.relationsIn.length > 0) && (
                <>
                  <div style={{ color: "var(--operational)", fontSize: "0.72rem", letterSpacing: "0.1em", marginTop: "0.4rem" }}>RELATIONSHIPS</div>
                  {selected.relationsOut.map((r, i) => (
                    <div key={`o${i}`} style={{ marginBottom: "0.15rem" }}>→ {r.relation} → <span style={{ color: "var(--dim)" }}>{r.toKind}</span> {r.toName}</div>
                  ))}
                  {selected.relationsIn.map((r, i) => (
                    <div key={`i${i}`} style={{ marginBottom: "0.15rem" }}>← <span style={{ color: "var(--dim)" }}>{r.fromKind}</span> {r.fromName} — {r.relation} → this</div>
                  ))}
                </>
              )}
              {selected.facts.length === 0 && selected.relationsOut.length === 0 && selected.relationsIn.length === 0 && (
                <span style={{ color: "var(--dim)" }}>no facts or relations recorded yet</span>
              )}
              <div style={{ marginTop: "0.6rem" }}>
                <button onClick={() => forget(selected.entity.name)} style={btn("var(--critical)")}>forget this entity</button>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <div style={{ marginTop: "0.8rem" }}>
        <Panel tone="advisory" title={`TIMELINE — WHAT HAPPENED (${episodes.length})`}>
          <div style={{ color: "var(--dim)", fontSize: "0.72rem", marginBottom: "0.4rem" }}>
            a recallable log of events — consequential actions are recorded here automatically (D-0041); encrypted at rest, forgettable
          </div>
          <div style={{ display: "flex", gap: "0.3rem", marginBottom: "0.35rem", alignItems: "center" }}>
            <input
              value={eq}
              onChange={(e) => setEq(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void refreshEpisodes(); }}
              placeholder="search the timeline…"
              style={{ flex: 1, ...inputStyle }}
            />
            <button onClick={() => refreshEpisodes()} style={btn("var(--operational)")}>search</button>
            {eq && <button onClick={() => { setEq(""); setSemanticActive(false); void refreshEpisodes("", false); }} style={btn("var(--dim)")}>clear</button>}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "var(--dim)", fontSize: "0.72rem", marginBottom: "0.5rem", cursor: "pointer" }}>
            <input type="checkbox" checked={byMeaning} onChange={(e) => { setByMeaning(e.target.checked); if (eq.trim()) void refreshEpisodes(eq, e.target.checked); }} />
            recall by meaning (embeddings){" "}
            {semanticActive
              ? <span style={{ color: "var(--operational)" }}>· semantic active</span>
              : byMeaning && <span style={{ color: "var(--advisory)" }}>· falls back to text if no embedding model</span>}
          </label>
          <div style={{ maxHeight: 320, overflowY: "auto", fontSize: "0.78rem" }}>
            {episodes.length === 0 && <span style={{ color: "var(--dim)" }}>no events{eq ? " match that search" : " yet — actions you take will appear here"}</span>}
            {episodes.map((ev) => (
              <div key={ev.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5rem", padding: "0.25rem 0", borderBottom: "1px solid var(--line)" }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{ color: "var(--advisory)", fontSize: "0.68rem", letterSpacing: "0.08em" }}>{ev.kind.toUpperCase()}</span>{" "}
                  <span style={{ color: "var(--focal)" }}>{ev.summary}</span>
                  {ev.entity_name && <span style={{ color: "var(--dim)" }}> · about {ev.entity_name}</span>}
                  {ev.tags.length > 0 && <span style={{ color: "var(--operational)", fontSize: "0.68rem" }}> {ev.tags.map((t) => `#${t}`).join(" ")}</span>}
                  <div style={{ color: "var(--dim)", fontSize: "0.66rem" }}>{relativeTime(ev.occurred_at)} · {ev.provenance}</div>
                </div>
                <button onClick={() => forgetEpisode(ev.id)} style={{ ...btn("var(--critical)"), flexShrink: 0 }}>forget</button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "0.6rem", borderTop: "1px solid var(--line)", paddingTop: "0.5rem", display: "flex", gap: "0.3rem" }}>
            <input value={evSummary} onChange={(e) => setEvSummary(e.target.value)} placeholder="record an event…" style={{ flex: 1, ...inputStyle }} />
            <select value={evKind} onChange={(e) => setEvKind(e.target.value)} style={inputStyle}>
              <option>note</option><option>observation</option><option>decision</option><option>milestone</option>
            </select>
            <button onClick={recordEpisode} disabled={!evSummary.trim()} style={{ ...btn("var(--advisory)"), opacity: evSummary.trim() ? 1 : 0.5 }}>record</button>
          </div>
        </Panel>
      </div>
    </main>
  );
}

/** Compact relative time for the timeline ("just now", "12m ago", "3h ago", "2d ago"). */
function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return iso;
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

const inputStyle: React.CSSProperties = {
  background: "var(--bg)", border: "1px solid var(--line)", color: "var(--focal)",
  fontFamily: "var(--mono)", fontSize: "0.73rem", padding: "0.35rem 0.5rem",
};
function btn(color: string): React.CSSProperties {
  return { background: "transparent", border: `1px solid ${color}`, color, padding: "0.2rem 0.55rem", fontFamily: "var(--mono)", fontSize: "0.72rem", cursor: "pointer" };
}
function Panel(props: { tone: "operational" | "advisory" | "critical" | "focal"; title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderLeft: `3px solid var(--${props.tone})`, padding: "0.9rem 1.1rem" }}>
      <h2 style={{ margin: "0 0 0.5rem", fontSize: "0.78rem", letterSpacing: "0.12em", color: `var(--${props.tone})` }}>{props.title}</h2>
      {props.children}
    </section>
  );
}
