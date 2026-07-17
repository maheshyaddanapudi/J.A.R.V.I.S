# DESIGN_SYSTEM — J.A.R.V.I.S. cinematic functional interface

**Status:** PROPOSED — for the **visual design system check-in** (R-UI-01, docs/06).
**Generated:** 2026-07-17. Recreates the FUNCTIONAL visual language of Tony Stark's
interfaces WITHOUT any Marvel IP, movie frames, artwork/logos, actor likenesses,
proprietary sound, or production assets (R-UI-01). Every rule below serves
*function*: no generic neon, no meaningless charts, no fake telemetry, no
decorative motion (R-UI-03).

## 1. Principle: everything communicates state

Every color, motion, and surface exists to convey **state, causality, priority,
relationship, progress, warning, completion, or failure**. If a visual element
can't name which of those it serves, it doesn't ship.

## 2. Color semantics (the operative palette)

| Token | Value | Meaning — used ONLY for this |
|---|---|---|
| `--operational` | cyan `#58c4e8` | nominal / active / operational state |
| `--advisory` | amber `#e8b558` | advisory / attention / degraded |
| `--critical` | red `#e85858` | critical / failure / emergency stop |
| `--focal` | white `#f2f7fa` | the single most important datum in view |
| `--dim` | slate `#7a8b96` | secondary/label text, inactive |
| `--bg` | near-black `#06090d` | deep background (layered glass sits on it) |
| `--surface` | `rgba(16,24,32,0.72)` | translucent layered panel |
| `--line` | `rgba(94,179,217,0.18)` | fine technical grid/borders |

Color is never decorative: a panel is cyan because its subject is operational,
amber because it needs attention, red because it failed. No other hues.

## 3. Typography

Fine technical monospace (`ui-monospace`/SF Mono/JetBrains Mono). Uppercase,
wide letter-spacing (`0.15–0.2em`) for section labels; normal case for data.
Scalable via rem; a single type scale (0.7 / 0.8 / 1.0 / 1.05 rem). Numbers are
tabular. No display/serif faces.

## 4. Surface & depth

Layered transparent surfaces on the dark field; 1px `--line` borders; a 3px
left accent bar in the panel's state color. Depth via translucency + subtle
parallax, never drop-shadow noise. Progressive disclosure: summary first, detail
on focus.

## 5. Motion communicates state (and only state)

| Motion | Means |
|---|---|
| slow breathing pulse (cyan) | idle / present / listening-ready |
| quick concentric ripples | actively listening (wake detected) |
| rotating arc / indeterminate sweep | thinking / working |
| waveform / amplitude bars | speaking |
| steady amber glow | advisory |
| hard red lock + halted ring | emergency stop engaged |
| one-shot check / cross | completion / failure |

Durations 200–1600ms; easing communicates causality (ease-out for arrivals).
**Reduced motion:** `prefers-reduced-motion` replaces every animation with a
static state color + text label — no information is motion-only.

## 6. Accessibility (non-negotiable, R-UI-02)

- Reduced-motion and high-contrast modes; state is ALWAYS also conveyed by color
  + a text label (never motion or color alone — colorblind-safe).
- Scalable type; focus-visible outlines; ARIA roles on live regions.
- Contrast ≥ WCAG AA for text on `--surface`.

## 7. Interface-mode catalog (all real vertical slices — R-UI-04)

Each mode renders live data or a clearly-labeled simulator, never an empty
screen, and every screen exposes the emergency stop.

| Mode | State (2026-07-17) |
|---|---|
| Command Center (browser) | BUILT — live kernel/DB/audit/approvals/activity/memory panels |
| **Ambient Voice Orb** | **BUILT this slice** — functional presence driven by real kernel activity + e-stop |
| Iron-Man-style HUD | Phase 10 (safe equivalents; live data or labeled sim) |
| Workshop | Phase 6 |
| Holotable / Spatial | Phase 6+ |
| Mission Control | Phase 10 |
| Home Control | Phase 5 (device gateway built; UI later) |
| Communications / Intelligence | Phase 4 |
| Health/System Telemetry | System metrics live from Phase 1; personal Phase 11 (no medical diagnosis; inferred health never presented as fact) |

## 8. Prohibited (permanent)

Marvel frames/artwork/logos/SFX/score/actor likeness; generic neon dashboards;
meaningless circular charts; fake code; random telemetry; static movie skins;
unreadable noise; any true empty-air-holography claim.

## Check-in request

Approve (or amend) this design language before Phase-1 UI hardens (R-UI-01). The
Command Center and Voice Orb already use its tokens; approval fixes them as the
system's visual language going forward.
