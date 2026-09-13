"use client";

import { useCallback, useEffect, useState } from "react";

const KERNEL_URL = process.env.NEXT_PUBLIC_JARVIS_KERNEL_URL ?? "http://127.0.0.1:4150";

interface Experiment {
  id: string;
  campaign: string;
  started_at: string;
  candidate_summary: string;
  hypothesis: string;
  baseline: Record<string, number>;
  trials: { scores: Record<string, number>; gatesPass: boolean }[];
  verdict: "keep" | "discard" | "crash";
  verdict_reason: string;
  gate_failures: { id: string; name: string }[];
  tokens_spent: number;
  bench_hash: string;
  envelope: "auto" | "proposal";
  applied_to_live: boolean;
}
interface LabSetting { key: string; value: unknown; source: string }

const VERDICT_COLOR: Record<string, string> = { keep: "var(--operational)", discard: "var(--dim)", crash: "var(--alert, #e5484d)" };

/**
 * NIGHT LAB (D-0079): evidence-gated self-experimentation, fully observable.
 * Every experiment — kept, discarded, crashed — straight from the ledger; kept
 * results apply/revert here under the three-envelope rule (persona + pinned
 * settings always ask you first). All real kernel state, nothing simulated.
 */
export default function LabPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [lab, setLab] = useState<LabSetting[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const [e, s] = await Promise.all([
        fetch(`${KERNEL_URL}/lab/experiments?limit=50`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`${KERNEL_URL}/settings`, { cache: "no-store" }).then((r) => r.json()),
      ]);
      setExperiments(e.experiments ?? []);
      setLab((s.settings ?? []).filter((x: LabSetting) => x.key.startsWith("lab.") || x.key === "budget.lab.nightlyTokenCap"));
    } catch { /* kernel unreachable — panel stays empty */ }
  }, []);
  useEffect(() => { void load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);

  async function act(id: string, action: "apply" | "revert", approve = false) {
    setBusy(id);
    try {
      const r = await fetch(`${KERNEL_URL}/lab/experiments/${id}/${action}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(action === "apply" ? { approve } : {}),
      }).then((x) => x.json());
      setNote(r.ok ? `${action}: ok (${(r.applied?.prompts ?? []).concat(r.applied?.settings ?? []).join(", ")})` : `${action} refused: ${r.reason}`);
    } catch (err) {
      setNote(`${action} failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
      await load();
    }
  }

  async function runNight() {
    setBusy("night");
    try {
      const r = await fetch(`${KERNEL_URL}/lab/night`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wait: true }),
      }).then((x) => x.json());
      setNote(r.skipped ? `night skipped: ${r.skipped}` : `night done: ${r.experiments} experiment(s), ${r.kept} kept${r.halted ? ` (halted: ${r.halted})` : ""}`);
    } catch (err) {
      setNote(`night failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
      await load();
    }
  }

  const chip = (text: string, color: string) => (
    <span style={{ border: `1px solid ${color}`, color, borderRadius: 3, padding: "0 0.35rem", fontSize: "0.68rem", marginRight: "0.35rem" }}>{text}</span>
  );
  const meanMetric = (e: Experiment, dim: string) => {
    const vals = e.trials.map((t) => t.scores?.[dim]).filter((v) => typeof v === "number");
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "—";
  };

  return (
    <main style={{ padding: "1.5rem", maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ marginBottom: "0.8rem" }}>
        <h1 style={{ fontSize: "1.05rem", letterSpacing: "0.2em", color: "var(--operational)", margin: 0 }}>J.A.R.V.I.S. — NIGHT LAB</h1>
        <p style={{ color: "var(--dim)", margin: "0.2rem 0 0", fontSize: "0.8rem" }}>
          Evidence-gated self-experimentation (D-0079). Every experiment from the ledger — kept, discarded, crashed.
          Persona and user-pinned changes always require your approval. <a href="/" style={{ color: "var(--operational)" }}>← dashboard</a>
        </p>
      </header>

      <section style={{ marginBottom: "1rem", fontSize: "0.78rem", color: "var(--dim)" }}>
        {lab.map((s) => (
          <span key={s.key} style={{ marginRight: "1rem" }}>
            {s.key} = <span style={{ color: "var(--operational)" }}>{String(s.value)}</span> ({s.source})
          </span>
        ))}
        <button
          onClick={() => void runNight()}
          disabled={busy !== null}
          style={{ marginLeft: "0.5rem", background: "none", border: "1px solid var(--operational)", color: "var(--operational)", borderRadius: 3, padding: "0.15rem 0.6rem", cursor: "pointer", fontSize: "0.75rem" }}
        >
          {busy === "night" ? "running…" : "run a lab night now"}
        </button>
        <span style={{ marginLeft: "0.6rem" }}>(the run still enforces its whole envelope — enabled, quiet hours, caps)</span>
      </section>

      {note && <p style={{ fontSize: "0.78rem", color: "var(--operational)" }}>{note}</p>}

      <section>
        {experiments.length === 0 && <p style={{ color: "var(--dim)", fontSize: "0.8rem" }}>No experiments yet. Enable <code>lab.enabled</code> in settings, or run a night manually.</p>}
        {experiments.map((e) => (
          <div key={e.id} style={{ border: "1px solid var(--line, #333)", borderRadius: 4, padding: "0.5rem 0.7rem", marginBottom: "0.5rem", fontSize: "0.8rem" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" }}>
              {chip(e.verdict.toUpperCase(), VERDICT_COLOR[e.verdict] ?? "var(--dim)")}
              {chip(e.envelope, e.envelope === "proposal" ? "var(--warn, #d4a72c)" : "var(--dim)")}
              {e.applied_to_live && chip("APPLIED TO LIVE", "var(--operational)")}
              <strong>{e.candidate_summary || "(no summary)"}</strong>
              <span style={{ color: "var(--dim)" }}>{new Date(e.started_at).toLocaleString()} · {e.tokens_spent.toLocaleString()} tok · bench {e.bench_hash}</span>
            </div>
            <div style={{ color: "var(--dim)", marginTop: "0.2rem" }}>{e.verdict_reason}</div>
            <div style={{ marginTop: "0.3rem", display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
              {Object.keys(e.baseline ?? {}).map((dim) => (
                <span key={dim} style={{ color: "var(--dim)", fontSize: "0.72rem" }}>
                  {dim}: {e.baseline[dim]} → <span style={{ color: "var(--operational)" }}>{meanMetric(e, dim)}</span>
                </span>
              ))}
              <button onClick={() => setOpen(open === e.id ? null : e.id)} style={{ background: "none", border: "none", color: "var(--operational)", cursor: "pointer", fontSize: "0.72rem" }}>
                {open === e.id ? "hide" : "details"}
              </button>
              {e.verdict === "keep" && !e.applied_to_live && (
                <button
                  onClick={() => void act(e.id, "apply", e.envelope === "proposal")}
                  disabled={busy !== null}
                  style={{ background: "none", border: "1px solid var(--operational)", color: "var(--operational)", borderRadius: 3, padding: "0.1rem 0.5rem", cursor: "pointer", fontSize: "0.72rem" }}
                >
                  {e.envelope === "proposal" ? "approve + apply" : "apply"}
                </button>
              )}
              {e.applied_to_live && (
                <button
                  onClick={() => void act(e.id, "revert")}
                  disabled={busy !== null}
                  style={{ background: "none", border: "1px solid var(--warn, #d4a72c)", color: "var(--warn, #d4a72c)", borderRadius: 3, padding: "0.1rem 0.5rem", cursor: "pointer", fontSize: "0.72rem" }}
                >
                  revert
                </button>
              )}
            </div>
            {open === e.id && (
              <pre style={{ marginTop: "0.4rem", fontSize: "0.7rem", whiteSpace: "pre-wrap", color: "var(--dim)" }}>
                {`hypothesis: ${e.hypothesis || "—"}\ntrials: ${JSON.stringify(e.trials?.map((t) => t.scores), null, 0)}\ngate failures: ${JSON.stringify(e.gate_failures)}`}
              </pre>
            )}
          </div>
        ))}
      </section>
    </main>
  );
}
