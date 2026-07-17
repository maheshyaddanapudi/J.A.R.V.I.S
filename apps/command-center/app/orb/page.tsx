"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "./orb.css";

const KERNEL_URL = process.env.NEXT_PUBLIC_JARVIS_KERNEL_URL ?? "http://127.0.0.1:4150";

/**
 * Ambient Voice Orb — the functional presence (R-UI-04, "Ambient Voice Orb").
 * Its state is REAL: derived from the kernel's activity SSE stream and the
 * emergency-stop state. Every animation communicates one of these states; the
 * state name + a text sub-label are always shown (never motion/color alone).
 */
type OrbState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "advisory"
  | "critical"
  | "stopped";

const STATE_COLOR: Record<OrbState, string> = {
  idle: "var(--operational)",
  listening: "var(--operational)",
  thinking: "var(--operational)",
  speaking: "var(--operational)",
  advisory: "var(--advisory)",
  critical: "var(--critical)",
  stopped: "var(--critical)",
};

const STATE_LABEL: Record<OrbState, string> = {
  idle: "Standing by",
  listening: "Listening",
  thinking: "Working",
  speaking: "Speaking",
  advisory: "Attention",
  critical: "Fault",
  stopped: "Emergency stop",
};

export default function OrbPage() {
  const [state, setState] = useState<OrbState>("idle");
  const [sub, setSub] = useState<string>("Say “Jarvis”, or use push-to-talk.");
  const [estop, setEstop] = useState(false);
  // allow a ?preview=thinking override so states are inspectable without driving
  // the whole pipeline; live state always wins when not previewing.
  const preview = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("preview") as OrbState | null;
  }, []);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Poll e-stop (authoritative; overrides everything).
  useEffect(() => {
    if (preview) return;
    let stop = false;
    async function poll() {
      try {
        const r = await fetch(`${KERNEL_URL}/core/estop`, { cache: "no-store" });
        const d = await r.json();
        if (!stop) setEstop(Boolean(d.engaged));
      } catch {
        /* kernel down — leave last state */
      }
    }
    void poll();
    const id = setInterval(poll, 1500);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [preview]);

  // Live state from the activity SSE stream.
  useEffect(() => {
    if (preview) return;
    const es = new EventSource(`${KERNEL_URL}/core/activity`);
    const toIdle = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setState("idle"), 1200);
    };
    es.onmessage = (ev) => {
      try {
        const e = JSON.parse(ev.data) as { kind: string; text?: string; message?: string; engaged?: boolean };
        switch (e.kind) {
          case "objective":
            setState("thinking");
            if (e.text) setSub(e.text.slice(0, 120));
            break;
          case "token":
            setState("speaking");
            break;
          case "tool_proposed":
          case "approval_required":
            setState("advisory");
            setSub("Awaiting your approval.");
            break;
          case "model":
          case "tool_result":
          case "verified":
            toIdle();
            break;
          case "estop":
            setEstop(Boolean(e.engaged));
            break;
          case "error":
            setState("critical");
            setSub(e.message ?? "Fault");
            toIdle();
            break;
        }
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, [preview]);

  const effective: OrbState = preview ?? (estop ? "stopped" : state);
  const color = STATE_COLOR[effective];

  return (
    <div className="orb-stage" style={{ ["--state" as string]: color }}>
      <div
        className={`orb state-${effective}`}
        role="status"
        aria-live="polite"
        aria-label={`J.A.R.V.I.S. ${STATE_LABEL[effective]}`}
      >
        <div className="orb-ring" />
        <div className="orb-ring" />
        <div className="orb-ring" />
        <div className="orb-sweep" />
        <div className="orb-core" />
        <div className="orb-bars">
          <span /><span /><span /><span /><span />
        </div>
      </div>
      <div className="orb-label">{STATE_LABEL[effective]}</div>
      <div className="orb-sub">{effective === "stopped" ? "All execution halted. Resume from the Command Center." : sub}</div>

      <button
        className="orb-estop"
        onClick={async () => {
          const path = estop ? "resume" : "engage";
          await fetch(`${KERNEL_URL}/core/estop/${path}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ via: "voice-orb" }),
          });
        }}
      >
        {estop ? "⏹ RESUME" : "⏹ EMERGENCY STOP"}
      </button>
    </div>
  );
}
