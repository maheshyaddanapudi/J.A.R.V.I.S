"use client";

import { useEffect, useState } from "react";

const KERNEL_URL =
  process.env.NEXT_PUBLIC_JARVIS_KERNEL_URL ?? "http://127.0.0.1:4150";

interface HealthReport {
  status: "ok" | "degraded";
  service: string;
  version: string;
  env: string;
  uptimeSeconds: number;
  now: string;
  checks: {
    database: { ok: true; latencyMs: number } | { ok: false; error: string };
    migrations:
      | { ok: true; total: number; applied: number }
      | { ok: false; pending: string[]; error?: string };
  };
}

type KernelState =
  | { reachable: true; report: HealthReport; fetchedAt: number }
  | { reachable: false; error: string; fetchedAt: number }
  | { reachable: null };

export default function SystemPage() {
  const [state, setState] = useState<KernelState>({ reachable: null });

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`${KERNEL_URL}/health`, { cache: "no-store" });
        const report = (await res.json()) as HealthReport;
        if (!cancelled) setState({ reachable: true, report, fetchedAt: Date.now() });
      } catch (err) {
        if (!cancelled)
          setState({
            reachable: false,
            error: err instanceof Error ? err.message : String(err),
            fetchedAt: Date.now(),
          });
      }
    }
    void poll();
    const id = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.1rem", letterSpacing: "0.2em", color: "var(--operational)" }}>
          J.A.R.V.I.S. — SYSTEM
        </h1>
        <p style={{ color: "var(--dim)", margin: 0 }}>
          Command Center · slice 1.1 · live service state (polled every 2 s)
        </p>
      </header>

      {state.reachable === null && <Panel tone="dim" title="KERNEL">probing…</Panel>}

      {state.reachable === false && (
        <Panel tone="critical" title="KERNEL — UNREACHABLE">
          <div>{KERNEL_URL}/health</div>
          <div style={{ color: "var(--dim)" }}>{state.error}</div>
        </Panel>
      )}

      {state.reachable === true && (
        <>
          <Panel
            tone={state.report.status === "ok" ? "operational" : "advisory"}
            title={`KERNEL — ${state.report.status.toUpperCase()}`}
          >
            <Row k="version" v={state.report.version} />
            <Row k="env" v={state.report.env} />
            <Row k="uptime" v={`${state.report.uptimeSeconds}s`} />
          </Panel>

          <Panel
            tone={state.report.checks.database.ok ? "operational" : "critical"}
            title="DATABASE"
          >
            {state.report.checks.database.ok ? (
              <Row
                k="round-trip"
                v={`${state.report.checks.database.latencyMs.toFixed(1)} ms`}
              />
            ) : (
              <div style={{ color: "var(--critical)" }}>
                {state.report.checks.database.error}
              </div>
            )}
          </Panel>

          <Panel
            tone={state.report.checks.migrations.ok ? "operational" : "advisory"}
            title="MIGRATIONS"
          >
            {state.report.checks.migrations.ok ? (
              <Row
                k="applied"
                v={`${state.report.checks.migrations.applied}/${state.report.checks.migrations.total}`}
              />
            ) : (
              <div style={{ color: "var(--advisory)" }}>
                pending: {state.report.checks.migrations.pending.join(", ") || "unknown"}
                {state.report.checks.migrations.error
                  ? ` (${state.report.checks.migrations.error})`
                  : ""}
              </div>
            )}
          </Panel>
        </>
      )}
    </main>
  );
}

function Panel(props: {
  tone: "operational" | "advisory" | "critical" | "dim";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderLeft: `3px solid var(--${props.tone})`,
        padding: "0.9rem 1.1rem",
        marginBottom: "0.8rem",
      }}
    >
      <h2
        style={{
          margin: "0 0 0.5rem",
          fontSize: "0.8rem",
          letterSpacing: "0.15em",
          color: `var(--${props.tone})`,
        }}
      >
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
