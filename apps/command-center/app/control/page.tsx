"use client";

import { useEffect, useRef, useState } from "react";

const KERNEL_URL = process.env.NEXT_PUBLIC_JARVIS_KERNEL_URL ?? "http://127.0.0.1:4150";

interface RunOutcome {
  tool: string;
  ok: boolean;
  summary: string;
  denied?: boolean;
}
interface Ev {
  kind: string;
  tool?: string;
  ok?: boolean;
  summary?: string;
  risk?: string;
  disclosure?: { whatWillHappen?: string; proposedCommands?: string[]; reversible?: boolean };
}

/**
 * Computer-control preview. Drives the labeled SIMULATION desktop through the
 * REAL gated loop (/core/run-tool) so the whole macOS-control experience —
 * pre-action disclosure → approval → execution → independent verification — is
 * exercised and ready before the real macOS adapter is activated at the D-0022
 * check-in. Everything here is SIMULATION and says so (honesty rule); nothing
 * touches a real machine.
 */
export default function ControlPage() {
  const [outcomes, setOutcomes] = useState<RunOutcome[]>([]);
  const [pipeline, setPipeline] = useState<Ev[]>([]);
  const [noteText, setNoteText] = useState("Remind Tony about the arc reactor diagnostics.");
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
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, []);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const e = await fetch(`${KERNEL_URL}/core/estop`, { cache: "no-store" }).then((r) => r.json());
        setEstop(Boolean(e.engaged));
      } catch {
        /* ignore */
      }
    }, 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    feedRef.current?.scrollTo(0, feedRef.current.scrollHeight);
  }, [pipeline]);

  async function run(tool: string, args: unknown, autoApprove?: string) {
    const res = await fetch(`${KERNEL_URL}/core/run-tool`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool, args, source: "command-center", ...(autoApprove ? { autoApprove } : {}) }),
    }).then((r) => r.json());
    setOutcomes((o) => [{ tool, ok: res.ok, summary: res.summary, denied: res.denied }, ...o].slice(0, 8));
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
            J.A.R.V.I.S. — COMPUTER CONTROL
          </h1>
          <p style={{ color: "var(--dim)", margin: "0.2rem 0 0", fontSize: "0.8rem" }}>
            SIMULATION desktop through the real gated loop ·{" "}
            <a href="/" style={{ color: "var(--operational)" }}>dashboard</a>
          </p>
        </div>
        <button onClick={toggleEstop} style={{ ...btn("var(--critical)"), padding: "0.6rem 1rem", fontWeight: 700 }}>
          {estop ? "⏹ STOPPED — RESUME" : "⏹ EMERGENCY STOP"}
        </button>
      </header>

      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderLeft: "3px solid var(--advisory)", padding: "0.6rem 1rem", marginBottom: "0.8rem", fontSize: "0.75rem", color: "var(--dim)" }}>
        Every action below runs against the labeled <b style={{ color: "var(--advisory)" }}>SIMULATION</b> desktop
        (a virtual Notes + Settings). The REAL macOS adapter (Accessibility/CGEvent) implements the same contract
        and is switched on only after the &quot;enable computer control&quot; check-in (D-0022).
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
        <Panel tone="operational" title="READ-ONLY (runs immediately)">
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            <button onClick={() => run("control.listApps", {})} style={btn("var(--operational)")}>list apps</button>
            <button onClick={() => run("control.screenshot", {})} style={btn("var(--operational)")}>screenshot</button>
            <button onClick={() => run("control.uiTree", { windowId: 1 })} style={btn("var(--operational)")}>UI tree (Notes)</button>
          </div>
        </Panel>

        <Panel tone="advisory" title="CONSEQUENTIAL (disclosure + approval)">
          <input
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--line)", color: "var(--focal)", fontFamily: "var(--mono)", fontSize: "0.75rem", padding: "0.3rem", marginBottom: "0.4rem" }}
          />
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
            <span style={{ color: "var(--dim)", fontSize: "0.72rem", alignSelf: "center" }}>type into note:</span>
            <button onClick={() => run("control.setValue", { title: "Note body", value: noteText }, "allow-once")} style={btn("var(--operational)")}>approve</button>
            <button onClick={() => run("control.setValue", { title: "Note body", value: noteText }, "deny")} style={btn("var(--critical)")}>deny</button>
          </div>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            <span style={{ color: "var(--dim)", fontSize: "0.72rem", alignSelf: "center" }}>press Save:</span>
            <button onClick={() => run("control.pressElement", { title: "Save" }, "allow-once")} style={btn("var(--operational)")}>approve</button>
            <button onClick={() => run("control.pressElement", { title: "Save" }, "deny")} style={btn("var(--critical)")}>deny</button>
          </div>
        </Panel>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem", marginTop: "0.8rem" }}>
        <Panel tone="operational" title="OUTCOMES">
          {outcomes.length === 0 && <span style={{ color: "var(--dim)" }}>no actions yet</span>}
          {outcomes.map((o, i) => (
            <div key={i} style={{ marginBottom: "0.3rem", fontSize: "0.78rem" }}>
              <span style={{ color: o.denied ? "var(--critical)" : o.ok ? "var(--operational)" : "var(--critical)" }}>
                {o.denied ? "⊘" : o.ok ? "✓" : "✗"} {o.tool}
              </span>
              <div style={{ color: "var(--dim)", fontSize: "0.72rem" }}>{o.summary}</div>
            </div>
          ))}
        </Panel>

        <Panel tone="advisory" title="GATED PIPELINE (live)">
          <div ref={feedRef} style={{ maxHeight: 220, overflowY: "auto", fontSize: "0.73rem" }}>
            {pipeline.length === 0 && <span style={{ color: "var(--dim)" }}>disclosure → approval → execute → verify appears here</span>}
            {pipeline.map((e, i) => (
              <div key={i} style={{ marginBottom: "0.3rem", color: pipeColor(e) }}>
                {formatEv(e)}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </main>
  );
}

function formatEv(e: Ev): string {
  switch (e.kind) {
    case "tool_proposed":
      return `⚙ proposed ${e.tool} (${e.risk}) — ${e.disclosure?.whatWillHappen ?? ""}${e.disclosure?.reversible === false ? " [irreversible]" : ""}`;
    case "approval_required":
      return `⏸ approval required: ${e.tool}`;
    case "tool_result":
      return `${e.ok ? "✓" : "✗"} ${e.tool}: ${e.summary}`;
    case "verified":
      return `${e.ok ? "✓" : "✗"} verified: ${e.summary}`;
    case "estop":
      return "⏹ emergency stop";
    default:
      return e.kind;
  }
}
function pipeColor(e: Ev): string {
  if (e.kind === "tool_proposed" || e.kind === "approval_required") return "var(--advisory)";
  if (e.kind === "verified") return "var(--operational)";
  if (e.kind === "estop" || (e.kind === "tool_result" && e.ok === false)) return "var(--critical)";
  return "var(--focal)";
}
function btn(color: string): React.CSSProperties {
  return {
    background: "transparent",
    border: `1px solid ${color}`,
    color,
    padding: "0.25rem 0.6rem",
    fontFamily: "var(--mono)",
    fontSize: "0.72rem",
    cursor: "pointer",
  };
}
function Panel(props: { tone: "operational" | "advisory" | "critical"; title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderLeft: `3px solid var(--${props.tone})`, padding: "0.9rem 1.1rem" }}>
      <h2 style={{ margin: "0 0 0.5rem", fontSize: "0.78rem", letterSpacing: "0.12em", color: `var(--${props.tone})` }}>{props.title}</h2>
      {props.children}
    </section>
  );
}
