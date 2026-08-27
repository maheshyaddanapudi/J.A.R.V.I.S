"use client";

import { useEffect, useState } from "react";

const KERNEL_URL = process.env.NEXT_PUBLIC_JARVIS_KERNEL_URL ?? "http://127.0.0.1:4150";

interface Surfaced {
  title: string;
  detail: string;
  priority: string;
  domain: string;
  dedupKey: string;
  why: string;
}
interface Suppression {
  title: string;
  gate: string;
  reason: string;
}
interface RunResult {
  surfaced: Surfaced[];
  suppressedCount: number;
  suppressed: Suppression[];
}
interface Rule {
  name: string;
  title: string;
  enabled: boolean;
  priority: string;
  condition: Record<string, unknown>;
}

/**
 * Proactivity control surface (R-PRO). Runs a cycle ON DEMAND and shows both
 * what surfaced (with its "why") AND what every gate suppressed and why — the
 * "why am I / am I not seeing this" transparency the goal requires. Snooze /
 * dismiss / per-domain toggles feed the same gate stack. LIVE BACKGROUND
 * delivery + notifications remain gated on the "enable proactive behavior"
 * check-in (D-0024); this computes only when you ask.
 */
export default function ProactivePage() {
  const [result, setResult] = useState<RunResult | null>(null);
  const [at, setAt] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [estop, setEstop] = useState(false);
  const [note, setNote] = useState<string>("");
  const [rules, setRules] = useState<Rule[]>([]);
  const [rName, setRName] = useState("");
  const [rTitle, setRTitle] = useState("");
  const [rType, setRType] = useState("commitment_overdue");
  const [rMinutes, setRMinutes] = useState("120");
  const [rPod, setRPod] = useState("morning");
  const [rPriority, setRPriority] = useState("normal");

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

  async function loadRules() {
    try {
      const r = await fetch(`${KERNEL_URL}/proactive/rules`, { cache: "no-store" }).then((x) => x.json());
      setRules(r.rules ?? []);
    } catch { /* */ }
  }
  useEffect(() => { void loadRules(); }, []);

  function buildCondition(): Record<string, unknown> {
    if (rType === "part_of_day") return { type: "part_of_day", value: rPod };
    if (rType === "commitment_due_within") return { type: "commitment_due_within", minutes: Number(rMinutes) || 60 };
    return { type: "commitment_overdue" };
  }
  async function saveRule() {
    if (!rName.trim() || !rTitle.trim()) return;
    setNote("");
    const r = await fetch(`${KERNEL_URL}/proactive/rules`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: rName.trim(), title: rTitle.trim(), priority: rPriority, condition: buildCondition() }),
    });
    setNote(r.ok ? `rule '${rName.trim()}' saved — run a cycle to see it` : "rule rejected (invalid condition)");
    setRName(""); setRTitle("");
    await loadRules();
  }
  async function toggleRule(name: string, enabled: boolean) {
    await fetch(`${KERNEL_URL}/proactive/rules/${encodeURIComponent(name)}/enabled`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled }),
    });
    await loadRules();
  }
  async function deleteRule(name: string) {
    await fetch(`${KERNEL_URL}/proactive/rules/${encodeURIComponent(name)}`, { method: "DELETE" });
    await loadRules();
  }
  function condLabel(c: Record<string, unknown>): string {
    if (c.type === "part_of_day") return `every ${c.value}`;
    if (c.type === "commitment_due_within") return `commitment due within ${c.minutes}m`;
    if (c.type === "commitment_overdue") return `commitment overdue`;
    return String(c.type);
  }

  async function runCycle() {
    setBusy(true);
    setNote("");
    try {
      const body = at ? { at: new Date(at).toISOString() } : {};
      const r = await fetch(`${KERNEL_URL}/proactive/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      setResult(await r.json());
    } catch (err) {
      setNote(`error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function post(path: string, body: unknown) {
    await fetch(`${KERNEL_URL}/proactive/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setNote(`${path} applied — run a cycle to see the effect`);
  }

  const domains = result
    ? [...new Set([...result.surfaced.map((s) => s.domain), ...result.suppressed.map(() => "")])].filter(Boolean)
    : [];

  return (
    <main style={{ padding: "1.5rem", maxWidth: 860, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
        <div>
          <h1 style={{ fontSize: "1.05rem", letterSpacing: "0.2em", color: "var(--operational)", margin: 0 }}>
            J.A.R.V.I.S. — PROACTIVITY
          </h1>
          <p style={{ color: "var(--dim)", margin: "0.2rem 0 0", fontSize: "0.8rem" }}>
            on-demand cycle · every suppression explained ·{" "}
            <a href="/" style={{ color: "var(--operational)" }}>dashboard</a>
          </p>
        </div>
        <span style={{ color: estop ? "var(--critical)" : "var(--dim)", fontSize: "0.8rem" }}>
          {estop ? "⏹ EMERGENCY STOP ENGAGED" : ""}
        </span>
      </header>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderLeft: "3px solid var(--advisory)",
          padding: "0.6rem 1rem",
          marginBottom: "0.8rem",
          fontSize: "0.75rem",
          color: "var(--dim)",
        }}
      >
        Live background delivery + notifications are gated on the &quot;enable proactive behavior&quot;
        check-in (D-0024). This runs a cycle only when you ask, and never takes a consequential action.
      </div>

      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.9rem", flexWrap: "wrap" }}>
        <button onClick={runCycle} disabled={busy} style={{ ...btn("var(--operational)"), padding: "0.5rem 1rem", opacity: busy ? 0.5 : 1 }}>
          {busy ? "running…" : "run a cycle"}
        </button>
        <span style={{ color: "var(--dim)", fontSize: "0.75rem" }}>preview at:</span>
        <input
          type="datetime-local"
          value={at}
          onChange={(e) => setAt(e.target.value)}
          style={{ background: "var(--bg)", border: "1px solid var(--line)", color: "var(--focal)", fontFamily: "var(--mono)", fontSize: "0.75rem", padding: "0.3rem" }}
        />
        {at && (
          <button onClick={() => setAt("")} style={btn("var(--dim)")}>now</button>
        )}
        {note && <span style={{ color: "var(--advisory)", fontSize: "0.72rem" }}>{note}</span>}
      </div>

      <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderLeft: "3px solid var(--focal)", padding: "0.9rem 1.1rem", marginBottom: "0.9rem" }}>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "0.78rem", letterSpacing: "0.12em", color: "var(--focal)" }}>
          YOUR RULES ({rules.length}) — what J.A.R.V.I.S. is proactive about
        </h2>
        <div style={{ color: "var(--dim)", fontSize: "0.72rem", marginBottom: "0.5rem" }}>
          rules add candidates that still pass every gate; suggestion-only, never acts. Conditions are a fixed safe set.
        </div>
        <div style={{ maxHeight: 180, overflowY: "auto", marginBottom: "0.6rem" }}>
          {rules.length === 0 && <span style={{ color: "var(--dim)", fontSize: "0.8rem" }}>no rules yet — built-in generators still run</span>}
          {rules.map((r) => (
            <div key={r.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0.2rem 0", borderBottom: "1px solid var(--line)", fontSize: "0.78rem" }}>
              <span>
                <span style={{ color: r.enabled ? "var(--focal)" : "var(--dim)" }}>{r.title}</span>{" "}
                <span style={{ color: "var(--dim)", fontSize: "0.68rem" }}>[{r.name} · {condLabel(r.condition)} · {r.priority}{r.enabled ? "" : " · OFF"}]</span>
              </span>
              <span style={{ display: "flex", gap: "0.3rem" }}>
                <button onClick={() => toggleRule(r.name, !r.enabled)} style={btn(r.enabled ? "var(--advisory)" : "var(--operational)")}>{r.enabled ? "disable" : "enable"}</button>
                <button onClick={() => deleteRule(r.name)} style={btn("var(--critical)")}>delete</button>
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", alignItems: "center", borderTop: "1px solid var(--line)", paddingTop: "0.5rem" }}>
          <input value={rName} onChange={(e) => setRName(e.target.value)} placeholder="rule id" style={{ ...ruleInput, width: 100 }} />
          <input value={rTitle} onChange={(e) => setRTitle(e.target.value)} placeholder="what to surface" style={{ ...ruleInput, flex: 1, minWidth: 140 }} />
          <select value={rType} onChange={(e) => setRType(e.target.value)} style={ruleInput}>
            <option value="commitment_overdue">commitment overdue</option>
            <option value="commitment_due_within">commitment due within…</option>
            <option value="part_of_day">at time of day…</option>
          </select>
          {rType === "commitment_due_within" && (
            <input value={rMinutes} onChange={(e) => setRMinutes(e.target.value)} style={{ ...ruleInput, width: 64 }} title="minutes" />
          )}
          {rType === "part_of_day" && (
            <select value={rPod} onChange={(e) => setRPod(e.target.value)} style={ruleInput}>
              <option>morning</option><option>afternoon</option><option>evening</option><option>night</option>
            </select>
          )}
          <select value={rPriority} onChange={(e) => setRPriority(e.target.value)} style={ruleInput}>
            <option>low</option><option>normal</option><option>high</option><option>critical</option>
          </select>
          <button onClick={saveRule} disabled={!rName.trim() || !rTitle.trim()} style={{ ...btn("var(--operational)"), opacity: rName.trim() && rTitle.trim() ? 1 : 0.5 }}>add rule</button>
        </div>
      </section>

      {domains.length > 0 && (
        <div style={{ marginBottom: "0.9rem", fontSize: "0.75rem", color: "var(--dim)" }}>
          domains:{" "}
          {domains.map((d) => (
            <span key={d} style={{ marginRight: "0.5rem" }}>
              {d}{" "}
              <button onClick={() => post("domain", { domain: d, enabled: false })} style={btn("var(--critical)")}>mute</button>{" "}
              <button onClick={() => post("domain", { domain: d, enabled: true })} style={btn("var(--operational)")}>on</button>
            </span>
          ))}
        </div>
      )}

      {result && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
          <Panel tone={result.surfaced.length ? "advisory" : "operational"} title={`SURFACED (${result.surfaced.length})`}>
            {result.surfaced.length === 0 && <span style={{ color: "var(--dim)" }}>nothing passed every gate</span>}
            {result.surfaced.map((s) => (
              <div key={s.dedupKey} style={{ marginBottom: "0.6rem" }}>
                <div style={{ color: "var(--advisory)" }}>
                  {s.title} <span style={{ color: "var(--dim)", fontSize: "0.7rem" }}>[{s.priority}·{s.domain}]</span>
                </div>
                <div style={{ color: "var(--focal)", fontSize: "0.78rem" }}>{s.detail}</div>
                <div style={{ color: "var(--dim)", fontSize: "0.7rem" }}>why: {s.why}</div>
                <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.2rem" }}>
                  <button onClick={() => post("snooze", { dedupKey: s.dedupKey, minutes: 60 })} style={btn("var(--operational)")}>snooze 1h</button>
                  <button onClick={() => post("dismiss", { dedupKey: s.dedupKey })} style={btn("var(--critical)")}>dismiss</button>
                </div>
              </div>
            ))}
          </Panel>

          <Panel tone="operational" title={`SUPPRESSED (${result.suppressedCount}) — why you are NOT seeing these`}>
            {result.suppressed.length === 0 && <span style={{ color: "var(--dim)" }}>nothing suppressed</span>}
            {result.suppressed.map((s, i) => (
              <div key={i} style={{ marginBottom: "0.45rem" }}>
                <div style={{ color: "var(--focal)", fontSize: "0.82rem" }}>{s.title}</div>
                <div style={{ color: "var(--dim)", fontSize: "0.72rem" }}>
                  <span style={{ color: "var(--advisory)" }}>{s.gate}</span> — {s.reason}
                </div>
              </div>
            ))}
          </Panel>
        </div>
      )}

      {!result && !busy && (
        <div style={{ color: "var(--dim)" }}>Run a cycle to see what J.A.R.V.I.S. would surface, and what it holds back — and why.</div>
      )}
    </main>
  );
}

const ruleInput: React.CSSProperties = {
  background: "var(--bg)", border: "1px solid var(--line)", color: "var(--focal)",
  fontFamily: "var(--mono)", fontSize: "0.72rem", padding: "0.3rem 0.4rem",
};
function btn(color: string): React.CSSProperties {
  return {
    background: "transparent",
    border: `1px solid ${color}`,
    color,
    padding: "0.15rem 0.5rem",
    fontFamily: "var(--mono)",
    fontSize: "0.68rem",
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
