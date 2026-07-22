# Graph Report - .  (2026-07-22)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2107 nodes · 4414 edges · 147 communities (110 shown, 37 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 92 edges (avg confidence: 0.64)
- Token cost: 10,846 input · 2,230 output

## Graph Freshness
- Built from commit: `984b3e0f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Skill Activation Service
- Proactivity Engine
- Research & Evidence Gathering
- Agenda Management
- Audio Playback Bridge
- Approvals & Consolidation
- Computer Control Interface
- Tool Registry & Announcements
- UI Screenshots Gallery
- Audit Log & Projects
- Kernel Dependencies
- Python Audio IO
- Emergency Stop Policy
- Ears Server & TTS
- Device Gateway Contract
- Workspace Files Contract
- Decision Log: Check-ins
- Context Provider Contract
- Role Override Store
- Model Provider Adapters
- Command Center TS Config
- Tauri App Config
- Decision Log: Settings & Affect
- Agent Runtime Contract
- Command Center Package Config
- Turn-Taking & Voice Engines
- Memory Judgment Service
- Entity & Fact Resolution
- Rust Kernel Core
- Interlock & Memory Consolidation
- Project Docs & Requirements
- Gateway Config Defaults
- Tool Registry & Self-Extension
- Companion Architecture Decisions
- Entity Memory Store
- A2UI Registry & Schema
- Voice/Control Check-in Decisions
- Command Center App Page
- Speech Engine Interfaces
- Perception Service & Core
- Semantic Memory Search
- Settings Registry
- Decision Log: Self-Improvement
- Agent Runtime Decisions
- Wake-Word Detection Engines
- MCP Registry
- Decision Log: Autonomy Rhythms
- Secrets Vault
- Memory Service API
- Database Migrations
- Model Gateway Decisions
- Base TS Config
- Gateway Router
- Project READMEs & Architecture
- Encrypted Vault Utilities
- Reasoning Tuner
- Memory Judgment Verification
- Root Package Config
- Voice Engine Tests
- Ops Health & Audit Chain
- Budget & Autonomy Spend
- Terminal Command Policy
- Files Page UI
- Pulse/Heartbeat Page UI
- Skills Page UI
- Companion App Config
- Reasoning Panel Decisions
- Devices & Secrets Decisions
- Kernel TS Build Config
- Server Entry Point
- Episodic Memory Store
- Settings Registry Logic
- Terminal Runner Contract
- Memory Page UI
- Self-Extension Page UI
- Tauri Permissions Config
- Streaming STT Engine
- Projects Service
- Agent Page UI
- Graphify Reference Docs
- Preflight Check Script
- Devices Page UI
- Models Page UI
- Proactive Page UI
- Skill Registry
- Device Tools & Interlock
- Settings Catalog & Tools
- A2UI Page UI
- Control Page UI
- Graph Page UI
- Reasoning Page UI
- Terminal Page UI
- Web Page UI
- Voice Activity Detection
- Announcer Queue
- Memory Recall Decisions
- Anthropic Adapter Tests
- Gateway Router Tests
- Affect Inference Service
- Announcement Tests
- Chat Page UI
- Orb Page State
- Persona Page UI
- Settings Page UI
- Embeddings & Ops Infra
- Model Asset Fetching
- Kernel Config Schema
- KEK Key Resolution
- Prompt Registry
- Root Layout
- Datastore Decision Docs
- Announcer Initiative
- Docker Compose Infra
- MCP Test Server
- Next.js Config
- Next Env Types
- Companion Audio Bridge
- Swift Package Manifest
- Perception Service
- Research & Web Automation
- Terminal Module Docs
- Web Module Docs
- A2UI Panels Decision
- Voice Stack Decision
- Module Docs Deferral
- Observability Viewer Decision
- Local Model Baseline
- Spatial Input Decision
- Simulator Depth Decision
- Hardware Inventory Decision
- Clean-Slate Acceptance Run
- Agent Module Guide
- Context Module Guide
- Control Module Guide
- Knowledge Workspace Files
- MCP Client Host
- Proactivity Rules
- Terminal Shell Policy
- Jarvis Ears
- Ears Module Guide
- Kernel Module Guide

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
- `D-0021 Memory architecture approval` --conceptually_related_to--> `Semantic memory (entities/facts/relations)`  [INFERRED]
  docs/DECISION_LOG.md → kernel/src/memory/entities.ts
- `THREAT_MODEL` --references--> `Untrusted-content envelopes`  [EXTRACTED]
  docs/THREAT_MODEL.md → kernel/src/core/untrusted.ts
- `D-0050 Deep-reasoning learning` --references--> `ReasoningTuner`  [EXTRACTED]
  docs/DECISION_LOG.md → src/core/reasoning.ts
- `D-0051 Sleep-cycle consolidation` --references--> `migration 0015 reasoning_decisions table`  [EXTRACTED]
  docs/DECISION_LOG.md → migrations/0015_reasoning_decisions.sql
- `D-0075 Memory Judgment Verification` --references--> `ReasoningTuner`  [EXTRACTED]
  docs/verification/D0075_MEMORY_JUDGMENT_2026-07-20.md → src/core/reasoning.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Binding Specification Docs (01-07)** — docs_01_mission_and_core_loop, docs_02_requirements, docs_03_spatial_hardware_oss, docs_04_stack_and_phases, docs_05_security_scope_locality, docs_06_check_ins_and_verify, docs_07_session_continuity [EXTRACTED 0.95]
- **Option A Hybrid Architecture Components** — concept_jarvisd_kernel, concept_jarvis_mind, concept_jarvis_ears, concept_command_center, concept_companion_app [EXTRACTED 0.90]
- **graphify extraction/build/query pipeline** — claude_skills_graphify_skill, claude_skills_graphify_references_extraction_spec, claude_skills_graphify_references_query, claude_skills_graphify_references_update, claude_skills_graphify_references_exports [INFERRED 0.75]
- **Capabilities built foundation-first, real activation gated on dedicated check-in** — docs_decision_log_d0022, docs_decision_log_d0023, docs_decision_log_d0024, docs_decision_log_d0025, docs_decision_log_d0026, docs_06 [INFERRED 0.80]
- **Full memory store set: secrets, context, semantic entities, episodic timeline** — docs_decision_log_d0028, docs_decision_log_d0029, docs_decision_log_d0038, docs_decision_log_d0039, docs_decision_log_d0041, kernel_src_context, kernel_src_memory_entities, kernel_src_memory_episodes [INFERRED 0.75]
- **Outward/high-risk capabilities routed through policy/approval/audit/verification pipeline** — kernel_src_web, kernel_src_terminal, kernel_src_research, kernel_src_mcp, kernel_src_core_coreloop, kernel_src_core_untrusted [INFERRED 0.80]
- **Graph-brain / semantic memory recall flow** — docs_decision_log_d0042, docs_decision_log_d0045, src_memory_semantic_semanticmemory, src_memory_entity_entitymemory, src_memory_episodic_episodicmemory, src_gateway_router_embed [INFERRED 0.80]
- **Deep-reasoning escalation, learning and consolidation flow** — docs_decision_log_d0048, docs_decision_log_d0049, docs_decision_log_d0050, docs_decision_log_d0051, docs_decision_log_d0052_override_contract, src_core_reasoning_assessdepth, src_core_reasoning_reasoningtuner, core_consolidation_sleepcycle, core_runconversation [INFERRED 0.82]
- **Dual-editable override ledger principle and its migrations** — docs_decision_log_d0053, docs_decision_log_d0054, docs_decision_log_d0055, gateway_tools, command_center_models_panel, src_gateway_config_roletarget [EXTRACTED 0.85]
- **A2UI readiness flow (D-0056 through D-0061)** — docs_decision_log_d0056, docs_decision_log_d0058, docs_decision_log_d0060, docs_decision_log_d0061 [INFERRED 0.85]
- **Three autonomy rhythms: live/heartbeat/quiet-hours governance** — docs_decision_log_d0024, docs_decision_log_d0063, docs_decision_log_d0064, docs_decision_log_d0065, docs_decision_log_d0066 [INFERRED 0.80]
- **Memory evolution completeness: recall/correct/forget/consolidate/harden** — docs_decision_log_d0057, docs_decision_log_d0062, docs_decision_log_d0063, docs_decision_log_d0067 [INFERRED 0.75]
- **Ordered check-in gate sequence unlocking real-world capabilities** — docs_mac_bringup, decision_d0004, decision_d0022, decision_d0023, decision_d0024, decision_d0025, decision_d0026, decision_d0027 [EXTRACTED 0.85]
- **Graph-brain memory subsystem (entities/episodes/semantic/judge/context)** — kernel_src_memory_entities, kernel_src_memory_episodes, kernel_src_memory_semantic, kernel_src_memory_judge, kernel_src_context [INFERRED 0.70]
- **Command Center dashboard as navigation hub linking all J.A.R.V.I.S. UI panels** — docs_screenshots_dashboard, docs_screenshots_audit_00_dashboard, docs_screenshots_chat, docs_screenshots_files, docs_screenshots_memory, docs_screenshots_proactivity, docs_screenshots_device_control, docs_screenshots_computer_control, docs_screenshots_self_extension, docs_screenshots_persona, docs_screenshots_models, docs_screenshots_skills, docs_screenshots_graph, docs_screenshots_settings, docs_screenshots_a2ui, docs_screenshots_pulse, docs_screenshots_voice_orb [EXTRACTED 0.85]
- **Phase 0 Documentation Set (traceability, research verification, threat model, decision log)** — docs_requirements_traceability, docs_research_verification, docs_threat_model, docs_decision_log [INFERRED 0.70]
- **Disclosure → approval → execute → verify gated pipeline pattern across consequential-action UIs** — docs_screenshots_computer_control, docs_screenshots_device_control, docs_screenshots_files, docs_screenshots_skills, docs_threat_model [INFERRED 0.75]
- **Shared Gated Pipeline (consequential-action approval flow) across tool surfaces** — jarvis_agent, jarvis_control, jarvis_devices, jarvis_files, jarvis_terminal, jarvis_web, jarvis_skills [INFERRED 0.85]
- **Shared runtime configuration keys (autonomy/proactive/heartbeat) between Settings and A2UI Panels** — jarvis_settings, jarvis_a2ui, jarvis_pulse [INFERRED 0.80]
- **Memory, Knowledge Graph and Reasoning form the persistent knowledge/learning layer** — jarvis_memory, jarvis_graph, jarvis_reasoning [INFERRED 0.80]
- **Memory Judgment Verification Chain (Observation → D-0075 → Fresh → A/B)** — docs_verification_observation_run_2026_07_19_report, docs_verification_d0075_memory_judgment_2026_07_20_report, docs_verification_fresh_observation_2026_07_20_report, docs_verification_ab_observation_2026_07_20_report [INFERRED 0.80]
- **Command Center UI Panel Screenshots + Acceptance Docs** — docs_screenshots_final_a2ui_screenshot, docs_screenshots_final_dashboard_screenshot, docs_screenshots_final_memory_screenshot, docs_screenshots_final_models_screenshot, docs_screenshots_final_pulse_screenshot, docs_screenshots_final_settings_screenshot, docs_verification_platform_acceptance_report [INFERRED 0.70]
- **Self-Extension / Self-Written Code Capability Narrative** — docs_verification_chat_parity_audit_2026_07_19_report, docs_verification_living_with_jarvis_2026_07_19_report, concept_d0074_self_written_code [INFERRED 0.75]
- **R-CAP-01 no-fixed-connector-list registries** — services_kernel_src_prompts_registry, services_kernel_src_skills_registry, services_kernel_src_mcp_registry, services_kernel_src_settings_registry, services_kernel_src_selfext_registry [INFERRED 0.75]
- **Tools running through the gated policy/approval/audit/verification loop** — services_kernel_src_devices_tools, services_kernel_src_knowledge_tools, services_kernel_src_research_tools, services_kernel_src_mcp_tools, services_kernel_src_selfext_activation, services_kernel_src_skills_tools, services_kernel_src_settings_tools [INFERRED 0.75]
- **Z1 trust-core exclusion / hard-limit enforcement boundary** — services_kernel_src_selfext_protected, services_kernel_src_selfext_guard, services_kernel_src_crypto_secrets, services_kernel_src_settings_catalog [INFERRED 0.70]

## Communities (147 total, 37 thin omitted)

### Community 0 - "Skill Activation Service"
Cohesion: 0.07
Nodes (27): ActivationService, CapabilityGuard, DANGEROUS_PATTERNS, GuardVerdict, manifestHash(), ScanFinding, SECRET_PATTERNS, sha() (+19 more)

### Community 1 - "Proactivity Engine"
Cohesion: 0.08
Nodes (27): parseJson(), sliceSpan(), ProactivityEngine, GateStack, inQuietHours(), priorityRank(), briefingCandidate(), calendarConflictCandidates() (+19 more)

### Community 2 - "Research & Evidence Gathering"
Cohesion: 0.07
Nodes (24): Evidence, GatherOptions, Researcher, ResearchFindings, SourceStatus, TargetCheck, queryTerms(), scorePassages() (+16 more)

### Community 3 - "Agenda Management"
Cohesion: 0.06
Nodes (25): Agenda, AgendaItem, agendaTools(), AutonomyStatus, BackgroundScheduler, TickResult, ActivityBus, SleepCycle (+17 more)

### Community 4 - "Audio Playback Bridge"
Cohesion: 0.09
Nodes (28): AppKit, ApplicationServices, AudioBridge, Double, Float, EarsClient, Float, AppInfoDTO (+20 more)

### Community 5 - "Approvals & Consolidation"
Cohesion: 0.08
Nodes (17): ApprovalBroker, ApprovalResolution, PendingApproval, ConsolidationReport, DecisionLog, CoreLoop, assessDepth(), Autotune (+9 more)

### Community 6 - "Computer Control Interface"
Cohesion: 0.09
Nodes (12): AppInfo, AxElement, ComputerControl, ControlProvenance, ControlResult, ElementSelector, Screenshot, WindowInfo (+4 more)

### Community 7 - "Tool Registry & Announcements"
Cohesion: 0.09
Nodes (25): Announcement, announceTools(), computerControlTools(), ActionDisclosure, ActivityEvent, RememberArgs, rememberPreferenceTool(), systemInfoTool (+17 more)

### Community 8 - "UI Screenshots Gallery"
Cohesion: 0.06
Nodes (40): J.A.R.V.I.S. Converse UI Screenshot, J.A.R.V.I.S. Agent UI Screenshot, J.A.R.V.I.S. Computer Control UI Screenshot, J.A.R.V.I.S. Devices UI Screenshot, J.A.R.V.I.S. Files UI Screenshot, J.A.R.V.I.S. Terminal UI Screenshot, J.A.R.V.I.S. Web UI Screenshot, J.A.R.V.I.S. Memory UI Screenshot (+32 more)

### Community 9 - "Audit Log & Projects"
Cohesion: 0.09
Nodes (20): Project, ProjectLogEntry, projectTools(), AuditEntry, AuditLog, redactSecrets(), WHOLE_MATCH_PATTERNS, /core/converse endpoint (+12 more)

### Community 10 - "Kernel Dependencies"
Cohesion: 0.05
Nodes (37): ajv, fastify, @modelcontextprotocol/sdk, pg, playwright, dependencies, ajv, fastify (+29 more)

### Community 11 - "Python Audio IO"
Cohesion: 0.07
Nodes (21): AudioSink, AudioSource, BufferAudioSink, BufferAudioSource, _PortAudioSource, ndarray, Path, Protocol (+13 more)

### Community 12 - "Emergency Stop Policy"
Cohesion: 0.08
Nodes (20): EmergencyStop, ActionRequest, Decision, Grant, ORDER, PolicyEngine, PROHIBITED, riskAtOrBelow() (+12 more)

### Community 13 - "Ears Server & TTS"
Cohesion: 0.10
Nodes (24): BaseModel, TtsChunk, listen(), load_engines(), ndarray, jarvis-ears HTTP/WS surface (localhost only, R-LOC-01).  GET  /health  — real en, Run the full utterance through the streaming STT and return the transcript., A complete captured utterance @16kHz mono float32. On the Mac the audio     come (+16 more)

### Community 14 - "Device Gateway Contract"
Cohesion: 0.13
Nodes (15): DEVICE_RISK, DeviceCommand, DeviceGateway, DeviceInfo, DeviceProvenance, DeviceResult, DeviceState, DeviceType (+7 more)

### Community 15 - "Workspace Files Contract"
Cohesion: 0.14
Nodes (16): DirEntry, EditOutcome, FileContent, FileInfo, FileKind, SearchMatch, SearchOptions, SearchResult (+8 more)

### Community 16 - "Decision Log: Check-ins"
Cohesion: 0.11
Nodes (31): Decision D-0022: real macOS adapter gated behind check-in, Decision D-0023: Stage B (sandboxed generation, signed install) requires dedicated security check-in, Decision D-0024: proactive cycle gated on check-in, suggestion-only, Decision D-0025: real Home Assistant gateway bound at check-in, Decision D-0027: MCP server trust raises only on reconnect re-attestation, Decision D-0043: user-editable persona (R-CAP-01), Decision D-0045: knowledge graph walk / semantic recall, Decision D-0058: settings editable at runtime, effective=value else default (+23 more)

### Community 17 - "Context Provider Contract"
Cohesion: 0.14
Nodes (14): CommitmentContext, ContextProvider, ContextSnapshot, EpisodeSource, KnowledgeSource, KnownEntity, PinnedFact, ProactiveContext (+6 more)

### Community 18 - "Role Override Store"
Cohesion: 0.11
Nodes (17): registerCoreRoutes(), sseCorsHeaders(), parseRolePin(), loadRoleOverrides(), persistRoleOverrides(), Store, StoredRoleOverrides, pinOf() (+9 more)

### Community 19 - "Model Provider Adapters"
Cohesion: 0.13
Nodes (12): ProviderAdapter, ProviderError, OllamaMessage, createOpenAiCompatAdapter(), ajv, RoleOverride, ChatEvent, NeutralMessage (+4 more)

### Community 20 - "Command Center TS Config"
Cohesion: 0.07
Nodes (27): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+19 more)

### Community 21 - "Tauri App Config"
Cohesion: 0.07
Nodes (26): app, security, trayIcon, windows, build, devUrl, frontendDist, bundle (+18 more)

### Community 22 - "Decision Log: Settings & Affect"
Cohesion: 0.11
Nodes (24): /core/converse route, D-0019 Affect/state inference (B4), D-0056 A2UI direction (superseded by D-0061), D-0058 General runtime settings command center, D-0059 Persist standing consent, D-0060 Dynamic settings runtime registration, D-0061 A2UI built (agent-generated declarative UI), D-0062 Memory-evolution completeness (correct/forget) (+16 more)

### Community 23 - "Agent Runtime Contract"
Cohesion: 0.14
Nodes (17): AgentResult, AgentRunOptions, AgentRuntime, AgentStep, LocalAgentRuntime, ToolContext, wrapUntrusted(), AgentRunOpts (+9 more)

### Community 24 - "Command Center Package Config"
Cohesion: 0.08
Nodes (25): dependencies, next, react, react-dom, description, devDependencies, @types/node, @types/react (+17 more)

### Community 25 - "Turn-Taking & Voice Engines"
Cohesion: 0.14
Nodes (17): Enum, Typed, replaceable speech-engine contracts (R-VOICE-12).  Every engine is an ope, VadFrame, Full-duplex turn-taking + barge-in state machine (R-VOICE-03).  This is the ENGI, Drives the conversation's turn state from VAD frames.      Barge-in fires when,, Feed one VAD frame; returns any turn transitions it triggered., TurnEvent, TurnTaker (+9 more)

### Community 26 - "Memory Judgment Service"
Cohesion: 0.12
Nodes (10): PrivacyClass, EntityCandidate, EntityForMerge, EntityMergeGroup, FactForMerge, GatewayMemoryJudge, JudgeGateway, MemoryJudge (+2 more)

### Community 27 - "Entity & Fact Resolution"
Cohesion: 0.13
Nodes (18): contentWords(), diceCoefficient(), Entity, EntityKind, Fact, fullestName(), GraphNeighborhood, GraphRecall (+10 more)

### Community 28 - "Rust Kernel Core"
Cohesion: 0.18
Nodes (19): engage_estop(), estop_engaged(), get(), is_healthy(), KernelError, parse_status(), post(), request() (+11 more)

### Community 29 - "Interlock & Memory Consolidation"
Cohesion: 0.12
Nodes (3): InterlockManager, anyPairShareWord(), PromptRegistry

### Community 30 - "Project Docs & Requirements"
Cohesion: 0.28
Nodes (19): Root CLAUDE.md, 01 Mission And Core Loop, 02 Requirements, 03 Spatial Hardware OSS, 04 Stack and Phases, 05 Security Scope Locality, 06 Check-ins and Verify, docs/07 (end-of-session update policy) (+11 more)

### Community 31 - "Gateway Config Defaults"
Cohesion: 0.14
Nodes (16): DEFAULT_GATEWAY_CONFIG, ENV_DEFAULT_KINDS, loadGatewayConfig(), NON_GENERATIVE_ROLES, resolveGatewayConfig(), createOllamaAdapter(), ContentPart, EffortLevel (+8 more)

### Community 32 - "Tool Registry & Self-Extension"
Cohesion: 0.12
Nodes (14): ToolRegistry, ActivationCheck, activationTools(), authoringTools(), RISK_ORDER, StepRunner, audit, settings (+6 more)

### Community 33 - "Companion Architecture Decisions"
Cohesion: 0.13
Nodes (21): Companion kernel-client core, Companion Tauri app shell, D-0021 Memory architecture approval, D-0014 Desktop shell: Tauri 2, D-0029 Contextual awareness: ContextService, D-0038 Semantic memory: entities/facts/relations, D-0039 Non-sensitive-only injection (referenced), D-0040 Companion Tauri 2 app shell scaffolded (+13 more)

### Community 34 - "Entity Memory Store"
Cohesion: 0.25
Nodes (3): assertNotSecret(), EntityMemory, seedChain()

### Community 35 - "A2UI Registry & Schema"
Cohesion: 0.12
Nodes (12): A2uiPanel, A2uiRegistry, A2uiComponent, A2uiComponentSchema, A2uiSpec, A2uiSpecSchema, Action, Heading (+4 more)

### Community 36 - "Voice/Control Check-in Decisions"
Cohesion: 0.13
Nodes (15): Ambient Voice Orb (apps/command-center/app/orb/), MacDesktop.swift (real macOS adapter), D-0004/D-0004a Voice stack approval, D-0022 Computer control check-in, D-0023 Self-extension Stage B check-in, D-0024 Proactive delivery check-in, D-0026 Design system check-in, docs/06 (check-in policy doc) (+7 more)

### Community 37 - "Command Center App Page"
Cohesion: 0.14
Nodes (15): activityColor(), ActivityEvent, btn(), ContextData, EmergencyStopButton(), formatActivity(), HealthReport, inputStyle (+7 more)

### Community 38 - "Speech Engine Interfaces"
Cohesion: 0.12
Nodes (9): ndarray, Protocol, Feed a PCM frame; return any wake detections in that frame., Yield audio chunks as they become available (sentence-level or better)., StreamingTtsEngine, SttEngine, TtsEngine, VadEngine (+1 more)

### Community 39 - "Perception Service & Core"
Cohesion: 0.15
Nodes (9): a2uiTools(), buildCore(), entityMemoryTools(), FilePerceptionSource, Observation, PerceptionService, PerceptionSource, perceptionTools() (+1 more)

### Community 40 - "Semantic Memory Search"
Cohesion: 0.13
Nodes (11): EmbedFn, SemanticHit, SemanticMemory, SemanticSource, toVectorLiteral(), audit, embed(), hashEmbed() (+3 more)

### Community 42 - "Decision Log: Self-Improvement"
Cohesion: 0.16
Nodes (18): D-0051 Sleep-Cycle Autotune Self-Adjustment, D-0064 Living Heartbeat + Agenda, D-0074 Self-Written Code Capability, D-0075 Fast-Model Memory Judgments, Gated Loop (runTool/runConversation choke point), A2UI Panels Command Center Screenshot, Command Center Dashboard Screenshot, Model Gateway Panel Screenshot (+10 more)

### Community 43 - "Agent Runtime Decisions"
Cohesion: 0.16
Nodes (18): D-0008 Model gateway approach, D-0009 Agent runtime: LangGraph behind AgentRuntime interface, D-0030 Agent runtime (jarvis-mind) foundation, D-0031 Skills registry, D-0032 Workspace knowledge / files capability, D-0033 Tool results feed agent reasoning (detail), D-0034 Web browsing / research capability, D-0035 Terminal-with-policy (+10 more)

### Community 44 - "Wake-Word Detection Engines"
Cohesion: 0.14
Nodes (10): WakeEvent, OpenWakeWord, ndarray, Path, Wake-word engine: openWakeWord ONNX pipeline.  Code: Apache-2.0 (dscripka/openWa, ndarray, Path, Wake-word engine: sherpa-onnx open-vocabulary keyword spotting (Apache-2.0).  Th (+2 more)

### Community 45 - "MCP Registry"
Cohesion: 0.15
Nodes (9): McpDiscovery, McpToolSpec, McpRegistry, McpServerRow, RegisteredServer, TrustLevel, audit, clients (+1 more)

### Community 46 - "Decision Log: Autonomy Rhythms"
Cohesion: 0.15
Nodes (17): D-0024 Background autonomy approved, D-0052 Sleep-cycle proposals (referenced), D-0063 Live + quiet-hours memory consolidation, D-0064 Living heartbeat / agenda, D-0065 Three rhythms: live/heartbeat/quiet hours, D-0066 Spend governance / budget, D-0069 Durable projects across heartbeats, R-MEM-04 forgetting is user's call (+9 more)

### Community 47 - "Secrets Vault"
Cohesion: 0.16
Nodes (6): buildCore, normalizeName(), SecretInfo, SecretsVault, audit, auditPayloads

### Community 49 - "Database Migrations"
Cohesion: 0.23
Nodes (11): AppliedMigration, config, migrationsDir, pool, listMigrationFiles(), migrationStatus(), runMigrations(), createPool() (+3 more)

### Community 50 - "Model Gateway Decisions"
Cohesion: 0.16
Nodes (15): Command Center /models panel, runConversation, D-0046 Scale validation (referenced), D-0047 Model-gateway observability, D-0048 Deep-reasoning escalation, D-0049 Provider-agnostic generation settings, D-0054 Runtime gateway role editor, D-0055 Conversational edit path for settings (+7 more)

### Community 51 - "Base TS Config"
Cohesion: 0.13
Nodes (14): ES2023, compilerOptions, declaration, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, lib, module (+6 more)

### Community 52 - "Gateway Router"
Cohesion: 0.29
Nodes (4): GatewayRouter, ChatRequest, ChatResult, ModelRole

### Community 53 - "Project READMEs & Architecture"
Cohesion: 0.16
Nodes (13): @jarvis/command-center module guide, J.A.R.V.I.S. macOS companion README, Companion app icons README, Companion fallback index.html, Command Center (Next.js + R3F UI), Companion (Tauri 2 + Swift bridge), jarvis-ears (Python speech daemon), jarvis-mind (Python LangGraph agent runtime) (+5 more)

### Community 54 - "Encrypted Vault Utilities"
Cohesion: 0.19
Nodes (6): MemoryService, gcmDecrypt(), gcmEncrypt(), Vault, WRAP_INFO, audit

### Community 56 - "Memory Judgment Verification"
Cohesion: 0.17
Nodes (13): a2ui registry (pruneSetting), core/index.ts (settings.onRemove hook), Memory Panel Screenshot, D-0075 Memory Judgment Verification, Gap-Fix Verification 2026-07-19 (D-0062), Observation Run 2026-07-19, Scale + Evolution Acceptance Run 2026-07-18, memory.correct/memory.forget tools (+5 more)

### Community 57 - "Root Package Config"
Cohesion: 0.15
Nodes (12): description, engines, node, name, packageManager, private, scripts, build (+4 more)

### Community 58 - "Voice Engine Tests"
Cohesion: 0.21
Nodes (11): kokoro(), ndarray, Engine tests against real models (no mocks — R-CORE-02).  Requires model assets, Real TTS -> real STT round trip: Kokoro speaks a command, STT must hear it., End-to-end: TTS speaks the wake phrase; the wake engine must detect it., _resample_24k_to_16k(), stt(), test_stt_transcribes_synthesized_speech() (+3 more)

### Community 59 - "Ops Health & Audit Chain"
Cohesion: 0.18
Nodes (4): canonicalJson(), BRAIN_TABLES, HealthReport, Ops

### Community 60 - "Budget & Autonomy Spend"
Cohesion: 0.21
Nodes (4): AUTONOMY_SOURCES, Budget, BudgetStatus, PRICE_PER_MTOK

### Community 61 - "Terminal Command Policy"
Cohesion: 0.23
Nodes (9): assessCommand(), Assessment, DENY, READ_ONLY, Verdict, terminalTools(), audit, makeEstop() (+1 more)

### Community 62 - "Files Page UI"
Cohesion: 0.21
Nodes (10): btn(), Entry, Ev, FileContent, FilesPage(), formatEv(), inputStyle, Match (+2 more)

### Community 63 - "Pulse/Heartbeat Page UI"
Cohesion: 0.18
Nodes (11): Beat, card(), ctl, dim, h2, input, Item, linkBtn (+3 more)

### Community 64 - "Skills Page UI"
Cohesion: 0.21
Nodes (10): AgentResult, btn(), Ev, formatEv(), inputStyle, Pending, pipeColor(), Skill (+2 more)

### Community 65 - "Companion App Config"
Cohesion: 0.17
Nodes (11): description, devDependencies, @tauri-apps/cli, name, private, scripts, build, dev (+3 more)

### Community 66 - "Reasoning Panel Decisions"
Cohesion: 0.23
Nodes (12): Command Center /reasoning panel, SleepCycle, D-0044 User-defined proactivity rules, D-0050 Deep-reasoning learning, D-0051 Sleep-cycle consolidation, D-0052 Override contract revised, D-0052 Reasoning panel UI, D-0053 Dual-editability principle (referenced) (+4 more)

### Community 67 - "Devices & Secrets Decisions"
Cohesion: 0.18
Nodes (12): Managed SecretsVault, D-0025 Physical devices check-in, D-0027 MCP server trust, D-0028 Secrets vault, devices/homeassistant.ts (real HA gateway), D-0011 MCP spec target 2025-11-25, D-0025 Device-control foundation SIMULATION-first, D-0027 MCP client host built, trust elevation gated (+4 more)

### Community 68 - "Kernel TS Build Config"
Cohesion: 0.17
Nodes (11): node, src/**/*.test.ts, src/**/*.ts, ../../tsconfig.base.json, compilerOptions, outDir, rootDir, types (+3 more)

### Community 69 - "Server Entry Point"
Cohesion: 0.17
Nodes (10): app, config, gateway, here, keyfile, migrationsDir, pkg, pool (+2 more)

### Community 71 - "Settings Registry Logic"
Cohesion: 0.20
Nodes (9): DynamicSpecInput, EffectiveSetting, jaccard(), normKey(), Override, SettingOrigin, SettingType, SettingValue (+1 more)

### Community 72 - "Terminal Runner Contract"
Cohesion: 0.27
Nodes (5): CommandResult, Provenance, RunOptions, TerminalRunner, LocalTerminal

### Community 73 - "Memory Page UI"
Cohesion: 0.22
Nodes (9): btn(), Entity, Episode, Fact, inputStyle, MemoryPage(), Recall, Rel (+1 more)

### Community 74 - "Self-Extension Page UI"
Cohesion: 0.20
Nodes (9): ActiveCap, BENIGN, btn(), Finding, MALICIOUS, Report, SelfExtPage(), Verdict (+1 more)

### Community 75 - "Tauri Permissions Config"
Cohesion: 0.18
Nodes (10): description, identifier, permissions, $schema, windows, core:default, core:window:allow-set-focus, core:window:allow-show (+2 more)

### Community 76 - "Streaming STT Engine"
Cohesion: 0.27
Nodes (5): SttPartial, ndarray, Path, Streaming STT engine: sherpa-onnx streaming zipformer transducer (Apache-2.0)., SherpaStreamingStt

### Community 78 - "Agent Page UI"
Cohesion: 0.27
Nodes (8): AgentPage(), AgentResult, btn(), Ev, formatEv(), Pending, pipeColor(), Step

### Community 79 - "Graphify Reference Docs"
Cohesion: 0.20
Nodes (9): graphify reference: add-watch, graphify reference: exports, graphify reference: extraction-spec, graphify reference: github-and-merge, graphify reference: hooks, graphify reference: query, graphify reference: transcribe, graphify reference: update (+1 more)

### Community 80 - "Preflight Check Script"
Cohesion: 0.36
Nodes (8): bad(), have(), hdr(), note(), ok(), port_state(), mac_preflight.sh script, skip()

### Community 81 - "Devices Page UI"
Cohesion: 0.31
Nodes (6): btn(), DevicesPage(), Ev, formatEv(), pipeColor(), RunOutcome

### Community 82 - "Models Page UI"
Cohesion: 0.28
Nodes (8): CallRow, h2(), inp, ModelsPage(), Override, ProviderRow, sec(), td

### Community 83 - "Proactive Page UI"
Cohesion: 0.25
Nodes (7): btn(), ProactivePage(), Rule, ruleInput, RunResult, Suppression, Surfaced

### Community 85 - "Device Tools & Interlock"
Cohesion: 0.33
Nodes (6): deviceTools(), HIGH_RISK_PREFIXES, isHighRisk(), audit, ctx, setup()

### Community 86 - "Settings Catalog & Tools"
Cohesion: 0.31
Nodes (6): SETTINGS_CATALOG, SettingSpec, settingsTools(), audit, catalog, estop

### Community 87 - "A2UI Page UI"
Cohesion: 0.29
Nodes (6): A2uiPage(), Component, ctl(), input, Panel, Setting

### Community 88 - "Control Page UI"
Cohesion: 0.36
Nodes (6): btn(), ControlPage(), Ev, formatEv(), pipeColor(), RunOutcome

### Community 89 - "Graph Page UI"
Cohesion: 0.29
Nodes (7): Bundle, chip(), EntityRow, GEdge, GNode, GraphPage(), input

### Community 90 - "Reasoning Page UI"
Cohesion: 0.36
Nodes (7): Autotune, chip(), h2(), input, ReasoningPage(), Report, sec()

### Community 91 - "Terminal Page UI"
Cohesion: 0.36
Nodes (6): btn(), Ev, formatEv(), pipeColor(), RunOutcome, TerminalPage()

### Community 92 - "Web Page UI"
Cohesion: 0.36
Nodes (6): btn(), Ev, formatEv(), pipeColor(), RunOutcome, WebPage()

### Community 93 - "Voice Activity Detection"
Cohesion: 0.32
Nodes (4): ndarray, Path, SileroVad, vad()

### Community 95 - "Memory Recall Decisions"
Cohesion: 0.38
Nodes (7): D-0042 Semantic vector recall over memory, D-0045 Graph-brain memory traversal, migration 0012 memory_embeddings table, Model gateway router.embed, EntityMemory, EpisodicMemory, SemanticMemory

### Community 96 - "Anthropic Adapter Tests"
Cohesion: 0.33
Nodes (4): createAnthropicAdapter(), adapter(), bodies, TOOL

### Community 97 - "Gateway Router Tests"
Cohesion: 0.29
Nodes (3): auditRows, baseConfig, fakePool

### Community 98 - "Affect Inference Service"
Cohesion: 0.40
Nodes (4): AffectReading, inferAffect(), Tone, Urgency

### Community 99 - "Announcement Tests"
Cohesion: 0.33
Nodes (4): activity, audit, DAY, NIGHT

### Community 100 - "Chat Page UI"
Cohesion: 0.50
Nodes (3): appendToLastAssistant(), applyFrame(), Turn

### Community 101 - "Orb Page State"
Cohesion: 0.40
Nodes (3): OrbState, STATE_COLOR, STATE_LABEL

### Community 102 - "Persona Page UI"
Cohesion: 0.50
Nodes (4): btn(), inputStyle, PersonaPage(), Prompt

### Community 103 - "Settings Page UI"
Cohesion: 0.50
Nodes (4): ctl(), input, Setting, SettingsPage()

### Community 104 - "Embeddings & Ops Infra"
Cohesion: 0.40
Nodes (5): D-0057 pgvector HNSW ANN index, D-0071 Longevity ops: health/backup/restore, Migration 0016 embeddings_hnsw, ops.ts health/backup/restore, reasoning.ts salient-term stopword list

### Community 105 - "Model Asset Fetching"
Cohesion: 0.60
Nodes (4): fetch(), main(), Path, Fetch jarvis-ears model assets from verifiable sources into JARVIS_EARS_MODELS.

### Community 106 - "Kernel Config Schema"
Cohesion: 0.60
Nodes (3): ConfigSchema, KernelConfig, loadConfig()

### Community 107 - "KEK Key Resolution"
Cohesion: 0.60
Nodes (3): exec, randomKek(), resolveKek()

### Community 108 - "Prompt Registry"
Cohesion: 0.50
Nodes (3): D-0043 Prompts registry for persona, migration 0013 prompts table, PromptRegistry

### Community 110 - "Datastore Decision Docs"
Cohesion: 0.67
Nodes (3): docs/04 (process/datastore justification doc), D-0006 Valkey deferred until real need, D-0007 Valkey over Redis

### Community 111 - "Announcer Initiative"
Cohesion: 0.67
Nodes (3): D-0068 Initiative to speak + advisory dissent, Migration 0022 announcements, Announcer

## Ambiguous Edges - Review These
- `LocalAgentRuntime` → `Prompts registry (persona)`  [AMBIGUOUS]
  docs/IMPLEMENTATION_PLAN.md · relation: calls
- `Chat Parity Audit 2026-07-19` → `D-0075 Fast-Model Memory Judgments`  [AMBIGUOUS]
  docs/verification/CHAT_PARITY_AUDIT_2026-07-19.md · relation: references

## Knowledge Gaps
- **485 isolated node(s):** `Component`, `Panel`, `Setting`, `input`, `Step` (+480 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **37 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `LocalAgentRuntime` and `Prompts registry (persona)`?**
  _Edge tagged AMBIGUOUS (relation: calls) - confidence is low._
- **What is the exact relationship between `Chat Parity Audit 2026-07-19` and `D-0075 Fast-Model Memory Judgments`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `AuditLog` connect `Audit Log & Projects` to `Skill Activation Service`, `Proactivity Engine`, `Agenda Management`, `Approvals & Consolidation`, `Tool Registry & Announcements`, `Emergency Stop Policy`, `Agent Runtime Contract`, `Memory Judgment Service`, `Entity & Fact Resolution`, `Interlock & Memory Consolidation`, `Tool Registry & Self-Extension`, `A2UI Registry & Schema`, `Semantic Memory Search`, `Settings Registry`, `MCP Registry`, `Secrets Vault`, `Encrypted Vault Utilities`, `Ops Health & Audit Chain`, `Terminal Command Policy`, `Server Entry Point`, `Settings Registry Logic`, `Device Tools & Interlock`, `Settings Catalog & Tools`, `Announcement Tests`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `ToolRegistry` connect `Tool Registry & Self-Extension` to `Skill Activation Service`, `Agenda Management`, `A2UI Registry & Schema`, `Approvals & Consolidation`, `Tool Registry & Announcements`, `Audit Log & Projects`, `Emergency Stop Policy`, `Settings Catalog & Tools`, `Agent Runtime Contract`, `Terminal Command Policy`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `SettingsRegistry` connect `Settings Registry` to `Tool Registry & Self-Extension`, `Agenda Management`, `A2UI Registry & Schema`, `Approvals & Consolidation`, `Announcement Tests`, `Tool Registry & Announcements`, `Settings Registry Logic`, `Settings Catalog & Tools`, `Reasoning Tuner`, `Ops Health & Audit Chain`, `Budget & Autonomy Spend`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `Component`, `Panel`, `Setting` to the rest of the system?**
  _485 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Skill Activation Service` be split into smaller, more focused modules?**
  _Cohesion score 0.0677555958862674 - nodes in this community are weakly interconnected._