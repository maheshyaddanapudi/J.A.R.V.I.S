"use client";

import { useEffect, useRef, useState } from "react";

const KERNEL_URL = process.env.NEXT_PUBLIC_JARVIS_KERNEL_URL ?? "http://127.0.0.1:4150";

interface Turn {
  role: "user" | "assistant";
  text: string;
  interrupted?: boolean;
  error?: boolean;
}

/**
 * Text conversation with J.A.R.V.I.S. through the REAL core loop (/core/converse,
 * SSE) — the same gated pipeline the voice path uses, with conversation memory
 * (sessionId) and the injected situational context. No mock replies: tokens are
 * streamed from the model via the kernel; a model/transport failure is shown as
 * an honest error turn, never a fabricated answer. Persistent e-stop halts a
 * stream mid-flight (R-CORE-02, R-SEC-03).
 */
export default function ChatPage() {
  const [sessionId, setSessionId] = useState<string>("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [estop, setEstop] = useState(false);
  const [contextText, setContextText] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setSessionId(crypto.randomUUID());
  }, []);

  // Poll e-stop + the situational context the loop injects, so the user can see
  // "what J.A.R.V.I.S. knows" feeding the conversation.
  useEffect(() => {
    let stop = false;
    async function poll() {
      try {
        const [e, c] = await Promise.all([
          fetch(`${KERNEL_URL}/core/estop`, { cache: "no-store" }).then((r) => r.json()),
          fetch(`${KERNEL_URL}/context`, { cache: "no-store" }).then((r) => r.json()),
        ]);
        if (stop) return;
        setEstop(Boolean(e.engaged));
        setContextText(c.describe ?? "");
      } catch {
        /* ignore — chat still works if these fail */
      }
    }
    void poll();
    const id = setInterval(poll, 3000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [turns]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setTurns((t) => [...t, { role: "user", text }, { role: "assistant", text: "" }]);
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch(`${KERNEL_URL}/core/converse`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, source: "command-center", sessionId }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(`kernel HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // SSE frames are separated by a blank line.
        const frames = buf.split("\n\n");
        buf = frames.pop() ?? "";
        for (const frame of frames) applyFrame(frame, setTurns);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTurns((t) => appendToLastAssistant(t, `\n[error: ${message}]`, { error: true }));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  async function toggleEstop() {
    if (estop) {
      await fetch(`${KERNEL_URL}/core/estop/resume`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ via: "command-center" }),
      });
    } else {
      abortRef.current?.abort();
      await fetch(`${KERNEL_URL}/core/estop/engage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ via: "command-center" }),
      });
    }
  }

  return (
    <main style={{ padding: "1.5rem", maxWidth: 820, margin: "0 auto", height: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
        <div>
          <h1 style={{ fontSize: "1.05rem", letterSpacing: "0.2em", color: "var(--operational)", margin: 0 }}>
            J.A.R.V.I.S. — CONVERSE
          </h1>
          <p style={{ color: "var(--dim)", margin: "0.2rem 0 0", fontSize: "0.8rem" }}>
            real core loop · memory + context · <a href="/" style={{ color: "var(--operational)" }}>dashboard</a>{" "}
            · <a href="/orb" style={{ color: "var(--operational)" }}>orb</a>
          </p>
        </div>
        <button
          onClick={toggleEstop}
          style={{
            background: "transparent",
            border: "1px solid var(--critical)",
            color: "var(--critical)",
            padding: "0.6rem 1rem",
            fontFamily: "var(--mono)",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {estop ? "⏹ STOPPED — RESUME" : "⏹ EMERGENCY STOP"}
        </button>
      </header>

      {contextText && (
        <details style={{ marginBottom: "0.6rem", background: "var(--surface)", border: "1px solid var(--line)", padding: "0.5rem 0.8rem" }}>
          <summary style={{ color: "var(--dim)", cursor: "pointer", fontSize: "0.78rem" }}>
            what J.A.R.V.I.S. knows right now (injected context)
          </summary>
          <pre style={{ whiteSpace: "pre-wrap", color: "var(--dim)", fontSize: "0.75rem", margin: "0.4rem 0 0" }}>
            {contextText}
          </pre>
        </details>
      )}

      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: "auto", border: "1px solid var(--line)", background: "var(--surface)", padding: "0.8rem 1rem" }}
      >
        {turns.length === 0 && (
          <div style={{ color: "var(--dim)" }}>Good day, sir. How may I help?</div>
        )}
        {turns.map((t, i) => (
          <div key={i} style={{ marginBottom: "0.7rem" }}>
            <div style={{ color: t.role === "user" ? "var(--focal)" : "var(--operational)", fontSize: "0.72rem", letterSpacing: "0.1em" }}>
              {t.role === "user" ? "YOU" : "J.A.R.V.I.S."}
            </div>
            <div style={{ color: t.error ? "var(--critical)" : "var(--focal)", whiteSpace: "pre-wrap" }}>
              {t.text || (busy && t.role === "assistant" ? "…" : "")}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void send(); }}
          placeholder={estop ? "emergency stop engaged — resume to talk" : "type to J.A.R.V.I.S.…"}
          disabled={busy || estop}
          style={{
            flex: 1,
            background: "var(--bg)",
            border: "1px solid var(--line)",
            color: "var(--focal)",
            fontFamily: "var(--mono)",
            padding: "0.6rem 0.8rem",
          }}
        />
        <button
          onClick={() => void send()}
          disabled={busy || estop || input.trim() === ""}
          style={{
            background: "transparent",
            border: "1px solid var(--operational)",
            color: "var(--operational)",
            padding: "0.6rem 1.2rem",
            fontFamily: "var(--mono)",
            cursor: busy ? "default" : "pointer",
            opacity: busy || estop || input.trim() === "" ? 0.4 : 1,
          }}
        >
          {busy ? "…" : "send"}
        </button>
      </div>
    </main>
  );
}

function applyFrame(frame: string, setTurns: React.Dispatch<React.SetStateAction<Turn[]>>) {
  const lines = frame.split("\n");
  const event = lines.find((l) => l.startsWith("event:"))?.slice(6).trim();
  const dataLine = lines.find((l) => l.startsWith("data:"))?.slice(5).trim();
  if (event === "done") return;
  if (event === "error") {
    let msg = "stream error";
    try { msg = (JSON.parse(dataLine ?? "{}") as { message?: string }).message ?? msg; } catch { /* keep */ }
    setTurns((t) => appendToLastAssistant(t, `\n[error: ${msg}]`, { error: true }));
    return;
  }
  if (!dataLine) return;
  try {
    const payload = JSON.parse(dataLine) as { type?: string; text?: string };
    if (payload.type === "token" && payload.text) {
      setTurns((t) => appendToLastAssistant(t, payload.text!));
    }
  } catch {
    /* ignore non-JSON keepalives */
  }
}

function appendToLastAssistant(turns: Turn[], text: string, flags: Partial<Turn> = {}): Turn[] {
  const copy = [...turns];
  for (let i = copy.length - 1; i >= 0; i--) {
    if (copy[i]!.role === "assistant") {
      copy[i] = { ...copy[i]!, text: copy[i]!.text + text, ...flags };
      break;
    }
  }
  return copy;
}
