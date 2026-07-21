# Graph Report - .  (2026-07-21)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2076 nodes · 4381 edges · 132 communities (108 shown, 24 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 114 edges (avg confidence: 0.69)
- Token cost: 10,679 input · 2,024 output

## Graph Freshness
- Built from commit: `9e0d6582`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Approval & Audit Log
- Tool Registry & Activation
- Proactivity Engine & Gates
- Research Evidence Gathering
- Agent Tool Definitions
- Swift Audio Bridge
- Computer Control Contract
- Device Gateway Contract
- Context Provider Contract
- Background Scheduler
- Kernel Package Dependencies
- Python Audio IO
- Agent Runtime Contract
- Model Provider Adapter
- Decision Log & Screenshots
- Evaluation Runs & Screenshots
- Workspace Files Contract
- Requirements Catalog
- Reasoning & Consolidation
- Memory Judge Gateway
- Command Center TSConfig
- Tauri App Config
- Command Center Package Config
- Voice Turn-Taking Engine
- Episodic Memory Encryption
- Kernel Rust Core
- Memory Mutation Operations
- Gateway Role Overrides
- MCP Client Registry
- Governing Principles & Decisions
- J.A.R.V.I.S. UI Overview
- Agenda & Prompt Registry
- Projects, Vault & Secrets
- Entity Memory Store
- Architecture Decision Records
- Command Center Dashboard Page
- Voice Streaming Protocols
- Entity Resolution & Merge
- Semantic Memory Search
- Settings Registry Core
- Ears HTTP/WS Server
- Secrets Vault Management
- Model Gateway Decisions
- Wake Word Engines
- Kernel Config Loading
- Gateway Config Defaults
- A2UI Panel Registry
- Gateway Server Routes
- Database Migrations
- Base TS Config
- Gateway Router Chat
- TTS Engine Implementations
- Autonomy & Heartbeat Decisions
- Voice Engine Integration Tests
- Ops Health & Backup
- System Architecture Overview
- Verification & Threat Model
- Root Package Scripts
- Autonomy Budget Tracking
- Files UI Page
- Pulse/Heartbeat UI Page
- Skills UI Page
- Companion App Package
- Agent & Skills Foundations
- Kernel TSConfig
- Dynamic Settings Registry
- Memory UI Page
- Self-Extension UI Page
- Tauri Permissions Config
- Context & MCP Security
- Streaming STT Engine
- Projects Log Store
- Agent UI Page
- Graphify Skill Docs
- Mac Preflight Script
- Devices UI Page
- Models UI Page
- Proactivity Rules UI Page
- Memory Architecture Decisions
- Reasoning Escalation Decisions
- Terminal Command Runner
- A2UI Rendering Page
- Computer Control UI Page
- Knowledge Graph UI Page
- Reasoning UI Page
- Terminal UI Page
- Web Browsing UI Page
- Devices & Secrets Decisions
- Proactivity & Settings Decisions
- Voice Activity Detection
- A2UI Schema Definitions
- Announcer Delivery Logic
- Anthropic Adapter Tests
- Router Test Suite
- Affect Inference Service
- Announce Test Utilities
- Chat UI Page
- Orb State UI Page
- Persona UI Page
- Settings UI Page
- Model Asset Fetching
- Terminal Policy Verdicts
- Companion Tauri Shell
- Self-Extension Kernel
- Root Layout Component
- macOS Control Adapter
- Platform Acceptance Testing
- MCP Test Server
- Ambient Voice Orb
- Next.js Config
- Next.js Type Declarations
- Swift Package Manifest
- Memory Encryption Architecture
- Terminal Policy Kernel
- Terminal Capability Tests
- Web Capability Tests
- Module CLAUDE.md Decision
- Observability Viewer Decision
- MCP Spec Target
- macOS Control Stack
- Spatial Input Model
- Session Continuity Design
- Simulator Depth Decision
- Hardware Inventory Decision
- Dashboard Navigation Hub
- Jarvis Ears Module

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
- `D-0028: Managed secrets vault` --shares_data_with--> `devices/homeassistant.ts (real HA gateway)`  [EXTRACTED]
  docs/DECISION_LOG.md → devices/homeassistant.ts
- `D-0028: Managed secrets vault` --references--> `kernel/src/crypto/secrets.ts (SecretsVault)`  [EXTRACTED]
  docs/DECISION_LOG.md → kernel/src/crypto/secrets.ts
- `D-0038: Semantic memory entities/facts/relations` --references--> `kernel/src/memory/entities.ts (EntityMemory)`  [EXTRACTED]
  docs/DECISION_LOG.md → kernel/src/memory/entities.ts
- `D-0041: Episodic memory` --references--> `kernel/src/memory/episodes.ts (EpisodicMemory)`  [EXTRACTED]
  docs/DECISION_LOG.md → kernel/src/memory/episodes.ts
- `D-0048: Deep-reasoning escalation` --references--> `kernel/src/core/reasoning.ts (assessDepth/ReasoningTuner)`  [EXTRACTED]
  docs/DECISION_LOG.md → kernel/src/core/reasoning.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Binding Authored Spec Documents (01-07)** — docs_01_mission_and_core_loop, docs_02_requirements, docs_03_spatial_hardware_oss, docs_04_stack_and_phases, docs_05_security_scope_locality, docs_06_check_ins_and_verify, docs_07_session_continuity [EXTRACTED 0.95]
- **graphify Skill Pipeline Files** — claude_skills_graphify_skill_md, claude_skills_graphify_references_query_md, claude_skills_graphify_references_extraction_spec_md, claude_skills_graphify_references_update_md, claude_skills_graphify_references_exports_md, claude_skills_graphify_references_add_watch_md, claude_skills_graphify_references_github_and_merge_md, claude_skills_graphify_references_hooks_md, claude_skills_graphify_references_transcribe_md [EXTRACTED 0.90]
- **Option A Hybrid Architecture Components** — jarvisd_kernel, jarvis_mind, jarvis_ears, command_center_app, companion_app [EXTRACTED 0.90]
- **SIMULATION-first, check-in-gated capability rollout pattern** — docs_decision_log_d0022, docs_decision_log_d0023, docs_decision_log_d0024, docs_decision_log_d0025, docs_decision_log_d0073 [INFERRED 0.80]
- **Dual-editable override-ledger settings contract (D-0053 family)** — docs_decision_log_d0053, docs_decision_log_d0058, docs_decision_log_d0059, docs_decision_log_d0060, docs_decision_log_d0061, docs_decision_log_d0054, docs_decision_log_d0055 [EXTRACTED 0.85]
- **Deep-reasoning escalation, provider-agnostic settings, and adaptive learning/consolidation** — docs_decision_log_d0046, docs_decision_log_d0047, docs_decision_log_d0048, docs_decision_log_d0049, docs_decision_log_d0050, docs_decision_log_d0051, docs_decision_log_d0052a, docs_decision_log_d0052b [EXTRACTED 0.85]
- **Mac Check-in Sequence Gating Capability Activation** — docs_mac_bringup, concept_d0022, concept_d0023, concept_d0024, concept_d0025, concept_d0026, concept_d0027 [EXTRACTED 0.85]
- **Phase 0 Binding Governance Document Set** — docs_product_spec, docs_capability_parity_matrix, docs_architecture, docs_threat_model, docs_decision_log, docs_requirements_traceability [EXTRACTED 0.80]
- **Requirement-to-Decision Traceability System** — docs_requirements_traceability, docs_product_spec, docs_capability_parity_matrix, docs_decision_log [EXTRACTED 0.80]
- **Phase-1 Acceptance Test Suite (AT1.1-AT1.14)** — docs_requirements_traceability, docs_requirements_traceability_at1_2, docs_requirements_traceability_at1_3, docs_requirements_traceability_at1_4, docs_requirements_traceability_at1_5, docs_requirements_traceability_at1_6, docs_requirements_traceability_at1_7, docs_requirements_traceability_at1_8, docs_requirements_traceability_at1_9, docs_requirements_traceability_at1_12, docs_requirements_traceability_at1_13, docs_requirements_traceability_at1_14 [EXTRACTED 0.90]
- **Fully local voice pipeline (wake, VAD, STT, TTS, echo-cancel) and its acceptance criteria** — docs_research_verification_voice_stack, docs_requirements_traceability_at1_2, docs_requirements_traceability_at1_3, docs_requirements_traceability_at1_4, docs_requirements_traceability_at1_12 [INFERRED 0.75]
- **Core threat-mitigation controls (untrusted content envelopes, policy gating, self-extension limits, computer-control gating)** — docs_threat_model_t1_prompt_injection, docs_threat_model_t2_tool_poisoning, docs_threat_model_t3_self_extension_abuse, docs_threat_model_t7_computer_control_misuse, kernel_src_core_untrusted [EXTRACTED 0.85]
- **Command Center Navigation Hub linking all J.A.R.V.I.S. feature pages** — jarvis_command_center, jarvis_memory, jarvis_model_gateway, jarvis_persona, jarvis_proactivity, jarvis_self_extension, jarvis_settings, jarvis_skills, jarvis_voice_orb, jarvis_reasoning [EXTRACTED 0.85]
- **Proactive behavior flow: heartbeat agenda, proactivity surfacing, and configurable settings** — jarvis_pulse, jarvis_proactivity, jarvis_settings [INFERRED 0.70]
- **Command Center Dashboard hub linking all J.A.R.V.I.S. modules** — docs_screenshots_audit_20_dashboard_estop, docs_screenshots_audit_01_chat, docs_screenshots_audit_02_agent, docs_screenshots_audit_03_control, docs_screenshots_audit_04_devices, docs_screenshots_audit_05_files, docs_screenshots_audit_06_terminal, docs_screenshots_audit_07_web, docs_screenshots_audit_08_memory, docs_screenshots_audit_09_graph, docs_screenshots_audit_10_models, docs_screenshots_audit_11_settings, docs_screenshots_audit_12_reasoning, docs_screenshots_audit_13_proactive, docs_screenshots_audit_14_skills, docs_screenshots_audit_15_persona, docs_screenshots_audit_16_pulse, docs_screenshots_audit_17_selfext, docs_screenshots_audit_18_a2ui, docs_screenshots_audit_19_orb, jarvis_dashboard_hub_concept [EXTRACTED 0.90]
- **Modules implementing the gated pipeline (policy + approval + audit) execution pattern** — docs_screenshots_audit_02_agent, docs_screenshots_audit_03_control, docs_screenshots_audit_04_devices, docs_screenshots_audit_05_files, docs_screenshots_audit_06_terminal, docs_screenshots_audit_07_web, docs_screenshots_audit_14_skills, jarvis_gated_pipeline_concept [INFERRED 0.80]
- **All J.A.R.V.I.S. UI surfaces expose the global Emergency Stop safety control** — docs_screenshots_audit_01_chat, docs_screenshots_audit_02_agent, docs_screenshots_audit_03_control, docs_screenshots_audit_04_devices, docs_screenshots_audit_05_files, docs_screenshots_audit_06_terminal, docs_screenshots_audit_07_web, docs_screenshots_audit_08_memory, docs_screenshots_audit_09_graph, docs_screenshots_audit_10_models, docs_screenshots_audit_20_dashboard_estop, docs_screenshots_audit_19_orb, jarvis_emergency_stop_concept [INFERRED 0.75]
- **Fast-Model Memory Judgment Evolution Across Observation Runs** — docs_verification_observation_run_2026_07_19, docs_verification_d0075_memory_judgment_2026_07_20, docs_verification_fresh_observation_2026_07_20, docs_verification_ab_observation_2026_07_20 [EXTRACTED 0.85]
- **Self-Extension Stage A/B Authoring, Activation, and Audit** — docs_verification_stage_b_affect_2026_07_19, docs_verification_chat_parity_audit_2026_07_19, services_kernel_src_selfext_claude, docs_verification_living_with_jarvis_2026_07_19 [EXTRACTED 0.80]
- **J.A.R.V.I.S. Command Center UI Panels** — docs_screenshots_final_dashboard, docs_screenshots_final_settings, docs_screenshots_final_a2ui, docs_screenshots_final_memory, docs_screenshots_final_models, docs_screenshots_final_pulse [INFERRED 0.75]

## Communities (132 total, 24 thin omitted)

### Community 0 - "Approval & Audit Log"
Cohesion: 0.05
Nodes (42): ActivityEvent, ApprovalBroker, ApprovalResolution, PendingApproval, AuditEntry, AuditLog, WHOLE_MATCH_PATTERNS, EmergencyStop (+34 more)

### Community 1 - "Tool Registry & Activation"
Cohesion: 0.06
Nodes (38): ToolRegistry, ActivationCheck, ActivationService, activationTools(), authoringTools(), RISK_ORDER, StepRunner, CapabilityGuard (+30 more)

### Community 2 - "Proactivity Engine & Gates"
Cohesion: 0.08
Nodes (27): ProactivityEngine, GateStack, inQuietHours(), priorityRank(), briefingCandidate(), calendarConflictCandidates(), commitmentCandidates(), dayKey() (+19 more)

### Community 3 - "Research Evidence Gathering"
Cohesion: 0.07
Nodes (24): Evidence, GatherOptions, Researcher, ResearchFindings, SourceStatus, TargetCheck, queryTerms(), scorePassages() (+16 more)

### Community 4 - "Agent Tool Definitions"
Cohesion: 0.11
Nodes (26): a2uiTools(), AgendaItem, agendaTools(), Announcement, announceTools(), computerControlTools(), ActionDisclosure, buildCore() (+18 more)

### Community 5 - "Swift Audio Bridge"
Cohesion: 0.09
Nodes (28): AppKit, ApplicationServices, AudioBridge, Double, Float, EarsClient, Float, AppInfoDTO (+20 more)

### Community 6 - "Computer Control Contract"
Cohesion: 0.09
Nodes (12): AppInfo, AxElement, ComputerControl, ControlProvenance, ControlResult, ElementSelector, Screenshot, WindowInfo (+4 more)

### Community 7 - "Device Gateway Contract"
Cohesion: 0.09
Nodes (22): DEVICE_RISK, DeviceCommand, DeviceGateway, DeviceInfo, DeviceProvenance, DeviceResult, DeviceState, DeviceType (+14 more)

### Community 8 - "Context Provider Contract"
Cohesion: 0.08
Nodes (20): CommitmentContext, ContextProvider, ContextSnapshot, EpisodeSource, KnowledgeSource, KnownEntity, PinnedFact, ProactiveContext (+12 more)

### Community 9 - "Background Scheduler"
Cohesion: 0.07
Nodes (19): AutonomyStatus, BackgroundScheduler, TickResult, ActivityBus, SleepCycle, DurableGrantRow, DurableGrants, Core (+11 more)

### Community 10 - "Kernel Package Dependencies"
Cohesion: 0.05
Nodes (37): ajv, fastify, @modelcontextprotocol/sdk, pg, playwright, dependencies, ajv, fastify (+29 more)

### Community 11 - "Python Audio IO"
Cohesion: 0.07
Nodes (21): AudioSink, AudioSource, BufferAudioSink, BufferAudioSource, _PortAudioSource, ndarray, Path, Protocol (+13 more)

### Community 12 - "Agent Runtime Contract"
Cohesion: 0.10
Nodes (19): AgentResult, AgentRunOptions, AgentRuntime, AgentStep, LocalAgentRuntime, ToolContext, wrapUntrusted(), AgentRunOpts (+11 more)

### Community 13 - "Model Provider Adapter"
Cohesion: 0.11
Nodes (17): ProviderAdapter, ProviderError, OllamaMessage, createOpenAiCompatAdapter(), ajv, RoleOverride, ChatEvent, ContentPart (+9 more)

### Community 14 - "Decision Log & Screenshots"
Cohesion: 0.07
Nodes (34): D-0023 Self-Extension Security Check-in Decision, D-0024 Proactive Behavior Gating Decision, D-0027 MCP Reconnect Trust Decision, D-0041 Timeline Encrypted-at-rest Decision, D-0043 Persona Versioning Decision, D-0058 Runtime Settings Override Decision, D-0064 Heartbeat/Agenda Consequential Action Decision, J.A.R.V.I.S. Command Center Dashboard Screenshot (+26 more)

### Community 15 - "Evaluation Runs & Screenshots"
Cohesion: 0.07
Nodes (33): A2UI Panels Screenshot, Command Center Dashboard Screenshot, Memory Panel Screenshot, Model Gateway Screenshot, Pulse (Heartbeat/Agenda) Screenshot, Settings Panel Screenshot, A/B Observation: Opus/Sonnet vs Haiku Tier (2026-07-20), Chat Parity Audit (2026-07-19) (+25 more)

### Community 16 - "Workspace Files Contract"
Cohesion: 0.14
Nodes (16): DirEntry, EditOutcome, FileContent, FileInfo, FileKind, SearchMatch, SearchOptions, SearchResult (+8 more)

### Community 17 - "Requirements Catalog"
Cohesion: 0.09
Nodes (29): R-AUTO requirements (autonomy & approval), R-CLASS requirements (five-state classification), R-CORE requirements (core loop/honesty), R-CTRL requirements (computer control), R-HW requirements (hardware catalog), R-MODEL requirements (model gateway), R-OSS requirements (open-source constraints), R-PRO requirements (proactive behavior) (+21 more)

### Community 18 - "Reasoning & Consolidation"
Cohesion: 0.12
Nodes (11): ConsolidationReport, DecisionLog, Autotune, DEFAULT_AUTOTUNE, DepthAssessment, DepthReason, ReasoningMode, ReasoningTuner (+3 more)

### Community 19 - "Memory Judge Gateway"
Cohesion: 0.10
Nodes (13): PrivacyClass, EntityCandidate, EntityForMerge, EntityMergeGroup, FactForMerge, GatewayMemoryJudge, JudgeGateway, MemoryJudge (+5 more)

### Community 20 - "Command Center TSConfig"
Cohesion: 0.07
Nodes (27): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+19 more)

### Community 21 - "Tauri App Config"
Cohesion: 0.07
Nodes (26): app, security, trayIcon, windows, build, devUrl, frontendDist, bundle (+18 more)

### Community 22 - "Command Center Package Config"
Cohesion: 0.08
Nodes (25): dependencies, next, react, react-dom, description, devDependencies, @types/node, @types/react (+17 more)

### Community 23 - "Voice Turn-Taking Engine"
Cohesion: 0.14
Nodes (17): Enum, Typed, replaceable speech-engine contracts (R-VOICE-12).  Every engine is an ope, VadFrame, Full-duplex turn-taking + barge-in state machine (R-VOICE-03).  This is the ENGI, Drives the conversation's turn state from VAD frames.      Barge-in fires when,, Feed one VAD frame; returns any turn transitions it triggered., TurnEvent, TurnTaker (+9 more)

### Community 24 - "Episodic Memory Encryption"
Cohesion: 0.16
Nodes (11): Entity, Fact, Episode, EpisodeKind, EpisodicMemory, KINDS, normalizeKind(), RecallOptions (+3 more)

### Community 25 - "Kernel Rust Core"
Cohesion: 0.18
Nodes (19): engage_estop(), estop_engaged(), get(), is_healthy(), KernelError, parse_status(), post(), request() (+11 more)

### Community 27 - "Gateway Role Overrides"
Cohesion: 0.11
Nodes (15): parseRolePin(), loadRoleOverrides(), Store, StoredRoleOverrides, ModelRoles, ClearRouteArgs, gatewayTools(), reasoningTools() (+7 more)

### Community 28 - "MCP Client Registry"
Cohesion: 0.13
Nodes (11): hashTools(), McpClientHost, McpDiscovery, McpToolSpec, McpRegistry, McpServerRow, RegisteredServer, TrustLevel (+3 more)

### Community 29 - "Governing Principles & Decisions"
Cohesion: 0.21
Nodes (19): Root CLAUDE.md, Dual-Editability Principle (D-0053), Five-State Capability Classification, Honesty Rule, Local-First Principle, Two-Stage Self-Extension, D-0002 Architecture Option Approved, D-0003 Capability Parity Matrix Approval (+11 more)

### Community 30 - "J.A.R.V.I.S. UI Overview"
Cohesion: 0.17
Nodes (22): J.A.R.V.I.S. Converse UI (chat screen), J.A.R.V.I.S. Agent UI (gated multi-step task runner), J.A.R.V.I.S. Computer Control UI (simulation desktop, gated actions), J.A.R.V.I.S. Devices UI (smart-home simulation, high-risk interlocks), J.A.R.V.I.S. Files UI (workspace search/edit, gated edits), J.A.R.V.I.S. Terminal UI (policy-gated shell), J.A.R.V.I.S. Web UI (gated headless browser), J.A.R.V.I.S. Memory UI (entities, facts, timeline) (+14 more)

### Community 31 - "Agenda & Prompt Registry"
Cohesion: 0.12
Nodes (6): Agenda, redactSecrets(), Prompt, PromptKind, PromptRegistry, audit

### Community 32 - "Projects, Vault & Secrets"
Cohesion: 0.14
Nodes (11): Project, ProjectLogEntry, projectTools(), exec, randomKek(), resolveKek(), gcmDecrypt(), gcmEncrypt() (+3 more)

### Community 33 - "Entity Memory Store"
Cohesion: 0.25
Nodes (3): assertNotSecret(), EntityMemory, seedChain()

### Community 34 - "Architecture Decision Records"
Cohesion: 0.17
Nodes (19): D-0002 Architecture Option A, D-0004 Voice Stack Approved, D-0021 Memory Architecture Approved, D-0022 Computer Control Check-in, D-0023 Self-Extension Stage B Check-in, D-0024 Proactive Delivery Check-in, D-0025 Physical Devices Check-in, D-0026 Design System Check-in (+11 more)

### Community 35 - "Command Center Dashboard Page"
Cohesion: 0.14
Nodes (15): activityColor(), ActivityEvent, btn(), ContextData, EmergencyStopButton(), formatActivity(), HealthReport, inputStyle (+7 more)

### Community 36 - "Voice Streaming Protocols"
Cohesion: 0.12
Nodes (9): ndarray, Protocol, Feed a PCM frame; return any wake detections in that frame., Yield audio chunks as they become available (sentence-level or better)., StreamingTtsEngine, SttEngine, TtsEngine, VadEngine (+1 more)

### Community 37 - "Entity Resolution & Merge"
Cohesion: 0.13
Nodes (14): anyPairShareWord(), contentWords(), diceCoefficient(), EntityKind, fullestName(), GraphNeighborhood, GraphRecall, mergeAttrs() (+6 more)

### Community 38 - "Semantic Memory Search"
Cohesion: 0.13
Nodes (11): EmbedFn, SemanticHit, SemanticMemory, SemanticSource, toVectorLiteral(), audit, embed(), hashEmbed() (+3 more)

### Community 39 - "Settings Registry Core"
Cohesion: 0.19
Nodes (3): SettingSpec, SettingsRegistry, validate()

### Community 40 - "Ears HTTP/WS Server"
Cohesion: 0.16
Nodes (16): BaseModel, listen(), ndarray, jarvis-ears HTTP/WS surface (localhost only, R-LOC-01).  GET  /health  — real en, Run the full utterance through the streaming STT and return the transcript., A complete captured utterance @16kHz mono float32. On the Mac the audio     come, Full voice round-trip: audio -> STT -> kernel core loop -> TTS audio out.     Ev, Continuous listening: emits wake, VAD, and live STT partial/final events.     On (+8 more)

### Community 41 - "Secrets Vault Management"
Cohesion: 0.15
Nodes (5): normalizeName(), SecretInfo, SecretsVault, audit, auditPayloads

### Community 42 - "Model Gateway Decisions"
Cohesion: 0.25
Nodes (9): D-0008: Model gateway approach (thin in-house gateway), D-0046: Gateway learns current Anthropic API, D-0047: Model-gateway observability, D-0049: Provider-agnostic generation settings, D-0054: Runtime gateway role editor, D-0055: Conversational edit path, D-0066: Spend governance, gateway/tools.ts (gated gateway tools) (+1 more)

### Community 43 - "Wake Word Engines"
Cohesion: 0.15
Nodes (9): WakeEvent, OpenWakeWord, ndarray, Path, Wake-word engine: openWakeWord ONNX pipeline.  Code: Apache-2.0 (dscripka/openWa, ndarray, Path, Wake-word engine: sherpa-onnx open-vocabulary keyword spotting (Apache-2.0).  Th (+1 more)

### Community 44 - "Kernel Config Loading"
Cohesion: 0.14
Nodes (13): ConfigSchema, KernelConfig, loadConfig(), app, config, gateway, here, keyfile (+5 more)

### Community 45 - "Gateway Config Defaults"
Cohesion: 0.18
Nodes (11): DEFAULT_GATEWAY_CONFIG, ENV_DEFAULT_KINDS, loadGatewayConfig(), NON_GENERATIVE_ROLES, resolveGatewayConfig(), createOllamaAdapter(), EffortLevel, EffortLevels (+3 more)

### Community 46 - "A2UI Panel Registry"
Cohesion: 0.20
Nodes (7): A2uiPanel, A2uiRegistry, A2uiSpec, A2uiSpecSchema, validateReferences(), audit, settings

### Community 47 - "Gateway Server Routes"
Cohesion: 0.19
Nodes (9): registerCoreRoutes(), sseCorsHeaders(), persistRoleOverrides(), pinOf(), ChatBodySchema, registerGatewayRoutes(), createServer(), config (+1 more)

### Community 48 - "Database Migrations"
Cohesion: 0.23
Nodes (11): AppliedMigration, config, migrationsDir, pool, listMigrationFiles(), migrationStatus(), runMigrations(), createPool() (+3 more)

### Community 49 - "Base TS Config"
Cohesion: 0.13
Nodes (14): ES2023, compilerOptions, declaration, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, lib, module (+6 more)

### Community 50 - "Gateway Router Chat"
Cohesion: 0.29
Nodes (4): GatewayRouter, ChatRequest, ChatResult, ModelRole

### Community 51 - "TTS Engine Implementations"
Cohesion: 0.16
Nodes (8): TtsChunk, load_engines(), KokoroTts, Path, TTS engine: Kokoro-82M via ONNX (model Apache-2.0). Local offline baseline.  Use, _split_sentences(), OpenAiTts, Optional cloud TTS adapter: OpenAI speech API (D-0004a).  REMOTE engine: local=F

### Community 52 - "Autonomy & Heartbeat Decisions"
Cohesion: 0.20
Nodes (12): D-0019: Affect/state inference B4 constrained opt-in, D-0024: Background autonomy APPROVED, D-0063: Memories update live and during quiet hours, D-0064: The living heartbeat, D-0065: Three rhythms, no collisions, D-0068: Initiative to speak + advisory dissent, D-0069: Durable projects, D-0072: Affect layer approved + built (+4 more)

### Community 53 - "Voice Engine Integration Tests"
Cohesion: 0.19
Nodes (12): kokoro(), ndarray, Engine tests against real models (no mocks — R-CORE-02).  Requires model assets, Real TTS -> real STT round trip: Kokoro speaks a command, STT must hear it., End-to-end: TTS speaks the wake phrase; the wake engine must detect it., _resample_24k_to_16k(), stt(), test_stt_transcribes_synthesized_speech() (+4 more)

### Community 54 - "Ops Health & Backup"
Cohesion: 0.18
Nodes (4): canonicalJson(), BRAIN_TABLES, HealthReport, Ops

### Community 55 - "System Architecture Overview"
Cohesion: 0.19
Nodes (11): @jarvis/command-center CLAUDE.md, J.A.R.V.I.S. macOS companion README, companion icons README, companion fallback index.html, Command Center (Next.js app), Companion (Tauri app), Option A — Hybrid TS+Python Architecture, 04 Stack and Phases (+3 more)

### Community 56 - "Verification & Threat Model"
Cohesion: 0.17
Nodes (11): AT1.5 Command Center display requirements, Local LLM runtimes & model set verification, macOS control surface verification (AX/CGEvent/ScreenCaptureKit), MCP protocol & gateway verification, Command Center dashboard screenshot, Devices UI screenshot (interlock), T11 Audit tampering / repudiation, T2 Tool poisoning / malicious MCP server (+3 more)

### Community 57 - "Root Package Scripts"
Cohesion: 0.15
Nodes (12): description, engines, node, name, packageManager, private, scripts, build (+4 more)

### Community 58 - "Autonomy Budget Tracking"
Cohesion: 0.21
Nodes (4): AUTONOMY_SOURCES, Budget, BudgetStatus, PRICE_PER_MTOK

### Community 59 - "Files UI Page"
Cohesion: 0.21
Nodes (10): btn(), Entry, Ev, FileContent, FilesPage(), formatEv(), inputStyle, Match (+2 more)

### Community 60 - "Pulse/Heartbeat UI Page"
Cohesion: 0.18
Nodes (11): Beat, card(), ctl, dim, h2, input, Item, linkBtn (+3 more)

### Community 61 - "Skills UI Page"
Cohesion: 0.21
Nodes (10): AgentResult, btn(), Ev, formatEv(), inputStyle, Pending, pipeColor(), Skill (+2 more)

### Community 62 - "Companion App Package"
Cohesion: 0.17
Nodes (11): description, devDependencies, @tauri-apps/cli, name, private, scripts, build, dev (+3 more)

### Community 63 - "Agent & Skills Foundations"
Cohesion: 0.18
Nodes (12): D-0009: Agent runtime LangGraph behind AgentRuntime interface, D-0030: Agent runtime (jarvis-mind) foundation, D-0031: Skills registry, D-0032: Workspace knowledge/files capability, D-0033: Tool results feed agent's reasoning, D-0034: Web browsing/research capability, D-0036: Research-with-provenance, kernel/src/agent (LocalAgentRuntime) (+4 more)

### Community 64 - "Kernel TSConfig"
Cohesion: 0.17
Nodes (11): node, src/**/*.test.ts, src/**/*.ts, ../../tsconfig.base.json, compilerOptions, outDir, rootDir, types (+3 more)

### Community 65 - "Dynamic Settings Registry"
Cohesion: 0.20
Nodes (9): DynamicSpecInput, EffectiveSetting, jaccard(), normKey(), Override, SettingOrigin, SettingType, SettingValue (+1 more)

### Community 66 - "Memory UI Page"
Cohesion: 0.22
Nodes (9): btn(), Entity, Episode, Fact, inputStyle, MemoryPage(), Recall, Rel (+1 more)

### Community 67 - "Self-Extension UI Page"
Cohesion: 0.20
Nodes (9): ActiveCap, BENIGN, btn(), Finding, MALICIOUS, Report, SelfExtPage(), Verdict (+1 more)

### Community 68 - "Tauri Permissions Config"
Cohesion: 0.18
Nodes (10): description, identifier, permissions, $schema, windows, core:default, core:window:allow-set-focus, core:window:allow-show (+2 more)

### Community 69 - "Context & MCP Security"
Cohesion: 0.22
Nodes (11): D-0027: MCP client host built, D-0029: Contextual awareness ContextService, D-0037: Untrusted-content envelopes (T1), D-0039: Semantic memory feeds contextual awareness, D-0067: Memory-injection hardening (T1b), D-0070: Perception core, T1 Prompt injection threat & mitigations, kernel/src/context (ContextService) (+3 more)

### Community 70 - "Streaming STT Engine"
Cohesion: 0.27
Nodes (5): SttPartial, ndarray, Path, Streaming STT engine: sherpa-onnx streaming zipformer transducer (Apache-2.0)., SherpaStreamingStt

### Community 72 - "Agent UI Page"
Cohesion: 0.27
Nodes (8): AgentPage(), AgentResult, btn(), Ev, formatEv(), Pending, pipeColor(), Step

### Community 73 - "Graphify Skill Docs"
Cohesion: 0.22
Nodes (10): .claude/CLAUDE.md (graphify trigger), graphify reference: add & watch, graphify reference: exports, graphify reference: extraction spec, graphify reference: github & merge, graphify reference: hooks, graphify reference: query/path/explain, graphify reference: transcribe (+2 more)

### Community 74 - "Mac Preflight Script"
Cohesion: 0.36
Nodes (8): bad(), have(), hdr(), note(), ok(), port_state(), mac_preflight.sh script, skip()

### Community 75 - "Devices UI Page"
Cohesion: 0.31
Nodes (6): btn(), DevicesPage(), Ev, formatEv(), pipeColor(), RunOutcome

### Community 76 - "Models UI Page"
Cohesion: 0.28
Nodes (8): CallRow, h2(), inp, ModelsPage(), Override, ProviderRow, sec(), td

### Community 77 - "Proactivity Rules UI Page"
Cohesion: 0.25
Nodes (7): btn(), ProactivePage(), Rule, ruleInput, RunResult, Suppression, Surfaced

### Community 78 - "Memory Architecture Decisions"
Cohesion: 0.22
Nodes (11): D-0006: Valkey deferred until real queue/cache need, D-0007: Valkey over Redis, D-0012: Local model baseline set, D-0038: Semantic memory entities/facts/relations, D-0041: Episodic memory, D-0042: Semantic (vector) recall over memory, D-0045: Graph-brain memory, D-0057: Brain-graph vector recall HNSW index (+3 more)

### Community 79 - "Reasoning Escalation Decisions"
Cohesion: 0.48
Nodes (7): D-0048: Deep-reasoning escalation, D-0050: Deep-reasoning learning, D-0051: Sleep-cycle consolidation, D-0052: Reasoning panel, D-0052: Override contract revised, kernel/src/core/consolidation.ts (SleepCycle), kernel/src/core/reasoning.ts (assessDepth/ReasoningTuner)

### Community 80 - "Terminal Command Runner"
Cohesion: 0.36
Nodes (4): CommandResult, Provenance, RunOptions, LocalTerminal

### Community 81 - "A2UI Rendering Page"
Cohesion: 0.29
Nodes (6): A2uiPage(), Component, ctl(), input, Panel, Setting

### Community 82 - "Computer Control UI Page"
Cohesion: 0.36
Nodes (6): btn(), ControlPage(), Ev, formatEv(), pipeColor(), RunOutcome

### Community 83 - "Knowledge Graph UI Page"
Cohesion: 0.29
Nodes (7): Bundle, chip(), EntityRow, GEdge, GNode, GraphPage(), input

### Community 84 - "Reasoning UI Page"
Cohesion: 0.36
Nodes (7): Autotune, chip(), h2(), input, ReasoningPage(), Report, sec()

### Community 85 - "Terminal UI Page"
Cohesion: 0.36
Nodes (6): btn(), Ev, formatEv(), pipeColor(), RunOutcome, TerminalPage()

### Community 86 - "Web Browsing UI Page"
Cohesion: 0.36
Nodes (6): btn(), Ev, formatEv(), pipeColor(), RunOutcome, WebPage()

### Community 87 - "Devices & Secrets Decisions"
Cohesion: 0.25
Nodes (8): devices/homeassistant.ts (real HA gateway), D-0025: Device-control foundation SIMULATION-first, D-0028: Managed secrets vault, D-0059: Persist everything that matters, D-0071: Longevity ops (health/watchdog/backup), kernel/src/crypto/secrets.ts (SecretsVault), kernel/src/devices (device-control HAL), kernel/src/ops/ops.ts (health/backup/restore)

### Community 88 - "Proactivity & Settings Decisions"
Cohesion: 0.16
Nodes (15): D-0004: Voice stack picks, D-0024: Proactivity engine built (foundation), D-0043: Prompts registry, D-0044: User-defined proactivity rules, D-0053: BINDING PRINCIPLE dual-editable override ledger, D-0056: A2UI evaluation deferred (superseded by D-0061), D-0058: General runtime settings registry, D-0060: Dynamic settings (+7 more)

### Community 89 - "Voice Activity Detection"
Cohesion: 0.32
Nodes (4): ndarray, Path, SileroVad, vad()

### Community 90 - "A2UI Schema Definitions"
Cohesion: 0.25
Nodes (7): A2uiComponent, A2uiComponentSchema, Action, Heading, Setting, SettingsGroup, Text

### Community 92 - "Anthropic Adapter Tests"
Cohesion: 0.33
Nodes (4): createAnthropicAdapter(), adapter(), bodies, TOOL

### Community 93 - "Router Test Suite"
Cohesion: 0.29
Nodes (3): auditRows, baseConfig, fakePool

### Community 94 - "Affect Inference Service"
Cohesion: 0.40
Nodes (4): AffectReading, inferAffect(), Tone, Urgency

### Community 95 - "Announce Test Utilities"
Cohesion: 0.33
Nodes (4): activity, audit, DAY, NIGHT

### Community 96 - "Chat UI Page"
Cohesion: 0.50
Nodes (3): appendToLastAssistant(), applyFrame(), Turn

### Community 97 - "Orb State UI Page"
Cohesion: 0.40
Nodes (3): OrbState, STATE_COLOR, STATE_LABEL

### Community 98 - "Persona UI Page"
Cohesion: 0.50
Nodes (4): btn(), inputStyle, PersonaPage(), Prompt

### Community 99 - "Settings UI Page"
Cohesion: 0.50
Nodes (4): ctl(), input, Setting, SettingsPage()

### Community 100 - "Model Asset Fetching"
Cohesion: 0.60
Nodes (4): fetch(), main(), Path, Fetch jarvis-ears model assets from verifiable sources into JARVIS_EARS_MODELS.

### Community 101 - "Terminal Policy Verdicts"
Cohesion: 0.40
Nodes (4): Assessment, DENY, READ_ONLY, Verdict

### Community 102 - "Companion Tauri Shell"
Cohesion: 0.50
Nodes (4): apps/companion/core (jarvis-companion-core Rust crate), apps/companion/src-tauri (Tauri 2 app shell), D-0014: Desktop shell Tauri 2, D-0040: Companion Tauri 2 app shell scaffolded

### Community 103 - "Self-Extension Kernel"
Cohesion: 0.83
Nodes (4): D-0023: Self-extension built safety-first, D-0073: Stage-B self-extension approved, kernel/src/selfext (self-extension foundation), kernel/src/selfext/activation.ts (ActivationService)

### Community 105 - "macOS Control Adapter"
Cohesion: 0.67
Nodes (3): MacDesktop.swift (real macOS control adapter), D-0022: Computer-control foundation SIMULATION-first, kernel/src/control (computer-control HAL)

## Ambiguous Edges - Review These
- `REQUIREMENTS_TRACEABILITY.md` → `A2UI Panels screenshot (Autonomy & Proactivity)`  [AMBIGUOUS]
  docs/screenshots/a2ui.png · relation: conceptually_related_to
- `D-0004: Voice stack picks` → `D-0012: Local model baseline set`  [AMBIGUOUS]
  docs/DECISION_LOG.md · relation: conceptually_related_to
- `D-0050: Deep-reasoning learning` → `D-0057: Brain-graph vector recall HNSW index`  [AMBIGUOUS]
  docs/DECISION_LOG.md · relation: references
- `AT1.9 Remember a preference` → `Knowledge Graph UI screenshot`  [AMBIGUOUS]
  docs/screenshots/graph.png · relation: conceptually_related_to
- `J.A.R.V.I.S. Self-Extension (Stage A) Feature` → `J.A.R.V.I.S. Settings Feature`  [AMBIGUOUS]
  docs/screenshots/self-extension.png · relation: conceptually_related_to

## Knowledge Gaps
- **477 isolated node(s):** `Component`, `Panel`, `Setting`, `input`, `Step` (+472 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `REQUIREMENTS_TRACEABILITY.md` and `A2UI Panels screenshot (Autonomy & Proactivity)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `D-0004: Voice stack picks` and `D-0012: Local model baseline set`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `D-0050: Deep-reasoning learning` and `D-0057: Brain-graph vector recall HNSW index`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `AT1.9 Remember a preference` and `Knowledge Graph UI screenshot`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `J.A.R.V.I.S. Self-Extension (Stage A) Feature` and `J.A.R.V.I.S. Settings Feature`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `AuditLog` connect `Approval & Audit Log` to `Tool Registry & Activation`, `Proactivity Engine & Gates`, `Agent Tool Definitions`, `Device Gateway Contract`, `Background Scheduler`, `Agent Runtime Contract`, `Memory Judge Gateway`, `Episodic Memory Encryption`, `Memory Mutation Operations`, `Gateway Role Overrides`, `MCP Client Registry`, `Agenda & Prompt Registry`, `Projects, Vault & Secrets`, `Entity Resolution & Merge`, `Semantic Memory Search`, `Settings Registry Core`, `Secrets Vault Management`, `Kernel Config Loading`, `A2UI Panel Registry`, `Ops Health & Backup`, `Dynamic Settings Registry`, `Announce Test Utilities`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `ToolRegistry` connect `Tool Registry & Activation` to `Approval & Audit Log`, `Agent Tool Definitions`, `Background Scheduler`, `Agent Runtime Contract`, `A2UI Panel Registry`, `Gateway Role Overrides`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._