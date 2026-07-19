# CAPABILITY_PARITY_MATRIX — J.A.R.V.I.S. (MCU) → this system

**Status:** DRAFT — pending Phase 0 check-in approval
**Generated:** 2026-07-16 (Phase 0) · **Living document** — updated at every phase gate; no row may be removed without an explanation recorded here and surfaced at a check-in (R-CLASS-03, R-SCOPE-01).

## State definitions (five-state; every capability is exactly one) — R-CLASS-01

| State | Meaning |
|---|---|
| **REAL** | Working functionality, implemented for real in its target phase. |
| **HARDWARE-DEPENDENT** | Production-quality typed adapter interface exists/planned; runs against a tested simulator until the hardware is owned; becomes REAL when hardware is added. |
| **SIMULATED** | Capability is fictional, unsafe, illegal, or depends on unavailable private systems — implemented as a clearly-marked SIMULATION adapter behind the same typed contract; permanently displays SIMULATION state; never presented as live. |
| **DEFERRED** | Achievable but sequenced to a later phase; prerequisites and target phase recorded; deferral ≠ removal. |
| **PROHIBITED** | Will not be built, with documented reasoning (illegal, unsafe, rights-violating, or on the non-negotiable prohibited list R-AUTO-04). |

**Sources.** Film abbreviations: IM1 = *Iron Man* (2008), IM2 = *Iron Man 2* (2010), AV = *The Avengers* (2012), IM3 = *Iron Man 3* (2013), AoU = *Avengers: Age of Ultron* (2015). Scene references are descriptive (no script excerpts). Platform/hardware claims cite `docs/RESEARCH_VERIFICATION.md` (verified 2026-07-16).

---

## A. Conversation, persona & voice

| ID | Movie capability (source) | Real-world equivalent | State | Phase | Notes |
|---|---|---|---|---|---|
| A1 | Natural spoken dialogue with dry, understated wit (IM1 workshop scenes; AV; AoU throughout) | Full-duplex streaming voice conversation with persona-tuned responses | **REAL** | 1 | Local STT/TTS/LLM; persona config for formality/length/urgency. |
| A2 | Restrained British-butler voice (all films) | Distinct British-style **synthetic** voice | **REAL** | 1 | Open-source TTS voice; see ARCHITECTURE §6. |
| A3 | Voice cloned from/imitating Paul Bettany | — | **PROHIBITED** | — | Rights violation; explicitly banned by R-VOICE-11. A2 delivers the experience lawfully. |
| A4 | Instant hands-free summoning — Tony just says "Jarvis" (IM1/IM2 workshop) | Local always-listening wake word "Jarvis" + push-to-talk + text | **REAL** | 1 | openWakeWord-class engine; metrics per R-VOICE-09. |
| A5 | Tony interrupts mid-sentence and J.A.R.V.I.S. yields (IM1/IM2 banter) | Barge-in ≤ 300 ms with echo cancellation | **REAL** (logic) + **HARDWARE-DEPENDENT** (echo-cancel device path) | 1 | Turn-taking/barge-in state machine built + tested in-container; echo-cancelled live capture is the macOS VPIO Swift adapter (`apps/companion/swift/`, source complete, builds on Mac) behind the AudioIO contract — tested `BufferAudioIO` simulator stands in until run on the Mac. |
| A6 | Knows it's Tony speaking (implicit, all films) | Local speaker verification (enrolled owner) | **REAL** | 1 (optional gate) | Never sole gate for consequential actions (T6). |
| A7 | Discreet/quiet responses in company (IM2 party, AV) | Whisper/quiet/text-only modes | **REAL** | 1 | R-VOICE-06. |
| A8 | Speaks unprompted with useful warnings ("power at 400% capacity", IM1 flight test) | Proactive spoken alerts, gated and sparse | **REAL** | 4 | Quiet hours, confidence thresholds, rate limits (R-PRO-02). **Engine built+verified 2026-07-17:** commitment/deadline/conflict/briefing generators + full gate stack + "why" + audit; live delivery gated on the check-in (D-0024). |
| A9 | Morning briefing on wake ("Good morning…" IM1 Malibu house) | Morning/evening briefings from configured sources | **REAL** | 4 | Approval-scoped integrations only. |

## B. Contextual awareness & perception

| ID | Movie capability (source) | Real-world equivalent | State | Phase | Notes |
|---|---|---|---|---|---|
| B1 | Knows what Tony is working on right now (IM1/IM2 workshop) | Active app/window/selection context via Accessibility + screen understanding | **REAL** | 2 | Permission-scoped; TCC-gated (screen recording permission). **Aggregation substrate BUILT+VERIFIED 2026-07-17** (`kernel/src/context/`, D-0029): read-only `ContextService` folds time-of-day, open/overdue commitments, pending approvals, recent proactive items, non-sensitive pinned memory, e-stop + MCP-server count into a labeled reference block injected into every conversation; `GET /context`. The Accessibility/screen active-app signal is a Mac-only `ContextProvider` that plugs into the same contract (TCC-gated). |
| B2 | Sees the room / where people are (IM1 mansion) | Camera-based room presence via webcam/room cameras with always-on indicators | **HARDWARE-DEPENDENT** | 5+ | Owner has no room cameras yet; simulator + typed CameraProvider contract first; privacy rules T13. |
| B3 | Understands objects shown to camera (IM1 suit parts) | Local vision models on webcam/screen images | **REAL** | 2 | Vision role in model gateway. |
| B4 | Reads Tony's emotional state (implied, IM3) | Affect/state inference — **opt-in, constrained**: voice-prosody at Phase 4 (modulates tone/timing/proactivity ONLY — never gates or triggers consequential actions), camera-based revisited at Phase 6; always labeled `inferred`; local-only; privacy indicator when camera-based | **REAL** (opt-in) | 4 (voice) / 6 (camera revisit) | Reclassified from DEFERRED at the 2026-07-17 check-in (D-0019). **Text-only layer BUILT+VERIFIED 2026-07-19 (D-0072):** `inferAffect` — deterministic, transparent, from the user's own words; off by default; nudges reply TONE only (never a gate, never stored, surfaces which signals fired); wired into `/core/converse` (SSE `affect` event). Voice-prosody + camera on the Mac. Health-adjacent constraint stands: never presented as fact. |
| B5 | Tracks Tony's vitals in the suit (IM3 HUD) | Wearable vitals via HealthKit/Apple Watch, authorized data only | **HARDWARE-DEPENDENT** | 11 | No medical diagnosis; never presents inferred health as fact. **User owns Apple Watch + iPhone (recorded 2026-07-17)** — buildable at Phase 11 without purchase. |
| B6 | Whole-home hearing/presence (IM1 house-wide) | Satellite mic/speaker nodes | **HARDWARE-DEPENDENT** | 5/12 | Typed AudioNode contract + simulator until hardware. |

## C. Computer operations & information work

| ID | Movie capability (source) | Real-world equivalent | State | Phase | Notes |
|---|---|---|---|---|---|
| C1 | Instantly pulls up files, schematics, footage (IM1/IM2/IM3) | Local file/document/repo/image search & analysis | **REAL** | 2 | Indexed with provenance; permission-scoped paths. **Built 2026-07-17 (D-0032):** REAL workspace-scoped files capability (`kernel/src/knowledge/`) — list/read/stat/search READ_ONLY + reversible gated `files.edit`; path-safe, binary/oversize-refusing, bounded; local/offline; agent-composable. 17 tests + live + harness `P-KNOW-01`. Remaining C1: content indexing/embeddings, image analysis, browser-sourced research. |
| C2 | Operates the computer for Tony (implied constantly) | Full macOS control: Accessibility UI-tree, apps, windows, clipboard, keyboard/mouse, files, terminal, AppleScript/JXA, Shortcuts | **REAL** | 1 (one reversible action) / 2 (full) | Semantic-first; approval-gated; audited; reversible where possible. **Phase-2 foundation built 2026-07-17:** typed control HAL + SIMULATION adapter verified through the gated loop in-container (10 tests, live approve/deny/audit); real macOS adapter source (`MacDesktop.swift`, AXUIElement/CGEvent) written; real-adapter activation gated on the "enable computer control" check-in (D-0022). **Terminal built REAL 2026-07-17 (D-0035):** `kernel/src/terminal/` — `terminal.inspect` (READ_ONLY safe allowlist) + `terminal.run` (CONSEQUENTIAL, per-command approval), command-safety policy (denylist refuses dangerous/prohibited outright), workspace-scoped, output never audited; 14 tests + live + harness `P-TERM-01`. The AX/window/clipboard portion stays SIMULATION until D-0022; the terminal + files portions are REAL in-container now. |
| C3 | Browses/researches across the public web (IM3 Mandarin investigation) | Browser automation + research pipeline with per-claim provenance | **REAL** | 2 | Playwright/CDP; domain allowlists; untrusted-content envelopes. **Built 2026-07-17:** REAL headless-browser (`kernel/src/web/`, D-0034) — `web.open`/`readText`/`links`/`screenshot`/`fill`/`click`, network policy (http/https, offline refuses external, allowlist), page content never audited (8 tests, `P-WEB-01`). **Research pipeline with per-claim provenance (`kernel/src/research/`, D-0036):** `research.gather` composes the gated browser into ONE sourced-evidence action — passages tagged `{url,title,line,snippet}`, fed to the agent to cite; refused source recorded not fabricated (6 tests, `P-RESEARCH-01`). Remaining C3: per-source untrusted-content envelope, citation-check pass. |
| C4 | Cross-references huge datasets to find patterns (IM3 crime-scene reconstruction; AV Loki search) | Multi-source analysis over **authorized** data with entity/relationship memory | **REAL** | 4 | Intelligence mode; only configured sources — see C5. |
| C5 | Hacks government/military/private systems (IM2 breaking into military DBs; AoU nuclear codes defense) | — | **PROHIBITED** | — | Illegal unauthorized access; on the R-AUTO-04 prohibited list. Authorized-API research (C3/C4) provides the lawful equivalent. |
| C6 | Monitors global news/media feeds (IM3) | Configured feed/topic monitoring with alerts | **REAL** | 4 | Rate-limited, provenance-labeled. |
| C7 | Manages calls/messages, screens comms (IM1/IM2) | Mail/calendar/messaging integrations; drafting, triage, screening | **REAL** (integration-dependent scope) | 4 | Sending is CONSEQUENTIAL → approval. Phone-call audio control only where an API the user configures permits it. |
| C8 | Runs schedule, reminders, deadlines (IM2 birthday remark) | Calendar/commitment/deadline tracking | **REAL** | 4 | |
| C9 | Executes long multi-step operations unattended (IM3 suit rebuild queue) | Durable long-running tasks with checkpoints, approvals, and Mission Control view | **REAL** | 3/10 | Budgets + delegation limits (T12). |

## D. Workshop, engineering & holograms

| ID | Movie capability (source) | Real-world equivalent | State | Phase | Notes |
|---|---|---|---|---|---|
| D1 | 3D "holographic" models floating in the workshop (IM1 Mark II design; AoU Ultron/vision core) | Interactive 3D scenes on screen / projector / XR headsets / light-field displays via Spatial Scene Service | **REAL** (flat/XR paths) + **HARDWARE-DEPENDENT** (light-field/volumetric) | 6–9 | Display classes labeled honestly (R-SPA-04). |
| D2 | True empty-air volumetric holograms touchable without any device (IM1/IM2) | — | **PROHIBITED** (as claimed) | — | Physically impossible with current/announced tech; claiming it violates honesty rule. Functional parity delivered by D1; row stays to document the gap. |
| D3 | Grab/rotate/scale/toss 3D models by hand (IM1 "throw it in the bin"; IM2 Expo model) | Hand-tracked manipulation: webcam (MediaPipe), Quest/Vision Pro hand tracking, mouse fallback | **REAL** | 6 (webcam+mouse) / 7+ (XR) | Verified APIs in RESEARCH_VERIFICATION; graceful degradation R-SPA-02. |
| D4 | Voice-driven CAD edits ("add exoskeleton", IM1) | Parametric CAD ops by voice on open formats | **REAL** | 6 | Open-source CAD kernel integration; scope per plan. |
| D5 | Physics/flight simulation & analysis (IM1 icing problem; IM2 element sim) | Simulation environments + digital twins | **REAL** (as simulation tooling) | 6/10 | Simulations are labeled simulations — they are the *product* here, not a stand-in. |
| D6 | Controls fabrication robots to build the suit (IM1/IM3 assembly arms) | Fabrication adapters (3D printer/CNC/robot arm) behind typed contracts | **HARDWARE-DEPENDENT** | 5/10 | No fab hardware owned; interlocks required (T8); simulator first. |
| D7 | Synthesizes a new element (IM2 vibranium arc) | — | **SIMULATED** | 10 | Fictional physics; lives in the armor/science simulator, permanently labeled SIMULATION. |
| D8 | Dum-E/U robot-arm assistants (IM1/IM2) | ROS 2 robot-arm adapter + simulator | **HARDWARE-DEPENDENT** | 5/10 | Catalog candidates researched before any purchase check-in. |

## E. Home & environment control

| ID | Movie capability (source) | Real-world equivalent | State | Phase | Notes |
|---|---|---|---|---|---|
| E1 | Lights, climate, glass, music, house systems (IM1/IM2 Malibu) | Home Assistant-backed device control (MQTT/Matter/Zigbee/Z-Wave) | **HARDWARE-DEPENDENT** | 5 | Owner's current device inventory unknown → catalog + Stark-residence **simulator** (labeled) first; real devices when configured. **Foundation built+verified 2026-07-17:** device gateway HAL + Stark-residence SIMULATION + policy gating + real HA adapter source; HIGH_RISK_PHYSICAL (locks/garage/utilities) require approval + single-use hardware interlock (verified live); real gateway gated on the check-in (D-0025). |
| E2 | House security monitoring & lockdown (IM3 mansion attack) | Alarm/camera/lock integrations with per-action approval | **HARDWARE-DEPENDENT** | 5 | HIGH-RISK actions (locks) need approval + interlocks. **Interlock enforcement built+verified 2026-07-17** (`devices/interlock.ts`): lock/garage/utility commands refuse without a single-use armed interlock, even when approved. |
| E3 | Whole-house ambient presence (all films) | Multi-room satellite nodes (mic/speaker/display) | **HARDWARE-DEPENDENT** | 11/12 | Trusted local-network pairing only. |
| E4 | Fire-suppression/utility control (IM1 workshop mishaps) | Utility-device adapters where real devices exist | **HARDWARE-DEPENDENT** | 5 | Never autonomous; per-action approval. |

## F. HUD & mission systems

| ID | Movie capability (source) | Real-world equivalent | State | Phase | Notes |
|---|---|---|---|---|---|
| F1 | In-helmet HUD: telemetry, comms, nav, diagnostics (IM1–IM3, AV) | Iron-Man-style HUD interface (desktop/XR) fed by live system data or labeled simulators | **REAL** | 10 | Functional visual language only; no movie assets (R-UI-01). |
| F2 | Weapons targeting & fire control (IM1 Gulmira; AV) | — | **PROHIBITED** | — | Autonomous weapons / targeting are on the non-negotiable prohibited list. Safe equivalents: F3. |
| F3 | Target lock → safe equivalents (object selection, inspection, navigation, search regions, robotics/drone test targets, rescue planning, structural/environmental analysis, diagnostics) | Safe-equivalent HUD modes | **REAL** (data-source-dependent) | 10 | Real sensors where owned; labeled simulators otherwise. |
| F4 | Flight control & autopilot of the suit (IM1) | Flight-dynamics **simulator**; safe real drone plugin where legal & owned | **SIMULATED** + **HARDWARE-DEPENDENT** (drone) | 10 | Real drone control = consequential physical action (approval + interlocks + local regs). |
| F5 | Remote piloting of empty suits (IM3 House Party Protocol) | Multi-agent teleoperation of **simulated** units; real robots only if ever owned & safe | **SIMULATED** | 10 | Autonomous armed operation would be PROHIBITED; simulation is labeled. |
| F6 | Combat threat assessment (AV New York) | Scenario analysis inside mission **simulator** | **SIMULATED** | 10 | Real-world "threat assessment" of people is prohibited surveillance. |
| F7 | Suit-up / deployment sequences (IM3 MK42) | Armor-systems simulator sequences | **SIMULATED** | 10 | Fictional hardware. |
| F8 | Rescue planning & structural analysis (AV civilian evac; IM3) | Planning tools over maps/building data user configures + simulator scenarios | **REAL** (tooling) / **SIMULATED** (scenarios) | 10 | |

## G. Multi-agent, self-extension & platform

| ID | Movie capability (source) | Real-world equivalent | State | Phase | Notes |
|---|---|---|---|---|---|
| G1 | Delegates to subsystems/other AIs (AoU Iron Legion coordination) | Multi-agent orchestration with registries, budgets, delegation-depth limits | **REAL** | 3 | Mission Control view Phase 10. |
| G2 | Upgrades/extends its own capabilities (implied: evolving suit software IM1→AoU) | Two-stage self-extension: Stage A generate-without-activate → security check-in → Stage B controlled activation, versioned, rollbackable | **REAL** | 3 | HIGHEST-RISK subsystem; dedicated check-in mandatory (R-CAP-05). **Stage A built+verified 2026-07-17:** hard limit (R-CAP-08), guard, registry, generate-without-activate. **Stage B built+verified 2026-07-19 (D-0073 APPROVED):** activation as a `capability:<name>` gated tool that COMPOSES existing gated tools (never manifest code, never Z1); R-CAP-08 re-validated at activation; propose→approve→activate (J.A.R.V.I.S. proposes on its own initiative, user approves through any interface via the CONSEQUENTIAL activate gate — nothing self-activates); deactivation always available; durable across restart. Live: malicious capability REJECTED + never activatable; benign one activated → composition ran through the gated loop; heartbeat can propose but not activate. |
| G3 | Modifies its own core/safety systems autonomously (Ultron's self-modification, AoU — the cautionary source) | — | **PROHIBITED** | — | Hard limit R-CAP-08: generated capabilities can never touch security/approval/audit/e-stop/credential/sandbox/installer logic. **ENFORCED + tested 2026-07-17** (`selfext/protected.ts`): deny-first structural rejection of any protected-path/permission/symbol touch; verified live. |
| G4 | Survives attack via hidden distributed copies (AoU JARVIS hiding in the net) | Local verified backup/restore + integrity checking | **REAL** (local) / **PROHIBITED** (covert net-wide persistence) | 1 (backup) / — | Hidden persistence is on the prohibited list; local backups deliver the survivability. |
| G5 | Becomes a new being / uploads to a body (AoU Vision) | — | **PROHIBITED** | — | Fictional; also outside single-user assistant scope. |
| G6 | Discovers & connects to new services on its own (implied ubiquitous integration) | MCP discovery + OpenAPI/CLI inspection + generated typed integrations via G2 lifecycle | **REAL** | 3 | Outbound only to user-configured integrations (R-LOC-02). **MCP foundation BUILT+VERIFIED 2026-07-17** (`kernel/src/mcp/`): connects to a real stdio MCP server, discovers its tools, registers them namespaced + trust-gated (untrusted→approval), rug-pull quarantine + name-shadow prevention verified live (T2). Trust elevation is a check-in (D-0027). OpenAPI/CLI adapters + G2 generation remain Phase 3. |
| G7 | Always-on across devices — desk, car, suit, phone (IM1–AoU) | Cross-device clients: browser, macOS, iPhone/Watch/Vision Pro, Quest/OpenXR | **REAL** (per-device phases) | 1/7/11 | Trusted local-network pairing; no cloud relay of personal data. |

## H. Memory & knowledge

| ID | Movie capability (source) | Real-world equivalent | State | Phase | Notes |
|---|---|---|---|---|---|
| H1 | Perfect recall of past projects/conversations (all films) | Typed memory stores (conversation, episodic, semantic, procedural, projects, decisions…) in local Postgres+pgvector | **REAL** | 1 (conversation) / 2 (full) | Provenance + epistemic labels mandatory. **Encryption-at-rest built+verified 2026-07-17** (R-MEM-03): AES-256-GCM field vault, sensitive values + conversation content ciphertext at rest, KEK from Keychain/env, wrong-key fatal. **Semantic store built 2026-07-17 (D-0038):** entities/facts/relations (`memory_entities`/`facts`/`relations`, migration 0010) — encrypted, secret-refusing, supersede-with-history; `memory.recall` (6 tests, `P-ENTMEM-01`). **Episodic store built 2026-07-17 (D-0041):** a recallable timeline of events (`memory_episodes`, migration 0011) — encrypted, forgettable, importance-ranked; **auto-recorded from real consequential activity** by the core loop and fed into contextual awareness ("Recently: …"); `memory.recordEpisode`/`recallEpisodes` (7 tests, `P-EPISODE-01`). **Semantic (vector) recall built 2026-07-17 (D-0042):** recall by MEANING — `memory_embeddings` (pgvector, migration 0012) + the gateway embeddings role; `semanticRecall`/`?semantic=1`, best-effort with lexical fallback (13 tests, live embeddings endpoint, `P-SEMANTIC-01`). **Graph-brain built 2026-07-17 (D-0045):** multi-hop associative traversal (`memory.related`, recursive CTE), hybrid vector→graph recall (`memory.recallGraph`: entry points by meaning + one-hop expansion), episode auto-linking, entities/facts vector-indexed (scrubbed on forget) — no graph DB needed at this scale (6 tests, live 8/8, `P-GRAPH-01`). H1 core complete: conversation + preferences + semantic graph + episodic + vector + hybrid graph recall. |
| H2 | Knows Tony's preferences & habits (drinks, music, routines) | Preference learning labeled `inferred_preference`, correctable | **REAL** | 2 | User can view/correct/delete/pin (R-MEM-04). **Learning stack built 2026-07-18:** deep-reasoning topics learned from instruction + repeated correction (D-0050); **sleep-cycle self-calibration** from J.A.R.V.I.S.'s own decision journal + model-calls record — bounded auto-adjustment, proposals for the consequential, evidence-since-pin override contract with re-pin-scaled bars (D-0051/D-0052); everything stored as visible/deletable preferences with who/why/when ledgers, editable via UI, API, or by instructing J.A.R.V.I.S. through the gated tools (D-0054/D-0055). |
| H3 | Knows Tony's contacts & relationships (IM2 Pepper/Rhodey handling) | People/relationship store, user-approved data | **REAL** | 4 | **Substrate built 2026-07-17 (D-0038):** entity (kind=person) + typed relations (`knows`/`works_on`/…) in the semantic store; recall traverses both directions. Populating from real contacts is Phase 4 (user-configured). |
| H4 | Institutional knowledge of Stark Industries ops | Project/objective tracking for the user's actual work | **REAL** | 2/4 | Scaled to single user. **Entity/relation substrate built 2026-07-17 (D-0038)** (kind=project/org + facts/relations). |

## I. Interface & experience

| ID | Movie capability (source) | Real-world equivalent | State | Phase | Notes |
|---|---|---|---|---|---|
| I1 | Cinematic animated interfaces — layered glass, cyan/amber/red states, radial diagnostics (IM1–IM3 workshop/HUD) | Original functional design system with that visual language; every animation communicates state | **REAL** | 1→ each mode's phase | Design-system check-in before hardening. **Design system proposed 2026-07-17** (`docs/DESIGN_SYSTEM.md`, D-0026); Command Center + Voice Orb built on it (live data, every element communicates state). |
| I2 | Marvel frames, logos, SFX, score, actor likeness | — | **PROHIBITED** | — | IP violation; original assets only (R-UI-01). |
| I3 | Ambient presence indicator (J.A.R.V.I.S. "is just there") | Voice Orb: wake/listen/think/speak states | **REAL** | 1 | **BUILT+verified live 2026-07-17** (`app/orb/`): functional ambient orb driven by real kernel activity SSE + e-stop; idle/listening/thinking/speaking/advisory/critical/stopped, each communicating state; verified flipping to Speaking on a real conversation and Emergency-stop on a real e-stop. |
| I4 | Mission-wide status walls (AV helicarrier-style ops views) | Mission Control mode over real agents/tasks | **REAL** | 10 | |
| I5 | Gesture+gaze-driven spatial UI (IM2 Expo; AoU lab) | Look-and-pinch (Vision Pro official model), hand tracking (Quest/webcam), gaze-hover — per platform privacy APIs | **REAL** (per-platform) | 6–11 | No raw-gaze dependence on visionOS (R-SPA-03; verified 2026-07-16). |

## J. Prohibited-list summary (for quick reference) — R-AUTO-04

Autonomous weapons/targeting (F2); unauthorized system access/hacking (C5); bypassing access controls; covert surveillance (incl. F6 real-world variant); credential theft; malware; hidden persistence (G4 covert variant); disabling safety mechanisms (G3); undisclosed impersonation of the user; unauthorized purchases/communication/physical control; actor-voice cloning (A3); Marvel IP reuse (I2); claiming empty-air holography (D2); autonomous core-security self-modification (G3).

---

## Approval & amendments

**APPROVED at the Phase 0 check-in, 2026-07-17 (D-0003)**, with these amendments:
1. **Simulator depth = FULL SUITE (D-0018):** all SIMULATED rows (F4, F5, F6, F7, F8 scenarios, D7) are built as physics-grade, first-class simulation products integrated with HUD/Mission Control in Phase 10 — not lightweight placeholders. SIMULATION labeling rules unchanged.
2. **B4 reclassified** DEFERRED → REAL (scheduled, opt-in, constrained) — see row B4 (D-0019).
3. **Owned hardware recorded (D-0020):** Quest 3S (Phase 7 real-hardware target; no eye tracking per RESEARCH_VERIFICATION §1.2), Apple Watch + iPhone (Phase 11), no Home Assistant/smart devices or Vision Pro yet (E1/B2 remain simulator-first; Phase 11 visionOS client is HARDWARE-DEPENDENT until a device exists).

### Change log
| Date | Row | Change | Reason |
|---|---|---|---|
| 2026-07-17 | B4 | DEFERRED → REAL (scheduled, opt-in, constrained) | User decision at Phase 0 check-in (D-0019) |
| 2026-07-17 | F4–F8, D7 | Scope note: full-suite depth | User decision at Phase 0 check-in (D-0018) |
| 2026-07-17 | B5, G7, I5 | Hardware-ownership notes | Inventory recorded (D-0020) |

## Change control

- Every state change is logged here with date + reason and linked from `docs/DECISION_LOG.md`.
- DEFERRED rows carry prerequisites + target phase in `docs/IMPLEMENTATION_PLAN.md`.
- SIMULATED and HARDWARE-DEPENDENT rows must name their typed contract once defined (Phase 1+).
- Hardware claims re-verified before their implementing phase begins (LAST VERIFICATION DATE discipline, R-HW-02).
