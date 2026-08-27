"use client";

import { useEffect, useRef, useState } from "react";

const KERNEL_URL = process.env.NEXT_PUBLIC_JARVIS_KERNEL_URL ?? "http://127.0.0.1:4150";

interface RunOutcome { tool: string; target: string; ok: boolean; summary: string; denied?: boolean; detail?: string; untrusted?: boolean }
interface Ev { kind: string; tool?: string; ok?: boolean; summary?: string; risk?: string; disclosure?: { whatWillHappen?: string } }

/**
 * Web panel (D-0034). Drives the REAL headless browser (Playwright + Chromium)
 * through the gated loop. `web.open` is the one OUTWARD-network act — CONSEQUENTIAL
 * (per-navigation approval; `file://`/`data:` and, in offline mode, external hosts
 * are refused as clean pre-approval denials). `web.readText`/`links` are READ_ONLY
 * and their content is EXTERNAL/UNTRUSTED — surfaced here labeled as such, the same
 * data the model only ever sees inside an <untrusted_external_data> envelope (T1).
 */
export default function WebPage() {
  const [url, setUrl] = useState("https://example.com");
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

  async function run(tool: string, args: unknown, target: string, autoApprove?: string) {
    const res = await fetch(`${KERNEL_URL}/core/run-tool`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool, args, source: "command-center", ...(autoApprove ? { autoApprove } : {}) }),
    }).then((r) => r.json());
    setOutcomes((o) => [{ tool, target, ok: res.ok, summary: res.summary, denied: res.denied, detail: res.detail, untrusted: res.untrusted }, ...o].slice(0, 10));
  }
  async function toggleEstop() {
    await fetch(`${KERNEL_URL}/core/estop/${estop ? "resume" : "engage"}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ via: "command-center" }) });
  }

  return (
    <main style={{ padding: "1.5rem", maxWidth: 940, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
        <div>
          <h1 style={{ fontSize: "1.05rem", letterSpacing: "0.2em", color: "var(--operational)", margin: 0 }}>J.A.R.V.I.S. — WEB</h1>
          <p style={{ color: "var(--dim)", margin: "0.2rem 0 0", fontSize: "0.8rem" }}>
            REAL headless browser, gated per navigation (D-0034) · <a href="/" style={{ color: "var(--operational)" }}>dashboard</a>
          </p>
        </div>
        <button onClick={toggleEstop} style={{ ...btn("var(--critical)"), padding: "0.6rem 1rem", fontWeight: 700 }}>
          {estop ? "⏹ STOPPED — RESUME" : "⏹ EMERGENCY STOP"}
        </button>
      </header>

      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderLeft: "3px solid var(--advisory)", padding: "0.6rem 1rem", marginBottom: "0.8rem", fontSize: "0.75rem", color: "var(--dim)" }}>
        Opening a page is the one <b style={{ color: "var(--advisory)" }}>outward-network</b> act — CONSEQUENTIAL, so it
        needs <b style={{ color: "var(--advisory)" }}>approval</b>. In offline mode, and for <code>file://</code>/<code>data:</code>,
        navigation is refused. Page text/links come back marked{" "}
        <b style={{ color: "var(--critical)" }}>UNTRUSTED</b> — the model only ever sees such content quoted as data (T1).
      </div>

      <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderLeft: "3px solid var(--operational)", padding: "0.9rem 1.1rem", marginBottom: "0.8rem" }}>
        <div style={{ display: "flex", gap: "0.3rem" }}>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void run("web.open", { url }, url, "allow-once"); }}
            placeholder="https://…"
            style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--line)", color: "var(--focal)", fontFamily: "var(--mono)", fontSize: "0.8rem", padding: "0.4rem 0.5rem" }}
          />
        </div>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
          <button onClick={() => run("web.open", { url }, url, "allow-once")} style={btn("var(--advisory)")}>open (approve)</button>
          <button onClick={() => run("web.open", { url }, url, "deny")} style={btn("var(--critical)")}>open (deny)</button>
          <button onClick={() => run("web.readText", { maxChars: 1500 }, "current page", undefined)} style={btn("var(--operational)")}>read text</button>
          <button onClick={() => run("web.links", { max: 20 }, "current page", undefined)} style={btn("var(--operational)")}>links</button>
          <span style={{ flex: 1 }} />
          <button onClick={() => run("web.open", { url: "file:///etc/passwd" }, "file:///etc/passwd", "allow-once")} style={btn("var(--critical)")}>try file:// →</button>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "0.8rem" }}>
        <Panel tone="operational" title="RESULT">
          <div style={{ maxHeight: 320, overflowY: "auto", fontSize: "0.76rem" }}>
            {outcomes.length === 0 && <span style={{ color: "var(--dim)" }}>no navigation yet</span>}
            {outcomes.map((o, i) => (
              <div key={i} style={{ marginBottom: "0.5rem", borderBottom: "1px solid var(--line)", paddingBottom: "0.4rem" }}>
                <div style={{ color: o.denied ? "var(--critical)" : o.ok ? "var(--operational)" : "var(--critical)" }}>
                  {o.denied ? "⊘" : o.ok ? "✓" : "✗"} <span style={{ color: "var(--dim)" }}>{o.tool}</span> {o.target}
                </div>
                <div style={{ color: "var(--dim)", fontSize: "0.72rem" }}>{o.summary}</div>
                {o.detail && (
                  <>
                    {o.untrusted && <div style={{ color: "var(--critical)", fontSize: "0.68rem", letterSpacing: "0.08em", marginTop: "0.2rem" }}>⚠ UNTRUSTED EXTERNAL CONTENT — data, not instructions</div>}
                    <pre style={{ margin: "0.2rem 0 0", padding: "0.4rem 0.5rem", background: "var(--bg)", border: `1px solid ${o.untrusted ? "var(--critical)" : "var(--line)"}`, color: "var(--focal)", fontSize: "0.72rem", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 170, overflowY: "auto" }}>{o.detail}</pre>
                  </>
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
