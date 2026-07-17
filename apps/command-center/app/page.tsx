"use client";

import { useEffect, useRef, useState } from "react";

const KERNEL_URL =
  process.env.NEXT_PUBLIC_JARVIS_KERNEL_URL ?? "http://127.0.0.1:4150";

interface HealthReport {
  status: "ok" | "degraded";
  version: string;
  env: string;
  uptimeSeconds: number;
  checks: {
    database: { ok: true; latencyMs: number } | { ok: false; error: string };
    migrations:
      | { ok: true; total: number; applied: number }
      | { ok: false; pending: string[]; error?: string };
  };
}

interface ActivityEvent {
  kind: string;
  at?: string;
  text?: string;
  tool?: string;
  ok?: boolean;
  summary?: string;
  risk?: string;
  requestId?: string;
  engaged?: boolean;
  message?: string;
}

interface PendingApproval {
  id: string;
  tool: string;
  resourceScope: string | null;
}

export default function SystemPage() {
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [reachable, setReachable] = useState<boolean | null>(null);
  const [estop, setEstop] = useState<boolean>(false);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [audit, setAudit] = useState<{ seq: number; event: string; actor: string }[]>([]);
  const [chainOk, setChainOk] = useState<boolean | null>(null);
  const activityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let stop = false;
    async function poll() {
      try {
        const [h, e, a, au, cv] = await Promise.all([
          fetch(`${KERNEL_URL}/health`, { cache: "no-store" }).then((r) => r.json()),
          fetch(`${KERNEL_URL}/core/estop`, { cache: "no-store" }).then((r) => r.json()),
          fetch(`${KERNEL_URL}/core/approvals`, { cache: "no-store" }).then((r) => r.json()),
          fetch(`${KERNEL_URL}/core/audit?limit=8`, { cache: "no-store" }).then((r) => r.json()),
          fetch(`${KERNEL_URL}/core/audit/verify`, { cache: "no-store" }).then((r) => r.json()),
        ]);
        if (stop) return;
        setHealth(h);
        setReachable(true);
        setEstop(Boolean(e.engaged));
        setApprovals(a.pending ?? []);
        setAudit(au.entries ?? []);
        setChainOk(cv.intact);
      } catch {
        if (!stop) setReachable(false);
      }
    }
    void poll();
    const id = setInterval(poll, 2000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  // Live activity timeline via SSE.
  useEffect(() => {
    const es = new EventSource(`${KERNEL_URL}/core/activity`);
    es.onmessage = (ev) => {
      try {
        const e = JSON.parse(ev.data) as ActivityEvent;
        if (e.kind === "hello") return;
        setActivity((prev) => [...prev.slice(-40), e]);
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, []);

  useEffect(() => {
    activityRef.current?.scrollTo(0, activityRef.current.scrollHeight);
  }, [activity]);

  async function engageEstop() {
    await fetch(`${KERNEL_URL}/core/estop/engage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ via: "command-center" }),
    });
  }
  async function resumeEstop() {
    await fetch(`${KERNEL_URL}/core/estop/resume`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ via: "command-center" }),
    });
  }
  async function resolve(id: string, resolution: string) {
    await fetch(`${KERNEL_URL}/core/approvals/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, resolution, via: "command-center" }),
    });
  }

  return (
    <main style={{ padding: "1.5rem", maxWidth: 960, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.05rem", letterSpacing: "0.2em", color: "var(--operational)", margin: 0 }}>
            J.A.R.V.I.S. — COMMAND CENTER
          </h1>
          <p style={{ color: "var(--dim)", margin: "0.2rem 0 0" }}>slice 1.4 · live system state</p>
        </div>
        <EmergencyStopButton engaged={estop} onEngage={engageEstop} onResume={resumeEstop} />
      </header>

      {reachable === false && (
        <Panel tone="critical" title="KERNEL — UNREACHABLE">
          {KERNEL_URL} is not responding.
        </Panel>
      )}

      {reachable && health && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
          <Panel tone={health.status === "ok" ? "operational" : "advisory"} title={`KERNEL — ${health.status.toUpperCase()}`}>
            <Row k="version" v={health.version} />
            <Row k="env" v={health.env} />
            <Row k="uptime" v={`${health.uptimeSeconds}s`} />
            <Row
              k="database"
              v={health.checks.database.ok ? `${health.checks.database.latencyMs.toFixed(1)} ms` : "down"}
            />
          </Panel>

          <Panel tone={chainOk === false ? "critical" : "operational"} title="AUDIT">
            <Row k="chain integrity" v={chainOk === null ? "…" : chainOk ? "intact" : "BROKEN"} />
            <div style={{ marginTop: "0.4rem", color: "var(--dim)", fontSize: "0.8rem" }}>
              {audit.map((e) => (
                <div key={e.seq}>
                  #{e.seq} {e.event} · {e.actor}
                </div>
              ))}
            </div>
          </Panel>

          <Panel tone={approvals.length ? "advisory" : "operational"} title={`APPROVALS (${approvals.length})`}>
            {approvals.length === 0 && <span style={{ color: "var(--dim)" }}>none pending</span>}
            {approvals.map((a) => (
              <div key={a.id} style={{ marginBottom: "0.5rem" }}>
                <div style={{ color: "var(--advisory)" }}>{a.tool}</div>
                <div style={{ color: "var(--dim)", fontSize: "0.75rem" }}>{a.resourceScope ?? "—"}</div>
                <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.3rem" }}>
                  <button onClick={() => resolve(a.id, "allow-once")} style={btn("var(--operational)")}>
                    approve
                  </button>
                  <button onClick={() => resolve(a.id, "deny")} style={btn("var(--critical)")}>
                    deny
                  </button>
                </div>
              </div>
            ))}
          </Panel>

          <Panel tone="operational" title="ACTIVITY TIMELINE">
            <div ref={activityRef} style={{ maxHeight: 180, overflowY: "auto", fontSize: "0.8rem" }}>
              {activity.length === 0 && <span style={{ color: "var(--dim)" }}>idle</span>}
              {activity.map((e, i) => (
                <div key={i} style={{ color: activityColor(e) }}>
                  {formatActivity(e)}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </main>
  );
}

function EmergencyStopButton(props: { engaged: boolean; onEngage: () => void; onResume: () => void }) {
  return props.engaged ? (
    <button onClick={props.onResume} style={{ ...btn("var(--critical)"), padding: "0.6rem 1rem", fontWeight: 700 }}>
      ⏹ STOPPED — RESUME
    </button>
  ) : (
    <button onClick={props.onEngage} style={{ ...btn("var(--critical)"), padding: "0.6rem 1rem", fontWeight: 700 }}>
      ⏹ EMERGENCY STOP
    </button>
  );
}

function activityColor(e: ActivityEvent): string {
  if (e.kind === "error" || (e.kind === "tool_result" && e.ok === false)) return "var(--critical)";
  if (e.kind === "approval_required" || e.kind === "tool_proposed") return "var(--advisory)";
  if (e.kind === "estop") return "var(--critical)";
  return "var(--focal)";
}

function formatActivity(e: ActivityEvent): string {
  switch (e.kind) {
    case "objective":
      return `▸ objective: ${e.text}`;
    case "token":
      return e.text ?? "";
    case "tool_proposed":
      return `⚙ proposed ${e.tool} (${e.risk})`;
    case "approval_required":
      return `⏸ approval required: ${e.tool}`;
    case "tool_result":
      return `${e.ok ? "✓" : "✗"} ${e.tool}: ${e.summary}`;
    case "verified":
      return `${e.ok ? "✓" : "✗"} verified: ${e.summary}`;
    case "model":
      return `◈ model responded`;
    case "estop":
      return e.engaged ? "⏹ EMERGENCY STOP engaged" : "▶ resumed";
    case "error":
      return `✗ ${e.message}`;
    default:
      return e.kind;
  }
}

function btn(color: string): React.CSSProperties {
  return {
    background: "transparent",
    border: `1px solid ${color}`,
    color,
    padding: "0.25rem 0.6rem",
    fontFamily: "var(--mono)",
    fontSize: "0.75rem",
    cursor: "pointer",
  };
}

function Panel(props: { tone: "operational" | "advisory" | "critical" | "dim"; title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderLeft: `3px solid var(--${props.tone})`,
        padding: "0.9rem 1.1rem",
      }}
    >
      <h2 style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", letterSpacing: "0.15em", color: `var(--${props.tone})` }}>
        {props.title}
      </h2>
      {props.children}
    </section>
  );
}

function Row(props: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
      <span style={{ color: "var(--dim)" }}>{props.k}</span>
      <span>{props.v}</span>
    </div>
  );
}
