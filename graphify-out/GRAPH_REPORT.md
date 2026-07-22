# Graph Report - .  (2026-07-22)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1984 nodes · 4199 edges · 133 communities (102 shown, 31 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 111 edges (avg confidence: 0.68)
- Token cost: 9,486 input · 1,990 output

## Graph Freshness
- Built from commit: `50e49fab`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Approval Broker & Memory Bus
- Proactivity Engine
- Research Gathering
- Tool Registry
- Audio Bridge Native
- Affect & Config Loading
- Computer Control API
- Context Provider
- Capability Guard & Activation
- UI Screenshots Overview
- Kernel Dependencies
- Audio I/O Python
- Agenda & Announcements
- Role Overrides Store
- Architecture Docs & Decisions
- Core Tools & Preferences
- Secrets Vault
- Device Gateway
- Workspace Files API
- Memory Forget/Correct Ops
- Settings Registry
- Ears Voice Server
- Grants & Policy Decisions
- Command Center TS Config
- Tauri App Config
- Entity Resolution
- Command Center Package Config
- Turn-Taking & Voice Engines
- Agent Runtime Core
- Provider Adapters
- Rust Kernel Core
- Capability Activation Service
- Gateway Config
- Episodic Memory
- Entity Memory Store
- A2UI Component Registry
- Semantic Memory Search
- Command Center App Page
- Voice Engine Protocols
- Reasoning & Consolidation
- Memory Judge & Merge
- UI Acceptance Screenshots
- Base TS Config
- Announcer Service
- Product Requirements Docs
- Background Scheduler
- Reasoning Tuner
- Device Interlock Safety
- Companion App Docs
- Root Package Config
- Wake Word Engines
- Voice Engine Tests
- Autonomy Budget
- Files Panel UI
- Pulse Panel UI
- Skills Panel UI
- Companion Package Config
- Memory Architecture Decisions
- Kernel TS Config
- Projects Tracking
- Terminal Runner
- Memory Panel UI
- Self-Extension Panel UI
- Tauri Permissions Config
- Streaming STT Engine
- Dynamic Settings Registry
- Gateway Router
- Agent Panel UI
- Graphify Tool Docs
- Mac Preflight Script
- Skill Registry
- Devices Panel UI
- Models Panel UI
- Proactive Panel UI
- Agent & Skills Decisions
- A2UI Panel UI
- Control Panel UI
- Knowledge Graph UI
- Reasoning Panel UI
- Terminal Panel UI
- Web Panel UI
- Research & MCP Decisions
- Kernel Module Guides
- Kernel Capability Guides
- Voice Activity Detection
- Audit Chain Verification
- Terminal Tools & Tests
- Acceptance Run Screenshots
- Memory Verification Runs
- Agenda Store
- Anthropic Adapter Tests
- Gateway Router Tests
- Chat Page UI
- Orb Page UI
- Persona Page UI
- Settings Page UI
- Proactivity & Settings Screenshots
- Verification Reports
- Model Asset Fetcher
- Terminal Policy
- Root Layout Metadata
- Companion Tauri App Shell
- Computer-Control HAL Gate
- MCP Test Server
- Next.js Config
- Next.js Env Types
- Swift Package Manifest
- Managed Secrets Vault
- Prompts Registry
- User Proactivity Rules
- Architecture Option Decision
- Voice Stack Approval
- Memory Architecture Security
- Graph-Brain Memory
- Anthropic API Pinning
- Gateway Observability
- Deep-Reasoning Escalation
- Generation Settings Policy
- Deep-Reasoning Learning
- Sleep-Cycle Consolidation
- Override Contract
- Runtime Settings Registry
- Files Panel UI
- Persona Panel UI
- Jarvis Ears Module
- Terminal Capability Docs
- Web Capability Docs

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
- `Model Gateway Panel Screenshot` --references--> `Kernel Module Guide (jarvisd)`  [INFERRED]
  docs/screenshots/final/models.png → services/kernel/CLAUDE.md
- `R-MEM-01..06 Memory Requirements` --references--> `Entities/Facts/Relations Store`  [INFERRED]
  docs/PRODUCT_SPEC.md → kernel/src/memory/entities.ts
- `Skills Panel — Saved Objectives & Gated Agent (UI Screenshot)` --references--> `Research & Platform Verification (Phase 0)`  [AMBIGUOUS]
  docs/screenshots/skills.png → docs/RESEARCH_VERIFICATION.md
- `Pulse Panel — Heartbeat Journal & Agenda (UI Screenshot)` --references--> `J.A.R.V.I.S. Threat Model`  [INFERRED]
  docs/screenshots/pulse.png → docs/THREAT_MODEL.md
- `Command Center Dashboard (UI Screenshot)` --references--> `Kernel MCP Client Host Guide`  [EXTRACTED]
  docs/screenshots/dashboard.png → services/kernel/src/mcp/CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **graphify Skill Pipeline (SKILL.md + references)** — claude_skills_graphify_skill, claude_skills_graphify_references_addwatch, claude_skills_graphify_references_exports, claude_skills_graphify_references_extractionspec, claude_skills_graphify_references_githubandmerge, claude_skills_graphify_references_hooks, claude_skills_graphify_references_query, claude_skills_graphify_references_transcribe, claude_skills_graphify_references_update [EXTRACTED 0.90]
- **Binding Authored Spec (docs 01-07)** — docs_01_mission_and_core_loop, docs_02_requirements, docs_03_spatial_hardware_oss, docs_04_stack_and_phases, docs_05_security_scope_locality, docs_06_check_ins_and_verify, docs_07_session_continuity [EXTRACTED 0.90]
- **Option A Hybrid Architecture Components** — concept_jarvisd_kernel, concept_jarvis_mind, concept_jarvis_ears, concept_command_center, concept_companion_tauri [EXTRACTED 0.90]
- **Fast-Model Memory Judgment Evolution (D-0075 lineage)** — docs_verification_observation_run_2026_07_19, docs_verification_d0075_memory_judgment_2026_07_20, docs_verification_fresh_observation_2026_07_20, docs_verification_ab_observation_2026_07_20, services_kernel_src_skills_claude [INFERRED 0.75]
- **Platform Acceptance Pillar Modules** — docs_verification_platform_acceptance, services_kernel_src_knowledge_claude, services_kernel_src_research_claude, services_kernel_src_mcp_claude, services_kernel_src_selfext_claude, services_kernel_src_devices_claude, services_kernel_src_control_claude, services_kernel_src_skills_claude [EXTRACTED 0.85]
- **Pages implementing the shared gated approval pipeline (propose/approve/audit)** — jarvis_agent, jarvis_computer_control, jarvis_devices, jarvis_files, jarvis_terminal, jarvis_web, jarvis_skills, jarvis_self_extension, jarvis_gated_pipeline [INFERRED 0.85]
- **Shared memory/entity/timeline knowledge layer across Memory, Graph, and Command Center** — jarvis_memory, jarvis_knowledge_graph, jarvis_command_center [INFERRED 0.80]
- **Runtime config keys (autonomy/heartbeat/proactive) shared across Settings, A2UI Panels, and Pulse** — jarvis_settings, jarvis_a2ui_panels, jarvis_pulse [INFERRED 0.80]
- **Command Center UI Surfaces** — docs_screenshots_final_pulse, docs_screenshots_final_settings, docs_screenshots_final_memory, docs_screenshots_final_models, docs_screenshots_final_a2ui [INFERRED 0.70]
- **Phase 2 REAL Knowledge/Web/Terminal/Memory Capabilities** — kernel_src_knowledge_filescapability, kernel_src_web_webcapability, kernel_src_terminal_terminalcapability, kernel_src_research_researchgather, kernel_src_memory_entities_entitiesstore, kernel_src_memory_episodes_episodesstore, kernel_src_memory_semantic_semanticrecall [INFERRED 0.80]
- **Mac Bring-Up Check-In Gate Sequence (docs/06)** — docs_implementation_plan_d0022, docs_implementation_plan_d0023, docs_implementation_plan_d0024, docs_implementation_plan_d0025, docs_implementation_plan_d0026, docs_implementation_plan_d0027, docs_mac_bringup_doc [EXTRACTED 0.85]

## Communities (133 total, 31 thin omitted)

### Community 0 - "Approval Broker & Memory Bus"
Cohesion: 0.06
Nodes (27): ActivityBus, ApprovalBroker, ApprovalResolution, PendingApproval, EmergencyStop, CoreLoop, assessDepth(), gatewayTools() (+19 more)

### Community 1 - "Proactivity Engine"
Cohesion: 0.07
Nodes (29): parseJson(), sliceSpan(), ProactivityEngine, GateStack, inQuietHours(), priorityRank(), briefingCandidate(), calendarConflictCandidates() (+21 more)

### Community 2 - "Research Gathering"
Cohesion: 0.07
Nodes (24): Evidence, GatherOptions, Researcher, ResearchFindings, SourceStatus, TargetCheck, queryTerms(), scorePassages() (+16 more)

### Community 3 - "Tool Registry"
Cohesion: 0.10
Nodes (22): computerControlTools(), ActionDisclosure, ActivityEvent, ToolRegistry, knowledgeTools(), researchTools(), webTools(), audit (+14 more)

### Community 4 - "Audio Bridge Native"
Cohesion: 0.09
Nodes (28): AppKit, ApplicationServices, AudioBridge, Double, Float, EarsClient, Float, AppInfoDTO (+20 more)

### Community 5 - "Affect & Config Loading"
Cohesion: 0.07
Nodes (34): AffectReading, inferAffect(), Tone, Urgency, ConfigSchema, KernelConfig, loadConfig(), registerCoreRoutes() (+26 more)

### Community 6 - "Computer Control API"
Cohesion: 0.09
Nodes (12): AppInfo, AxElement, ComputerControl, ControlProvenance, ControlResult, ElementSelector, Screenshot, WindowInfo (+4 more)

### Community 7 - "Context Provider"
Cohesion: 0.08
Nodes (20): CommitmentContext, ContextProvider, ContextSnapshot, EpisodeSource, KnowledgeSource, KnownEntity, PinnedFact, ProactiveContext (+12 more)

### Community 8 - "Capability Guard & Activation"
Cohesion: 0.10
Nodes (31): ActivationCheck, activationTools(), authoringTools(), RISK_ORDER, StepRunner, CapabilityGuard, DANGEROUS_PATTERNS, GuardVerdict (+23 more)

### Community 9 - "UI Screenshots Overview"
Cohesion: 0.07
Nodes (41): Converse chat UI screenshot, Agent gated pipeline UI screenshot, Computer Control UI screenshot, Devices UI screenshot, Files UI screenshot, Terminal UI screenshot, Web browser tool UI screenshot, Memory UI screenshot (+33 more)

### Community 10 - "Kernel Dependencies"
Cohesion: 0.05
Nodes (37): ajv, fastify, @modelcontextprotocol/sdk, pg, playwright, dependencies, ajv, fastify (+29 more)

### Community 11 - "Audio I/O Python"
Cohesion: 0.07
Nodes (21): AudioSink, AudioSource, BufferAudioSink, BufferAudioSource, _PortAudioSource, ndarray, Path, Protocol (+13 more)

### Community 12 - "Agenda & Announcements"
Cohesion: 0.08
Nodes (20): AgendaItem, agendaTools(), Announcement, announceTools(), Project, ProjectLogEntry, projectTools(), AutonomyStatus (+12 more)

### Community 13 - "Role Overrides Store"
Cohesion: 0.11
Nodes (18): parseRolePin(), loadRoleOverrides(), persistRoleOverrides(), Store, StoredRoleOverrides, ajv, pinOf(), RoleOverride (+10 more)

### Community 14 - "Architecture Docs & Decisions"
Cohesion: 0.13
Nodes (30): Command Center Module Guide, macOS Companion README, Companion App Icons README, Companion Fallback UI Page, J.A.R.V.I.S. Repository Guide (CLAUDE.md), Command Center (Next.js UI), Companion (Tauri 2 + Swift bridge), D-0002 Architecture Option Decision (+22 more)

### Community 15 - "Core Tools & Preferences"
Cohesion: 0.08
Nodes (23): a2uiTools(), buildCore(), RememberArgs, rememberPreferenceTool(), systemInfoTool, Tool, ToolResult, hashTools() (+15 more)

### Community 16 - "Secrets Vault"
Cohesion: 0.10
Nodes (11): normalizeName(), SecretInfo, SecretsVault, gcmDecrypt(), gcmEncrypt(), Vault, WRAP_INFO, audit (+3 more)

### Community 17 - "Device Gateway"
Cohesion: 0.13
Nodes (15): DEVICE_RISK, DeviceCommand, DeviceGateway, DeviceInfo, DeviceProvenance, DeviceResult, DeviceState, DeviceType (+7 more)

### Community 18 - "Workspace Files API"
Cohesion: 0.14
Nodes (16): DirEntry, EditOutcome, FileContent, FileInfo, FileKind, SearchMatch, SearchOptions, SearchResult (+8 more)

### Community 19 - "Memory Forget/Correct Ops"
Cohesion: 0.10
Nodes (3): assertNotSecret(), registerMemoryRoutes(), PromptRegistry

### Community 20 - "Settings Registry"
Cohesion: 0.17
Nodes (6): jaccard(), normKey(), SettingSpec, SettingsRegistry, tokens(), validate()

### Community 21 - "Ears Voice Server"
Cohesion: 0.10
Nodes (24): BaseModel, TtsChunk, listen(), load_engines(), ndarray, jarvis-ears HTTP/WS surface (localhost only, R-LOC-01).  GET  /health  — real en, Run the full utterance through the streaming STT and return the transcript., A complete captured utterance @16kHz mono float32. On the Mac the audio     come (+16 more)

### Community 22 - "Grants & Policy Decisions"
Cohesion: 0.10
Nodes (14): DurableGrantRow, DurableGrants, ActionRequest, Decision, Grant, ORDER, PolicyEngine, PROHIBITED (+6 more)

### Community 23 - "Command Center TS Config"
Cohesion: 0.07
Nodes (27): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+19 more)

### Community 24 - "Tauri App Config"
Cohesion: 0.07
Nodes (26): app, security, trayIcon, windows, build, devUrl, frontendDist, bundle (+18 more)

### Community 25 - "Entity Resolution"
Cohesion: 0.11
Nodes (16): anyPairShareWord(), contentWords(), diceCoefficient(), EntityKind, fullestName(), GraphNeighborhood, GraphRecall, mergeAttrs() (+8 more)

### Community 26 - "Command Center Package Config"
Cohesion: 0.08
Nodes (25): dependencies, next, react, react-dom, description, devDependencies, @types/node, @types/react (+17 more)

### Community 27 - "Turn-Taking & Voice Engines"
Cohesion: 0.14
Nodes (17): Enum, Typed, replaceable speech-engine contracts (R-VOICE-12).  Every engine is an ope, VadFrame, Full-duplex turn-taking + barge-in state machine (R-VOICE-03).  This is the ENGI, Drives the conversation's turn state from VAD frames.      Barge-in fires when,, Feed one VAD frame; returns any turn transitions it triggered., TurnEvent, TurnTaker (+9 more)

### Community 28 - "Agent Runtime Core"
Cohesion: 0.13
Nodes (18): AgentResult, AgentRunOptions, AgentRuntime, AgentStep, LocalAgentRuntime, Core, ToolContext, WorkspaceNoteArgs (+10 more)

### Community 29 - "Provider Adapters"
Cohesion: 0.13
Nodes (9): ProviderAdapter, ProviderError, OllamaMessage, createOpenAiCompatAdapter(), ChatEvent, NeutralMessage, TargetOptions, ToolCall (+1 more)

### Community 30 - "Rust Kernel Core"
Cohesion: 0.18
Nodes (19): engage_estop(), estop_engaged(), get(), is_healthy(), KernelError, parse_status(), post(), request() (+11 more)

### Community 31 - "Capability Activation Service"
Cohesion: 0.14
Nodes (4): ActivationService, CapabilityRecord, CapabilityRegistry, normalizeComposition()

### Community 32 - "Gateway Config"
Cohesion: 0.15
Nodes (15): DEFAULT_GATEWAY_CONFIG, ENV_DEFAULT_KINDS, loadGatewayConfig(), NON_GENERATIVE_ROLES, resolveGatewayConfig(), createOllamaAdapter(), ContentPart, EffortLevel (+7 more)

### Community 33 - "Episodic Memory"
Cohesion: 0.19
Nodes (10): Entity, Fact, Episode, EpisodeKind, EpisodicMemory, KINDS, normalizeKind(), RecallOptions (+2 more)

### Community 34 - "Entity Memory Store"
Cohesion: 0.25
Nodes (3): assertNotSecret(), EntityMemory, seedChain()

### Community 35 - "A2UI Component Registry"
Cohesion: 0.12
Nodes (12): A2uiPanel, A2uiRegistry, A2uiComponent, A2uiComponentSchema, A2uiSpec, A2uiSpecSchema, Action, Heading (+4 more)

### Community 36 - "Semantic Memory Search"
Cohesion: 0.13
Nodes (11): EmbedFn, SemanticHit, SemanticMemory, SemanticSource, toVectorLiteral(), audit, embed(), hashEmbed() (+3 more)

### Community 37 - "Command Center App Page"
Cohesion: 0.14
Nodes (15): activityColor(), ActivityEvent, btn(), ContextData, EmergencyStopButton(), formatActivity(), HealthReport, inputStyle (+7 more)

### Community 38 - "Voice Engine Protocols"
Cohesion: 0.12
Nodes (9): ndarray, Protocol, Feed a PCM frame; return any wake detections in that frame., Yield audio chunks as they become available (sentence-level or better)., StreamingTtsEngine, SttEngine, TtsEngine, VadEngine (+1 more)

### Community 39 - "Reasoning & Consolidation"
Cohesion: 0.17
Nodes (10): ConsolidationReport, DecisionLog, SleepCycle, Autotune, DEFAULT_AUTOTUNE, DepthAssessment, DepthReason, ReasoningMode (+2 more)

### Community 40 - "Memory Judge & Merge"
Cohesion: 0.15
Nodes (8): PrivacyClass, EntityCandidate, EntityForMerge, EntityMergeGroup, FactForMerge, GatewayMemoryJudge, JudgeGateway, MergeGroup

### Community 41 - "UI Acceptance Screenshots"
Cohesion: 0.16
Nodes (16): Requirements Traceability (Phase-1 Acceptance Tests), Research & Platform Verification (Phase 0), Audit — Command Center Dashboard Snapshot (UI Screenshot), Converse UI — Chat View (UI Screenshot), Converse UI — Reasoning Effort Selector (UI Screenshot), Computer Control Panel — Gated Pipeline (UI Screenshot), Command Center Dashboard (UI Screenshot), Devices Panel — High-Risk Physical Interlock (UI Screenshot) (+8 more)

### Community 42 - "Base TS Config"
Cohesion: 0.13
Nodes (14): ES2023, compilerOptions, declaration, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, lib, module (+6 more)

### Community 44 - "Product Requirements Docs"
Cohesion: 0.14
Nodes (12): D-0023 Self-Extension Hard-Limit / Stage B Gate, R-AUTO-01..04 Autonomy & Approval, R-CAP-01..08 Self-Extension Lifecycle, R-CLASS-01..03 Five-State Capability Classification, R-CORE-02 Honesty Rule, R-CORE-03 Core Loop, R-LOC-01..03 Locality, R-MODEL-01..06 Model Gateway Requirements (+4 more)

### Community 45 - "Background Scheduler"
Cohesion: 0.16
Nodes (7): BackgroundScheduler, activity, audit, catalog, estop, proactive, sleepCycle

### Community 47 - "Device Interlock Safety"
Cohesion: 0.21
Nodes (7): InterlockManager, deviceTools(), HIGH_RISK_PREFIXES, isHighRisk(), audit, ctx, setup()

### Community 48 - "Companion App Docs"
Cohesion: 0.18
Nodes (10): MacDesktop.swift (Real Control Adapter), main.swift (JarvisAudio), DESIGN_SYSTEM.md — Visual Design Language, DEVELOPMENT.md — Local Dev Guide, D-0024 Proactivity Engine Gate, D-0025 Device-Control Gate, D-0026 UI Design System Approval, MAC_BRINGUP.md — Mac Runbook (+2 more)

### Community 49 - "Root Package Config"
Cohesion: 0.15
Nodes (12): description, engines, node, name, packageManager, private, scripts, build (+4 more)

### Community 50 - "Wake Word Engines"
Cohesion: 0.14
Nodes (10): WakeEvent, OpenWakeWord, ndarray, Path, Wake-word engine: openWakeWord ONNX pipeline.  Code: Apache-2.0 (dscripka/openWa, ndarray, Path, Wake-word engine: sherpa-onnx open-vocabulary keyword spotting (Apache-2.0).  Th (+2 more)

### Community 51 - "Voice Engine Tests"
Cohesion: 0.21
Nodes (11): kokoro(), ndarray, Engine tests against real models (no mocks — R-CORE-02).  Requires model assets, Real TTS -> real STT round trip: Kokoro speaks a command, STT must hear it., End-to-end: TTS speaks the wake phrase; the wake engine must detect it., _resample_24k_to_16k(), stt(), test_stt_transcribes_synthesized_speech() (+3 more)

### Community 52 - "Autonomy Budget"
Cohesion: 0.21
Nodes (4): AUTONOMY_SOURCES, Budget, BudgetStatus, PRICE_PER_MTOK

### Community 53 - "Files Panel UI"
Cohesion: 0.21
Nodes (10): btn(), Entry, Ev, FileContent, FilesPage(), formatEv(), inputStyle, Match (+2 more)

### Community 54 - "Pulse Panel UI"
Cohesion: 0.18
Nodes (11): Beat, card(), ctl, dim, h2, input, Item, linkBtn (+3 more)

### Community 55 - "Skills Panel UI"
Cohesion: 0.21
Nodes (10): AgentResult, btn(), Ev, formatEv(), inputStyle, Pending, pipeColor(), Skill (+2 more)

### Community 56 - "Companion Package Config"
Cohesion: 0.17
Nodes (11): description, devDependencies, @tauri-apps/cli, name, private, scripts, build, dev (+3 more)

### Community 57 - "Memory Architecture Decisions"
Cohesion: 0.18
Nodes (12): D-0029 Contextual Awareness, D-0038 Semantic Memory (Entities/Facts/Relations), D-0039 Knowledge Feeds Contextual Awareness, D-0041 Episodic Memory, D-0042 Semantic Vector Recall, D-0075 Fast-Model Memory Judgments + Self-Authored Skills, R-MEM-01..06 Memory Requirements, ContextService (+4 more)

### Community 58 - "Kernel TS Config"
Cohesion: 0.17
Nodes (11): node, src/**/*.test.ts, src/**/*.ts, ../../tsconfig.base.json, compilerOptions, outDir, rootDir, types (+3 more)

### Community 60 - "Terminal Runner"
Cohesion: 0.27
Nodes (5): CommandResult, Provenance, RunOptions, TerminalRunner, LocalTerminal

### Community 61 - "Memory Panel UI"
Cohesion: 0.22
Nodes (9): btn(), Entity, Episode, Fact, inputStyle, MemoryPage(), Recall, Rel (+1 more)

### Community 62 - "Self-Extension Panel UI"
Cohesion: 0.20
Nodes (9): ActiveCap, BENIGN, btn(), Finding, MALICIOUS, Report, SelfExtPage(), Verdict (+1 more)

### Community 63 - "Tauri Permissions Config"
Cohesion: 0.18
Nodes (10): description, identifier, permissions, $schema, windows, core:default, core:window:allow-set-focus, core:window:allow-show (+2 more)

### Community 64 - "Streaming STT Engine"
Cohesion: 0.27
Nodes (5): SttPartial, ndarray, Path, Streaming STT engine: sherpa-onnx streaming zipformer transducer (Apache-2.0)., SherpaStreamingStt

### Community 65 - "Dynamic Settings Registry"
Cohesion: 0.15
Nodes (10): DynamicSpecInput, EffectiveSetting, Override, SettingOrigin, SettingType, SettingValue, activity, audit (+2 more)

### Community 66 - "Gateway Router"
Cohesion: 0.40
Nodes (3): GatewayRouter, ChatRequest, ChatResult

### Community 67 - "Agent Panel UI"
Cohesion: 0.27
Nodes (8): AgentPage(), AgentResult, btn(), Ev, formatEv(), Pending, pipeColor(), Step

### Community 68 - "Graphify Tool Docs"
Cohesion: 0.20
Nodes (10): graphify Claude Integration Note, graphify add/watch reference, graphify exports reference, graphify extraction spec, graphify GitHub & merge reference, graphify hooks reference, graphify query/path/explain reference, graphify transcribe reference (+2 more)

### Community 69 - "Mac Preflight Script"
Cohesion: 0.36
Nodes (8): bad(), have(), hdr(), note(), ok(), port_state(), mac_preflight.sh script, skip()

### Community 71 - "Devices Panel UI"
Cohesion: 0.31
Nodes (6): btn(), DevicesPage(), Ev, formatEv(), pipeColor(), RunOutcome

### Community 72 - "Models Panel UI"
Cohesion: 0.28
Nodes (8): CallRow, h2(), inp, ModelsPage(), Override, ProviderRow, sec(), td

### Community 73 - "Proactive Panel UI"
Cohesion: 0.25
Nodes (7): btn(), ProactivePage(), Rule, ruleInput, RunResult, Suppression, Surfaced

### Community 74 - "Agent & Skills Decisions"
Cohesion: 0.22
Nodes (9): D-0030 Agent Runtime, D-0031 Skills Registry, D-0032 Workspace Knowledge/Files, D-0033 Agent Reasons Over Tool Output, D-0035 Terminal-with-Policy, LocalAgentRuntime, Workspace Files Capability, Skills Registry (+1 more)

### Community 75 - "A2UI Panel UI"
Cohesion: 0.29
Nodes (6): A2uiPage(), Component, ctl(), input, Panel, Setting

### Community 76 - "Control Panel UI"
Cohesion: 0.36
Nodes (6): btn(), ControlPage(), Ev, formatEv(), pipeColor(), RunOutcome

### Community 77 - "Knowledge Graph UI"
Cohesion: 0.29
Nodes (7): Bundle, chip(), EntityRow, GEdge, GNode, GraphPage(), input

### Community 78 - "Reasoning Panel UI"
Cohesion: 0.36
Nodes (7): Autotune, chip(), h2(), input, ReasoningPage(), Report, sec()

### Community 79 - "Terminal Panel UI"
Cohesion: 0.36
Nodes (6): btn(), Ev, formatEv(), pipeColor(), RunOutcome, TerminalPage()

### Community 80 - "Web Panel UI"
Cohesion: 0.36
Nodes (6): btn(), Ev, formatEv(), pipeColor(), RunOutcome, WebPage()

### Community 81 - "Research & MCP Decisions"
Cohesion: 0.29
Nodes (8): D-0027 MCP Client Host, D-0034 Web/Research Capability, D-0036 Research-with-Provenance, D-0037 Untrusted-Content Envelopes, Untrusted-Content Envelope, MCP Client Host, research.gather (Provenance), Web/Research Browser Capability

### Community 82 - "Kernel Module Guides"
Cohesion: 0.25
Nodes (8): Model Gateway Panel Screenshot, Pulse (Heartbeat/Agenda) Panel Screenshot, Living-Heartbeat Verification 2026-07-19 (D-0064), Phase 1 Acceptance Results, J.A.R.V.I.S. Docker Compose Infra, jarvis-ears Module Guide, Kernel Module Guide (jarvisd), Kernel Prompts Registry Guide

### Community 83 - "Kernel Capability Guides"
Cohesion: 0.32
Nodes (8): Platform Acceptance Results, Kernel Context Service Guide, Kernel Computer-Control HAL Guide, Kernel Crypto/Vault Guide, Kernel Devices HAL Guide, Kernel Knowledge/Files Guide, Kernel MCP Client Host Guide, Kernel Research-with-Provenance Guide

### Community 84 - "Voice Activity Detection"
Cohesion: 0.32
Nodes (4): ndarray, Path, SileroVad, vad()

### Community 86 - "Terminal Tools & Tests"
Cohesion: 0.39
Nodes (5): assessCommand(), terminalTools(), audit, makeEstop(), makeLoop()

### Community 87 - "Acceptance Run Screenshots"
Cohesion: 0.33
Nodes (7): A2UI Panels Screenshot, Settings Panel Screenshot, Clean-Slate Evolution Acceptance Run 2026-07-19, Gap-Fix Verification 2026-07-19 (D-0062), Scale + Evolution Acceptance Run 2026-07-18, Kernel Proactivity Engine Guide, Kernel Settings Registry Guide

### Community 88 - "Memory Verification Runs"
Cohesion: 0.33
Nodes (7): Memory Panel Screenshot, A/B Observation 2026-07-20 (Model Tier Comparison), D-0075 Memory Judgment Verification, Fresh Full Observation Run 2026-07-20, Observation Run 2026-07-19, Kernel Agent Runtime Guide, Kernel Skills Registry Guide

### Community 90 - "Anthropic Adapter Tests"
Cohesion: 0.33
Nodes (4): createAnthropicAdapter(), adapter(), bodies, TOOL

### Community 91 - "Gateway Router Tests"
Cohesion: 0.29
Nodes (3): auditRows, baseConfig, fakePool

### Community 92 - "Chat Page UI"
Cohesion: 0.50
Nodes (3): appendToLastAssistant(), applyFrame(), Turn

### Community 93 - "Orb Page UI"
Cohesion: 0.40
Nodes (3): OrbState, STATE_COLOR, STATE_LABEL

### Community 94 - "Persona Page UI"
Cohesion: 0.50
Nodes (4): btn(), inputStyle, PersonaPage(), Prompt

### Community 95 - "Settings Page UI"
Cohesion: 0.50
Nodes (4): ctl(), input, Setting, SettingsPage()

### Community 96 - "Proactivity & Settings Screenshots"
Cohesion: 0.40
Nodes (5): A2UI Panel — Autonomy & Proactivity Controls (UI Screenshot), Proactivity Panel — Rules & Suppression (UI Screenshot), Pulse Panel — Heartbeat Journal & Agenda (UI Screenshot), Settings Panel — Full Runtime Settings (UI Screenshot), Settings Panel — Proactivity Settings (Scrolled) (UI Screenshot)

### Community 97 - "Verification Reports"
Cohesion: 0.50
Nodes (5): Chat Parity Audit 2026-07-19, Full Reverification 2026-07-19, Living with J.A.R.V.I.S. 2026-07-19, Stage-B Self-Extension + Affect Verification, Kernel Self-Extension Guide

### Community 98 - "Model Asset Fetcher"
Cohesion: 0.60
Nodes (4): fetch(), main(), Path, Fetch jarvis-ears model assets from verifiable sources into JARVIS_EARS_MODELS.

### Community 99 - "Terminal Policy"
Cohesion: 0.40
Nodes (4): Assessment, DENY, READ_ONLY, Verdict

### Community 101 - "Companion Tauri App Shell"
Cohesion: 1.00
Nodes (3): Companion Kernel-Client Core, Companion Tauri 2 App Shell, D-0040 Companion Tauri App Shell

### Community 102 - "Computer-Control HAL Gate"
Cohesion: 0.67
Nodes (3): D-0022 Computer-Control HAL Activation Gate, R-CTRL-01..05 Computer Control Requirements, Computer-Control HAL

## Ambiguous Edges - Review These
- `Research & Platform Verification (Phase 0)` → `Skills Panel — Saved Objectives & Gated Agent (UI Screenshot)`  [AMBIGUOUS]
  docs/screenshots/skills.png · relation: references
- `Chat Parity Audit 2026-07-19` → `Platform Acceptance Results`  [AMBIGUOUS]
  docs/verification/CHAT_PARITY_AUDIT_2026-07-19.md · relation: references
- `Full Reverification 2026-07-19` → `Phase 1 Acceptance Results`  [AMBIGUOUS]
  docs/verification/FULL_REVERIFICATION_2026-07-19.md · relation: references

## Knowledge Gaps
- **452 isolated node(s):** `Component`, `Panel`, `Setting`, `input`, `Step` (+447 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **31 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Research & Platform Verification (Phase 0)` and `Skills Panel — Saved Objectives & Gated Agent (UI Screenshot)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Chat Parity Audit 2026-07-19` and `Platform Acceptance Results`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Full Reverification 2026-07-19` and `Phase 1 Acceptance Results`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `AuditLog` connect `Agenda & Announcements` to `Approval Broker & Memory Bus`, `Proactivity Engine`, `Tool Registry`, `Affect & Config Loading`, `Capability Guard & Activation`, `Core Tools & Preferences`, `Secrets Vault`, `Memory Forget/Correct Ops`, `Settings Registry`, `Grants & Policy Decisions`, `Entity Resolution`, `Agent Runtime Core`, `Capability Activation Service`, `Episodic Memory`, `A2UI Component Registry`, `Semantic Memory Search`, `Reasoning & Consolidation`, `Announcer Service`, `Background Scheduler`, `Device Interlock Safety`, `Dynamic Settings Registry`, `Skill Registry`, `Audit Chain Verification`, `Terminal Tools & Tests`, `Agenda Store`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `SimulatedDesktop` connect `Computer Control API` to `Agent Runtime Core`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `ComputerControl` connect `Computer Control API` to `Tool Registry`, `Agent Runtime Core`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `Component`, `Panel`, `Setting` to the rest of the system?**
  _452 weakly-connected nodes found - possible documentation gaps or missing edges._