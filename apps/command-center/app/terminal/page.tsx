"use client";

import { useEffect, useRef, useState } from "react";

const KERNEL_URL = process.env.NEXT_PUBLIC_JARVIS_KERNEL_URL ?? "http://127.0.0.1:4150";

interface RunOutcome { tool: string; command: string; ok: boolean; summary: string; denied?: boolean; detail?: string }
interface Ev { kind: string; tool?: string; ok?: boolean; summary?: string; risk?: string; disclosure?: { whatWillHappen?: string; proposedCommands?: string[] } }

/**
 * Terminal panel (D-0035). Drives the REAL, workspace-scoped shell
 * (`terminal.inspect` READ_ONLY / `terminal.run` CONSEQUENTIAL) through the gated
 * loop (/core/run-tool). Read-only inspection runs immediately; a real command
 * requires approval and shows the disclosure→approval→execute→verify pipeline;
 * dangerous/prohibited commands (sudo, rm -rf /, pipe-to-shell, cred-exfil…) are
 * REFUSED outright before any approval. Command output is shown here but never
 * audited (content stays local). This is a REAL shell, confined to the workspace.
 */
export default function TerminalPage() {
  const [command, setCommand] = useState("git status");
  const [outcomes, setOutcomes] = useState<RunOutcome[]>([]);
  const [pipeline, setPipeline] = useState<Ev[]>([]);
  const [estop, setEstop] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource(`${KERNEL_URL}/core/activity`);
    es.onmessage = (m) => {
      try {
        const e = JSON.parse(m.data) as Ev;
        if (["tool_proposed", "approval_required", "tool_result", "verified", "estop"].includes(e.kind)) {
          setPipeline((p) => [...p.slice(-30), e]);
        }
        if (e.kind === "estop") setEstop(Boolean((e as { engaged?: boolean }).engaged));
      } catch { /* ignore */ }
    };
    return () => es.close();
  }, []);
  useEffect(() => {
    const id = setInterval(async () => {
      try { setEstop(Boolean((await fetch(`${KERNEL_URL}/core/estop`, { cache: "no-store" }).then((r) => r.json())).engaged)); } catch { /* */ }
    }, 3000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { feedRef.current?.scrollTo(0, feedRef.current.scrollHeight); }, [pipeline]);

  async function run(tool: string, cmd: string, autoApprove?: string) {
    if (!cmd.trim()) return;
    const res = await fetch(`${KERNEL_URL}/core/run-tool`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool, args: { command: cmd }, source: "command-center", ...(autoApprove ? { autoApprove } : {}) }),
    }).then((r) => r.json());
    setOutcomes((o) => [{ tool, command: cmd, ok: res.ok, summary: res.summary, denied: res.denied, detail: res.detail }, ...o].slice(0, 12));
  }
  async function toggleEstop() {
    await fetch(`${KERNEL_URL}/core/estop/${estop ? "resume" : "engage"}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ via: "command-center" }) });
  }

  return (
    <main style={{ padding: "1.5rem", maxWidth: 940, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
        <div>
          <h1 style={{ fontSize: "1.05rem", letterSpacing: "0.2em", color: "var(--operational)", margin: 0 }}>J.A.R.V.I.S. — TERMINAL</h1>
          <p style={{ color: "var(--dim)", margin: "0.2rem 0 0", fontSize: "0.8rem" }}>
            a REAL workspace-scoped shell, policy-gated (D-0035) · <a href="/" style={{ color: "var(--operational)" }}>dashboard</a>
          </p>
        </div>
        <button onClick={toggleEstop} style={{ ...btn("var(--critical)"), padding: "0.6rem 1rem", fontWeight: 700 }}>
          {estop ? "⏹ STOPPED — RESUME" : "⏹ EMERGENCY STOP"}
        </button>
      </header>

      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderLeft: "3px solid var(--advisory)", padding: "0.6rem 1rem", marginBottom: "0.8rem", fontSize: "0.75rem", color: "var(--dim)" }}>
        <b style={{ color: "var(--advisory)" }}>Read-only</b> inspection (pwd, ls, git status/log/diff, uname…) runs immediately.
        A real command needs <b style={{ color: "var(--advisory)" }}>approval</b>. Dangerous/prohibited commands
        (sudo, <code>rm -rf /</code>, pipe-to-shell, credential exfil…) are <b style={{ color: "var(--critical)" }}>refused
        outright</b>. The shell is confined to the workspace; output stays local (never audited).
      </div>

      <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderLeft: "3px solid var(--operational)", padding: "0.9rem 1.1rem", marginBottom: "0.8rem" }}>
        <div style={{ display: "flex", gap: "0.3rem" }}>
          <span style={{ color: "var(--operational)", fontFamily: "var(--mono)", alignSelf: "center" }}>$</span>
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void run("terminal.inspect", command); }}
            placeholder="a command…"
            style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--line)", color: "var(--focal)", fontFamily: "var(--mono)", fontSize: "0.8rem", padding: "0.4rem 0.5rem" }}
          />
        </div>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
          <button onClick={() => run("terminal.inspect", command)} style={btn("var(--operational)")}>inspect (read-only, auto)</button>
          <button onClick={() => run("terminal.run", command, "allow-once")} style={btn("var(--advisory)")}>run (approve)</button>
          <button onClick={() => run("terminal.run", command, "deny")} style={btn("var(--critical)")}>run (deny)</button>
          <span style={{ flex: 1 }} />
          <button onClick={() => run("terminal.run", "sudo rm -rf /", "allow-once")} style={btn("var(--critical)")}>try a dangerous command →</button>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "0.8rem" }}>
        <Panel tone="operational" title="OUTPUT">
          <div style={{ maxHeight: 320, overflowY: "auto", fontSize: "0.76rem" }}>
            {outcomes.length === 0 && <span style={{ color: "var(--dim)" }}>no commands run yet</span>}
            {outcomes.map((o, i) => (
              <div key={i} style={{ marginBottom: "0.5rem", borderBottom: "1px solid var(--line)", paddingBottom: "0.4rem" }}>
                <div style={{ color: o.denied ? "var(--critical)" : o.ok ? "var(--operational)" : "var(--critical)" }}>
                  {o.denied ? "⊘" : o.ok ? "✓" : "✗"} <span style={{ color: "var(--dim)" }}>{o.tool}</span> <code>{o.command}</code>
                </div>
                <div style={{ color: "var(--dim)", fontSize: "0.72rem" }}>{o.summary}</div>
                {o.detail && (
                  <pre style={{ margin: "0.3rem 0 0", padding: "0.4rem 0.5rem", background: "var(--bg)", border: "1px solid var(--line)", color: "var(--focal)", fontSize: "0.72rem", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 160, overflowY: "auto" }}>{o.detail}</pre>
                )}
              </div>
            ))}
          </div>
        </Panel>

        <Panel tone="advisory" title="GATED PIPELINE (live)">
          <div ref={feedRef} style={{ maxHeight: 320, overflowY: "auto", fontSize: "0.73rem" }}>
            {pipeline.length === 0 && <span style={{ color: "var(--dim)" }}>disclosure → approval → execute → verify appears here</span>}
            {pipeline.map((e, i) => (
              <div key={i} style={{ marginBottom: "0.3rem", color: pipeColor(e) }}>{formatEv(e)}</div>
            ))}
          </div>
        </Panel>
      </div>
    </main>
  );
}

function formatEv(e: Ev): string {
  switch (e.kind) {
    case "tool_proposed": return `⚙ proposed ${e.tool} (${e.risk}) — ${e.disclosure?.whatWillHappen ?? ""}`;
    case "approval_required": return `⏸ approval required: ${e.tool}`;
    case "tool_result": return `${e.ok ? "✓" : "✗"} ${e.tool}: ${e.summary}`;
    case "verified": return `${e.ok ? "✓" : "✗"} verified: ${e.summary}`;
    case "estop": return "⏹ emergency stop";
    default: return e.kind;
  }
}
function pipeColor(e: Ev): string {
  if (e.kind === "tool_proposed" || e.kind === "approval_required") return "var(--advisory)";
  if (e.kind === "verified") return "var(--operational)";
  if (e.kind === "estop" || (e.kind === "tool_result" && e.ok === false)) return "var(--critical)";
  return "var(--focal)";
}
function btn(color: string): React.CSSProperties {
  return { background: "transparent", border: `1px solid ${color}`, color, padding: "0.25rem 0.6rem", fontFamily: "var(--mono)", fontSize: "0.72rem", cursor: "pointer" };
}
function Panel(props: { tone: "operational" | "advisory" | "critical"; title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderLeft: `3px solid var(--${props.tone})`, padding: "0.9rem 1.1rem" }}>
      <h2 style={{ margin: "0 0 0.5rem", fontSize: "0.78rem", letterSpacing: "0.12em", color: `var(--${props.tone})` }}>{props.title}</h2>
      {props.children}
    </section>
  );
}
