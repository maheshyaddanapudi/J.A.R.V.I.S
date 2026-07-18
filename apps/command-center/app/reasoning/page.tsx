"use client";

import { useEffect, useState } from "react";

const KERNEL_URL = process.env.NEXT_PUBLIC_JARVIS_KERNEL_URL ?? "http://127.0.0.1:4150";

interface Autotune { signalThreshold: 1 | 2; source: "default" | "jarvis" | "user"; reason?: string }
interface Report {
  at: string; windowHours: number;
  decisions: { requested: string; mode: string; reason: string; n: number }[];
  findings: string[]; proposals: string[]; adjustments: string[]; notes: string[];
  autotune: Autotune;
}

/**
 * Reasoning panel (D-0050/D-0051/D-0052): the learning contract, visible.
 * Learned deep topics (teach/forget), the bounded autotune knob (who set it and
 * why — a user setting is never overridden by J.A.R.V.I.S.), and the sleep-cycle
 * consolidation (run now → findings/adjustments/proposals/notes over the REAL
 * decision journal + model-call audit). Everything shown is live kernel state.
 */
export default function ReasoningPage() {
  const [topics, setTopics] = useState<string[]>([]);
  const [newTopic, setNewTopic] = useState("");
  const [tune, setTune] = useState<Autotune | null>(null);
  const [reason, setReason] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [running, setRunning] = useState(false);
  const [estop, setEstop] = useState(false);

  async function refresh() {
    try {
      const t = await fetch(`${KERNEL_URL}/core/reasoning/topics`, { cache: "no-store" }).then((r) => r.json());
      setTopics(t.topics ?? []);
    } catch { /* */ }
    try {
      setTune(await fetch(`${KERNEL_URL}/core/reasoning/autotune`, { cache: "no-store" }).then((r) => r.json()));
    } catch { /* */ }
  }

  useEffect(() => {
    void refresh();
    const id = setInterval(async () => {
      try { setEstop(Boolean((await fetch(`${KERNEL_URL}/core/estop`, { cache: "no-store" }).then((r) => r.json())).engaged)); } catch { /* */ }
    }, 3000);
    return () => clearInterval(id);
  }, []);

  async function teach() {
    const topic = newTopic.trim();
    if (!topic) return;
    await fetch(`${KERNEL_URL}/core/reasoning/topics`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ topic }),
    });
    setNewTopic("");
    void refresh();
  }

  async function forget(topic: string) {
    await fetch(`${KERNEL_URL}/core/reasoning/topics/${encodeURIComponent(topic)}`, { method: "DELETE" });
    void refresh();
  }

  async function setThreshold(v: 1 | 2) {
    await fetch(`${KERNEL_URL}/core/reasoning/autotune`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ signalThreshold: v, reason: reason.trim() || "set from command center" }),
    });
    setReason("");
    void refresh();
  }

  async function resetTune() {
    await fetch(`${KERNEL_URL}/core/reasoning/autotune`, { method: "DELETE" });
    void refresh();
  }

  async function consolidate() {
    setRunning(true);
    try {
      const r = await fetch(`${KERNEL_URL}/core/reasoning/consolidate`, {
        method: "POST", headers: { "content-type": "application/json" }, body: "{}",
      }).then((x) => x.json());
      setReport(r);
      void refresh();
    } finally {
      setRunning(false);
    }
  }

  return (
    <main style={{ padding: "1.5rem", maxWidth: 980, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
        <div>
          <h1 style={{ fontSize: "1.05rem", letterSpacing: "0.2em", color: "var(--operational)", margin: 0 }}>J.A.R.V.I.S. — REASONING</h1>
          <p style={{ color: "var(--dim)", margin: "0.2rem 0 0", fontSize: "0.8rem" }}>
            what it has learned, and from whom · <a href="/" style={{ color: "var(--operational)" }}>dashboard</a> · <a href="/chat" style={{ color: "var(--operational)" }}>chat</a> · <a href="/models" style={{ color: "var(--operational)" }}>models</a>
          </p>
        </div>
        <button onClick={() => fetch(`${KERNEL_URL}/core/estop/${estop ? "resume" : "engage"}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ via: "command-center" }) })}
          style={{ background: "transparent", border: "1px solid var(--critical)", color: "var(--critical)", padding: "0.6rem 1rem", fontFamily: "var(--mono)", fontWeight: 700, cursor: "pointer" }}>
          {estop ? "⏹ STOPPED — RESUME" : "⏹ EMERGENCY STOP"}
        </button>
      </header>

      <section style={sec("--operational")}>
        <h2 style={h2("--operational")}>LEARNED DEEP TOPICS (from your instruction or repeated correction — always yours to erase)</h2>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
          {topics.length === 0 && <span style={{ color: "var(--dim)", fontSize: "0.8rem" }}>nothing learned yet</span>}
          {topics.map((t) => (
            <span key={t} style={{ border: "1px solid var(--operational)", color: "var(--operational)", padding: "0.15rem 0.5rem", fontSize: "0.78rem", fontFamily: "var(--mono)" }}>
              {t}{" "}
              <button onClick={() => forget(t)} title="forget" style={{ background: "none", border: "none", color: "var(--critical)", cursor: "pointer", fontFamily: "var(--mono)" }}>✕</button>
            </span>
          ))}
          <input value={newTopic} onChange={(e) => setNewTopic(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void teach(); }}
            placeholder="always think deeply about…" style={{ ...input, minWidth: 200 }} />
          <button onClick={teach} style={chip()}>teach</button>
        </div>
      </section>

      <section style={sec("--focal")}>
        <h2 style={h2("--focal")}>ESCALATION SENSITIVITY (bounded autotune — a manual setting is never overridden)</h2>
        {tune && (
          <div style={{ fontSize: "0.8rem", color: "var(--focal)", marginBottom: "0.5rem" }}>
            threshold <b>{tune.signalThreshold}</b> ({tune.signalThreshold === 1 ? "eager: one strong signal escalates" : "conservative: two signals needed"})
            {" · set by "}
            <b style={{ color: tune.source === "user" ? "var(--operational)" : tune.source === "jarvis" ? "var(--advisory)" : "var(--dim)" }}>{tune.source}</b>
            {tune.reason && <span style={{ color: "var(--dim)" }}> — “{tune.reason}”</span>}
          </div>
        )}
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="reason (J.A.R.V.I.S. will remember it)" style={{ ...input, minWidth: 240 }} />
          <button onClick={() => setThreshold(1)} style={chip()}>set eager (1)</button>
          <button onClick={() => setThreshold(2)} style={chip()}>set conservative (2)</button>
          <button onClick={resetTune} style={chip()}>reset to default</button>
        </div>
      </section>

      <section style={sec("--advisory")}>
        <h2 style={h2("--advisory")}>SLEEP-CYCLE CONSOLIDATION (reviews its own decision journal + model-call audit)</h2>
        <button onClick={consolidate} disabled={running} style={{ ...chip(), opacity: running ? 0.5 : 1 }}>
          {running ? "consolidating…" : "▶ run consolidation now"}
        </button>
        {report && (
          <div style={{ marginTop: "0.7rem", fontSize: "0.8rem" }}>
            <div style={{ color: "var(--dim)" }}>window: last {report.windowHours}h · decisions journaled: {report.decisions.reduce((s, d) => s + d.n, 0)}</div>
            {(["findings", "adjustments", "proposals", "notes"] as const).map((k) => (
              <div key={k} style={{ marginTop: "0.5rem" }}>
                <div style={{ letterSpacing: "0.1em", fontSize: "0.72rem", color: k === "adjustments" ? "var(--advisory)" : k === "proposals" ? "var(--operational)" : "var(--focal)" }}>
                  {k.toUpperCase()}{k === "proposals" ? " (yours to approve — never auto-applied)" : k === "adjustments" ? " (bounded, auto-applied, reversible)" : ""}
                </div>
                {report[k].length === 0 ? (
                  <div style={{ color: "var(--dim)" }}>— none</div>
                ) : (
                  report[k].map((x, i) => <div key={i} style={{ color: "var(--focal)" }}>· {x}</div>)
                )}
              </div>
            ))}
          </div>
        )}
        {!report && <div style={{ color: "var(--dim)", fontSize: "0.78rem", marginTop: "0.5rem" }}>last report also lands on the <a href="/memory" style={{ color: "var(--operational)" }}>timeline</a> (tag sleep-cycle)</div>}
      </section>
    </main>
  );
}

const input: React.CSSProperties = {
  background: "var(--bg)", border: "1px solid var(--line)", color: "var(--focal)",
  fontFamily: "var(--mono)", fontSize: "0.75rem", padding: "0.3rem 0.5rem",
};
function chip(): React.CSSProperties {
  return {
    background: "transparent", border: "1px solid var(--line)", color: "var(--focal)",
    padding: "0.25rem 0.6rem", fontFamily: "var(--mono)", fontSize: "0.75rem", cursor: "pointer",
  };
}
function sec(accent: string): React.CSSProperties {
  return { background: "var(--surface)", border: "1px solid var(--line)", borderLeft: `3px solid var(${accent})`, padding: "0.9rem 1.1rem", marginBottom: "0.7rem" };
}
function h2(accent: string): React.CSSProperties {
  return { margin: "0 0 0.5rem", fontSize: "0.78rem", letterSpacing: "0.12em", color: `var(${accent})` };
}
