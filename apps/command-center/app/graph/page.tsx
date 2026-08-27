"use client";

import { useEffect, useState } from "react";

const KERNEL_URL = process.env.NEXT_PUBLIC_JARVIS_KERNEL_URL ?? "http://127.0.0.1:4150";

interface GNode { id?: string; name: string; kind: string; depth?: number }
interface GEdge { fromName: string; toName: string; relation: string }
interface EntityRow { id: string; name: string; kind: string }
interface Bundle { entities: { name: string; kind: string; facts: string[] }[]; relations: GEdge[]; mode: string }

/**
 * Knowledge-graph panel (D-0045): SEE the graph-brain. Walk the neighborhood of a
 * named entity (multi-hop, GET /memory/graph?name=&depth=) or ask by meaning
 * (GET /memory/graph?q= — semantic entry points + one-hop expansion; labeled
 * lexical fallback without an embedding model). All real kernel state; nodes are
 * clickable (click = re-walk from there). Labels always text, never color-only.
 */
export default function GraphPage() {
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [name, setName] = useState("");
  const [depth, setDepth] = useState(2);
  const [q, setQ] = useState("");
  const [nodes, setNodes] = useState<GNode[]>([]);
  const [edges, setEdges] = useState<GEdge[]>([]);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [note, setNote] = useState("pick an entity or ask by meaning");
  const [estop, setEstop] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch(`${KERNEL_URL}/memory/entities`, { cache: "no-store" }).then((x) => x.json());
        setEntities(r.entities ?? []);
      } catch { /* */ }
    })();
    const id = setInterval(async () => {
      try { setEstop(Boolean((await fetch(`${KERNEL_URL}/core/estop`, { cache: "no-store" }).then((r) => r.json())).engaged)); } catch { /* */ }
    }, 3000);
    return () => clearInterval(id);
  }, []);

  async function walk(n: string, d = depth) {
    setNote(""); setBundle(null);
    const r = await fetch(`${KERNEL_URL}/memory/graph?name=${encodeURIComponent(n)}&depth=${d}`, { cache: "no-store" });
    if (!r.ok) { setNodes([]); setEdges([]); setNote(`no memory of '${n}'`); return; }
    const g = await r.json();
    setName(n);
    setNodes(g.nodes ?? []);
    setEdges((g.edges ?? []).map((e: { fromName: string; toName: string; relation: string }) => ({ fromName: e.fromName, toName: e.toName, relation: e.relation })));
  }

  async function ask() {
    if (!q.trim()) return;
    setNote("");
    const r = await fetch(`${KERNEL_URL}/memory/graph?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" }).then((x) => x.json());
    const b: Bundle = r;
    setBundle(b);
    setNodes((b.entities ?? []).map((e) => ({ name: e.name, kind: e.kind })));
    setEdges(b.relations ?? []);
    if (!b.entities?.length) setNote("nothing relevant in the knowledge graph");
  }

  // layout: radial by depth when walking; single ring for meaning-queries
  const W = 920, H = 520, CX = W / 2, CY = H / 2;
  const hasDepth = nodes.some((n) => n.depth !== undefined);
  const byDepth = new Map<number, GNode[]>();
  for (const n of nodes) {
    const d = hasDepth ? (n.depth ?? 0) : 1;
    byDepth.set(d, [...(byDepth.get(d) ?? []), n]);
  }
  const pos = new Map<string, { x: number; y: number }>();
  for (const [d, ring] of byDepth) {
    const r = hasDepth ? d * 150 : 170;
    ring.forEach((n, i) => {
      if (r === 0) { pos.set(n.name, { x: CX, y: CY }); return; }
      const a = (i / ring.length) * Math.PI * 2 + d * 0.6;
      pos.set(n.name, { x: CX + r * Math.cos(a), y: CY + r * 0.72 * Math.sin(a) });
    });
  }
  const kindColor = (k: string) =>
    k === "person" ? "var(--operational)" : k === "project" ? "var(--advisory)" : "var(--focal)";

  return (
    <main style={{ padding: "1.5rem", maxWidth: 980, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
        <div>
          <h1 style={{ fontSize: "1.05rem", letterSpacing: "0.2em", color: "var(--operational)", margin: 0 }}>J.A.R.V.I.S. — KNOWLEDGE GRAPH</h1>
          <p style={{ color: "var(--dim)", margin: "0.2rem 0 0", fontSize: "0.8rem" }}>
            what connects to what (D-0045) · <a href="/" style={{ color: "var(--operational)" }}>dashboard</a> · <a href="/memory" style={{ color: "var(--operational)" }}>memory</a>
          </p>
        </div>
        <button onClick={() => fetch(`${KERNEL_URL}/core/estop/${estop ? "resume" : "engage"}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ via: "command-center" }) })}
          style={{ background: "transparent", border: "1px solid var(--critical)", color: "var(--critical)", padding: "0.6rem 1rem", fontFamily: "var(--mono)", fontWeight: 700, cursor: "pointer" }}>
          {estop ? "⏹ STOPPED — RESUME" : "⏹ EMERGENCY STOP"}
        </button>
      </header>

      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.6rem" }}>
        <span style={{ color: "var(--dim)", fontSize: "0.75rem" }}>walk from:</span>
        {entities.slice(0, 8).map((e) => (
          <button key={e.id} onClick={() => walk(e.name)} style={chip(e.name === name)}>{e.name}</button>
        ))}
        <select value={depth} onChange={(ev) => { const d = Number(ev.target.value); setDepth(d); if (name) void walk(name, d); }} style={input}>
          <option value={1}>1 hop</option><option value={2}>2 hops</option><option value={3}>3 hops</option>
        </select>
        <span style={{ color: "var(--dim)", fontSize: "0.75rem", marginLeft: "0.6rem" }}>or ask by meaning:</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void ask(); }}
          placeholder="e.g. what powers the suit?" style={{ ...input, minWidth: 220 }} />
        <button onClick={ask} style={chip(false)}>recall</button>
        {bundle && <span style={{ color: bundle.mode === "semantic" ? "var(--operational)" : "var(--advisory)", fontSize: "0.72rem" }}>· {bundle.mode} entry points + graph expansion</span>}
      </div>

      <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderLeft: "3px solid var(--operational)", padding: "0.4rem" }}>
        {nodes.length === 0 ? (
          <div style={{ color: "var(--dim)", fontSize: "0.8rem", padding: "2rem", textAlign: "center" }}>{note}</div>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="knowledge graph">
            {edges.map((e, i) => {
              const a = pos.get(e.fromName), b = pos.get(e.toName);
              if (!a || !b) return null;
              return (
                <g key={`e${i}`}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--line)" strokeWidth={1.5} />
                  <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 6} textAnchor="middle"
                    style={{ fill: "var(--dim)", fontSize: 11, fontFamily: "var(--mono)" }}>{e.relation}</text>
                </g>
              );
            })}
            {nodes.map((n) => {
              const p = pos.get(n.name);
              if (!p) return null;
              return (
                <g key={n.name} onClick={() => walk(n.name)} style={{ cursor: "pointer" }}>
                  <circle cx={p.x} cy={p.y} r={26} fill="var(--bg)" stroke={kindColor(n.kind)} strokeWidth={n.depth === 0 ? 3 : 1.5} />
                  <text x={p.x} y={p.y - 2} textAnchor="middle" style={{ fill: kindColor(n.kind), fontSize: 10, fontFamily: "var(--mono)" }}>{n.kind}</text>
                  <text x={p.x} y={p.y + 42} textAnchor="middle" style={{ fill: "var(--focal)", fontSize: 13, fontFamily: "var(--mono)" }}>{n.name}</text>
                  {n.depth !== undefined && n.depth > 0 && (
                    <text x={p.x} y={p.y + 12} textAnchor="middle" style={{ fill: "var(--dim)", fontSize: 9, fontFamily: "var(--mono)" }}>{n.depth} hop{n.depth > 1 ? "s" : ""}</text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </section>

      {bundle && bundle.entities.length > 0 && (
        <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderLeft: "3px solid var(--focal)", padding: "0.9rem 1.1rem", marginTop: "0.7rem" }}>
          <h2 style={{ margin: "0 0 0.5rem", fontSize: "0.78rem", letterSpacing: "0.12em", color: "var(--focal)" }}>WHAT J.A.R.V.I.S. WOULD DRAW ON</h2>
          {bundle.entities.map((e) => (
            <div key={e.name} style={{ marginBottom: "0.4rem", fontSize: "0.8rem" }}>
              <span style={{ color: "var(--dim)" }}>{e.kind}</span> <b style={{ color: "var(--focal)" }}>{e.name}</b>
              {e.facts.map((f, i) => <div key={i} style={{ color: "var(--dim)", marginLeft: "1rem" }}>· {f}</div>)}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}

const input: React.CSSProperties = {
  background: "var(--bg)", border: "1px solid var(--line)", color: "var(--focal)",
  fontFamily: "var(--mono)", fontSize: "0.73rem", padding: "0.3rem 0.45rem",
};
function chip(active: boolean): React.CSSProperties {
  return {
    background: "transparent", border: `1px solid ${active ? "var(--operational)" : "var(--line)"}`,
    color: active ? "var(--operational)" : "var(--focal)", padding: "0.25rem 0.6rem",
    fontFamily: "var(--mono)", fontSize: "0.73rem", cursor: "pointer",
  };
}
