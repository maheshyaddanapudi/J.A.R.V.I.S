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
];
