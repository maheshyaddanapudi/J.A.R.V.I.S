"use client";

import { useEffect, useState, useCallback } from "react";

const KERNEL_URL = process.env.NEXT_PUBLIC_JARVIS_KERNEL_URL ?? "http://127.0.0.1:4150";

interface Beat { id: string; at: string; proactive_surfaced: number; consolidated: boolean; agenda_reviewed: number; agenda_completed: number; brain_used: boolean; summary: string; detail: string }
interface Item { id: string; what: string; why: string; status: string; dueAt: string | null; outcome: string; provenance: string; createdAt: string }
interface Status { enabled: boolean; intervalMinutes: number; running: boolean; lastTickAt: string | null }

/**
 * PULSE (D-0064): the observable life of J.A.R.V.I.S. between conversations.
 * Left: the heartbeat journal — what actually happened at each beat (cycles run,
 * agenda worked, what it thought). Right: the agenda — intentions J.A.R.V.I.S.
 * wrote for itself (or you wrote for it), dual-editable. All real kernel state.
 */
export default function PulsePage() {
  const [beats, setBeats] = useState<Beat[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [what, setWhat] = useState("");
  const [why, setWhy] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [b, a, s] = await Promise.all([
        fetch(`${KERNEL_URL}/autonomy/heartbeats?limit=40`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`${KERNEL_URL}/agenda`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`${KERNEL_URL}/autonomy/status`, { cache: "no-store" }).then((r) => r.json()),
      ]);
      setBeats(b.heartbeats ?? []);
      setItems(a.items ?? []);
      setStatus(s);
    } catch { /* kernel unreachable — panels stay empty */ }
  }, []);
  useEffect(() => { void load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);

  async function addItem() {
    if (!what.trim()) return;
    await fetch(`${KERNEL_URL}/agenda`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ what, why }) });
    setWhat(""); setWhy(""); await load();
  }
  async function complete(id: string) {
    await fetch(`${KERNEL_URL}/agenda/${id}/complete`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ outcome: "completed by user" }) });
    await load();
  }
  async function drop(id: string) {
    await fetch(`${KERNEL_URL}/agenda/${id}`, { method: "DELETE" });
    await load();
  }

  const pending = items.filter((i) => i.status === "pending");
  const resolved = items.filter((i) => i.status !== "pending").slice(0, 10);

  return (
    <main style={{ padding: "1.5rem", maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ marginBottom: "0.8rem" }}>
        <h1 style={{ fontSize: "1.05rem", letterSpacing: "0.2em", color: "var(--operational)", margin: 0 }}>J.A.R.V.I.S. — PULSE</h1>
        <p style={{ color: "var(--dim)", margin: "0.2rem 0 0", fontSize: "0.8rem" }}>
          life between conversations: the heartbeat journal + the agenda J.A.R.V.I.S. writes for itself (D-0064) · consequential actions are never taken on a heartbeat — they queue for you · <a href="/settings" style={{ color: "var(--operational)" }}>settings</a> · <a href="/" style={{ color: "var(--operational)" }}>dashboard</a>
        </p>
        {status && (
          <p aria-label="autonomy state" style={{ color: status.enabled ? "var(--operational)" : "var(--advisory)", fontSize: "0.78rem", margin: "0.4rem 0 0" }}>
            autonomy {status.enabled ? `ON — every ${status.intervalMinutes} min` : "OFF (enable via settings: autonomy.enabled)"}
            {status.lastTickAt ? ` · last beat ${status.lastTickAt}` : ""}
          </p>
        )}
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1rem" }}>
        <section aria-label="heartbeat journal">
          <h2 style={h2}>HEARTBEAT JOURNAL</h2>
          {beats.length === 0 && <p style={dim}>no beats yet — enable autonomy and each tick will be journaled here</p>}
          {beats.map((b) => (
            <div key={b.id} style={card("var(--operational)")}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--focal)", fontSize: "0.78rem" }}>{b.at}</span>
                <span style={{ color: "var(--dim)", fontSize: "0.72rem" }}>
                  {b.brain_used ? "◆ thought" : "quiet"} · agenda {b.agenda_completed}/{b.agenda_reviewed} · {b.consolidated ? "consolidated" : "no consolidation"} · {b.proactive_surfaced} proactive
                </span>
              </div>
              {b.summary && <p style={{ color: "var(--focal)", fontSize: "0.82rem", margin: "0.3rem 0 0" }}>{b.summary}</p>}
              {b.detail && (
                <button onClick={() => setOpen(open === b.id ? null : b.id)} style={linkBtn} aria-label={`beat detail ${b.id}`}>
                  {open === b.id ? "hide steps" : "show steps"}
                </button>
              )}
              {open === b.id && <pre style={pre}>{b.detail}</pre>}
            </div>
          ))}
        </section>

        <section aria-label="agenda">
          <h2 style={h2}>AGENDA — WHAT J.A.R.V.I.S. INTENDS TO DO</h2>
          <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.6rem" }}>
            <input aria-label="agenda what" value={what} onChange={(e) => setWhat(e.target.value)} placeholder="add an intention…" style={{ ...input, flex: 2 }} />
            <input aria-label="agenda why" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="why (optional)" style={{ ...input, flex: 1 }} />
            <button onClick={addItem} style={ctl}>add →</button>
          </div>
          {pending.length === 0 && <p style={dim}>agenda is empty — J.A.R.V.I.S. adds intentions here as it notices things (and you can too)</p>}
          {pending.map((i) => (
            <div key={i.id} style={card("var(--advisory)")}>
              <div style={{ color: "var(--focal)", fontSize: "0.82rem" }}>{i.what}</div>
              <div style={{ color: "var(--dim)", fontSize: "0.72rem", margin: "0.15rem 0 0.3rem" }}>
                {i.why && <>{i.why} · </>}by {i.provenance}{i.dueAt ? ` · due ${i.dueAt}` : " · next heartbeat"}
              </div>
              <button onClick={() => complete(i.id)} style={{ ...ctl, marginRight: "0.4rem" }} aria-label={`complete ${i.id}`}>done</button>
              <button onClick={() => drop(i.id)} style={{ ...ctl, color: "var(--critical)" }} aria-label={`drop ${i.id}`}>drop</button>
            </div>
          ))}
          {resolved.length > 0 && <h3 style={{ ...h2, fontSize: "0.72rem", marginTop: "0.8rem" }}>RECENTLY RESOLVED</h3>}
          {resolved.map((i) => (
            <div key={i.id} style={{ ...card("var(--line)"), opacity: 0.75 }}>
              <span style={{ color: "var(--dim)", fontSize: "0.76rem" }}>[{i.status}] {i.what}{i.outcome ? ` → ${i.outcome}` : ""}</span>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

const h2: React.CSSProperties = { fontSize: "0.78rem", letterSpacing: "0.15em", color: "var(--dim)", margin: "0 0 0.5rem" };
const dim: React.CSSProperties = { color: "var(--dim)", fontSize: "0.8rem" };
const input: React.CSSProperties = { background: "var(--bg)", border: "1px solid var(--line)", color: "var(--focal)", fontFamily: "var(--mono)", fontSize: "0.78rem", padding: "0.35rem 0.5rem" };
const ctl: React.CSSProperties = { background: "transparent", border: "1px solid var(--line)", color: "var(--focal)", padding: "0.3rem 0.7rem", fontFamily: "var(--mono)", fontSize: "0.73rem", cursor: "pointer" };
const linkBtn: React.CSSProperties = { ...ctl, border: "none", color: "var(--operational)", padding: "0.2rem 0", fontSize: "0.7rem" };
const pre: React.CSSProperties = { color: "var(--dim)", fontSize: "0.7rem", whiteSpace: "pre-wrap", margin: "0.3rem 0 0", borderTop: "1px solid var(--line)", paddingTop: "0.3rem" };
function card(edge: string): React.CSSProperties {
  return { background: "var(--surface)", border: "1px solid var(--line)", borderLeft: `3px solid ${edge}`, padding: "0.55rem 0.8rem", marginBottom: "0.5rem" };
}
