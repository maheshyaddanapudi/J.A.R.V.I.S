"use client";

import { useEffect, useRef, useState } from "react";

const KERNEL_URL = process.env.NEXT_PUBLIC_JARVIS_KERNEL_URL ?? "http://127.0.0.1:4150";

interface Step { index: number; tool: string; ok: boolean; denied?: boolean; summary: string }
interface AgentResult { objective: string; answer: string; steps: Step[]; stepsUsed: number; budgetExhausted: boolean; halted: boolean }
interface Pending { id: string; tool: string; resourceScope: string | null }
interface Ev { kind: string; tool?: string; ok?: boolean; summary?: string; risk?: string; text?: string; disclosure?: { whatWillHappen?: string } }

/**
 * Agent panel — give J.A.R.V.I.S. an objective and watch the multi-step plan
 * execute through the gated loop (POST /agent/run). Every consequential step
 * surfaces an approval you resolve inline WITHOUT leaving the page, so the run
 * unblocks; read-only steps run straight through. The gated pipeline (disclosure
 * → approval → execute → verify) streams live. Persistent e-stop halts the plan.
 * All real: no fabricated steps — a step's result is the tool's real result.
 */
export default function AgentPage() {
  const [objective, setObjective] = useState("Check system status and report back.");
  const [maxSteps, setMaxSteps] = useState(6);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [pipeline, setPipeline] = useState<Ev[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [estop, setEstop] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource(`${KERNEL_URL}/core/activity`);
    es.onmessage = (m) => {
      try {
        const e = JSON.parse(m.data) as Ev;
        if (["objective", "tool_proposed", "approval_required", "tool_result", "verified", "error", "estop"].includes(e.kind)) {
          setPipeline((p) => [...p.slice(-40), e]);
        }
        if (e.kind === "estop") setEstop(Boolean((e as { engaged?: boolean }).engaged));
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, []);

  // Poll pending approvals + e-stop so consequential steps can be resolved inline.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const [a, e] = await Promise.all([
          fetch(`${KERNEL_URL}/core/approvals`, { cache: "no-store" }).then((r) => r.json()),
          fetch(`${KERNEL_URL}/core/estop`, { cache: "no-store" }).then((r) => r.json()),
        ]);
        setPending(a.pending ?? []);
        setEstop(Boolean(e.engaged));
      } catch {
        /* ignore */
      }
    }, 1200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    feedRef.current?.scrollTo(0, feedRef.current.scrollHeight);
  }, [pipeline]);

  async function run() {
    if (running || !objective.trim()) return;
    setRunning(true);
    setResult(null);
    setPipeline([]);
    try {
      const r = await fetch(`${KERNEL_URL}/agent/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ objective: objective.trim(), maxSteps, privacyClass: "LOCAL_ONLY" }),
      }).then((x) => x.json());
      setResult(r as AgentResult);
    } catch (err) {
      setResult({ objective, answer: `[error: ${err instanceof Error ? err.message : String(err)}]`, steps: [], stepsUsed: 0, budgetExhausted: false, halted: false });
    } finally {
      setRunning(false);
    }
  }

  async function resolve(id: string, resolution: string) {
    await fetch(`${KERNEL_URL}/core/approvals/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, resolution, via: "command-center" }),
    });
  }
  async function toggleEstop() {
    await fetch(`${KERNEL_URL}/core/estop/${estop ? "resume" : "engage"}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ via: "command-center" }),
    });
  }

  return (
    <main style={{ padding: "1.5rem", maxWidth: 900, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
        <div>
          <h1 style={{ fontSize: "1.05rem", letterSpacing: "0.2em", color: "var(--operational)", margin: 0 }}>
            J.A.R.V.I.S. — AGENT
          </h1>
          <p style={{ color: "var(--dim)", margin: "0.2rem 0 0", fontSize: "0.8rem" }}>
            multi-step tasks through the gated loop ·{" "}
            <a href="/" style={{ color: "var(--operational)" }}>dashboard</a>
          </p>
        </div>
        <button onClick={toggleEstop} style={{ ...btn("var(--critical)"), padding: "0.6rem 1rem", fontWeight: 700 }}>
          {estop ? "⏹ STOPPED — RESUME" : "⏹ EMERGENCY STOP"}
        </button>
      </header>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
        <input
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void run(); }}
          placeholder="give J.A.R.V.I.S. an objective…"
          disabled={running || estop}
          style={{ flex: 1, minWidth: 260, background: "var(--bg)", border: "1px solid var(--line)", color: "var(--focal)", fontFamily: "var(--mono)", padding: "0.5rem 0.7rem" }}
        />
        <label style={{ color: "var(--dim)", fontSize: "0.72rem", alignSelf: "center" }}>
          max steps{" "}
          <input type="number" min={1} max={20} value={maxSteps} onChange={(e) => setMaxSteps(Number(e.target.value))}
            style={{ width: 48, background: "var(--bg)", border: "1px solid var(--line)", color: "var(--focal)", fontFamily: "var(--mono)", padding: "0.3rem" }} />
        </label>
        <button onClick={() => void run()} disabled={running || estop || objective.trim() === ""}
          style={{ ...btn("var(--operational)"), padding: "0.5rem 1.1rem", opacity: running || estop ? 0.5 : 1 }}>
          {running ? "running…" : "run"}
        </button>
      </div>

      {pending.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--advisory)", padding: "0.6rem 1rem", marginBottom: "0.6rem" }}>
          <div style={{ color: "var(--advisory)", fontSize: "0.78rem", marginBottom: "0.3rem" }}>
            a step needs your approval:
          </div>
          {pending.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
              <span style={{ color: "var(--focal)" }}>{p.tool}</span>
              <span style={{ color: "var(--dim)", fontSize: "0.72rem" }}>{p.resourceScope ?? ""}</span>
              <button onClick={() => resolve(p.id, "allow-once")} style={btn("var(--operational)")}>approve</button>
              <button onClick={() => resolve(p.id, "deny")} style={btn("var(--critical)")}>deny</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
        <Panel tone="advisory" title="GATED PIPELINE (live)">
          <div ref={feedRef} style={{ maxHeight: 260, overflowY: "auto", fontSize: "0.73rem" }}>
            {pipeline.length === 0 && <span style={{ color: "var(--dim)" }}>run an objective to watch the plan execute</span>}
            {pipeline.map((e, i) => (
              <div key={i} style={{ marginBottom: "0.25rem", color: pipeColor(e) }}>{formatEv(e)}</div>
            ))}
          </div>
        </Panel>

        <Panel tone={result?.halted ? "critical" : "operational"} title="RESULT">
          {!result && <span style={{ color: "var(--dim)" }}>{running ? "…" : "no run yet"}</span>}
          {result && (
            <>
              <div style={{ color: "var(--dim)", fontSize: "0.72rem", marginBottom: "0.3rem" }}>
                {result.stepsUsed} step(s){result.budgetExhausted ? " · budget exhausted" : ""}{result.halted ? " · HALTED" : ""}
              </div>
              {result.steps.map((s) => (
                <div key={s.index} style={{ marginBottom: "0.25rem", fontSize: "0.76rem" }}>
                  <span style={{ color: s.denied || !s.ok ? "var(--critical)" : "var(--operational)" }}>
                    {s.denied ? "⊘" : s.ok ? "✓" : "✗"} {s.tool}
                  </span>
                  <div style={{ color: "var(--dim)", fontSize: "0.7rem" }}>{s.summary}</div>
                </div>
              ))}
              <div style={{ color: "var(--focal)", marginTop: "0.4rem", whiteSpace: "pre-wrap" }}>{result.answer}</div>
            </>
          )}
        </Panel>
      </div>
    </main>
  );
}

function formatEv(e: Ev): string {
  switch (e.kind) {
    case "objective": return `▸ objective: ${e.text}`;
    case "tool_proposed": return `⚙ ${e.tool} (${e.risk}) — ${e.disclosure?.whatWillHappen ?? ""}`;
    case "approval_required": return `⏸ approval required: ${e.tool}`;
    case "tool_result": return `${e.ok ? "✓" : "✗"} ${e.tool}: ${e.summary}`;
    case "verified": return `${e.ok ? "✓" : "✗"} verified: ${e.summary}`;
    case "error": return `✗ ${e.text ?? "error"}`;
    case "estop": return "⏹ emergency stop";
    default: return e.kind;
  }
}
function pipeColor(e: Ev): string {
  if (e.kind === "tool_proposed" || e.kind === "approval_required") return "var(--advisory)";
  if (e.kind === "verified") return "var(--operational)";
  if (e.kind === "estop" || e.kind === "error" || (e.kind === "tool_result" && e.ok === false)) return "var(--critical)";
  return "var(--focal)";
}
function btn(color: string): React.CSSProperties {
  return { background: "transparent", border: `1px solid ${color}`, color, padding: "0.2rem 0.55rem", fontFamily: "var(--mono)", fontSize: "0.72rem", cursor: "pointer" };
}
function Panel(props: { tone: "operational" | "advisory" | "critical"; title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderLeft: `3px solid var(--${props.tone})`, padding: "0.9rem 1.1rem" }}>
      <h2 style={{ margin: "0 0 0.5rem", fontSize: "0.78rem", letterSpacing: "0.12em", color: `var(--${props.tone})` }}>{props.title}</h2>
      {props.children}
    </section>
  );
}
