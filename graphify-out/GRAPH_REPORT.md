# Graph Report - .  (2026-07-22)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2004 nodes · 4251 edges · 144 communities (98 shown, 46 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 84 edges (avg confidence: 0.64)
- Token cost: 9,304 input · 2,059 output

## Graph Freshness
- Built from commit: `108165c8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Approval & Audit Broker
- Project Architecture Docs
- Proactivity Gate Engine
- Agent Tool Builders
- Research Evidence Gathering
- macOS Audio Bridge
- Computer Control Contract
- Capability Guard & Activation
- Affect & Config Loading
- UI Screenshots Gallery
- Secrets Vault
- Kernel Package Dependencies
- Python Audio I/O
- Emergency Stop & Grants
- Speech Daemon HTTP API
- Memory Maintenance Ops
- Agent Runtime Contract
- Tool Registry Core
- Device Gateway Contract
- Workspace File Contracts
- Approval Decisions & Requirements
- Context Provider Contract
- Command Center TS Config
- Tauri App Config
- Memory Judge & Merge
- Command Center Package Config
- Autonomy Decision Log
- Voice Turn-Taking State Machine
- Model Provider Adapters
- Rust Kernel Core Lib
- MCP Client Registry
- Gateway Config Schema
- Episodic Memory Store
- Settings Registry
- Entity Resolution Utils
- Entity Memory Store
- Gateway Adapter Tests
- Command Center Dashboard Page
- Product Decisions & Screenshots
- Speech Engine Protocols
- Sleep Cycle Consolidation
- Semantic Memory Search
- Wake Word Engines
- Role Overrides Store
- Project Tracking
- Knowledge & Research Tools
- Base TS Config
- A2UI Panel Registry
- Gateway Router
- Perception Service
- Announcement System
- Settings Registry Ops
- Root Package Config
- Voice Engine Tests
- Autonomy Budget Control
- Reasoning Tuner
- Terminal Command Policy
- Files UI Page
- Pulse UI Page
- Skills UI Page
- Companion Package Config
- Kernel TS Config
- Background Autonomy Scheduler
- Persona Prompt Registry
- Terminal Runner Contract
- Memory UI Page
- Self-Extension UI Page
- Tauri Permissions Config
- Streaming STT Engine
- Agent UI Page
- Graphify Reference Docs
- Mac Preflight Script
- Skill Registry
- Devices UI Page
- Models UI Page
- Proactive Rules UI Page
- Audit Log Verification
- A2UI Settings Page
- Control UI Page
- Knowledge Graph UI Page
- Reasoning UI Page
- Terminal UI Page
- Web UI Page
- Voice Activity Detection
- A2UI Component Schema
- Anthropic Adapter Tests
- Agenda Store
- Chat UI Page
- Orb UI Page
- Persona UI Page
- Settings UI Page
- Model Asset Fetcher
- Root Layout Metadata
- Agent Runtime Decisions
- Scale & Ops Decisions
- Memory Judgment Verification
- Docker Infra Compose
- MCP Test Server
- Next.js Config
- Next.js Env Types
- Swift Package Config
- Valkey vs Redis Decision
- Tauri Desktop Shell
- macOS Control Simulation
- Affect State Inference
- Device Control & Secrets
- Memory Graph Recall
- A2UI Panel Sandboxing
- Voice Stack Decision
- Module CLAUDE.md Deferral
- Observability Viewer Choice
- Local Model Baseline
- Spatial Input Model
- Simulator Depth Decision
- Hardware Inventory Decision
- Self-Extension Safety Gate
- Skills Registry Decision
- Workspace Files Capability
- Terminal Policy Decision
- Model Gateway Observability
- Deep Reasoning Escalation
- Generation Settings Decision
- Reasoning Panel UI
- Initiative & Dissent Feature
- Perception Core Decision
- Clean-Slate Acceptance Run
- Phase 1 Acceptance Results
- Affect Verification Report
- Agent Module Guide
- Context Module Guide
- Control Module Guide
- Jarvis Ears Component
- Protected Path Envelope
- Ears Module Guide
- Kernel Module Guide
- Terminal Module Guide
- Web Module Guide
- Kokoro TTS Engine

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
- `Model Gateway Panel Screenshot` --references--> `A/B Observation 2026-07-20 (Opus/Sonnet vs Haiku tier)`  [INFERRED]
  docs/screenshots/final/models.png → docs/verification/AB_OBSERVATION_2026-07-20.md
- `Pulse (Heartbeat/Agenda) Panel Screenshot` --references--> `A/B Observation 2026-07-20 (Opus/Sonnet vs Haiku tier)`  [INFERRED]
  docs/screenshots/final/pulse.png → docs/verification/AB_OBSERVATION_2026-07-20.md
- `A2UI Panels Command Center Screenshot` --references--> `Chat Parity Audit 2026-07-19`  [INFERRED]
  docs/screenshots/final/a2ui.png → docs/verification/CHAT_PARITY_AUDIT_2026-07-19.md
- `Command Center Dashboard Screenshot` --references--> `Chat Parity Audit 2026-07-19`  [INFERRED]
  docs/screenshots/final/dashboard.png → docs/verification/CHAT_PARITY_AUDIT_2026-07-19.md
- `Command Center Dashboard Screenshot` --references--> `Platform Acceptance Results`  [INFERRED]
  docs/screenshots/final/dashboard.png → docs/verification/PLATFORM_ACCEPTANCE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **graphify extraction/build/query pipeline** — claude_skills_graphify_skill, claude_skills_graphify_references_extraction_spec, claude_skills_graphify_references_query, claude_skills_graphify_references_update, claude_skills_graphify_references_exports [INFERRED 0.75]
- **Binding Specification Docs (01-07)** — docs_01_mission_and_core_loop, docs_02_requirements, docs_03_spatial_hardware_oss, docs_04_stack_and_phases, docs_05_security_scope_locality, docs_06_check_ins_and_verify, docs_07_session_continuity [EXTRACTED 0.95]
- **Option A Hybrid Architecture Components** — concept_jarvisd_kernel, concept_jarvis_mind, concept_jarvis_ears, concept_command_center, concept_companion_app [EXTRACTED 0.90]
- **A2UI readiness flow (D-0056 through D-0061)** — docs_decision_log_d0056, docs_decision_log_d0058, docs_decision_log_d0060, docs_decision_log_d0061 [INFERRED 0.85]
- **Three autonomy rhythms: live/heartbeat/quiet-hours governance** — docs_decision_log_d0024, docs_decision_log_d0063, docs_decision_log_d0064, docs_decision_log_d0065, docs_decision_log_d0066 [INFERRED 0.80]
- **Memory evolution completeness: recall/correct/forget/consolidate/harden** — docs_decision_log_d0057, docs_decision_log_d0062, docs_decision_log_d0063, docs_decision_log_d0067 [INFERRED 0.75]
- **Ordered check-in gate sequence unlocking real-world capabilities** — docs_mac_bringup, decision_d0004, decision_d0022, decision_d0023, decision_d0024, decision_d0025, decision_d0026, decision_d0027 [EXTRACTED 0.85]
- **Phase 0 Documentation Set (traceability, research verification, threat model, decision log)** — docs_requirements_traceability, docs_research_verification, docs_threat_model, docs_decision_log [INFERRED 0.70]
- **Self-Extension / Self-Written Code Capability Narrative** — docs_verification_chat_parity_audit_2026_07_19_report, docs_verification_living_with_jarvis_2026_07_19_report, concept_d0074_self_written_code [INFERRED 0.75]
- **Memory Judgment Verification Chain (Observation → D-0075 → Fresh → A/B)** — docs_verification_observation_run_2026_07_19_report, docs_verification_d0075_memory_judgment_2026_07_20_report, docs_verification_fresh_observation_2026_07_20_report, docs_verification_ab_observation_2026_07_20_report [INFERRED 0.80]
- **Command Center UI Panel Screenshots + Acceptance Docs** — docs_screenshots_final_a2ui_screenshot, docs_screenshots_final_dashboard_screenshot, docs_screenshots_final_memory_screenshot, docs_screenshots_final_models_screenshot, docs_screenshots_final_pulse_screenshot, docs_screenshots_final_settings_screenshot, docs_verification_platform_acceptance_report [INFERRED 0.70]
- **Tools running through the gated policy/approval/audit/verification loop** — services_kernel_src_devices_tools, services_kernel_src_knowledge_tools, services_kernel_src_research_tools, services_kernel_src_mcp_tools, services_kernel_src_selfext_activation, services_kernel_src_skills_tools, services_kernel_src_settings_tools [INFERRED 0.75]
- **R-CAP-01 no-fixed-connector-list registries** — services_kernel_src_prompts_registry, services_kernel_src_skills_registry, services_kernel_src_mcp_registry, services_kernel_src_settings_registry, services_kernel_src_selfext_registry [INFERRED 0.75]
- **Z1 trust-core exclusion / hard-limit enforcement boundary** — services_kernel_src_selfext_protected, services_kernel_src_selfext_guard, services_kernel_src_crypto_secrets, services_kernel_src_settings_catalog [INFERRED 0.70]
- **Disclosure → approval → execute → verify gated pipeline pattern across consequential-action UIs** — docs_screenshots_computer_control, docs_screenshots_device_control, docs_screenshots_files, docs_screenshots_skills, docs_threat_model [INFERRED 0.75]
- **Command Center dashboard as navigation hub linking all J.A.R.V.I.S. UI panels** — docs_screenshots_dashboard, docs_screenshots_audit_00_dashboard, docs_screenshots_chat, docs_screenshots_files, docs_screenshots_memory, docs_screenshots_proactivity, docs_screenshots_device_control, docs_screenshots_computer_control, docs_screenshots_self_extension, docs_screenshots_persona, docs_screenshots_models, docs_screenshots_skills, docs_screenshots_graph, docs_screenshots_settings, docs_screenshots_a2ui, docs_screenshots_pulse, docs_screenshots_voice_orb [EXTRACTED 0.85]
- **Shared runtime configuration keys (autonomy/proactive/heartbeat) between Settings and A2UI Panels** — jarvis_settings, jarvis_a2ui, jarvis_pulse [INFERRED 0.80]
- **Memory, Knowledge Graph and Reasoning form the persistent knowledge/learning layer** — jarvis_memory, jarvis_graph, jarvis_reasoning [INFERRED 0.80]

## Communities (144 total, 46 thin omitted)

### Community 0 - "Approval & Audit Broker"
Cohesion: 0.06
Nodes (26): ActivityBus, ApprovalBroker, ApprovalResolution, PendingApproval, AuditEntry, AuditLog, WHOLE_MATCH_PATTERNS, CoreLoop (+18 more)

### Community 1 - "Project Architecture Docs"
Cohesion: 0.07
Nodes (53): @jarvis/command-center module guide, J.A.R.V.I.S. macOS companion README, Companion app icons README, Companion fallback index.html, Root CLAUDE.md, Command Center (Next.js + R3F UI), Companion (Tauri 2 + Swift bridge), jarvis-ears (Python speech daemon) (+45 more)

### Community 2 - "Proactivity Gate Engine"
Cohesion: 0.08
Nodes (27): ProactivityEngine, GateStack, inQuietHours(), priorityRank(), briefingCandidate(), calendarConflictCandidates(), commitmentCandidates(), dayKey() (+19 more)

### Community 3 - "Agent Tool Builders"
Cohesion: 0.09
Nodes (31): a2uiTools(), AgendaItem, agendaTools(), Announcement, announceTools(), computerControlTools(), ActionDisclosure, buildCore() (+23 more)

### Community 4 - "Research Evidence Gathering"
Cohesion: 0.07
Nodes (24): Evidence, GatherOptions, Researcher, ResearchFindings, SourceStatus, TargetCheck, queryTerms(), scorePassages() (+16 more)

### Community 5 - "macOS Audio Bridge"
Cohesion: 0.09
Nodes (28): AppKit, ApplicationServices, AudioBridge, Double, Float, EarsClient, Float, AppInfoDTO (+20 more)

### Community 6 - "Computer Control Contract"
Cohesion: 0.09
Nodes (12): AppInfo, AxElement, ComputerControl, ControlProvenance, ControlResult, ElementSelector, Screenshot, WindowInfo (+4 more)

### Community 7 - "Capability Guard & Activation"
Cohesion: 0.10
Nodes (32): ActivationCheck, activationTools(), authoringTools(), RISK_ORDER, StepRunner, CapabilityGuard, DANGEROUS_PATTERNS, GuardVerdict (+24 more)

### Community 8 - "Affect & Config Loading"
Cohesion: 0.08
Nodes (31): AffectReading, inferAffect(), Tone, Urgency, ConfigSchema, KernelConfig, loadConfig(), registerCoreRoutes() (+23 more)

### Community 9 - "UI Screenshots Gallery"
Cohesion: 0.06
Nodes (40): J.A.R.V.I.S. Converse UI Screenshot, J.A.R.V.I.S. Agent UI Screenshot, J.A.R.V.I.S. Computer Control UI Screenshot, J.A.R.V.I.S. Devices UI Screenshot, J.A.R.V.I.S. Files UI Screenshot, J.A.R.V.I.S. Terminal UI Screenshot, J.A.R.V.I.S. Web UI Screenshot, J.A.R.V.I.S. Memory UI Screenshot (+32 more)

### Community 10 - "Secrets Vault"
Cohesion: 0.08
Nodes (16): buildCore, exec, randomKek(), resolveKek(), MemoryService, normalizeName(), SecretInfo, SecretsVault (+8 more)

### Community 11 - "Kernel Package Dependencies"
Cohesion: 0.05
Nodes (37): ajv, fastify, @modelcontextprotocol/sdk, pg, playwright, dependencies, ajv, fastify (+29 more)

### Community 12 - "Python Audio I/O"
Cohesion: 0.07
Nodes (21): AudioSink, AudioSource, BufferAudioSink, BufferAudioSource, _PortAudioSource, ndarray, Path, Protocol (+13 more)

### Community 13 - "Emergency Stop & Grants"
Cohesion: 0.08
Nodes (16): EmergencyStop, DurableGrantRow, DurableGrants, ActionRequest, Decision, Grant, ORDER, PolicyEngine (+8 more)

### Community 14 - "Speech Daemon HTTP API"
Cohesion: 0.11
Nodes (21): BaseModel, listen(), load_engines(), ndarray, jarvis-ears HTTP/WS surface (localhost only, R-LOC-01).  GET  /health  — real en, Run the full utterance through the streaming STT and return the transcript., A complete captured utterance @16kHz mono float32. On the Mac the audio     come, Full voice round-trip: audio -> STT -> kernel core loop -> TTS audio out.     Ev (+13 more)

### Community 15 - "Memory Maintenance Ops"
Cohesion: 0.10
Nodes (3): redactSecrets(), assertNotSecret(), registerMemoryRoutes()

### Community 16 - "Agent Runtime Contract"
Cohesion: 0.11
Nodes (22): AgentResult, AgentRunOptions, AgentRuntime, AgentStep, LocalAgentRuntime, AutonomyStatus, TickResult, wrapUntrusted() (+14 more)

### Community 17 - "Tool Registry Core"
Cohesion: 0.11
Nodes (9): Core, ToolRegistry, McpServerConfig, ActivationService, CapabilityRecord, CapabilityRegistry, normalizeComposition(), makeTools() (+1 more)

### Community 18 - "Device Gateway Contract"
Cohesion: 0.13
Nodes (15): DEVICE_RISK, DeviceCommand, DeviceGateway, DeviceInfo, DeviceProvenance, DeviceResult, DeviceState, DeviceType (+7 more)

### Community 19 - "Workspace File Contracts"
Cohesion: 0.14
Nodes (16): DirEntry, EditOutcome, FileContent, FileInfo, FileKind, SearchMatch, SearchOptions, SearchResult (+8 more)

### Community 20 - "Approval Decisions & Requirements"
Cohesion: 0.11
Nodes (31): Decision D-0022: real macOS adapter gated behind check-in, Decision D-0023: Stage B (sandboxed generation, signed install) requires dedicated security check-in, Decision D-0024: proactive cycle gated on check-in, suggestion-only, Decision D-0025: real Home Assistant gateway bound at check-in, Decision D-0027: MCP server trust raises only on reconnect re-attestation, Decision D-0043: user-editable persona (R-CAP-01), Decision D-0045: knowledge graph walk / semantic recall, Decision D-0058: settings editable at runtime, effective=value else default (+23 more)

### Community 21 - "Context Provider Contract"
Cohesion: 0.14
Nodes (14): CommitmentContext, ContextProvider, ContextSnapshot, EpisodeSource, KnowledgeSource, KnownEntity, PinnedFact, ProactiveContext (+6 more)

### Community 22 - "Command Center TS Config"
Cohesion: 0.07
Nodes (27): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+19 more)

### Community 23 - "Tauri App Config"
Cohesion: 0.07
Nodes (26): app, security, trayIcon, windows, build, devUrl, frontendDist, bundle (+18 more)

### Community 24 - "Memory Judge & Merge"
Cohesion: 0.12
Nodes (12): PrivacyClass, EntityCandidate, EntityForMerge, EntityMergeGroup, FactForMerge, GatewayMemoryJudge, JudgeGateway, MemoryJudge (+4 more)

### Community 25 - "Command Center Package Config"
Cohesion: 0.08
Nodes (25): dependencies, next, react, react-dom, description, devDependencies, @types/node, @types/react (+17 more)

### Community 26 - "Autonomy Decision Log"
Cohesion: 0.11
Nodes (26): D-0024 Background autonomy approved, D-0043 Prompts registry for persona, D-0044 User-defined proactivity rules, D-0050 Deep-reasoning learning, D-0051 Sleep-cycle consolidation, D-0052 Sleep-cycle proposals (referenced), D-0052 Override contract revised, D-0053 Dual-editability principle (referenced) (+18 more)

### Community 27 - "Voice Turn-Taking State Machine"
Cohesion: 0.17
Nodes (15): Enum, VadFrame, Full-duplex turn-taking + barge-in state machine (R-VOICE-03).  This is the ENGI, Drives the conversation's turn state from VAD frames.      Barge-in fires when,, Feed one VAD frame; returns any turn transitions it triggered., TurnEvent, TurnTaker, VoiceState (+7 more)

### Community 28 - "Model Provider Adapters"
Cohesion: 0.15
Nodes (10): ProviderAdapter, ProviderError, OllamaMessage, ajv, RoleOverride, ChatEvent, NeutralMessage, RoleTarget (+2 more)

### Community 29 - "Rust Kernel Core Lib"
Cohesion: 0.18
Nodes (19): engage_estop(), estop_engaged(), get(), is_healthy(), KernelError, parse_status(), post(), request() (+11 more)

### Community 30 - "MCP Client Registry"
Cohesion: 0.13
Nodes (11): hashTools(), McpClientHost, McpDiscovery, McpToolSpec, McpRegistry, McpServerRow, RegisteredServer, TrustLevel (+3 more)

### Community 31 - "Gateway Config Schema"
Cohesion: 0.15
Nodes (17): ENV_DEFAULT_KINDS, loadGatewayConfig(), NON_GENERATIVE_ROLES, parseRolePin(), resolveGatewayConfig(), ContentPart, EffortLevel, EffortLevels (+9 more)

### Community 32 - "Episodic Memory Store"
Cohesion: 0.19
Nodes (10): Entity, Fact, Episode, EpisodeKind, EpisodicMemory, KINDS, normalizeKind(), RecallOptions (+2 more)

### Community 33 - "Settings Registry"
Cohesion: 0.18
Nodes (4): jaccard(), SettingSpec, SettingsRegistry, validate()

### Community 34 - "Entity Resolution Utils"
Cohesion: 0.13
Nodes (14): anyPairShareWord(), contentWords(), diceCoefficient(), EntityKind, fullestName(), GraphNeighborhood, GraphRecall, mergeAttrs() (+6 more)

### Community 35 - "Entity Memory Store"
Cohesion: 0.25
Nodes (3): assertNotSecret(), EntityMemory, seedChain()

### Community 36 - "Gateway Adapter Tests"
Cohesion: 0.11
Nodes (9): DEFAULT_GATEWAY_CONFIG, createOllamaAdapter(), createOpenAiCompatAdapter(), GatewayConfig, captured, auditRows, baseConfig, fakePool (+1 more)

### Community 37 - "Command Center Dashboard Page"
Cohesion: 0.14
Nodes (15): activityColor(), ActivityEvent, btn(), ContextData, EmergencyStopButton(), formatActivity(), HealthReport, inputStyle (+7 more)

### Community 38 - "Product Decisions & Screenshots"
Cohesion: 0.16
Nodes (19): D-0051 Sleep-Cycle Autotune Self-Adjustment, D-0064 Living Heartbeat + Agenda, D-0074 Self-Written Code Capability, D-0075 Fast-Model Memory Judgments, Gated Loop (runTool/runConversation choke point), A2UI Panels Command Center Screenshot, Command Center Dashboard Screenshot, Model Gateway Panel Screenshot (+11 more)

### Community 39 - "Speech Engine Protocols"
Cohesion: 0.12
Nodes (9): ndarray, Protocol, Feed a PCM frame; return any wake detections in that frame., Yield audio chunks as they become available (sentence-level or better)., StreamingTtsEngine, SttEngine, TtsEngine, VadEngine (+1 more)

### Community 40 - "Sleep Cycle Consolidation"
Cohesion: 0.18
Nodes (10): ConsolidationReport, DecisionLog, SleepCycle, Autotune, DEFAULT_AUTOTUNE, DepthAssessment, DepthReason, ReasoningMode (+2 more)

### Community 41 - "Semantic Memory Search"
Cohesion: 0.13
Nodes (11): EmbedFn, SemanticHit, SemanticMemory, SemanticSource, toVectorLiteral(), audit, embed(), hashEmbed() (+3 more)

### Community 42 - "Wake Word Engines"
Cohesion: 0.17
Nodes (8): Typed, replaceable speech-engine contracts (R-VOICE-12).  Every engine is an ope, WakeEvent, ndarray, Wake-word engine: openWakeWord ONNX pipeline.  Code: Apache-2.0 (dscripka/openWa, ndarray, Path, Wake-word engine: sherpa-onnx open-vocabulary keyword spotting (Apache-2.0).  Th, SherpaKeywordWake

### Community 43 - "Role Overrides Store"
Cohesion: 0.18
Nodes (9): loadRoleOverrides(), persistRoleOverrides(), Store, StoredRoleOverrides, pinOf(), ChatBodySchema, registerGatewayRoutes(), config (+1 more)

### Community 44 - "Project Tracking"
Cohesion: 0.21
Nodes (5): Project, ProjectLogEntry, Projects, projectTools(), audit

### Community 45 - "Knowledge & Research Tools"
Cohesion: 0.20
Nodes (10): ActivityEvent, knowledgeTools(), researchTools(), audit, makeEstop(), makeLoop(), audit, makeEstop() (+2 more)

### Community 46 - "Base TS Config"
Cohesion: 0.13
Nodes (14): ES2023, compilerOptions, declaration, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, lib, module (+6 more)

### Community 47 - "A2UI Panel Registry"
Cohesion: 0.21
Nodes (8): A2uiPanel, A2uiRegistry, A2uiSpec, A2uiSpecSchema, validateReferences(), audit, settings, toolReg()

### Community 48 - "Gateway Router"
Cohesion: 0.29
Nodes (4): GatewayRouter, ChatRequest, ChatResult, ModelRole

### Community 49 - "Perception Service"
Cohesion: 0.19
Nodes (6): FilePerceptionSource, Observation, PerceptionService, PerceptionSource, perceptionTools(), Provenance

### Community 50 - "Announcement System"
Cohesion: 0.20
Nodes (5): Announcer, activity, audit, DAY, NIGHT

### Community 51 - "Settings Registry Ops"
Cohesion: 0.15
Nodes (10): BRAIN_TABLES, HealthReport, DynamicSpecInput, EffectiveSetting, normKey(), Override, SettingOrigin, SettingType (+2 more)

### Community 52 - "Root Package Config"
Cohesion: 0.15
Nodes (12): description, engines, node, name, packageManager, private, scripts, build (+4 more)

### Community 53 - "Voice Engine Tests"
Cohesion: 0.21
Nodes (11): ndarray, Engine tests against real models (no mocks — R-CORE-02).  Requires model assets, Real TTS -> real STT round trip: Kokoro speaks a command, STT must hear it., End-to-end: TTS speaks the wake phrase; the wake engine must detect it., _resample_24k_to_16k(), stt(), test_stt_transcribes_synthesized_speech(), test_vad_distinguishes_speech_from_silence() (+3 more)

### Community 54 - "Autonomy Budget Control"
Cohesion: 0.21
Nodes (4): AUTONOMY_SOURCES, Budget, BudgetStatus, PRICE_PER_MTOK

### Community 56 - "Terminal Command Policy"
Cohesion: 0.23
Nodes (9): assessCommand(), Assessment, DENY, READ_ONLY, Verdict, terminalTools(), audit, makeEstop() (+1 more)

### Community 57 - "Files UI Page"
Cohesion: 0.21
Nodes (10): btn(), Entry, Ev, FileContent, FilesPage(), formatEv(), inputStyle, Match (+2 more)

### Community 58 - "Pulse UI Page"
Cohesion: 0.18
Nodes (11): Beat, card(), ctl, dim, h2, input, Item, linkBtn (+3 more)

### Community 59 - "Skills UI Page"
Cohesion: 0.21
Nodes (10): AgentResult, btn(), Ev, formatEv(), inputStyle, Pending, pipeColor(), Skill (+2 more)

### Community 60 - "Companion Package Config"
Cohesion: 0.17
Nodes (11): description, devDependencies, @tauri-apps/cli, name, private, scripts, build, dev (+3 more)

### Community 61 - "Kernel TS Config"
Cohesion: 0.17
Nodes (11): node, src/**/*.test.ts, src/**/*.ts, ../../tsconfig.base.json, compilerOptions, outDir, rootDir, types (+3 more)

### Community 62 - "Background Autonomy Scheduler"
Cohesion: 0.21
Nodes (4): BackgroundScheduler, audit, fakeSettings(), makeScheduler()

### Community 63 - "Persona Prompt Registry"
Cohesion: 0.18
Nodes (4): /core/converse endpoint, Prompt, PromptKind, PromptRegistry

### Community 64 - "Terminal Runner Contract"
Cohesion: 0.27
Nodes (5): CommandResult, Provenance, RunOptions, TerminalRunner, LocalTerminal

### Community 65 - "Memory UI Page"
Cohesion: 0.22
Nodes (9): btn(), Entity, Episode, Fact, inputStyle, MemoryPage(), Recall, Rel (+1 more)

### Community 66 - "Self-Extension UI Page"
Cohesion: 0.20
Nodes (9): ActiveCap, BENIGN, btn(), Finding, MALICIOUS, Report, SelfExtPage(), Verdict (+1 more)

### Community 67 - "Tauri Permissions Config"
Cohesion: 0.18
Nodes (10): description, identifier, permissions, $schema, windows, core:default, core:window:allow-set-focus, core:window:allow-show (+2 more)

### Community 68 - "Streaming STT Engine"
Cohesion: 0.27
Nodes (5): SttPartial, ndarray, Path, Streaming STT engine: sherpa-onnx streaming zipformer transducer (Apache-2.0)., SherpaStreamingStt

### Community 69 - "Agent UI Page"
Cohesion: 0.27
Nodes (8): AgentPage(), AgentResult, btn(), Ev, formatEv(), Pending, pipeColor(), Step

### Community 70 - "Graphify Reference Docs"
Cohesion: 0.20
Nodes (9): graphify reference: add-watch, graphify reference: exports, graphify reference: extraction-spec, graphify reference: github-and-merge, graphify reference: hooks, graphify reference: query, graphify reference: transcribe, graphify reference: update (+1 more)

### Community 71 - "Mac Preflight Script"
Cohesion: 0.36
Nodes (8): bad(), have(), hdr(), note(), ok(), port_state(), mac_preflight.sh script, skip()

### Community 73 - "Devices UI Page"
Cohesion: 0.31
Nodes (6): btn(), DevicesPage(), Ev, formatEv(), pipeColor(), RunOutcome

### Community 74 - "Models UI Page"
Cohesion: 0.28
Nodes (8): CallRow, h2(), inp, ModelsPage(), Override, ProviderRow, sec(), td

### Community 75 - "Proactive Rules UI Page"
Cohesion: 0.25
Nodes (7): btn(), ProactivePage(), Rule, ruleInput, RunResult, Suppression, Surfaced

### Community 77 - "A2UI Settings Page"
Cohesion: 0.29
Nodes (6): A2uiPage(), Component, ctl(), input, Panel, Setting

### Community 78 - "Control UI Page"
Cohesion: 0.36
Nodes (6): btn(), ControlPage(), Ev, formatEv(), pipeColor(), RunOutcome

### Community 79 - "Knowledge Graph UI Page"
Cohesion: 0.29
Nodes (7): Bundle, chip(), EntityRow, GEdge, GNode, GraphPage(), input

### Community 80 - "Reasoning UI Page"
Cohesion: 0.36
Nodes (7): Autotune, chip(), h2(), input, ReasoningPage(), Report, sec()

### Community 81 - "Terminal UI Page"
Cohesion: 0.36
Nodes (6): btn(), Ev, formatEv(), pipeColor(), RunOutcome, TerminalPage()

### Community 82 - "Web UI Page"
Cohesion: 0.36
Nodes (6): btn(), Ev, formatEv(), pipeColor(), RunOutcome, WebPage()

### Community 83 - "Voice Activity Detection"
Cohesion: 0.24
Nodes (5): ndarray, Path, VAD engine: Silero VAD v6 ONNX (MIT), 16 kHz, 512-sample frames., SileroVad, vad()

### Community 84 - "A2UI Component Schema"
Cohesion: 0.25
Nodes (7): A2uiComponent, A2uiComponentSchema, Action, Heading, Setting, SettingsGroup, Text

### Community 85 - "Anthropic Adapter Tests"
Cohesion: 0.33
Nodes (4): createAnthropicAdapter(), adapter(), bodies, TOOL

### Community 87 - "Chat UI Page"
Cohesion: 0.50
Nodes (3): appendToLastAssistant(), applyFrame(), Turn

### Community 88 - "Orb UI Page"
Cohesion: 0.40
Nodes (3): OrbState, STATE_COLOR, STATE_LABEL

### Community 89 - "Persona UI Page"
Cohesion: 0.50
Nodes (4): btn(), inputStyle, PersonaPage(), Prompt

### Community 90 - "Settings UI Page"
Cohesion: 0.50
Nodes (4): ctl(), input, Setting, SettingsPage()

### Community 91 - "Model Asset Fetcher"
Cohesion: 0.60
Nodes (4): fetch(), main(), Path, Fetch jarvis-ears model assets from verifiable sources into JARVIS_EARS_MODELS.

### Community 93 - "Agent Runtime Decisions"
Cohesion: 0.67
Nodes (3): D-0008 Model gateway approach, D-0009 Agent runtime: LangGraph behind AgentRuntime interface, D-0030 Agent runtime (jarvis-mind) foundation

### Community 94 - "Scale & Ops Decisions"
Cohesion: 0.67
Nodes (3): D-0046 Scale validation (referenced), D-0057 pgvector HNSW ANN index, D-0071 Longevity ops: health/backup/restore

### Community 95 - "Memory Judgment Verification"
Cohesion: 1.00
Nodes (3): Memory Panel Screenshot, D-0075 Memory Judgment Verification, Observation Run 2026-07-19

### Community 143 - "Kokoro TTS Engine"
Cohesion: 0.24
Nodes (6): TtsChunk, KokoroTts, Path, TTS engine: Kokoro-82M via ONNX (model Apache-2.0). Local offline baseline.  Use, _split_sentences(), kokoro()

## Ambiguous Edges - Review These
- `Chat Parity Audit 2026-07-19` → `D-0075 Fast-Model Memory Judgments`  [AMBIGUOUS]
  docs/verification/CHAT_PARITY_AUDIT_2026-07-19.md · relation: references

## Knowledge Gaps
- **457 isolated node(s):** `Component`, `Panel`, `Setting`, `input`, `Step` (+452 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **46 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Chat Parity Audit 2026-07-19` and `D-0075 Fast-Model Memory Judgments`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `AuditLog` connect `Approval & Audit Broker` to `Proactivity Gate Engine`, `Agent Tool Builders`, `Capability Guard & Activation`, `Affect & Config Loading`, `Secrets Vault`, `Emergency Stop & Grants`, `Memory Maintenance Ops`, `Agent Runtime Contract`, `Tool Registry Core`, `Memory Judge & Merge`, `MCP Client Registry`, `Episodic Memory Store`, `Settings Registry`, `Entity Resolution Utils`, `Semantic Memory Search`, `Project Tracking`, `Knowledge & Research Tools`, `A2UI Panel Registry`, `Announcement System`, `Settings Registry Ops`, `Terminal Command Policy`, `Background Autonomy Scheduler`, `Persona Prompt Registry`, `Skill Registry`, `Audit Log Verification`, `Agenda Store`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `SimulatedDesktop` connect `Computer Control Contract` to `Agent Tool Builders`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `ComputerControl` connect `Computer Control Contract` to `Agent Tool Builders`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `Component`, `Panel`, `Setting` to the rest of the system?**
  _457 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Approval & Audit Broker` be split into smaller, more focused modules?**
  _Cohesion score 0.06223358908780904 - nodes in this community are weakly interconnected._
- **Should `Project Architecture Docs` be split into smaller, more focused modules?**
  _Cohesion score 0.0715846994535519 - nodes in this community are weakly interconnected._