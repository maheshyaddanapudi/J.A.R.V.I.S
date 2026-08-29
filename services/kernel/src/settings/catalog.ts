import type { SettingSpec } from "./registry.js";
import { DEFAULT_GATES } from "../proactive/types.js";

/**
 * The editable-settings CATALOG (D-0058). Every entry is a knob the Command
 * Center can edit at runtime. Defaults are read LIVE from the code/config
 * constants, so an un-overridden key always reflects the current default.
 *
 * To make a new value user-editable: add it here and read it via the
 * SettingsRegistry where it's consumed. NOTHING from the Z1 trust core
 * (policy/approval/audit/e-stop/credentials/sandbox) appears here — the catalog
 * is the allowlist (R-CAP-08).
 */
export const SETTINGS_CATALOG: SettingSpec[] = [
  // ---- Proactivity gates (were hardcoded in DEFAULT_GATES) ----
  {
    key: "proactive.quietHours.enabled",
    label: "Quiet hours enabled",
    category: "Proactivity",
    type: "boolean",
    default: () => DEFAULT_GATES.quietHours !== null,
    description: "Suppress non-critical proactive items during quiet hours (critical always speaks).",
  },
  {
    key: "proactive.quietHours.start",
    label: "Quiet hours start (hour)",
    category: "Proactivity",
    type: "hour",
    min: 0,
    max: 23,
    default: () => DEFAULT_GATES.quietHours?.start ?? 22,
    description: "Hour (0–23, local) quiet hours begin.",
  },
  {
    key: "proactive.quietHours.end",
    label: "Quiet hours end (hour)",
    category: "Proactivity",
    type: "hour",
    min: 0,
    max: 23,
    default: () => DEFAULT_GATES.quietHours?.end ?? 7,
    description: "Hour (0–23, local) quiet hours end.",
  },
  {
    key: "proactive.confidenceThreshold",
    label: "Minimum confidence",
    category: "Proactivity",
    type: "number",
    min: 0,
    max: 1,
    step: 0.05,
    default: () => DEFAULT_GATES.confidenceThreshold,
    description: "Proactive items below this confidence are suppressed.",
  },
  {
    key: "proactive.rateLimit.max",
    label: "Max items per window",
    category: "Proactivity",
    type: "number",
    min: 1,
    max: 100,
    step: 1,
    default: () => DEFAULT_GATES.rateLimit.max,
    description: "Most proactive items surfaced within the rate-limit window.",
  },
  {
    key: "proactive.rateLimit.windowMinutes",
    label: "Rate-limit window (minutes)",
    category: "Proactivity",
    type: "number",
    min: 1,
    max: 1440,
    step: 5,
    default: () => DEFAULT_GATES.rateLimit.windowMinutes,
    description: "Length of the rate-limit window.",
  },
  {
    key: "proactive.minPriority",
    label: "Minimum priority",
    category: "Proactivity",
    type: "enum",
    options: ["low", "medium", "high", "critical"] as const,
    default: () => DEFAULT_GATES.minPriority,
    description: "Proactive items below this priority are suppressed.",
  },

  // ---- Background autonomy (D-0024, approved; default OFF — one toggle on) ----
  {
    key: "autonomy.enabled",
    label: "Background autonomy",
    category: "Autonomy",
    type: "boolean",
    default: () => false,
    description: "Let J.A.R.V.I.S. run its safe cycles on a schedule (proactivity + sleep-cycle). Still never acts consequentially without approval; e-stop halts it.",
  },
  {
    key: "autonomy.intervalMinutes",
    label: "Autonomy interval (minutes)",
    category: "Autonomy",
    type: "number",
    min: 1,
    max: 1440,
    step: 5,
    default: () => 30,
    description: "How often the background cycles run.",
  },
  {
    key: "autonomy.runProactive",
    label: "Autonomy: run proactivity",
    category: "Autonomy",
    type: "boolean",
    default: () => true,
    description: "Compute + surface proactive suggestions on each tick (suggestion-only).",
  },
  {
    key: "autonomy.runSleepCycle",
    label: "Autonomy: run sleep-cycle",
    category: "Autonomy",
    type: "boolean",
    default: () => true,
    description: "Run bounded self-calibration + proposals on each tick.",
  },

  // ---- Reasoning / generation defaults (mirror the JARVIS_EFFORT/THINKING env,
  //      surfaced for UI editing; the gateway reads env at load, these give a
  //      visible, editable home for the same intent) ----
  {
    key: "affect.enabled",
    label: "Emotional attunement (affect)",
    category: "Persona",
    type: "boolean",
    default: () => false,
    description: "OFF by default. When on, J.A.R.V.I.S. reads tone/stress from YOUR OWN WORDS (never camera/mic) and gently adjusts its reply tone. It shows you what it sensed; it never gates what it will do and never stores a judgment about you.",
  },
  {
    key: "announce.holdInQuietHours",
    label: "Hold non-urgent announcements in quiet hours",
    category: "Autonomy",
    type: "boolean",
    default: () => true,
    description: "When on, J.A.R.V.I.S. queues non-urgent announcements during quiet hours and surfaces them after; 'urgent' always breaks through.",
  },

  // ---- Spend governance (D-0066): self-restraint on autonomous cost ----
  {
    key: "budget.autonomy.dailyTokenCap",
    label: "Autonomy daily token cap",
    category: "Autonomy",
    type: "number",
    min: 0,
    max: 100000000,
    step: 10000,
    default: () => 500000,
    description: "Max model tokens autonomy (heartbeat + sleep) may spend per rolling 24h. 0 = unlimited. When reached, background thinking pauses; live conversation is never blocked.",
  },
  {
    key: "budget.dailyTokenCap",
    label: "Overall daily token cap (advisory)",
    category: "Autonomy",
    type: "number",
    min: 0,
    max: 1000000000,
    step: 100000,
    default: () => 0,
    description: "Max total model tokens per rolling 24h. 0 = unlimited. Over this, autonomy pauses and a warning surfaces — a live conversation is still served.",
  },

  // ---- Heartbeat (D-0064): J.A.R.V.I.S.'s own time between conversations ----
  {
    key: "heartbeat.brain",
    label: "Heartbeat thinking",
    category: "Autonomy",
    type: "enum",
    options: ["off", "when-agenda", "every-tick"] as const,
    default: () => "when-agenda",
    description: "When the heartbeat consults the model brain: never, only when agenda items are due, or on every tick. Consequential actions are always denied on a heartbeat and queued for you.",
  },
  {
    key: "heartbeat.maxSteps",
    label: "Heartbeat step budget",
    category: "Autonomy",
    type: "number",
    min: 2,
    max: 12,
    step: 1,
    default: () => 6,
    description: "Maximum tool steps one heartbeat's thinking may take.",
  },
  {
    key: "heartbeat.privacy",
    label: "Heartbeat privacy class",
    category: "Autonomy",
    type: "enum",
    options: ["LOCAL_ONLY", "STANDARD"] as const,
    default: () => "LOCAL_ONLY",
    description: "LOCAL_ONLY keeps heartbeat thinking on local models (default, local-first); STANDARD allows configured remote providers.",
  },

  {
    key: "heartbeat.deferWhileActiveMinutes",
    label: "Defer heartbeat while I'm active (min)",
    category: "Autonomy",
    type: "number",
    min: 0,
    max: 60,
    step: 1,
    default: () => 5,
    description: "Skip the heartbeat's thinking pass if you interacted within this many minutes (0 = never defer). Keeps beats from competing with a live session.",
  },
  {
    key: "heartbeat.freshnessCheck",
    label: "Freshness-check agenda before acting",
    category: "Autonomy",
    type: "boolean",
    default: () => true,
    description: "Before a heartbeat works its agenda, a fast-model review compares each item against what happened since it was written (newer conversations, corrected facts) and flags stale ones so J.A.R.V.I.S. reconciles with current truth instead of acting on old instructions. Advisory — nothing is silently dropped.",
  },
  {
    key: "sleep.useQuietHours",
    label: "Deep consolidation only in quiet hours",
    category: "Autonomy",
    type: "boolean",
    default: () => false,
    description: "When on, the sleep cycle (incl. memory consolidation) runs only inside the quiet-hours window (proactive.quietHours.start/end) — deep work while you sleep. Off = it runs on every heartbeat. On-demand runs are unaffected.",
  },

  // ---- Memory consolidation (D-0063): quiet-hours tidy-up thresholds ----
  {
    key: "memory.consolidation.overlap",
    label: "Fact-merge overlap threshold",
    category: "Memory",
    type: "number",
    min: 0.5,
    max: 0.95,
    step: 0.05,
    default: () => 0.7,
    description: "How similar two facts about the same entity must be (content-word overlap) before the sleep cycle merges the older into the newer. Higher = more conservative.",
  },
  {
    key: "memory.consolidation.staleDays",
    label: "Stale-memory review age (days)",
    category: "Memory",
    type: "number",
    min: 7,
    max: 365,
    step: 1,
    default: () => 90,
    description: "Entities unused for this many days are PROPOSED for review during the sleep cycle — never auto-forgotten.",
  },
  {
    key: "tools.validateArgs",
    label: "Validate tool arguments against their schema",
    category: "Core",
    type: "boolean",
    default: () => false,
    description:
      "When on, every gated tool call is checked against the tool's declared input schema before disclosure/approval; a malformed call is refused with a field-level message ('missing required property statement') instead of failing inside the tool. Off = current behavior (the loop still contains any failure — nothing crashes either way). Default set by measurement, not opinion: see the arg-validation experiment in docs/verification/.",
  },
  {
    key: "memory.llmJudgment",
    label: "Use the fast model for memory judgments",
    category: "Memory",
    type: "boolean",
    default: () => true,
    description: "When on, J.A.R.V.I.S. asks the fast model whether a similarly-named mention is the SAME entity ('Pepper' ⇄ 'Pepper Potts') and which facts restate each other, instead of relying on string heuristics. Best-effort: private/secret memory stays local, and it always falls back to the deterministic logic when no local model is available (offline). Turning this off costs only quality, never correctness: name variants may become separate entities, and fact merging / learned-topic extraction fall back to word-overlap heuristics — nothing errors, and every write still lands (live-verified keyless 2026-08-29).",
  },

  {
    key: "reasoning.defaultEffort",
    label: "Default reasoning effort (remote)",
    category: "Reasoning",
    type: "enum",
    options: ["low", "medium", "high", "xhigh", "max"] as const,
    default: () => (process.env.JARVIS_EFFORT as string) || "high",
    description: "Preferred effort for remote reasoning-capable models when a role target does not set its own.",
  },
  {
    key: "reasoning.defaultThinking",
    label: "Default extended thinking (remote)",
    category: "Reasoning",
    type: "enum",
    options: ["on", "off"] as const,
    default: () => (process.env.JARVIS_THINKING as string) || "on",
    description: "Whether remote reasoning models think by default when a role target does not set its own.",
  },

  // ---- Night Lab (D-0079; default OFF — enabling was the check-in) ----
  // NOTE: these three are on LAB_FORBIDDEN_SETTING_PREFIXES — the lab can
  // never edit its own envelope; only the user (UI/API/instruction) can.
  {
    key: "lab.enabled",
    label: "Night Lab enabled",
    category: "Night Lab",
    type: "boolean",
    default: () => false,
    description: "Evidence-gated self-experimentation during quiet hours: propose one change on the whitelisted surface, measure it on the isolated lab instance, keep or revert on the evidence, report in the morning. The e-stop halts it; every experiment is ledgered.",
  },
  {
    key: "lab.campaign",
    label: "Active lab campaign",
    category: "Night Lab",
    type: "enum",
    // Options are the APPROVED campaign contracts committed under
    // bench/campaigns/ — a new campaign becomes selectable only via a commit
    // (committed = accepted, per the D-0079 check-in).
    options: ["persona-adherence"] as const,
    default: () => "persona-adherence",
    description: "Which approved campaign the Night Lab runs. One campaign per night.",
  },
  {
    key: "budget.lab.nightlyTokenCap",
    label: "Night Lab nightly token cap",
    category: "Night Lab",
    type: "number",
    min: 0,
    max: 10000000,
    step: 50000,
    default: () => 300000,
    description: "Max model tokens one lab night may spend (baseline + all trials, measured from bench telemetry). The lab halts between experiments when reached; the overall autonomy cap still applies above this.",
  },
];
