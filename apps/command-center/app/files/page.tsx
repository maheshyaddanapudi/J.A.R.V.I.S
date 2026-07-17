"use client";

import { useEffect, useRef, useState } from "react";

const KERNEL_URL = process.env.NEXT_PUBLIC_JARVIS_KERNEL_URL ?? "http://127.0.0.1:4150";

interface Entry { name: string; path: string; kind: string; size: number; modified: string }
interface Match { path: string; line: number; preview: string }
interface FileContent { path: string; content: string; bytes: number; truncated: boolean }
interface Pending { id: string; tool: string; resourceScope: string | null }
interface Ev { kind: string; tool?: string; ok?: boolean; summary?: string; risk?: string; disclosure?: { whatWillHappen?: string } }

/**
 * Knowledge / files panel (Phase 2, D-0032). Browses, searches, and views the
 * REAL workspace over the read-only /knowledge/* routes, and edits a file through
 * the gated loop (files.edit → /core/run-tool): a consequential edit surfaces an
 * inline approval you resolve here, and the loop independently re-reads the file
 * to verify the change. This is a real local filesystem (not a simulator);
 * everything stays inside the workspace root. Persistent e-stop halts a running edit.
 */
export default function FilesPage() {
  const [dir, setDir] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [open, setOpen] = useState<FileContent | null>(null);
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [note, setNote] = useState("");
  const [pipeline, setPipeline] = useState<Ev[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [estop, setEstop] = useState(false);
  const [busy, setBusy] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  async function listDir(d: string) {
    setNote("");
    const r = await fetch(`${KERNEL_URL}/knowledge/list?dir=${encodeURIComponent(d)}`, { cache: "no-store" }).then((x) => x.json());
    if (r.error) { setNote(r.error); return; }
    setDir(d); setEntries(r.entries ?? []);
  }
  useEffect(() => { void listDir(""); }, []);

  useEffect(() => {
    const es = new EventSource(`${KERNEL_URL}/core/activity`);
    es.onmessage = (m) => {
      try {
        const e = JSON.parse(m.data) as Ev;
        if (["tool_proposed", "approval_required", "tool_result", "verified", "error", "estop"].includes(e.kind)) {
          setPipeline((p) => [...p.slice(-40), e]);
        }
        if (e.kind === "estop") setEstop(Boolean((e as { engaged?: boolean }).engaged));
      } catch { /* */ }
    };
    return () => es.close();
  }, []);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const [a, e] = await Promise.all([
          fetch(`${KERNEL_URL}/core/approvals`, { cache: "no-store" }).then((r) => r.json()),
          fetch(`${KERNEL_URL}/core/estop`, { cache: "no-store" }).then((r) => r.json()),
        ]);
        setPending(a.pending ?? []);
        setEstop(Boolean(e.engaged));
      } catch { /* */ }
    }, 1200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { feedRef.current?.scrollTo(0, feedRef.current.scrollHeight); }, [pipeline]);

  async function openFile(path: string) {
    setNote("");
    const r = await fetch(`${KERNEL_URL}/knowledge/read?path=${encodeURIComponent(path)}`, { cache: "no-store" }).then((x) => x.json());
    if (r.error) { setNote(r.error); return; }
    setOpen(r as FileContent); setFind(""); setReplace("");
  }
  async function search() {
    if (!query.trim()) return;
    const r = await fetch(`${KERNEL_URL}/knowledge/search?q=${encodeURIComponent(query.trim())}`, { cache: "no-store" }).then((x) => x.json());
    setMatches(r.matches ?? []);
  }
  async function proposeEdit(autoDeny = false) {
    if (!open || !find || busy) return;
    setBusy(true); setNote("");
    try {
      const res = await fetch(`${KERNEL_URL}/core/run-tool`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tool: "files.edit",
          args: { path: open.path, find, replace },
          source: "command-center",
          ...(autoDeny ? { autoApprove: "deny" } : {}),
        }),
      }).then((r) => r.json());
      setNote(`${res.ok ? "✓" : res.denied ? "⊘" : "✗"} ${res.summary}`);
      if (res.ok) await openFile(open.path); // re-read to show the verified change
    } finally {
      setBusy(false);
    }
  }
  async function resolve(id: string, resolution: string) {
    await fetch(`${KERNEL_URL}/core/approvals/resolve`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, resolution, via: "command-center" }),
    });
  }
  async function toggleEstop() {
    await fetch(`${KERNEL_URL}/core/estop/${estop ? "resume" : "engage"}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ via: "command-center" }),
    });
  }

  const parent = dir ? dir.split("/").slice(0, -1).join("/") : null;

  return (
    <main style={{ padding: "1.5rem", maxWidth: 980, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
        <div>
          <h1 style={{ fontSize: "1.05rem", letterSpacing: "0.2em", color: "var(--operational)", margin: 0 }}>J.A.R.V.I.S. — FILES</h1>
          <p style={{ color: "var(--dim)", margin: "0.2rem 0 0", fontSize: "0.8rem" }}>
            real workspace · read/search auto-run · edits are gated · <a href="/" style={{ color: "var(--operational)" }}>dashboard</a>
          </p>
        </div>
        <button onClick={toggleEstop} style={{ ...btn("var(--critical)"), padding: "0.6rem 1rem", fontWeight: 700 }}>
          {estop ? "⏹ STOPPED — RESUME" : "⏹ EMERGENCY STOP"}
        </button>
      </header>

      {pending.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--advisory)", padding: "0.6rem 1rem", marginBottom: "0.6rem" }}>
          <div style={{ color: "var(--advisory)", fontSize: "0.78rem", marginBottom: "0.3rem" }}>a file edit needs your approval:</div>
          {pending.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
              <span style={{ color: "var(--focal)" }}>{p.tool}</span>
              <button onClick={() => resolve(p.id, "allow-once")} style={btn("var(--operational)")}>approve</button>
              <button onClick={() => resolve(p.id, "deny")} style={btn("var(--critical)")}>deny</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
        <Panel tone="operational" title={`WORKSPACE  /${dir}`}>
          {parent !== null || dir ? (
            <div onClick={() => listDir(parent ?? "")} style={{ cursor: "pointer", color: "var(--operational)", marginBottom: "0.25rem", fontSize: "0.78rem" }}>↰ ..</div>
          ) : null}
          <div style={{ maxHeight: 240, overflowY: "auto", fontSize: "0.78rem" }}>
            {entries.map((e) => (
              <div key={e.path} onClick={() => (e.kind === "dir" ? listDir(e.path) : openFile(e.path))}
                style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", padding: "0.1rem 0", color: e.kind === "dir" ? "var(--operational)" : "var(--focal)" }}>
                <span>{e.kind === "dir" ? "▸ " : "  "}{e.name}</span>
                <span style={{ color: "var(--dim)", fontSize: "0.68rem" }}>{e.kind === "dir" ? "dir" : `${e.size} b`}</span>
              </div>
            ))}
            {entries.length === 0 && <span style={{ color: "var(--dim)" }}>empty</span>}
          </div>
        </Panel>

        <Panel tone="operational" title="SEARCH (read-only, workspace-wide)">
          <div style={{ display: "flex", gap: "0.3rem", marginBottom: "0.4rem" }}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="find text across the workspace" style={{ flex: 1, ...inputStyle }} />
            <button onClick={search} style={btn("var(--operational)")}>search</button>
          </div>
          <div style={{ maxHeight: 200, overflowY: "auto", fontSize: "0.72rem" }}>
            {matches === null && <span style={{ color: "var(--dim)" }}>results appear here (file:line)</span>}
            {matches?.length === 0 && <span style={{ color: "var(--dim)" }}>no matches</span>}
            {matches?.map((m, i) => (
              <div key={i} onClick={() => openFile(m.path)} style={{ cursor: "pointer", marginBottom: "0.2rem" }}>
                <span style={{ color: "var(--operational)" }}>{m.path}:{m.line}</span>{" "}
                <span style={{ color: "var(--dim)" }}>{m.preview}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem", marginTop: "0.8rem" }}>
        <Panel tone="focal" title={open ? `VIEW  ${open.path}${open.truncated ? "  (truncated)" : ""}` : "VIEW"}>
          {!open && <span style={{ color: "var(--dim)" }}>click a file to read it</span>}
          {open && (
            <>
              <pre style={{ maxHeight: 220, overflow: "auto", fontSize: "0.72rem", color: "var(--focal)", margin: 0, whiteSpace: "pre-wrap" }}>{open.content}</pre>
              <div style={{ marginTop: "0.5rem", borderTop: "1px solid var(--line)", paddingTop: "0.5rem" }}>
                <div style={{ color: "var(--advisory)", fontSize: "0.72rem", marginBottom: "0.3rem" }}>EDIT (consequential — needs approval):</div>
                <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="exact text to find (unique)" style={{ width: "100%", marginBottom: "0.25rem", ...inputStyle }} />
                <input value={replace} onChange={(e) => setReplace(e.target.value)} placeholder="replace with" style={{ width: "100%", marginBottom: "0.35rem", ...inputStyle }} />
                <div style={{ display: "flex", gap: "0.3rem" }}>
                  <button onClick={() => proposeEdit(false)} disabled={busy || estop || !find} style={{ ...btn("var(--operational)"), opacity: busy || estop || !find ? 0.5 : 1 }}>propose edit</button>
                  <button onClick={() => proposeEdit(true)} disabled={busy || estop || !find} style={{ ...btn("var(--critical)"), opacity: busy || estop || !find ? 0.5 : 1 }}>test deny</button>
                </div>
                {note && <div style={{ marginTop: "0.35rem", color: "var(--dim)", fontSize: "0.72rem" }}>{note}</div>}
              </div>
            </>
          )}
        </Panel>

        <Panel tone="advisory" title="GATED PIPELINE (live)">
          <div ref={feedRef} style={{ maxHeight: 300, overflowY: "auto", fontSize: "0.73rem" }}>
            {pipeline.length === 0 && <span style={{ color: "var(--dim)" }}>propose an edit to watch disclosure → approval → execute → verify</span>}
            {pipeline.map((e, i) => (<div key={i} style={{ marginBottom: "0.25rem", color: pipeColor(e) }}>{formatEv(e)}</div>))}
          </div>
        </Panel>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--bg)", border: "1px solid var(--line)", color: "var(--focal)",
  fontFamily: "var(--mono)", fontSize: "0.73rem", padding: "0.35rem 0.5rem",
};
function formatEv(e: Ev): string {
  switch (e.kind) {
    case "tool_proposed": return `⚙ ${e.tool} (${e.risk}) — ${e.disclosure?.whatWillHappen ?? ""}`;
    case "approval_required": return `⏸ approval required: ${e.tool}`;
    case "tool_result": return `${e.ok ? "✓" : "✗"} ${e.tool}: ${e.summary}`;
    case "verified": return `${e.ok ? "✓" : "✗"} verified: ${e.summary}`;
    case "error": return `✗ ${(e as { message?: string }).message ?? "error"}`;
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
function Panel(props: { tone: "operational" | "advisory" | "critical" | "focal"; title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderLeft: `3px solid var(--${props.tone})`, padding: "0.9rem 1.1rem" }}>
      <h2 style={{ margin: "0 0 0.5rem", fontSize: "0.78rem", letterSpacing: "0.12em", color: `var(--${props.tone})` }}>{props.title}</h2>
      {props.children}
    </section>
  );
}
