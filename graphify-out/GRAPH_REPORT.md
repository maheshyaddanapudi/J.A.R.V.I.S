# Graph Report - J.A.R.V.I.S  (2026-08-25)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2148 nodes · 4355 edges · 173 communities (117 shown, 56 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 89 edges (avg confidence: 0.63)
- Token cost: 10,854 input · 2,646 output

## Graph Freshness
- Built from commit: `fbe9944a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Approval & Activity Bus
- Capability Activation Service
- Agent Tool Registry
- Research & Evidence Gathering
- Proactivity Gating Engine
- Audio Playback Bridge
- Computer Control API
- Device Gateway Contract
- Feature Decision Log
- Agenda Scheduler
- Python Audio I/O
- Config & Migrations
- Provider Adapter Layer
- UI Screenshot Verification
- Audit & Project Log
- Agent Runtime Contract
- Workspace Files Contract
- Context Provider Contract
- Reasoning Consolidation
- Secrets Vault
- Voice Server (TTS/STT)
- TS Config (Command Center)
- Role Overrides Store
- Tauri App Config
- Memory Judge & Privacy
- Turn-Taking Voice Engine
- Rust Kernel Estop
- MCP Client Registry
- Architecture Decision Docs
- Entity Memory Store
- Episodic Memory
- Memory Forget/Merge Ops
- Terminal Policy Runner
- Command Center UI Screenshots
- Command Center Dashboard Page
- Capability Decisions Overview
- Speech Engine Protocols
- Semantic Memory Search
- Settings Registry
- Entity Graph Recall
- Product UI Screenshots
- A2UI Spec Registry
- Gateway Config Schema
- Decisions & Runbooks
- Memory Service API
- TS Base Config
- Ops Backup & Health
- Backend Dependencies
- Monorepo Docs & Structure
- Root Package Config
- Wake Word Engines
- Voice Engine Tests
- Projects Log Store
- Budget & Autonomy Limits
- Gateway Router
- Files Page UI
- Pulse Page UI
- Skills Page UI
- Companion Package Config
- Kernel TS Config
- Settings Registry Types
- Memory Page UI
- Self-Extension Page UI
- Tauri Permissions Config
- Graphify Tooling Docs
- Streaming STT Engine
- Agent Page UI
- Command Center Package Config
- Test Dependencies
- JARVIS Feature Screenshots
- Mac Preflight Script
- Devices Page UI
- Models Page UI
- Proactive Page UI
- Architecture Decisions Log
- A2UI Page UI
- Control Page UI
- Graph Page UI
- Reasoning Page UI
- Terminal Page UI
- Web Page UI
- React Type Dependencies
- Devices & Secrets Modules
- Research/Web/MCP Capabilities
- Settings & Pulse UI
- Threat Model Scenarios
- Voice Activity Detection
- Announcement Delivery
- Frontend Dependencies
- Architecture & Threat Docs
- Security Threat Model
- Kernel Package Config
- Package Scripts
- Router Unit Tests
- Design System Docs
- Affect Inference Service
- Proactive DB Schema
- Memory DB Schema
- Announcement Tests
- Anthropic Adapter Tests
- Chat Page UI
- Orb Page UI
- Persona Page UI
- Settings Page UI
- Design Decision Records
- Graphify Setup Script
- Model Asset Fetcher
- Kek Encryption Key
- JARVIS Agent & Skills UI
- Root Layout Component
- Voice Orb Design
- macOS Computer Control
- Audit Trail & Tampering
- Audit & Estop Schema
- Memory Schema
- Self-Extension Capabilities Schema
- Heartbeat Agenda Schema
- Projects Log Schema
- MCP Test Server
- Next.js Config
- Next Env Types
- Swift Package Manifest
- Reasoning Panel Feature
- Ops Health Fix
- JARVIS Companion Core
- Graphify Auto-Update Script
- Graphify Refresh Script
- System Events Schema
- Model Calls Schema
- MCP Servers Schema
- Integration Secrets Schema
- Skills Schema
- Memory Embeddings Schema
- Prompts Schema
- Proactive Rules Schema
- Reasoning Decisions Schema
- Runtime Settings Schema
- Durable Grants Schema
- Setting Specs Schema
- UI Panels Schema
- Announcements Schema
- Trust Core Policy
- Phase 0 Documentation
- Voice Stack Decision
- Module Docs Deferral
- MCP Spec Target
- Local Model Baseline
- macOS Control Stack
- Spatial Input Model
- Session Continuity Design
- Companion Tauri Shell
- Memory Evolution Design
- Spend Governance Design
- Initiative & Dissent Design
- Perception Core Design
- Trust Zone Z0 User
- Trust Zone Z1 Core
- Trust Zone Z2 Orchestration
- Trust Zone Z3 Tooling
- Trust Zone Z4 Extensions
- Trust Zone Z5 Content
- Trust Zone Z6 Models
- JARVIS Ears Module
- Proactivity Engine
- URL Target Checker

## God Nodes (most connected - your core abstractions)
1. `AuditLog` - 94 edges
2. `buildCore()` - 47 edges
3. `SettingsRegistry` - 42 edges
4. `Core` - 39 edges
5. `GatewayRouter` - 36 edges
6. `EmergencyStop` - 34 edges
7. `EntityMemory` - 33 edges
8. `MemoryService` - 31 edges
9. `ActivityBus` - 30 edges
10. `Tool` - 30 edges

## Surprising Connections (you probably didn't know these)
- `Command Center dashboard screenshot` --references--> `kernel (jarvisd) module guide — trust core + platform process`  [INFERRED]
  docs/screenshots/final/dashboard.png → services/kernel/CLAUDE.md
- `Model gateway panel screenshot` --references--> `kernel (jarvisd) module guide — trust core + platform process`  [INFERRED]
  docs/screenshots/final/models.png → services/kernel/CLAUDE.md
- `A2UI generated panels screenshot` --references--> `kernel/src/settings — runtime settings module guide`  [INFERRED]
  docs/screenshots/final/a2ui.png → services/kernel/src/settings/CLAUDE.md
- `Chat-Parity Audit — guarantees, screenshots, self-evolution gaps` --references--> `A2UI generated panels screenshot`  [AMBIGUOUS]
  docs/verification/CHAT_PARITY_AUDIT_2026-07-19.md → docs/screenshots/final/a2ui.png
- `Chat-Parity Audit — guarantees, screenshots, self-evolution gaps` --references--> `Command Center dashboard screenshot`  [AMBIGUOUS]
  docs/verification/CHAT_PARITY_AUDIT_2026-07-19.md → docs/screenshots/final/dashboard.png

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **R-UI functional visual language requirement group** — docs_design_system, req_r_ui_01, req_r_ui_02, req_r_ui_03, req_r_ui_04, decision_d0026 [EXTRACTED 0.85]
- **Session-continuity governing document set** — docs_implementation_plan, docs_capability_parity_matrix_doc, docs_requirements_traceability_doc [EXTRACTED 0.85]
- **Graphify Build/Query Pipeline Components** — dot_claude_skills_graphify_skill_md_doc, dot_claude_skills_graphify_references_extraction_spec_md_doc, dot_claude_skills_graphify_references_query_md_doc, dot_claude_skills_graphify_references_update_md_doc, dot_claude_skills_graphify_references_transcribe_md_doc [EXTRACTED 0.85]
- **Terminal-with-policy capability (Phase 2)** — services_kernel_src_terminal_contract_terminalrunner, services_kernel_src_terminal_policy_assesscommand, services_kernel_src_terminal_runner_localterminal, services_kernel_src_terminal_tools_terminal_inspect, services_kernel_src_terminal_tools_terminal_run [EXTRACTED 0.85]
- **Three rhythms: live, heartbeat, quiet hours** — docs_decision_log_d0063, docs_decision_log_d0064, docs_decision_log_d0065, core_loop_coreloop [EXTRACTED 0.85]
- **Untrusted-content envelope defense (T1) across outward-facing capabilities** — kernel_src_core_untrusted, kernel_src_web_module, kernel_src_research_module, kernel_src_mcp_module, docs_decision_log_d0037 [EXTRACTED 0.85]
- **Web browsing/research capability (Phase 2)** — services_kernel_src_web_contract_webbrowser, services_kernel_src_web_policy_checkwebtarget, services_kernel_src_web_playwright_playwrightbrowser, services_kernel_src_web_tools_webtools, services_kernel_src_web_tools_web_open, services_kernel_src_web_tools_web_readtext, services_kernel_src_web_tools_web_links, services_kernel_src_web_tools_web_screenshot, services_kernel_src_web_tools_web_fill, services_kernel_src_web_tools_web_click [EXTRACTED 0.85]
- **Mac bring-up capability check-in sequence (8a-8g)** — docs_mac_bringup, decision_d0004, decision_d0022, decision_d0024, decision_d0025, decision_d0027, decision_d0026, decision_d0023 [EXTRACTED 0.90]
- **J.A.R.V.I.S. Trust Zone Architecture (Z0–Z6)** — docs_threat_model_z0_user, docs_threat_model_z1_core_trust_domain, docs_threat_model_z2_orchestration, docs_threat_model_z3_tooling, docs_threat_model_z4_extensions, docs_threat_model_z5_content, docs_threat_model_z6_models [EXTRACTED 0.90]
- **A2UI-Composed J.A.R.V.I.S. Control Panels** — docs_screenshots_a2ui_screenshot, docs_screenshots_settings_screenshot, docs_screenshots_dashboard_screenshot [INFERRED 0.60]
- **Phase 2 gated high-risk capabilities pattern** — services_kernel_src_terminal_policy_assesscommand, services_kernel_src_web_policy_checkwebtarget, services_kernel_src_terminal_tools_terminal_run, services_kernel_src_web_tools_web_open [INFERRED 0.60]
- **Autonomy safety envelope (approval ceiling, budget, defer, e-stop)** — docs_decision_log_d0024, docs_decision_log_d0064, docs_decision_log_d0065, docs_decision_log_d0066 [INFERRED 0.70]
- **Autonomy/heartbeat configuration shared across Settings, Pulse, A2UI and Reasoning pages** — jarvis_settings, jarvis_pulse, jarvis_a2ui_panels, jarvis_reasoning [INFERRED 0.70]
- **Command Center settings/A2UI panel rendering flow** — docs_screenshots_final_a2ui_image, docs_screenshots_final_settings_image, docs_screenshots_final_dashboard_image, services_kernel_src_settings_claude_module [INFERRED 0.70]
- **Fast-model memory judgment + observation + rhythm-sync flow** — decision_d0075, docs_decision_log_d0076, docs_decision_log_d0077, src_memory_judge, ops_ops [INFERRED 0.75]
- **Shared entities (Dum-E, Tony Stark, Arc Reactor) across memory and knowledge graph views** — jarvis_memory, jarvis_knowledge_graph, jarvis_command_center [INFERRED 0.75]
- **Self-extension: draft → propose → approve → activate verification chain** — services_kernel_src_selfext_claude_module, docs_verification_stage_b_affect_2026_07_19_report, docs_verification_chat_parity_audit_2026_07_19_report, docs_verification_full_reverification_2026_07_19_report [INFERRED 0.75]
- **Foundation-built-but-gated-behind-check-in pattern** — docs_decision_log_d0022, docs_decision_log_d0023, docs_decision_log_d0024, docs_decision_log_d0025, docs_decision_log_d0026, docs_decision_log_d0027 [INFERRED 0.80]
- **Memory-system bug discovery, fix, and re-verification arc** — docs_verification_observation_run_2026_07_19_report, docs_verification_d0075_memory_judgment_2026_07_20_report, docs_verification_fresh_observation_2026_07_20_report, docs_verification_ab_observation_2026_07_20_report [INFERRED 0.80]
- **Memory, Knowledge Graph and Reasoning form the persistent knowledge/learning layer** — jarvis_memory, jarvis_reasoning [INFERRED 0.80]
- **Shared runtime configuration keys (autonomy/proactive/heartbeat) between Settings and A2UI Panels** — jarvis_settings, jarvis_pulse [INFERRED 0.80]
- **Shared gated approval pipeline across consequential tool actions** — jarvis_agent, jarvis_computer_control, jarvis_devices, jarvis_files, jarvis_terminal, jarvis_web, jarvis_skills [INFERRED 0.85]

## Communities (173 total, 56 thin omitted)

### Community 0 - "Approval & Activity Bus"
Cohesion: 0.05
Nodes (46): ActivityBus, ActivityEvent, ApprovalBroker, ApprovalResolution, PendingApproval, EmergencyStop, CoreLoop, ActionRequest (+38 more)

### Community 1 - "Capability Activation Service"
Cohesion: 0.07
Nodes (33): ActivationCheck, ActivationService, RISK_ORDER, StepRunner, CapabilityGuard, DANGEROUS_PATTERNS, GuardVerdict, manifestHash() (+25 more)

### Community 2 - "Agent Tool Registry"
Cohesion: 0.08
Nodes (31): a2uiTools(), AgendaItem, agendaTools(), Announcement, announceTools(), computerControlTools(), ActionDisclosure, buildCore() (+23 more)

### Community 3 - "Research & Evidence Gathering"
Cohesion: 0.06
Nodes (32): Evidence, GatherOptions, Researcher, ResearchFindings, SourceStatus, TargetCheck, queryTerms(), scorePassages() (+24 more)

### Community 4 - "Proactivity Gating Engine"
Cohesion: 0.08
Nodes (25): ProactivityEngine, GateStack, inQuietHours(), priorityRank(), briefingCandidate(), calendarConflictCandidates(), commitmentCandidates(), dayKey() (+17 more)

### Community 5 - "Audio Playback Bridge"
Cohesion: 0.09
Nodes (28): AppKit, ApplicationServices, AudioBridge, Double, Float, EarsClient, Float, AppInfoDTO (+20 more)

### Community 6 - "Computer Control API"
Cohesion: 0.09
Nodes (12): AppInfo, AxElement, ComputerControl, ControlProvenance, ControlResult, ElementSelector, Screenshot, WindowInfo (+4 more)

### Community 7 - "Device Gateway Contract"
Cohesion: 0.09
Nodes (22): DEVICE_RISK, DeviceCommand, DeviceGateway, DeviceInfo, DeviceProvenance, DeviceResult, DeviceState, DeviceType (+14 more)

### Community 8 - "Feature Decision Log"
Cohesion: 0.06
Nodes (43): A2UI (agent-generated declarative UI), Anthropic Adapter, Command Center /models panel, Command Center /settings panel, ContextService, CoreLoop, D-0024 Proactivity engine built, live delivery gated, D-0038: Semantic memory entities/facts/relations store (+35 more)

### Community 9 - "Agenda Scheduler"
Cohesion: 0.07
Nodes (19): Agenda, AutonomyStatus, BackgroundScheduler, TickResult, SleepCycle, DurableGrantRow, DurableGrants, Core (+11 more)

### Community 10 - "Python Audio I/O"
Cohesion: 0.07
Nodes (21): AudioSink, AudioSource, BufferAudioSink, BufferAudioSource, _PortAudioSource, ndarray, Path, Protocol (+13 more)

### Community 11 - "Config & Migrations"
Cohesion: 0.09
Nodes (27): ConfigSchema, KernelConfig, loadConfig(), registerCoreRoutes(), sseCorsHeaders(), AppliedMigration, config, migrationsDir (+19 more)

### Community 12 - "Provider Adapter Layer"
Cohesion: 0.11
Nodes (14): ProviderAdapter, ProviderError, createAnthropicAdapter(), createOllamaAdapter(), OllamaMessage, createOpenAiCompatAdapter(), ajv, ChatEvent (+6 more)

### Community 13 - "UI Screenshot Verification"
Cohesion: 0.08
Nodes (36): A2UI generated panels screenshot, Command Center dashboard screenshot, Memory panel screenshot, Model gateway panel screenshot, Pulse (heartbeat/agenda) panel screenshot, Settings panel screenshot, A/B Observation: Opus/Sonnet vs Haiku tier, Chat-Parity Audit — guarantees, screenshots, self-evolution gaps (+28 more)

### Community 14 - "Audit & Project Log"
Cohesion: 0.09
Nodes (20): A2uiSpecSchema, validateReferences(), Project, ProjectLogEntry, projectTools(), AuditEntry, AuditLog, redactSecrets() (+12 more)

### Community 15 - "Agent Runtime Contract"
Cohesion: 0.11
Nodes (19): AgentResult, AgentRunOptions, AgentRuntime, AgentStep, LocalAgentRuntime, ToolContext, wrapUntrusted(), AgentRunOpts (+11 more)

### Community 16 - "Workspace Files Contract"
Cohesion: 0.14
Nodes (16): DirEntry, EditOutcome, FileContent, FileInfo, FileKind, SearchMatch, SearchOptions, SearchResult (+8 more)

### Community 17 - "Context Provider Contract"
Cohesion: 0.14
Nodes (14): CommitmentContext, ContextProvider, ContextSnapshot, EpisodeSource, KnowledgeSource, KnownEntity, PinnedFact, ProactiveContext (+6 more)

### Community 18 - "Reasoning Consolidation"
Cohesion: 0.12
Nodes (11): ConsolidationReport, DecisionLog, Autotune, DEFAULT_AUTOTUNE, DepthAssessment, DepthReason, ReasoningMode, ReasoningTuner (+3 more)

### Community 19 - "Secrets Vault"
Cohesion: 0.10
Nodes (11): normalizeName(), SecretInfo, SecretsVault, gcmDecrypt(), gcmEncrypt(), Vault, WRAP_INFO, audit (+3 more)

### Community 20 - "Voice Server (TTS/STT)"
Cohesion: 0.10
Nodes (24): BaseModel, TtsChunk, listen(), load_engines(), ndarray, jarvis-ears HTTP/WS surface (localhost only, R-LOC-01).  GET  /health  — real en, Run the full utterance through the streaming STT and return the transcript., A complete captured utterance @16kHz mono float32. On the Mac the audio     come (+16 more)

### Community 21 - "TS Config (Command Center)"
Cohesion: 0.07
Nodes (27): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+19 more)

### Community 22 - "Role Overrides Store"
Cohesion: 0.13
Nodes (15): parseRolePin(), loadRoleOverrides(), persistRoleOverrides(), Store, StoredRoleOverrides, pinOf(), ChatBodySchema, registerGatewayRoutes() (+7 more)

### Community 23 - "Tauri App Config"
Cohesion: 0.07
Nodes (26): app, security, trayIcon, windows, build, devUrl, frontendDist, bundle (+18 more)

### Community 24 - "Memory Judge & Privacy"
Cohesion: 0.12
Nodes (12): PrivacyClass, EntityCandidate, EntityForMerge, EntityMergeGroup, FactForMerge, GatewayMemoryJudge, JudgeGateway, MemoryJudge (+4 more)

### Community 25 - "Turn-Taking Voice Engine"
Cohesion: 0.14
Nodes (17): Enum, Typed, replaceable speech-engine contracts (R-VOICE-12).  Every engine is an ope, VadFrame, Full-duplex turn-taking + barge-in state machine (R-VOICE-03).  This is the ENGI, Drives the conversation's turn state from VAD frames.      Barge-in fires when,, Feed one VAD frame; returns any turn transitions it triggered., TurnEvent, TurnTaker (+9 more)

### Community 26 - "Rust Kernel Estop"
Cohesion: 0.18
Nodes (19): engage_estop(), estop_engaged(), get(), is_healthy(), KernelError, parse_status(), post(), request() (+11 more)

### Community 27 - "MCP Client Registry"
Cohesion: 0.13
Nodes (11): hashTools(), McpClientHost, McpDiscovery, McpToolSpec, McpRegistry, McpServerRow, RegisteredServer, TrustLevel (+3 more)

### Community 28 - "Architecture Decision Docs"
Cohesion: 0.12
Nodes (19): CLAUDE.md — Repository Guide, Five-State Capability Classification, Two-Stage Self-Extension (Stage A/B), D-0004: Voice Stack Pick, D-0007: Valkey over Redis, D-0008: Own Thin Adapter over LiteLLM, D-0011: Pin to Stable MCP Spec, D-0015: Custom macOS Control Bridge (+11 more)

### Community 29 - "Entity Memory Store"
Cohesion: 0.24
Nodes (3): assertNotSecret(), EntityMemory, seedChain()

### Community 30 - "Episodic Memory"
Cohesion: 0.19
Nodes (10): Entity, Fact, Episode, EpisodeKind, EpisodicMemory, KINDS, normalizeKind(), RecallOptions (+2 more)

### Community 32 - "Terminal Policy Runner"
Cohesion: 0.14
Nodes (13): CommandResult, Provenance, RunOptions, TerminalRunner, assessCommand(), Assessment, DENY, READ_ONLY (+5 more)

### Community 33 - "Command Center UI Screenshots"
Cohesion: 0.11
Nodes (20): Computer Control UI screenshot, Devices (Stark-residence simulation) UI screenshot, Files workspace UI screenshot, Terminal (policy-gated shell) UI screenshot, Web (headless browser) UI screenshot, Memory (entities & timeline) UI screenshot, Knowledge Graph UI screenshot, Proactivity UI screenshot (+12 more)

### Community 34 - "Command Center Dashboard Page"
Cohesion: 0.14
Nodes (15): activityColor(), ActivityEvent, btn(), ContextData, EmergencyStopButton(), formatActivity(), HealthReport, inputStyle (+7 more)

### Community 35 - "Capability Decisions Overview"
Cohesion: 0.15
Nodes (19): D-0075: Fast-model memory judgments + self-authored skills, D-0023 Self-extension safety-first, Stage B gated, D-0029 Contextual awareness: ContextService, D-0031 Skills registry, D-0032 Workspace knowledge/files capability, D-0033 Tool results feed agent reasoning (detail field), D-0035 Terminal-with-policy, D-0074 Code-authored capabilities run in-container (+11 more)

### Community 36 - "Speech Engine Protocols"
Cohesion: 0.12
Nodes (9): ndarray, Protocol, Feed a PCM frame; return any wake detections in that frame., Yield audio chunks as they become available (sentence-level or better)., StreamingTtsEngine, SttEngine, TtsEngine, VadEngine (+1 more)

### Community 37 - "Semantic Memory Search"
Cohesion: 0.13
Nodes (11): EmbedFn, SemanticHit, SemanticMemory, SemanticSource, toVectorLiteral(), audit, embed(), hashEmbed() (+3 more)

### Community 38 - "Settings Registry"
Cohesion: 0.19
Nodes (3): SettingSpec, SettingsRegistry, validate()

### Community 39 - "Entity Graph Recall"
Cohesion: 0.15
Nodes (13): contentWords(), diceCoefficient(), EntityKind, fullestName(), GraphNeighborhood, GraphRecall, mergeAttrs(), nameSimilar() (+5 more)

### Community 40 - "Product UI Screenshots"
Cohesion: 0.12
Nodes (17): A2UI Panels — Autonomy & Proactivity control panel screenshot, Converse screen with deep-reasoning persona echo screenshot, Converse screen idle state screenshot, Computer Control (SIMULATION desktop, gated pipeline) screenshot, Command Center dashboard (kernel/audit/memory/MCP/proactive) screenshot, Devices — Stark-residence SIMULATION home control screenshot, Files — workspace browser & search screenshot, Knowledge Graph walk (Arc Reactor/Mark VII/Pepper Potts/Tony Stark) screenshot (+9 more)

### Community 41 - "A2UI Spec Registry"
Cohesion: 0.13
Nodes (10): A2uiPanel, A2uiRegistry, A2uiComponent, A2uiComponentSchema, A2uiSpec, Action, Heading, Setting (+2 more)

### Community 42 - "Gateway Config Schema"
Cohesion: 0.18
Nodes (15): DEFAULT_GATEWAY_CONFIG, ENV_DEFAULT_KINDS, loadGatewayConfig(), NON_GENERATIVE_ROLES, resolveGatewayConfig(), RoleOverride, ContentPart, EffortLevel (+7 more)

### Community 43 - "Decisions & Runbooks"
Cohesion: 0.16
Nodes (16): D-0019: Affect/Emotion Inference Rescheduled, D-0020: Personal Health Telemetry Accepted, D-0022: macOS computer-control activation gate, D-0023: Self-extension Stage B activation (dedicated security check-in), D-0024: Proactive delivery enable, D-0025: Physical device control enable, D-0027: MCP server trust elevation, D-0046: Gateway pinned to current Anthropic API (+8 more)

### Community 44 - "Memory Service API"
Cohesion: 0.26
Nodes (3): assertNotSecret(), MemoryService, registerMemoryRoutes()

### Community 45 - "TS Base Config"
Cohesion: 0.13
Nodes (14): ES2023, compilerOptions, declaration, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, lib, module (+6 more)

### Community 46 - "Ops Backup & Health"
Cohesion: 0.18
Nodes (4): canonicalJson(), BRAIN_TABLES, HealthReport, Ops

### Community 47 - "Backend Dependencies"
Cohesion: 0.15
Nodes (13): ajv, fastify, @modelcontextprotocol/sdk, pg, playwright, dependencies, ajv, fastify (+5 more)

### Community 48 - "Monorepo Docs & Structure"
Cohesion: 0.19
Nodes (12): apps/command-center CLAUDE.md module guide, apps/companion README.md, apps/companion Tauri icons README, apps/companion ui/index.html fallback page, Core Interaction Loop, Honesty Rule, Option A — Hybrid TS Kernel + Python Mind, Option B — Single-Runtime TypeScript Core (+4 more)

### Community 49 - "Root Package Config"
Cohesion: 0.15
Nodes (12): description, engines, node, name, packageManager, private, scripts, build (+4 more)

### Community 50 - "Wake Word Engines"
Cohesion: 0.14
Nodes (10): WakeEvent, OpenWakeWord, ndarray, Path, Wake-word engine: openWakeWord ONNX pipeline.  Code: Apache-2.0 (dscripka/openWa, ndarray, Path, Wake-word engine: sherpa-onnx open-vocabulary keyword spotting (Apache-2.0).  Th (+2 more)

### Community 51 - "Voice Engine Tests"
Cohesion: 0.21
Nodes (11): kokoro(), ndarray, Engine tests against real models (no mocks — R-CORE-02).  Requires model assets, Real TTS -> real STT round trip: Kokoro speaks a command, STT must hear it., End-to-end: TTS speaks the wake phrase; the wake engine must detect it., _resample_24k_to_16k(), stt(), test_stt_transcribes_synthesized_speech() (+3 more)

### Community 53 - "Budget & Autonomy Limits"
Cohesion: 0.21
Nodes (4): AUTONOMY_SOURCES, Budget, BudgetStatus, PRICE_PER_MTOK

### Community 54 - "Gateway Router"
Cohesion: 0.32
Nodes (3): GatewayRouter, ChatRequest, ChatResult

### Community 55 - "Files Page UI"
Cohesion: 0.21
Nodes (10): btn(), Entry, Ev, FileContent, FilesPage(), formatEv(), inputStyle, Match (+2 more)

### Community 56 - "Pulse Page UI"
Cohesion: 0.18
Nodes (11): Beat, card(), ctl, dim, h2, input, Item, linkBtn (+3 more)

### Community 57 - "Skills Page UI"
Cohesion: 0.21
Nodes (10): AgentResult, btn(), Ev, formatEv(), inputStyle, Pending, pipeColor(), Skill (+2 more)

### Community 58 - "Companion Package Config"
Cohesion: 0.17
Nodes (11): description, devDependencies, @tauri-apps/cli, name, private, scripts, build, dev (+3 more)

### Community 59 - "Kernel TS Config"
Cohesion: 0.17
Nodes (11): node, src/**/*.test.ts, src/**/*.ts, ../../tsconfig.base.json, compilerOptions, outDir, rootDir, types (+3 more)

### Community 60 - "Settings Registry Types"
Cohesion: 0.20
Nodes (9): DynamicSpecInput, EffectiveSetting, jaccard(), normKey(), Override, SettingOrigin, SettingType, SettingValue (+1 more)

### Community 61 - "Memory Page UI"
Cohesion: 0.22
Nodes (9): btn(), Entity, Episode, Fact, inputStyle, MemoryPage(), Recall, Rel (+1 more)

### Community 62 - "Self-Extension Page UI"
Cohesion: 0.20
Nodes (9): ActiveCap, BENIGN, btn(), Finding, MALICIOUS, Report, SelfExtPage(), Verdict (+1 more)

### Community 63 - "Tauri Permissions Config"
Cohesion: 0.18
Nodes (10): description, identifier, permissions, $schema, windows, core:default, core:window:allow-set-focus, core:window:allow-show (+2 more)

### Community 64 - "Graphify Tooling Docs"
Cohesion: 0.20
Nodes (11): Graphify Knowledge-Graph Build Pipeline, .claude/CLAUDE.md graphify pointer, graphify reference: add-watch, graphify reference: exports, graphify reference: extraction-spec, graphify reference: github-and-merge, graphify reference: hooks, graphify reference: query/path/explain (+3 more)

### Community 65 - "Streaming STT Engine"
Cohesion: 0.27
Nodes (5): SttPartial, ndarray, Path, Streaming STT engine: sherpa-onnx streaming zipformer transducer (Apache-2.0)., SherpaStreamingStt

### Community 67 - "Agent Page UI"
Cohesion: 0.27
Nodes (8): AgentPage(), AgentResult, btn(), Ev, formatEv(), Pending, pipeColor(), Step

### Community 68 - "Command Center Package Config"
Cohesion: 0.20
Nodes (9): description, name, private, scripts, build, dev, start, typecheck (+1 more)

### Community 69 - "Test Dependencies"
Cohesion: 0.20
Nodes (10): @types/node, devDependencies, tsx, @types/node, @types/pg, vitest, @types/node, tsx (+2 more)

### Community 70 - "JARVIS Feature Screenshots"
Cohesion: 0.20
Nodes (10): Chat/Converse UI screenshot, Model Gateway UI screenshot, Reasoning UI screenshot, Persona UI screenshot, Voice Orb UI screenshot, J.A.R.V.I.S. Converse (core loop, memory+context), J.A.R.V.I.S. Model Gateway (local-capable-first routing, measured live), J.A.R.V.I.S. Persona (user-editable speaking style R-CAP-01, D-0043) (+2 more)

### Community 71 - "Mac Preflight Script"
Cohesion: 0.36
Nodes (8): bad(), have(), hdr(), note(), ok(), port_state(), mac_preflight.sh script, skip()

### Community 72 - "Devices Page UI"
Cohesion: 0.31
Nodes (6): btn(), DevicesPage(), Ev, formatEv(), pipeColor(), RunOutcome

### Community 73 - "Models Page UI"
Cohesion: 0.28
Nodes (8): CallRow, h2(), inp, ModelsPage(), Override, ProviderRow, sec(), td

### Community 74 - "Proactive Page UI"
Cohesion: 0.25
Nodes (7): btn(), ProactivePage(), Rule, ruleInput, RunResult, Suppression, Surfaced

### Community 75 - "Architecture Decisions Log"
Cohesion: 0.22
Nodes (9): D-0002 Architecture option (Hybrid TS+Python), D-0006 Valkey deferred, D-0007 Valkey over Redis, D-0008 Model gateway approach, D-0009 Agent runtime: LangGraph behind AgentRuntime interface, D-0010 Observability viewer: Jaeger v2, D-0013 Postgres encryption approach, D-0014 Desktop shell: Tauri 2 (+1 more)

### Community 76 - "A2UI Page UI"
Cohesion: 0.29
Nodes (6): A2uiPage(), Component, ctl(), input, Panel, Setting

### Community 77 - "Control Page UI"
Cohesion: 0.36
Nodes (6): btn(), ControlPage(), Ev, formatEv(), pipeColor(), RunOutcome

### Community 78 - "Graph Page UI"
Cohesion: 0.29
Nodes (7): Bundle, chip(), EntityRow, GEdge, GNode, GraphPage(), input

### Community 79 - "Reasoning Page UI"
Cohesion: 0.36
Nodes (7): Autotune, chip(), h2(), input, ReasoningPage(), Report, sec()

### Community 80 - "Terminal Page UI"
Cohesion: 0.36
Nodes (6): btn(), Ev, formatEv(), pipeColor(), RunOutcome, TerminalPage()

### Community 81 - "Web Page UI"
Cohesion: 0.36
Nodes (6): btn(), Ev, formatEv(), pipeColor(), RunOutcome, WebPage()

### Community 82 - "React Type Dependencies"
Cohesion: 0.25
Nodes (8): devDependencies, @types/react, @types/react-dom, typescript, typescript, typescript, @types/react, @types/react-dom

### Community 83 - "Devices & Secrets Modules"
Cohesion: 0.29
Nodes (8): devices/homeassistant.ts (real HA gateway), D-0025 Device-control foundation SIMULATION-first, D-0028 Managed secrets vault, D-0078 graphify adopted as developer tooling, GRAPHIFY.md, graphify (dev tooling), kernel/src/crypto/secrets.ts (SecretsVault), kernel/src/devices (Device-control HAL)

### Community 84 - "Research/Web/MCP Capabilities"
Cohesion: 0.29
Nodes (8): D-0027 MCP client host; trust-elevation is a check-in, D-0034 Web browsing / research capability, D-0036 Research-with-provenance, D-0037 Untrusted-content envelopes (T1 defense), kernel/src/core/untrusted.ts (envelope), kernel/src/mcp (MCP client host), kernel/src/research (research.gather), kernel/src/web (PlaywrightBrowser)

### Community 85 - "Settings & Pulse UI"
Cohesion: 0.25
Nodes (8): Settings UI screenshot, Pulse (heartbeat journal + agenda) UI screenshot, A2UI Panels UI screenshot, A10 — Emergency-Stop & Kill-Switch, T12 — Availability / Runaway Autonomy, J.A.R.V.I.S. A2UI Panels (sandboxed renderer, whitelisted components, D-0061), J.A.R.V.I.S. Pulse (heartbeat journal + self-written agenda D-0064), J.A.R.V.I.S. Settings (runtime-editable config D-0058)

### Community 86 - "Threat Model Scenarios"
Cohesion: 0.25
Nodes (8): Self-Extension (Stage A generate-without-activate) screenshot, A2 — Credentials & API Keys, A4 — Policy Engine Config, ADV2 — Malicious/Compromised MCP Server, ADV3 — Supply Chain Adversary, ADV6 — System's Own Generated Code, T2 — Tool Poisoning / Malicious MCP Server, T3 — Self-Extension Abuse

### Community 87 - "Voice Activity Detection"
Cohesion: 0.32
Nodes (4): ndarray, Path, SileroVad, vad()

### Community 89 - "Frontend Dependencies"
Cohesion: 0.29
Nodes (7): dependencies, next, react, react-dom, next, react, react-dom

### Community 90 - "Architecture & Threat Docs"
Cohesion: 0.48
Nodes (7): D-0002: Architecture Option A approved, D-0004/D-0004a: Voice stack approved with condition, D-0021: Memory architecture + local security model approved, IMPLEMENTATION_PLAN.md — Living Development Plan, Product Spec (docs/PRODUCT_SPEC.md), J.A.R.V.I.S. Threat Model, R-CAP-08: Hard limit on generated-capability scope

### Community 91 - "Security Threat Model"
Cohesion: 0.29
Nodes (7): D-0037: Untrusted Content Envelope, A1 — Memory Stores, ADV1 — Remote Content Author, ADV5 — Voice Spoofer, T1 — Prompt Injection, T5 — Memory Poisoning, T6 — Voice Spoofing & False Wake

### Community 92 - "Kernel Package Config"
Cohesion: 0.29
Nodes (6): description, main, name, private, type, version

### Community 93 - "Package Scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, migrate, start, test, typecheck

### Community 94 - "Router Unit Tests"
Cohesion: 0.29
Nodes (3): auditRows, baseConfig, fakePool

### Community 95 - "Design System Docs"
Cohesion: 0.40
Nodes (5): D-0026: Design system check-in, R-UI-01: Functional visual language without Marvel IP, R-UI-02: Color semantics, motion-communicates-state, accessibility, R-UI-03: No decorative/meaningless visual elements, R-UI-04: Interface modes as real vertical slices

### Community 96 - "Affect Inference Service"
Cohesion: 0.40
Nodes (4): AffectReading, inferAffect(), Tone, Urgency

### Community 97 - "Proactive DB Schema"
Cohesion: 0.33
Nodes (5): calendar_events, commitments, proactive_domain_settings, proactive_items, proactive_snoozes

### Community 98 - "Memory DB Schema"
Cohesion: 0.47
Nodes (4): memory_entities, memory_facts, memory_relations, memory_episodes

### Community 99 - "Announcement Tests"
Cohesion: 0.33
Nodes (4): activity, audit, DAY, NIGHT

### Community 100 - "Anthropic Adapter Tests"
Cohesion: 0.33
Nodes (3): adapter(), bodies, TOOL

### Community 101 - "Chat Page UI"
Cohesion: 0.50
Nodes (3): appendToLastAssistant(), applyFrame(), Turn

### Community 102 - "Orb Page UI"
Cohesion: 0.40
Nodes (3): OrbState, STATE_COLOR, STATE_LABEL

### Community 103 - "Persona Page UI"
Cohesion: 0.50
Nodes (4): btn(), inputStyle, PersonaPage(), Prompt

### Community 104 - "Settings Page UI"
Cohesion: 0.50
Nodes (4): ctl(), input, Setting, SettingsPage()

### Community 105 - "Design Decision Records"
Cohesion: 0.40
Nodes (5): D-0003 Capability parity matrix approval, D-0018 Simulator depth: full suite, D-0019: Affect layer deferral, D-0020 User hardware inventory, D-0072: Affect layer approved (opt-in, text-only, local)

### Community 106 - "Graphify Setup Script"
Cohesion: 0.70
Nodes (4): bad(), ok(), graphify-setup.sh script, warn()

### Community 107 - "Model Asset Fetcher"
Cohesion: 0.60
Nodes (4): fetch(), main(), Path, Fetch jarvis-ears model assets from verifiable sources into JARVIS_EARS_MODELS.

### Community 108 - "Kek Encryption Key"
Cohesion: 0.60
Nodes (3): exec, randomKek(), resolveKek()

### Community 109 - "JARVIS Agent & Skills UI"
Cohesion: 0.50
Nodes (4): Agent (gated multi-step tasks) UI screenshot, Skills UI screenshot, J.A.R.V.I.S. Agent (gated pipeline multi-step tasks), J.A.R.V.I.S. Skills (saved objectives run via gated agent)

### Community 111 - "Voice Orb Design"
Cohesion: 0.67
Nodes (3): Ambient Voice Orb (apps/command-center/app/orb), D-0026 Visual design system proposed; Ambient Voice Orb built, DESIGN_SYSTEM.md

### Community 112 - "macOS Computer Control"
Cohesion: 1.00
Nodes (3): MacDesktop.swift (real macOS adapter), D-0022 Computer-control foundation SIMULATION-first, kernel/src/control (Computer-control HAL)

### Community 113 - "Audit Trail & Tampering"
Cohesion: 0.67
Nodes (3): Audit trail — Command Center dashboard (night state) screenshot, A3 — Audit Log, T11 — Audit Tampering / Repudiation

## Ambiguous Edges - Review These
- `Audit trail — Command Center dashboard (night state) screenshot` → `Command Center dashboard (kernel/audit/memory/MCP/proactive) screenshot`  [AMBIGUOUS]
  docs/screenshots/audit/00-dashboard.png · relation: conceptually_related_to
- `Chat-Parity Audit — guarantees, screenshots, self-evolution gaps` → `A2UI generated panels screenshot`  [AMBIGUOUS]
  docs/verification/CHAT_PARITY_AUDIT_2026-07-19.md · relation: references
- `Chat-Parity Audit — guarantees, screenshots, self-evolution gaps` → `Command Center dashboard screenshot`  [AMBIGUOUS]
  docs/verification/CHAT_PARITY_AUDIT_2026-07-19.md · relation: references
- `Chat-Parity Audit — guarantees, screenshots, self-evolution gaps` → `Memory panel screenshot`  [AMBIGUOUS]
  docs/verification/CHAT_PARITY_AUDIT_2026-07-19.md · relation: references
- `Chat-Parity Audit — guarantees, screenshots, self-evolution gaps` → `Model gateway panel screenshot`  [AMBIGUOUS]
  docs/verification/CHAT_PARITY_AUDIT_2026-07-19.md · relation: references
- `Chat-Parity Audit — guarantees, screenshots, self-evolution gaps` → `Pulse (heartbeat/agenda) panel screenshot`  [AMBIGUOUS]
  docs/verification/CHAT_PARITY_AUDIT_2026-07-19.md · relation: references
- `Chat-Parity Audit — guarantees, screenshots, self-evolution gaps` → `Settings panel screenshot`  [AMBIGUOUS]
  docs/verification/CHAT_PARITY_AUDIT_2026-07-19.md · relation: references
- `Clean-Slate Evolution Acceptance Run (D-0063)` → `Living-Heartbeat Verification (D-0064)`  [AMBIGUOUS]
  docs/verification/HEARTBEAT_2026-07-19.md · relation: conceptually_related_to
- `J.A.R.V.I.S. Self-Extension (Stage A generate/review, Stage B approve/activate, hard limit R-CAP-08)` → `J.A.R.V.I.S. A2UI Panels (sandboxed renderer, whitelisted components, D-0061)`  [AMBIGUOUS]
  docs/screenshots/audit/17-selfext.png · relation: shares_data_with

## Knowledge Gaps
- **532 isolated node(s):** `PendingApproval`, `Decision`, `PROHIBITED`, `audit`, `audit` (+527 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **56 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Audit trail — Command Center dashboard (night state) screenshot` and `Command Center dashboard (kernel/audit/memory/MCP/proactive) screenshot`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Chat-Parity Audit — guarantees, screenshots, self-evolution gaps` and `A2UI generated panels screenshot`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Chat-Parity Audit — guarantees, screenshots, self-evolution gaps` and `Command Center dashboard screenshot`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Chat-Parity Audit — guarantees, screenshots, self-evolution gaps` and `Memory panel screenshot`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Chat-Parity Audit — guarantees, screenshots, self-evolution gaps` and `Model gateway panel screenshot`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Chat-Parity Audit — guarantees, screenshots, self-evolution gaps` and `Pulse (heartbeat/agenda) panel screenshot`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Chat-Parity Audit — guarantees, screenshots, self-evolution gaps` and `Settings panel screenshot`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._