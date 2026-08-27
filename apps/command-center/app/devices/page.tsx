"use client";

import { useEffect, useRef, useState } from "react";

const KERNEL_URL = process.env.NEXT_PUBLIC_JARVIS_KERNEL_URL ?? "http://127.0.0.1:4150";

interface RunOutcome {
  label: string;
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
  disclosure?: { whatWillHappen?: string; riskClass?: string };
}

/**
 * Device-control preview. Drives the labeled Stark-residence SIMULATION through
 * the REAL gated loop so the physical-device safety flow — CONSEQUENTIAL vs
 * HIGH_RISK_PHYSICAL, and the rule that locks/garage/utilities need an armed
 * single-use hardware INTERLOCK in addition to approval (R-AUTO-01) — is proven
 * before the real Home Assistant gateway is bound at the D-0025 check-in.
 * Everything is SIMULATION and says so; no real device is touched.
 */
export default function DevicesPage() {
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

  async function run(label: string, tool: string, args: unknown, autoApprove?: string) {
    const res = await fetch(`${KERNEL_URL}/core/run-tool`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool, args, source: "command-center", ...(autoApprove ? { autoApprove } : {}) }),
    }).then((r) => r.json());
    setOutcomes((o) => [{ label, ok: res.ok, summary: res.summary, denied: res.denied }, ...o].slice(0, 9));
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
            J.A.R.V.I.S. — DEVICES
          </h1>
          <p style={{ color: "var(--dim)", margin: "0.2rem 0 0", fontSize: "0.8rem" }}>
            Stark-residence SIMULATION through the real gated loop ·{" "}
            <a href="/" style={{ color: "var(--operational)" }}>dashboard</a>
          </p>
        </div>
        <button onClick={toggleEstop} style={{ ...btn("var(--critical)"), padding: "0.6rem 1rem", fontWeight: 700 }}>
          {estop ? "⏹ STOPPED — RESUME" : "⏹ EMERGENCY STOP"}
        </button>
      </header>

      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderLeft: "3px solid var(--advisory)", padding: "0.6rem 1rem", marginBottom: "0.8rem", fontSize: "0.75rem", color: "var(--dim)" }}>
        A labeled <b style={{ color: "var(--advisory)" }}>SIMULATION</b> home (lights, thermostat, front lock,
        garage, water valve). Lights/climate are CONSEQUENTIAL (approval). Locks/garage/utilities are
        <b style={{ color: "var(--critical)" }}> HIGH_RISK_PHYSICAL</b>: they need per-action approval PLUS an
        armed single-use interlock. The real Home Assistant gateway is bound only at the D-0025 check-in.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
        <Panel tone="operational" title="CONSEQUENTIAL (approval only)">
          <Line label="Workshop lights">
            <button onClick={() => run("lights on", "device.set", { deviceId: "light.workshop", set: { on: true } }, "allow-once")} style={btn("var(--operational)")}>on (approve)</button>
            <button onClick={() => run("lights off", "device.set", { deviceId: "light.workshop", set: { on: false } }, "allow-once")} style={btn("var(--operational)")}>off</button>
            <button onClick={() => run("lights on", "device.set", { deviceId: "light.workshop", set: { on: true } }, "deny")} style={btn("var(--critical)")}>deny</button>
          </Line>
          <Line label="Read state">
            <button onClick={() => run("list devices", "device.list", {})} style={btn("var(--operational)")}>list</button>
            <button onClick={() => run("lock state", "device.state", { deviceId: "lock.front" })} style={btn("var(--operational)")}>lock.front</button>
          </Line>
        </Panel>

        <Panel tone="critical" title="HIGH_RISK_PHYSICAL (approval + interlock)">
          <Line label="Front door (no interlock)">
            <button onClick={() => run("unlock (no interlock)", "device.set", { deviceId: "lock.front", set: { locked: false } }, "allow-once")} style={btn("var(--advisory)")}>unlock → refused</button>
          </Line>
          <Line label="Front door (armed)">
            <button onClick={() => run("arm interlock", "device.armInterlock", { deviceId: "lock.front" }, "allow-once")} style={btn("var(--operational)")}>1 · arm interlock</button>
            <button onClick={() => run("unlock (armed)", "device.set", { deviceId: "lock.front", set: { locked: false } }, "allow-once")} style={btn("var(--critical)")}>2 · unlock (approve)</button>
          </Line>
          <div style={{ color: "var(--dim)", fontSize: "0.68rem" }}>
            arm → unlock succeeds once; a second unlock without re-arming is refused (single-use).
          </div>
        </Panel>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem", marginTop: "0.8rem" }}>
        <Panel tone="operational" title="OUTCOMES">
          {outcomes.length === 0 && <span style={{ color: "var(--dim)" }}>no actions yet</span>}
          {outcomes.map((o, i) => (
            <div key={i} style={{ marginBottom: "0.3rem", fontSize: "0.78rem" }}>
              <span style={{ color: o.denied || !o.ok ? "var(--critical)" : "var(--operational)" }}>
                {o.denied ? "⊘" : o.ok ? "✓" : "✗"} {o.label}
              </span>
              <div style={{ color: "var(--dim)", fontSize: "0.72rem" }}>{o.summary}</div>
            </div>
          ))}
        </Panel>

        <Panel tone="advisory" title="GATED PIPELINE (live)">
          <div ref={feedRef} style={{ maxHeight: 220, overflowY: "auto", fontSize: "0.73rem" }}>
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
    case "tool_proposed":
      return `⚙ ${e.tool} (${e.disclosure?.riskClass ?? e.risk}) — ${e.disclosure?.whatWillHappen ?? ""}`;
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
    padding: "0.25rem 0.55rem",
    fontFamily: "var(--mono)",
    fontSize: "0.7rem",
    cursor: "pointer",
    marginRight: "0.3rem",
  };
}
function Line(props: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "0.5rem" }}>
      <div style={{ color: "var(--dim)", fontSize: "0.7rem", marginBottom: "0.2rem" }}>{props.label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.2rem" }}>{props.children}</div>
    </div>
  );
}
function Panel(props: { tone: "operational" | "advisory" | "critical"; title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderLeft: `3px solid var(--${props.tone})`, padding: "0.9rem 1.1rem" }}>
      <h2 style={{ margin: "0 0 0.5rem", fontSize: "0.78rem", letterSpacing: "0.12em", color: `var(--${props.tone})` }}>{props.title}</h2>
      {props.children}
    </section>
  );
}
