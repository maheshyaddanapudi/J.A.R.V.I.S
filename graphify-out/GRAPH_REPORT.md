# Graph Report - J.A.R.V.I.S  (2026-08-25)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2072 nodes · 4246 edges · 178 communities (108 shown, 70 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 87 edges (avg confidence: 0.64)
- Token cost: 10,235 input · 4,901 output

## Graph Freshness
- Built from commit: `fef06b76`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Activity & Approval Bus
- Capability Activation Service
- Core Tools & Agenda
- Research & Evidence Gathering
- Proactivity Engine
- Audio Bridge (macOS)
- Affect & Config Service
- Computer Control Contract
- Sleep Consolidation Scheduler
- App UI Screenshots
- Audio IO
- Evaluation Screenshots & Runs
- Voice Server (Ears)
- Durable Grants Management
- Role Override Router
- Agent Runtime
- Audit Log & Agenda
- Device Control Gateway
- Workspace Files Contract
- Context Provider Contract
- Secrets Vault
- TS Config (Command Center)
- Architecture Decisions Log
- Entity Memory Matching
- Tauri App Config
- Voice Turn-Taking
- Model Provider Adapter
- Memory Judge Gateway
- Rust Core Estop Client
- A2UI Panel Registry
- Gateway Config
- Episodic Memory
- App Panel Screenshots
- Terminal Policy Runner
- Command Center Home Page
- TTS/STT Engine Contracts
- Entity Graph Recall
- Semantic Memory Search
- Wake Word Engines
- Settings Registry
- Gateway Router Tests
- Requirements & Runbooks Docs
- Base TS Config
- Perception Service
- Ops Health & Backup
- MCP Server Registry
- Package Dependencies
- Architecture Decision Records
- Root Package Config
- Voice Engine Tests
- Projects Tracking
- Autonomy Budget
- Memory Management API
- Files UI Page
- Pulse UI Page
- Skills UI Page
- Companion App Package
- Kernel TS Config
- Settings Registry Types
- Memory UI Page
- Self-Extension UI Page
- Tauri Permissions Config
- Knowledge Graph Build Pipeline
- Streaming STT Engine
- Agent UI Page
- Command Center Package
- TS Dev Dependencies
- Mac Preflight Script
- Devices UI Page
- Models UI Page
- Proactive UI Page
- Root Agent Instructions
- MCP & Web Capability Decisions
- MCP Client Host
- A2UI Page
- Control UI Page
- Graph UI Page
- Reasoning UI Page
- Terminal UI Page
- Web UI Page
- React Type Dependencies
- Design System Docs
- Voice Activity Detection
- A2UI Schema
- Announcement Service
- Next.js Dependencies
- Platform Decisions
- Threat Model (Injection/Spoofing)
- Threat Model (Supply Chain)
- Kernel Package Config
- NPM Scripts
- Anthropic Adapter Tests
- Announcement Tests
- Chat UI Page
- Voice Orb UI Page
- Persona UI Page
- Settings UI Page
- Module Guides & READMEs
- Graphify Setup Script
- Model Asset Fetching
- Voice Stack Decisions
- Root Layout Component
- Agent Runtime Design
- Self-Extension Safety
- Memory Store Interface
- MCP Test Server
- Next.js Config
- Next.js Env Types
- Swift Package Manifest
- Valkey Caching Decisions
- Spatial Input Model
- Simulator Depth Suite
- Hardware Inventory Design
- Background Autonomy Approval
- Contextual Awareness Service
- Skills Registry Design
- A2UI Feature Decisions
- Jarvis Companion App
- Graphify Auto-Update Script
- Graphify Refresh Script
- Module CLAUDE.md Deferral
- Observability Viewer Choice
- MCP Spec Target
- Local Model Baseline
- Desktop Shell Choice
- macOS Control Stack
- Affect Inference Scheduling
- Computer-Control Simulation
- Terminal Policy Capability
- Companion App Scaffold
- Semantic Vector Recall
- Prompts Registry Design
- Proactivity Rules Design
- Graph-Brain Memory
- Anthropic API Gateway
- Gateway Observability
- Deep-Reasoning Escalation
- Generation Settings Design
- Deep-Reasoning Learning
- Sleep-Cycle Consolidation
- Override Contract Revision
- Reasoning Panel Fix
- Override Ledger Principle
- Gateway Role Editor
- Conversational Settings Editing
- Vector Index (pgvector)
- Runtime Settings Registry
- Persisted Consent State
- Dynamic Settings A2UI
- Memory Evolution Completeness
- Sleep-Time Memory Consolidation
- Self-Authored Agenda
- Rhythms Scheduling Design
- Spend Governance Policy
- Memory Injection Hardening
- Initiative And Dissent
- Durable Projects Feature
- Perception Core Design
- Longevity Ops Design
- Affect Layer Implementation
- Stage-B Self-Extension
- Trust Zone User
- Core Trust Domain
- Trust Zone Orchestration
- Trust Zone Tooling
- Trust Zone Extensions
- Trust Zone Content
- Trust Zone Models
- Jarvis Ears Module
- URL Target Checker
- Kokoro TTS Engine
- Policy & Grants Engine

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
- **Session-continuity governing document set** — docs_implementation_plan, docs_decision_log_doc, docs_capability_parity_matrix_doc, docs_requirements_traceability_doc, claude [EXTRACTED 0.85]
- **Graphify Build/Query Pipeline Components** — dot_claude_skills_graphify_skill_md_doc, dot_claude_skills_graphify_references_extraction_spec_md_doc, dot_claude_skills_graphify_references_query_md_doc, dot_claude_skills_graphify_references_update_md_doc, dot_claude_skills_graphify_references_transcribe_md_doc [EXTRACTED 0.85]
- **Terminal-with-policy capability (Phase 2)** — services_kernel_src_terminal_contract_terminalrunner, services_kernel_src_terminal_policy_assesscommand, services_kernel_src_terminal_runner_localterminal, services_kernel_src_terminal_tools_terminal_inspect, services_kernel_src_terminal_tools_terminal_run [EXTRACTED 0.85]
- **Web browsing/research capability (Phase 2)** — services_kernel_src_web_contract_webbrowser, services_kernel_src_web_policy_checkwebtarget, services_kernel_src_web_playwright_playwrightbrowser, services_kernel_src_web_tools_webtools, services_kernel_src_web_tools_web_open, services_kernel_src_web_tools_web_readtext, services_kernel_src_web_tools_web_links, services_kernel_src_web_tools_web_screenshot, services_kernel_src_web_tools_web_fill, services_kernel_src_web_tools_web_click [EXTRACTED 0.85]
- **Binding Authored Specification Set (docs 01-07)** — docs_01_mission_and_core_loop_doc, docs_02_requirements_doc, docs_03_spatial_hardware_oss_doc, docs_04_stack_and_phases_doc, docs_05_security_scope_locality_doc, docs_06_check_ins_and_verify_doc, docs_07_session_continuity_doc [EXTRACTED 0.90]
- **Mac bring-up capability check-in sequence (8a-8g)** — docs_mac_bringup, decision_d0004, decision_d0022, decision_d0024, decision_d0025, decision_d0027, decision_d0026, decision_d0023 [EXTRACTED 0.90]
- **J.A.R.V.I.S. Trust Zone Architecture (Z0–Z6)** — docs_threat_model_z0_user, docs_threat_model_z1_core_trust_domain, docs_threat_model_z2_orchestration, docs_threat_model_z3_tooling, docs_threat_model_z4_extensions, docs_threat_model_z5_content, docs_threat_model_z6_models [EXTRACTED 0.90]
- **A2UI-Composed J.A.R.V.I.S. Control Panels** — docs_screenshots_a2ui_screenshot, docs_screenshots_settings_screenshot, docs_screenshots_dashboard_screenshot [INFERRED 0.60]
- **Phase 2 gated high-risk capabilities pattern** — services_kernel_src_terminal_policy_assesscommand, services_kernel_src_web_policy_checkwebtarget, services_kernel_src_terminal_tools_terminal_run, services_kernel_src_web_tools_web_open [INFERRED 0.60]
- **Autonomy/heartbeat configuration shared across Settings, Pulse, A2UI and Reasoning pages** — jarvis_settings, jarvis_pulse, jarvis_a2ui_panels, jarvis_reasoning [INFERRED 0.70]
- **Command Center settings/A2UI panel rendering flow** — docs_screenshots_final_a2ui_image, docs_screenshots_final_settings_image, docs_screenshots_final_dashboard_image, services_kernel_src_settings_claude_module [INFERRED 0.70]
- **Shared entities (Dum-E, Tony Stark, Arc Reactor) across memory and knowledge graph views** — jarvis_memory, jarvis_knowledge_graph, jarvis_command_center [INFERRED 0.75]
- **Self-Extension Two-Stage Lifecycle Decisions** — concept_self_extension_two_stage, concept_decision_d0074, concept_decision_d0075, docs_capability_parity_matrix_doc [INFERRED 0.75]
- **Self-extension: draft → propose → approve → activate verification chain** — services_kernel_src_selfext_claude_module, docs_verification_stage_b_affect_2026_07_19_report, docs_verification_chat_parity_audit_2026_07_19_report, docs_verification_full_reverification_2026_07_19_report [INFERRED 0.75]
- **Memory-system bug discovery, fix, and re-verification arc** — docs_verification_observation_run_2026_07_19_report, docs_verification_d0075_memory_judgment_2026_07_20_report, docs_verification_fresh_observation_2026_07_20_report, docs_verification_ab_observation_2026_07_20_report [INFERRED 0.80]
- **Memory, Knowledge Graph and Reasoning form the persistent knowledge/learning layer** — jarvis_memory, jarvis_reasoning [INFERRED 0.80]
- **Shared runtime configuration keys (autonomy/proactive/heartbeat) between Settings and A2UI Panels** — jarvis_settings, jarvis_pulse [INFERRED 0.80]
- **SIMULATION/foundation-first, real-activation gated by check-in pattern** — docs_decision_log_d0022, docs_decision_log_d0023, docs_decision_log_d0024, docs_decision_log_d0025 [INFERRED 0.85]
- **Shared gated approval pipeline across consequential tool actions** — jarvis_agent, jarvis_computer_control, jarvis_devices, jarvis_files, jarvis_terminal, jarvis_web, jarvis_skills [INFERRED 0.85]

## Communities (178 total, 70 thin omitted)

### Community 0 - "Activity & Approval Bus"
Cohesion: 0.05
Nodes (43): ActivityBus, ActivityEvent, ApprovalBroker, ApprovalResolution, PendingApproval, EmergencyStop, Core, CoreLoop (+35 more)

### Community 1 - "Capability Activation Service"
Cohesion: 0.06
Nodes (35): ActivationCheck, ActivationService, activationTools(), authoringTools(), RISK_ORDER, StepRunner, CapabilityGuard, DANGEROUS_PATTERNS (+27 more)

### Community 2 - "Core Tools & Agenda"
Cohesion: 0.08
Nodes (35): a2uiTools(), AgendaItem, agendaTools(), Announcement, announceTools(), Project, ProjectLogEntry, projectTools() (+27 more)

### Community 3 - "Research & Evidence Gathering"
Cohesion: 0.06
Nodes (34): Evidence, GatherOptions, Researcher, ResearchFindings, SourceStatus, TargetCheck, queryTerms(), scorePassages() (+26 more)

### Community 4 - "Proactivity Engine"
Cohesion: 0.08
Nodes (27): parseJson(), sliceSpan(), ProactivityEngine, GateStack, inQuietHours(), priorityRank(), briefingCandidate(), calendarConflictCandidates() (+19 more)

### Community 5 - "Audio Bridge (macOS)"
Cohesion: 0.09
Nodes (28): AppKit, ApplicationServices, AudioBridge, Double, Float, EarsClient, Float, AppInfoDTO (+20 more)

### Community 6 - "Affect & Config Service"
Cohesion: 0.07
Nodes (34): AffectReading, inferAffect(), Tone, Urgency, ConfigSchema, KernelConfig, loadConfig(), registerCoreRoutes() (+26 more)

### Community 7 - "Computer Control Contract"
Cohesion: 0.09
Nodes (12): AppInfo, AxElement, ComputerControl, ControlProvenance, ControlResult, ElementSelector, Screenshot, WindowInfo (+4 more)

### Community 8 - "Sleep Consolidation Scheduler"
Cohesion: 0.08
Nodes (16): BackgroundScheduler, ConsolidationReport, DecisionLog, SleepCycle, Autotune, DEFAULT_AUTOTUNE, DepthAssessment, DepthReason (+8 more)

### Community 9 - "App UI Screenshots"
Cohesion: 0.06
Nodes (42): Chat/Converse UI screenshot, Agent (gated multi-step tasks) UI screenshot, Computer Control UI screenshot, Devices (Stark-residence simulation) UI screenshot, Files workspace UI screenshot, Terminal (policy-gated shell) UI screenshot, Web (headless browser) UI screenshot, Memory (entities & timeline) UI screenshot (+34 more)

### Community 10 - "Audio IO"
Cohesion: 0.07
Nodes (21): AudioSink, AudioSource, BufferAudioSink, BufferAudioSource, _PortAudioSource, ndarray, Path, Protocol (+13 more)

### Community 11 - "Evaluation Screenshots & Runs"
Cohesion: 0.08
Nodes (36): A2UI generated panels screenshot, Command Center dashboard screenshot, Memory panel screenshot, Model gateway panel screenshot, Pulse (heartbeat/agenda) panel screenshot, Settings panel screenshot, A/B Observation: Opus/Sonnet vs Haiku tier, Chat-Parity Audit — guarantees, screenshots, self-evolution gaps (+28 more)

### Community 12 - "Voice Server (Ears)"
Cohesion: 0.11
Nodes (21): BaseModel, listen(), load_engines(), ndarray, jarvis-ears HTTP/WS surface (localhost only, R-LOC-01).  GET  /health  — real en, Run the full utterance through the streaming STT and return the transcript., A complete captured utterance @16kHz mono float32. On the Mac the audio     come, Full voice round-trip: audio -> STT -> kernel core loop -> TTS audio out.     Ev (+13 more)

### Community 13 - "Durable Grants Management"
Cohesion: 0.08
Nodes (5): DurableGrants, InterlockManager, PromptRegistry, SkillRegistry, toSkill()

### Community 14 - "Role Override Router"
Cohesion: 0.14
Nodes (18): parseRolePin(), loadRoleOverrides(), persistRoleOverrides(), Store, StoredRoleOverrides, ajv, GatewayRouter, pinOf() (+10 more)

### Community 15 - "Agent Runtime"
Cohesion: 0.10
Nodes (22): AgentResult, AgentRunOptions, AgentRuntime, AgentStep, LocalAgentRuntime, AutonomyStatus, TickResult, wrapUntrusted() (+14 more)

### Community 16 - "Audit Log & Agenda"
Cohesion: 0.11
Nodes (12): Agenda, AuditEntry, AuditLog, redactSecrets(), WHOLE_MATCH_PATTERNS, Prompt, PromptKind, audit (+4 more)

### Community 17 - "Device Control Gateway"
Cohesion: 0.13
Nodes (15): DEVICE_RISK, DeviceCommand, DeviceGateway, DeviceInfo, DeviceProvenance, DeviceResult, DeviceState, DeviceType (+7 more)

### Community 18 - "Workspace Files Contract"
Cohesion: 0.14
Nodes (16): DirEntry, EditOutcome, FileContent, FileInfo, FileKind, SearchMatch, SearchOptions, SearchResult (+8 more)

### Community 19 - "Context Provider Contract"
Cohesion: 0.14
Nodes (14): CommitmentContext, ContextProvider, ContextSnapshot, EpisodeSource, KnowledgeSource, KnownEntity, PinnedFact, ProactiveContext (+6 more)

### Community 20 - "Secrets Vault"
Cohesion: 0.11
Nodes (11): normalizeName(), SecretInfo, SecretsVault, gcmDecrypt(), gcmEncrypt(), Vault, WRAP_INFO, audit (+3 more)

### Community 21 - "TS Config (Command Center)"
Cohesion: 0.07
Nodes (27): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+19 more)

### Community 22 - "Architecture Decisions Log"
Cohesion: 0.11
Nodes (27): CLAUDE.md — J.A.R.V.I.S. Repository Guide, Core Interaction Loop, D-0002 Architecture Option Approved (Option A), D-0003 Capability Parity Matrix Approved, D-0074 Code-Authored Capabilities Run In-Container (Correction), D-0075 Fast-Model Memory Judgments + Self-Authored Skills, D-0076 Fresh 70/30 Observation — ops.health() Bug + Approval-Wait Trap, D-0077 Rhythm Sync — Agenda Freshness Gate + Chat Delivery of Announcements (+19 more)

### Community 23 - "Entity Memory Matching"
Cohesion: 0.17
Nodes (4): anyPairShareWord(), assertNotSecret(), EntityMemory, seedChain()

### Community 24 - "Tauri App Config"
Cohesion: 0.07
Nodes (26): app, security, trayIcon, windows, build, devUrl, frontendDist, bundle (+18 more)

### Community 25 - "Voice Turn-Taking"
Cohesion: 0.14
Nodes (17): Enum, Typed, replaceable speech-engine contracts (R-VOICE-12).  Every engine is an ope, VadFrame, Full-duplex turn-taking + barge-in state machine (R-VOICE-03).  This is the ENGI, Drives the conversation's turn state from VAD frames.      Barge-in fires when,, Feed one VAD frame; returns any turn transitions it triggered., TurnEvent, TurnTaker (+9 more)

### Community 26 - "Model Provider Adapter"
Cohesion: 0.13
Nodes (9): ProviderAdapter, ProviderError, OllamaMessage, createOpenAiCompatAdapter(), ChatEvent, NeutralMessage, TargetOptions, ToolCall (+1 more)

### Community 27 - "Memory Judge Gateway"
Cohesion: 0.13
Nodes (9): PrivacyClass, EntityCandidate, EntityForMerge, EntityMergeGroup, FactForMerge, GatewayMemoryJudge, MemoryJudge, MergeGroup (+1 more)

### Community 28 - "Rust Core Estop Client"
Cohesion: 0.18
Nodes (19): engage_estop(), estop_engaged(), get(), is_healthy(), KernelError, parse_status(), post(), request() (+11 more)

### Community 29 - "A2UI Panel Registry"
Cohesion: 0.23
Nodes (7): A2uiPanel, A2uiRegistry, A2uiSpec, A2uiSpecSchema, validateReferences(), audit, settings

### Community 30 - "Gateway Config"
Cohesion: 0.14
Nodes (16): DEFAULT_GATEWAY_CONFIG, ENV_DEFAULT_KINDS, loadGatewayConfig(), NON_GENERATIVE_ROLES, resolveGatewayConfig(), createOllamaAdapter(), ContentPart, EffortLevel (+8 more)

### Community 31 - "Episodic Memory"
Cohesion: 0.19
Nodes (10): Entity, Fact, Episode, EpisodeKind, EpisodicMemory, KINDS, normalizeKind(), RecallOptions (+2 more)

### Community 32 - "App Panel Screenshots"
Cohesion: 0.10
Nodes (21): A2UI Panels — Autonomy & Proactivity control panel screenshot, Audit trail — Command Center dashboard (night state) screenshot, Converse screen with deep-reasoning persona echo screenshot, Converse screen idle state screenshot, Computer Control (SIMULATION desktop, gated pipeline) screenshot, Command Center dashboard (kernel/audit/memory/MCP/proactive) screenshot, Devices — Stark-residence SIMULATION home control screenshot, Files — workspace browser & search screenshot (+13 more)

### Community 33 - "Terminal Policy Runner"
Cohesion: 0.14
Nodes (13): CommandResult, Provenance, RunOptions, TerminalRunner, assessCommand(), Assessment, DENY, READ_ONLY (+5 more)

### Community 34 - "Command Center Home Page"
Cohesion: 0.14
Nodes (15): activityColor(), ActivityEvent, btn(), ContextData, EmergencyStopButton(), formatActivity(), HealthReport, inputStyle (+7 more)

### Community 35 - "TTS/STT Engine Contracts"
Cohesion: 0.12
Nodes (9): ndarray, Protocol, Feed a PCM frame; return any wake detections in that frame., Yield audio chunks as they become available (sentence-level or better)., StreamingTtsEngine, SttEngine, TtsEngine, VadEngine (+1 more)

### Community 36 - "Entity Graph Recall"
Cohesion: 0.15
Nodes (13): contentWords(), diceCoefficient(), EntityKind, fullestName(), GraphNeighborhood, GraphRecall, mergeAttrs(), nameSimilar() (+5 more)

### Community 37 - "Semantic Memory Search"
Cohesion: 0.13
Nodes (11): EmbedFn, SemanticHit, SemanticMemory, SemanticSource, toVectorLiteral(), audit, embed(), hashEmbed() (+3 more)

### Community 38 - "Wake Word Engines"
Cohesion: 0.18
Nodes (7): WakeEvent, ndarray, Wake-word engine: openWakeWord ONNX pipeline.  Code: Apache-2.0 (dscripka/openWa, ndarray, Path, Wake-word engine: sherpa-onnx open-vocabulary keyword spotting (Apache-2.0).  Th, SherpaKeywordWake

### Community 39 - "Settings Registry"
Cohesion: 0.21
Nodes (3): SettingSpec, SettingsRegistry, validate()

### Community 40 - "Gateway Router Tests"
Cohesion: 0.17
Nodes (6): ChatRequest, ChatResult, JudgeGateway, auditRows, baseConfig, fakePool

### Community 41 - "Requirements & Runbooks Docs"
Cohesion: 0.17
Nodes (15): D-0019: Affect/Emotion Inference Rescheduled, D-0020: Personal Health Telemetry Accepted, D-0022: macOS computer-control activation gate, D-0024: Proactive delivery enable, D-0025: Physical device control enable, D-0027: MCP server trust elevation, D-0046: Gateway pinned to current Anthropic API, DEVELOPMENT.md — Running J.A.R.V.I.S. Locally (+7 more)

### Community 42 - "Base TS Config"
Cohesion: 0.13
Nodes (14): ES2023, compilerOptions, declaration, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, lib, module (+6 more)

### Community 43 - "Perception Service"
Cohesion: 0.19
Nodes (6): FilePerceptionSource, Observation, PerceptionService, PerceptionSource, perceptionTools(), Provenance

### Community 44 - "Ops Health & Backup"
Cohesion: 0.18
Nodes (4): canonicalJson(), BRAIN_TABLES, HealthReport, Ops

### Community 45 - "MCP Server Registry"
Cohesion: 0.20
Nodes (6): McpDiscovery, McpToolSpec, McpRegistry, McpServerRow, RegisteredServer, TrustLevel

### Community 46 - "Package Dependencies"
Cohesion: 0.15
Nodes (13): ajv, fastify, @modelcontextprotocol/sdk, pg, playwright, dependencies, ajv, fastify (+5 more)

### Community 47 - "Architecture Decision Records"
Cohesion: 0.17
Nodes (13): D-0008 — Thin in-house model gateway; LiteLLM optional adapter, D-0013 — Postgres encryption approach, D-0021 — Memory architecture + local security model approved, D-0025 — Device-control foundation SIMULATION-first, D-0028 — Managed SecretsVault for integration credentials, D-0038 — Semantic memory: entities/facts/relations store, D-0039 — Semantic memory feeds contextual awareness, D-0041 — Episodic memory: recallable timeline of events (+5 more)

### Community 48 - "Root Package Config"
Cohesion: 0.15
Nodes (12): description, engines, node, name, packageManager, private, scripts, build (+4 more)

### Community 49 - "Voice Engine Tests"
Cohesion: 0.21
Nodes (11): ndarray, Engine tests against real models (no mocks — R-CORE-02).  Requires model assets, Real TTS -> real STT round trip: Kokoro speaks a command, STT must hear it., End-to-end: TTS speaks the wake phrase; the wake engine must detect it., _resample_24k_to_16k(), stt(), test_stt_transcribes_synthesized_speech(), test_vad_distinguishes_speech_from_silence() (+3 more)

### Community 51 - "Autonomy Budget"
Cohesion: 0.21
Nodes (4): AUTONOMY_SOURCES, Budget, BudgetStatus, PRICE_PER_MTOK

### Community 53 - "Files UI Page"
Cohesion: 0.21
Nodes (10): btn(), Entry, Ev, FileContent, FilesPage(), formatEv(), inputStyle, Match (+2 more)

### Community 54 - "Pulse UI Page"
Cohesion: 0.18
Nodes (11): Beat, card(), ctl, dim, h2, input, Item, linkBtn (+3 more)

### Community 55 - "Skills UI Page"
Cohesion: 0.21
Nodes (10): AgentResult, btn(), Ev, formatEv(), inputStyle, Pending, pipeColor(), Skill (+2 more)

### Community 56 - "Companion App Package"
Cohesion: 0.17
Nodes (11): description, devDependencies, @tauri-apps/cli, name, private, scripts, build, dev (+3 more)

### Community 57 - "Kernel TS Config"
Cohesion: 0.17
Nodes (11): node, src/**/*.test.ts, src/**/*.ts, ../../tsconfig.base.json, compilerOptions, outDir, rootDir, types (+3 more)

### Community 58 - "Settings Registry Types"
Cohesion: 0.20
Nodes (9): DynamicSpecInput, EffectiveSetting, jaccard(), normKey(), Override, SettingOrigin, SettingType, SettingValue (+1 more)

### Community 59 - "Memory UI Page"
Cohesion: 0.22
Nodes (9): btn(), Entity, Episode, Fact, inputStyle, MemoryPage(), Recall, Rel (+1 more)

### Community 60 - "Self-Extension UI Page"
Cohesion: 0.20
Nodes (9): ActiveCap, BENIGN, btn(), Finding, MALICIOUS, Report, SelfExtPage(), Verdict (+1 more)

### Community 61 - "Tauri Permissions Config"
Cohesion: 0.18
Nodes (10): description, identifier, permissions, $schema, windows, core:default, core:window:allow-set-focus, core:window:allow-show (+2 more)

### Community 62 - "Knowledge Graph Build Pipeline"
Cohesion: 0.20
Nodes (11): Graphify Knowledge-Graph Build Pipeline, .claude/CLAUDE.md graphify pointer, graphify reference: add-watch, graphify reference: exports, graphify reference: extraction-spec, graphify reference: github-and-merge, graphify reference: hooks, graphify reference: query/path/explain (+3 more)

### Community 63 - "Streaming STT Engine"
Cohesion: 0.27
Nodes (5): SttPartial, ndarray, Path, Streaming STT engine: sherpa-onnx streaming zipformer transducer (Apache-2.0)., SherpaStreamingStt

### Community 64 - "Agent UI Page"
Cohesion: 0.27
Nodes (8): AgentPage(), AgentResult, btn(), Ev, formatEv(), Pending, pipeColor(), Step

### Community 65 - "Command Center Package"
Cohesion: 0.20
Nodes (9): description, name, private, scripts, build, dev, start, typecheck (+1 more)

### Community 66 - "TS Dev Dependencies"
Cohesion: 0.20
Nodes (10): typescript, devDependencies, tsx, @types/pg, typescript, vitest, typescript, tsx (+2 more)

### Community 67 - "Mac Preflight Script"
Cohesion: 0.36
Nodes (8): bad(), have(), hdr(), note(), ok(), port_state(), mac_preflight.sh script, skip()

### Community 68 - "Devices UI Page"
Cohesion: 0.31
Nodes (6): btn(), DevicesPage(), Ev, formatEv(), pipeColor(), RunOutcome

### Community 69 - "Models UI Page"
Cohesion: 0.28
Nodes (8): CallRow, h2(), inp, ModelsPage(), Override, ProviderRow, sec(), td

### Community 70 - "Proactive UI Page"
Cohesion: 0.25
Nodes (7): btn(), ProactivePage(), Rule, ruleInput, RunResult, Suppression, Surfaced

### Community 71 - "Root Agent Instructions"
Cohesion: 0.25
Nodes (9): CLAUDE.md — Root Agent Instructions, D-0002: Architecture Option A approved, D-0004/D-0004a: Voice stack approved with condition, D-0021: Memory architecture + local security model approved, D-0023: Self-extension Stage B activation (dedicated security check-in), D-0075: Fast-model memory judgments + self-authored skills, IMPLEMENTATION_PLAN.md — Living Development Plan, Product Spec (docs/PRODUCT_SPEC.md) (+1 more)

### Community 72 - "MCP & Web Capability Decisions"
Cohesion: 0.28
Nodes (9): D-0027 — MCP client host built; trust elevation is a check-in, D-0032 — Workspace knowledge/files capability, D-0033 — Tool results feed agent's reasoning (detail field), D-0034 — Web browsing/research capability, D-0036 — Research-with-provenance over gated web browser, D-0037 — Untrusted-content envelopes (prompt-injection defense), J.A.R.V.I.S. Threat Model, R-CORE-03 (+1 more)

### Community 73 - "MCP Client Host"
Cohesion: 0.28
Nodes (5): hashTools(), McpClientHost, audit, clients, serverPath

### Community 74 - "A2UI Page"
Cohesion: 0.29
Nodes (6): A2uiPage(), Component, ctl(), input, Panel, Setting

### Community 75 - "Control UI Page"
Cohesion: 0.36
Nodes (6): btn(), ControlPage(), Ev, formatEv(), pipeColor(), RunOutcome

### Community 76 - "Graph UI Page"
Cohesion: 0.29
Nodes (7): Bundle, chip(), EntityRow, GEdge, GNode, GraphPage(), input

### Community 77 - "Reasoning UI Page"
Cohesion: 0.36
Nodes (7): Autotune, chip(), h2(), input, ReasoningPage(), Report, sec()

### Community 78 - "Terminal UI Page"
Cohesion: 0.36
Nodes (6): btn(), Ev, formatEv(), pipeColor(), RunOutcome, TerminalPage()

### Community 79 - "Web UI Page"
Cohesion: 0.36
Nodes (6): btn(), Ev, formatEv(), pipeColor(), RunOutcome, WebPage()

### Community 80 - "React Type Dependencies"
Cohesion: 0.25
Nodes (8): devDependencies, @types/node, @types/react, @types/react-dom, @types/node, @types/node, @types/react, @types/react-dom

### Community 81 - "Design System Docs"
Cohesion: 0.29
Nodes (7): D-0026: Design system check-in, D-0026 — Visual design system proposed; Ambient Voice Orb built, R-UI-01, R-UI-01: Functional visual language without Marvel IP, R-UI-02: Color semantics, motion-communicates-state, accessibility, R-UI-03: No decorative/meaningless visual elements, R-UI-04: Interface modes as real vertical slices

### Community 82 - "Voice Activity Detection"
Cohesion: 0.32
Nodes (4): ndarray, Path, SileroVad, vad()

### Community 83 - "A2UI Schema"
Cohesion: 0.25
Nodes (7): A2uiComponent, A2uiComponentSchema, Action, Heading, Setting, SettingsGroup, Text

### Community 85 - "Next.js Dependencies"
Cohesion: 0.29
Nodes (7): dependencies, next, react, react-dom, next, react, react-dom

### Community 86 - "Platform Decisions"
Cohesion: 0.29
Nodes (7): D-0004: Voice Stack Pick, D-0007: Valkey over Redis, D-0008: Own Thin Adapter over LiteLLM, D-0011: Pin to Stable MCP Spec, D-0015: Custom macOS Control Bridge, Research & Platform Verification (Phase 0), Voice Orb — standing-by state screenshot

### Community 87 - "Threat Model (Injection/Spoofing)"
Cohesion: 0.29
Nodes (7): D-0037: Untrusted Content Envelope, A1 — Memory Stores, ADV1 — Remote Content Author, ADV5 — Voice Spoofer, T1 — Prompt Injection, T5 — Memory Poisoning, T6 — Voice Spoofing & False Wake

### Community 88 - "Threat Model (Supply Chain)"
Cohesion: 0.29
Nodes (7): A2 — Credentials & API Keys, A4 — Policy Engine Config, ADV2 — Malicious/Compromised MCP Server, ADV3 — Supply Chain Adversary, ADV6 — System's Own Generated Code, T2 — Tool Poisoning / Malicious MCP Server, T3 — Self-Extension Abuse

### Community 89 - "Kernel Package Config"
Cohesion: 0.29
Nodes (6): description, main, name, private, type, version

### Community 90 - "NPM Scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, migrate, start, test, typecheck

### Community 91 - "Anthropic Adapter Tests"
Cohesion: 0.33
Nodes (4): createAnthropicAdapter(), adapter(), bodies, TOOL

### Community 92 - "Announcement Tests"
Cohesion: 0.33
Nodes (4): activity, audit, DAY, NIGHT

### Community 93 - "Chat UI Page"
Cohesion: 0.50
Nodes (3): appendToLastAssistant(), applyFrame(), Turn

### Community 94 - "Voice Orb UI Page"
Cohesion: 0.40
Nodes (3): OrbState, STATE_COLOR, STATE_LABEL

### Community 95 - "Persona UI Page"
Cohesion: 0.50
Nodes (4): btn(), inputStyle, PersonaPage(), Prompt

### Community 96 - "Settings UI Page"
Cohesion: 0.50
Nodes (4): ctl(), input, Setting, SettingsPage()

### Community 97 - "Module Guides & READMEs"
Cohesion: 0.50
Nodes (5): apps/command-center CLAUDE.md module guide, apps/companion README.md, apps/companion Tauri icons README, apps/companion ui/index.html fallback page, pnpm-workspace.yaml monorepo config

### Community 98 - "Graphify Setup Script"
Cohesion: 0.70
Nodes (4): bad(), ok(), graphify-setup.sh script, warn()

### Community 99 - "Model Asset Fetching"
Cohesion: 0.60
Nodes (4): fetch(), main(), Path, Fetch jarvis-ears model assets from verifiable sources into JARVIS_EARS_MODELS.

### Community 100 - "Voice Stack Decisions"
Cohesion: 0.50
Nodes (4): D-0004 — Voice stack picks, D-0004a — TTS multi-adapter routable role, R-MODEL-04, R-VOICE-10

### Community 102 - "Agent Runtime Design"
Cohesion: 0.67
Nodes (3): D-0009 — Agent runtime: LangGraph behind AgentRuntime interface, D-0030 — Agent runtime (jarvis-mind) foundation, R-SEC-04

### Community 103 - "Self-Extension Safety"
Cohesion: 0.67
Nodes (3): D-0023 — Self-extension safety-first; Stage B gated, R-CAP-05, R-CAP-08

### Community 176 - "Kokoro TTS Engine"
Cohesion: 0.24
Nodes (6): TtsChunk, KokoroTts, Path, TTS engine: Kokoro-82M via ONNX (model Apache-2.0). Local offline baseline.  Use, _split_sentences(), kokoro()

### Community 177 - "Policy & Grants Engine"
Cohesion: 0.21
Nodes (8): DurableGrantRow, ActionRequest, Decision, ORDER, PROHIBITED, riskAtOrBelow(), RiskClass, audit

## Ambiguous Edges - Review These
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
- `Audit trail — Command Center dashboard (night state) screenshot` → `Command Center dashboard (kernel/audit/memory/MCP/proactive) screenshot`  [AMBIGUOUS]
  docs/screenshots/audit/00-dashboard.png · relation: conceptually_related_to
- `J.A.R.V.I.S. A2UI Panels (sandboxed renderer, whitelisted components, D-0061)` → `J.A.R.V.I.S. Self-Extension (Stage A generate/review, Stage B approve/activate, hard limit R-CAP-08)`  [AMBIGUOUS]
  docs/screenshots/audit/17-selfext.png · relation: shares_data_with

## Knowledge Gaps
- **505 isolated node(s):** `PendingApproval`, `Decision`, `PROHIBITED`, `Preference`, `audit` (+500 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **70 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

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
- **What is the exact relationship between `Clean-Slate Evolution Acceptance Run (D-0063)` and `Living-Heartbeat Verification (D-0064)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._