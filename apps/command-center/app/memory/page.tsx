"use client";

import { useEffect, useState } from "react";

const KERNEL_URL = process.env.NEXT_PUBLIC_JARVIS_KERNEL_URL ?? "http://127.0.0.1:4150";

interface Entity { id: string; name: string; kind: string; attributes: string }
interface Fact { id: string; statement: string; status: string }
interface Rel { relation: string; toName?: string; toKind?: string; fromName?: string; fromKind?: string; note: string }
interface Recall { entity: Entity; facts: Fact[]; relationsOut: Rel[]; relationsIn: Rel[] }

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

  async function refresh() {
    try {
      const r = await fetch(`${KERNEL_URL}/memory/entities`, { cache: "no-store" }).then((x) => x.json());
      setEntities(r.entities ?? []);
    } catch { /* */ }
  }
  useEffect(() => { void refresh(); }, []);
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
    </main>
  );
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
