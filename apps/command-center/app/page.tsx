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

interface McpServer {
  id: string;
  trust: string;
  quarantined: boolean;
  tools: string[];
}

interface ProactiveItem {
  title: string;
  priority: string;
  domain: string;
  detail?: string;
}

interface ContextData {
  partOfDay: string;
  commitments: { title: string; overdue: boolean; dueSoon: boolean }[];
  pendingApprovals: { count: number };
  mcpServers: number;
  emergencyStop: boolean;
}

interface SecretInfo {
  name: string;
  description: string;
}

/** Resilient JSON GET: a missing/erroring endpoint yields the fallback rather
 *  than blanking the whole dashboard (honest partial state, never fake data). */
async function getJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return fallback;
    return (await r.json()) as T;
  } catch {
    return fallback;
  }
}

export default function SystemPage() {
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [reachable, setReachable] = useState<boolean | null>(null);
  const [estop, setEstop] = useState<boolean>(false);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [audit, setAudit] = useState<{ seq: number; event: string; actor: string }[]>([]);
  const [chainOk, setChainOk] = useState<boolean | null>(null);
  const [prefs, setPrefs] = useState<{ key: string; value: string; status: string }[]>([]);
  const [context, setContext] = useState<ContextData | null>(null);
  const [mcp, setMcp] = useState<McpServer[]>([]);
  const [proactive, setProactive] = useState<ProactiveItem[]>([]);
  const [secrets, setSecrets] = useState<SecretInfo[]>([]);
  const [secretsAvailable, setSecretsAvailable] = useState<boolean>(true);
  const activityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let stop = false;
    async function poll() {
      try {
        // Health probe first — its failure means the kernel is unreachable.
        const h = await fetch(`${KERNEL_URL}/health`, { cache: "no-store" }).then((r) => r.json());
        if (stop) return;
        setHealth(h);
        setReachable(true);
      } catch {
        if (!stop) setReachable(false);
        return;
      }
      // Everything else loads resiliently — one missing endpoint never blanks the view.
      const [e, a, au, cv, pf, ctx, ms, pi, sec] = await Promise.all([
        getJson(`${KERNEL_URL}/core/estop`, { engaged: false }),
        getJson<{ pending: PendingApproval[] }>(`${KERNEL_URL}/core/approvals`, { pending: [] }),
        getJson<{ entries: { seq: number; event: string; actor: string }[] }>(`${KERNEL_URL}/core/audit?limit=8`, { entries: [] }),
        getJson<{ intact: boolean | null }>(`${KERNEL_URL}/core/audit/verify`, { intact: null }),
        getJson<{ preferences: { key: string; value: string; status: string }[] }>(`${KERNEL_URL}/memory/preferences`, { preferences: [] }),
        getJson<{ snapshot: ContextData } | null>(`${KERNEL_URL}/context`, null),
        getJson<{ servers: McpServer[] }>(`${KERNEL_URL}/mcp/servers`, { servers: [] }),
        getJson<{ items: ProactiveItem[] }>(`${KERNEL_URL}/proactive/items`, { items: [] }),
        fetch(`${KERNEL_URL}/secrets`, { cache: "no-store" }),
      ]);
      if (stop) return;
      setEstop(Boolean((e as { engaged?: boolean }).engaged));
      setApprovals(a.pending ?? []);
      setAudit(au.entries ?? []);
      setChainOk(cv.intact);
      setPrefs(pf.preferences ?? []);
      setContext(ctx?.snapshot ?? null);
      setMcp(ms.servers ?? []);
      setProactive(pi.items ?? []);
      // /secrets returns 503 when no vault is configured — reflect that honestly.
      setSecretsAvailable(sec.ok);
      setSecrets(sec.ok ? ((await sec.json()).secrets ?? []) : []);
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
  async function deletePref(key: string) {
    await fetch(`${KERNEL_URL}/memory/preferences/${encodeURIComponent(key)}`, { method: "DELETE" });
  }
  async function storeSecret(name: string, value: string, description: string) {
    await fetch(`${KERNEL_URL}/secrets`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, value, description }),
    });
  }
  async function forgetSecret(name: string) {
    await fetch(`${KERNEL_URL}/secrets/${encodeURIComponent(name)}`, { method: "DELETE" });
  }
  async function connectMcpServer(id: string, command: string, args: string[]) {
    await fetch(`${KERNEL_URL}/mcp/connect`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, command, args }),
    });
  }
  async function setMcpTrust(id: string, trust: string) {
    await fetch(`${KERNEL_URL}/mcp/trust`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, trust }),
    });
  }

  return (
    <main style={{ padding: "1.5rem", maxWidth: 960, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.05rem", letterSpacing: "0.2em", color: "var(--operational)", margin: 0 }}>
            J.A.R.V.I.S. — COMMAND CENTER
          </h1>
          <p style={{ color: "var(--dim)", margin: "0.2rem 0 0" }}>
            live operations · all data is real kernel state{" "}
            <a href="/chat" style={{ color: "var(--operational)", marginLeft: "0.6rem" }}>
              converse →
            </a>{" "}
            <a href="/proactive" style={{ color: "var(--operational)", marginLeft: "0.4rem" }}>
              proactivity →
            </a>{" "}
            <a href="/control" style={{ color: "var(--operational)", marginLeft: "0.4rem" }}>
              control →
            </a>{" "}
            <a href="/devices" style={{ color: "var(--operational)", marginLeft: "0.4rem" }}>
              devices →
            </a>{" "}
            <a href="/selfext" style={{ color: "var(--operational)", marginLeft: "0.4rem" }}>
              self-extension →
            </a>{" "}
            <a href="/orb" style={{ color: "var(--operational)", marginLeft: "0.4rem" }}>
              voice orb →
            </a>
          </p>
        </div>
        <EmergencyStopButton engaged={estop} onEngage={engageEstop} onResume={resumeEstop} />
      </header>

      {reachable && context && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderLeft: "3px solid var(--focal)",
            padding: "0.6rem 1.1rem",
            marginBottom: "0.8rem",
            fontSize: "0.85rem",
            color: "var(--dim)",
          }}
        >
          <span style={{ color: "var(--focal)", textTransform: "capitalize" }}>{context.partOfDay}</span>
          {" · "}
          {context.commitments.length
            ? `${context.commitments.length} commitment(s)${
                context.commitments.some((c) => c.overdue) ? " — some OVERDUE" : ""
              }`
            : "no open commitments"}
          {" · "}
          {context.pendingApprovals.count} awaiting approval
          {" · "}
          {context.mcpServers} MCP server(s)
          {context.emergencyStop && (
            <span style={{ color: "var(--critical)" }}> · EMERGENCY STOP ENGAGED</span>
          )}
        </div>
      )}

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

          <Panel tone="operational" title={`MEMORY (${prefs.length})`}>
            {prefs.length === 0 && <span style={{ color: "var(--dim)" }}>no preferences stored</span>}
            {prefs.map((p) => (
              <div key={p.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                <span>
                  <span style={{ color: "var(--dim)" }}>{p.key}:</span> {p.value}{" "}
                  <span style={{ color: "var(--dim)", fontSize: "0.7rem" }}>({p.status})</span>
                </span>
                <button onClick={() => deletePref(p.key)} style={btn("var(--critical)")}>
                  forget
                </button>
              </div>
            ))}
          </Panel>

          <Panel
            tone={mcp.some((s) => s.quarantined) ? "critical" : "operational"}
            title={`MCP SERVERS (${mcp.length})`}
          >
            {mcp.length === 0 && <span style={{ color: "var(--dim)" }}>none connected</span>}
            {mcp.map((s) => (
              <div key={s.id} style={{ marginBottom: "0.5rem" }}>
                <span style={{ color: s.quarantined ? "var(--critical)" : "var(--focal)" }}>{s.id}</span>{" "}
                <span
                  style={{
                    color: s.trust === "trusted" ? "var(--operational)" : "var(--advisory)",
                    fontSize: "0.72rem",
                  }}
                >
                  [{s.quarantined ? "QUARANTINED" : s.trust}]
                </span>
                <div style={{ color: "var(--dim)", fontSize: "0.72rem" }}>
                  {s.tools.length} tool(s): {s.tools.slice(0, 6).join(", ")}
                </div>
                <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.2rem" }}>
                  {(["untrusted", "limited", "trusted"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setMcpTrust(s.id, t)}
                      disabled={s.trust === t && !s.quarantined}
                      style={{
                        ...btn(t === "trusted" ? "var(--operational)" : "var(--advisory)"),
                        opacity: s.trust === t && !s.quarantined ? 0.4 : 1,
                        fontSize: "0.68rem",
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ color: "var(--dim)", fontSize: "0.66rem", marginTop: "0.3rem" }}>
              raising trust above untrusted re-attests on reconnect (D-0027)
            </div>
            <McpConnectForm onConnect={connectMcpServer} />
          </Panel>

          <Panel tone={proactive.length ? "advisory" : "operational"} title={`PROACTIVE (${proactive.length})`}>
            {proactive.length === 0 && <span style={{ color: "var(--dim)" }}>nothing surfaced</span>}
            {proactive.map((p, i) => (
              <div key={i} style={{ marginBottom: "0.3rem" }}>
                <span style={{ color: "var(--advisory)" }}>{p.title}</span>{" "}
                <span style={{ color: "var(--dim)", fontSize: "0.72rem" }}>
                  [{p.priority}·{p.domain}]
                </span>
              </div>
            ))}
          </Panel>

          <Panel tone="operational" title={`SECRETS (${secrets.length})`}>
            {!secretsAvailable && <span style={{ color: "var(--dim)" }}>vault unavailable</span>}
            {secretsAvailable && secrets.length === 0 && (
              <span style={{ color: "var(--dim)" }}>none stored</span>
            )}
            {secrets.map((s) => (
              <div
                key={s.name}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}
              >
                <span>
                  <span style={{ color: "var(--focal)" }}>{s.name}</span>{" "}
                  <span style={{ color: "var(--dim)", fontSize: "0.72rem" }}>{s.description}</span>
                  <span style={{ color: "var(--operational)", fontSize: "0.68rem" }}> · encrypted</span>
                </span>
                <button onClick={() => forgetSecret(s.name)} style={btn("var(--critical)")}>
                  forget
                </button>
              </div>
            ))}
            {secretsAvailable && (
              <>
                <div style={{ color: "var(--dim)", fontSize: "0.68rem", margin: "0.3rem 0" }}>
                  names only — values never leave the encrypted vault
                </div>
                <SecretForm onStore={storeSecret} />
              </>
            )}
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

const inputStyle: React.CSSProperties = {
  background: "var(--bg)",
  border: "1px solid var(--line)",
  color: "var(--focal)",
  fontFamily: "var(--mono)",
  fontSize: "0.72rem",
  padding: "0.25rem 0.4rem",
  flex: 1,
  minWidth: 0,
};

function SecretForm(props: { onStore: (name: string, value: string, description: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [desc, setDesc] = useState("");
  const canStore = name.trim() !== "" && value !== "";
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginTop: "0.3rem" }}>
      <input style={inputStyle} placeholder="name (e.g. anthropic_api_key)" value={name} onChange={(e) => setName(e.target.value)} />
      <input style={inputStyle} type="password" placeholder="value" value={value} onChange={(e) => setValue(e.target.value)} />
      <input style={inputStyle} placeholder="description" value={desc} onChange={(e) => setDesc(e.target.value)} />
      <button
        disabled={!canStore}
        onClick={async () => {
          await props.onStore(name.trim(), value, desc);
          setName("");
          setValue("");
          setDesc("");
        }}
        style={{ ...btn("var(--operational)"), opacity: canStore ? 1 : 0.4 }}
      >
        store (encrypted)
      </button>
    </div>
  );
}

function McpConnectForm(props: { onConnect: (id: string, command: string, args: string[]) => Promise<void> }) {
  const [id, setId] = useState("");
  const [command, setCommand] = useState("");
  const [argsText, setArgsText] = useState("");
  const canConnect = id.trim() !== "" && command.trim() !== "";
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginTop: "0.3rem" }}>
      <input style={inputStyle} placeholder="id" value={id} onChange={(e) => setId(e.target.value)} />
      <input style={inputStyle} placeholder="command (e.g. node)" value={command} onChange={(e) => setCommand(e.target.value)} />
      <input style={inputStyle} placeholder="args (space-separated)" value={argsText} onChange={(e) => setArgsText(e.target.value)} />
      <button
        disabled={!canConnect}
        onClick={async () => {
          const args = argsText.trim() ? argsText.trim().split(/\s+/) : [];
          await props.onConnect(id.trim(), command.trim(), args);
          setId("");
          setCommand("");
          setArgsText("");
        }}
        style={{ ...btn("var(--operational)"), opacity: canConnect ? 1 : 0.4 }}
      >
        connect
      </button>
    </div>
  );
}
