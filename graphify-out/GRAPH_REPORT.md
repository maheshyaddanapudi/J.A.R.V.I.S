# Graph Report - J.A.R.V.I.S  (2026-08-28)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2282 nodes · 4490 edges · 253 communities (135 shown, 118 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 106 edges (avg confidence: 0.66)
- Token cost: 13,408 input · 6,352 output

## Graph Freshness
- Built from commit: `04396fe0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Research Evidence Gathering
- Proactivity Engine
- Audio Bridge (macOS)
- Affect & Core Config
- Computer Control
- Secrets Vault
- Sleep Consolidation
- Capability Guard
- Audio I/O
- Audit & Interlock
- Approval Broker
- Agent Runtime
- Agenda Management
- Context Provider
- Agent Tools
- Device Gateway
- Workspace Files
- Voice HTTP Server
- Core Tool Registration
- Command Center Dashboard
- TypeScript Config
- MCP Client Host
- Tauri App Config
- Role Overrides Store
- Memory Merge Judge
- Turn-Taking Voice Engine
- Model Provider Adapters
- Lab Bench Kernel
- Capability Activation
- Rust E-Stop Core
- Lab Bench Engine
- A2UI Registry
- Policy & E-Stop
- Gateway Config
- Entity Memory
- Episodic Memory
- Lab Applier
- Settings Registry
- Terminal Runner
- Voice Engine Protocols
- Entity Graph Recall
- Semantic Memory
- Kernel Module Guides
- Projects Tracking
- Gateway Router
- Lab Night Run
- Night Lab Spec
- TypeScript Base Config
- Durable Grants
- Lab Night Runner
- Repo Architecture Overview
- Acceptance Verification Reports
- Skills Registry
- Root Package Manifest
- Wake Word Engines
- Voice Engine Tests
- Budget & Autonomy
- Package Dependencies
- Files Page UI
- Pulse Page UI
- Skills Page UI
- Companion App Manifest
- Kernel TS Config
- Test Fixtures/Stubs
- Dynamic Settings Registry
- Memory Page UI
- Self-Extension Page UI
- Tauri Permissions Config
- Graphify Pipeline
- Architecture Decisions Log
- Streaming STT Engine
- Lab Experiment Engine
- Perception Service
- Agent Page UI
- Command Center Manifest
- Dev Dependencies
- Core Architecture Docs
- Architecture Decisions
- Override Governance Decisions
- Mac Preflight Script
- Announcement Service
- Devices Page UI
- Models Page UI
- Proactive Page UI
- Bench Grading Decisions
- Activation Gate Decisions
- Proactivity Decisions
- A2UI Page UI
- Control Page UI
- Graph Page UI
- Reasoning Page UI
- Terminal Page UI
- Web Page UI
- Frontend Dev Dependencies
- Threat Model Docs
- VAD Engine
- Lab Page UI
- Frontend Dependencies
- MCP & Research Decisions
- Project Phases Roadmap
- Kernel Package Config
- Build/Test Scripts
- Background Scheduler
- Approval & Core Loop
- Anthropic Adapter
- Lab Night Tests
- Router Tests
- Untrusted Content Tests
- UI Design System Rules
- Memory & Context Decisions
- Gateway & Reasoning Decisions
- Model Observation Runs
- Proactive Items Schema
- Semantic Memory Schema
- Settings Catalog Tests
- Announcement Tests
- Chat Page UI
- Orb Page UI
- Persona Page UI
- Settings Page UI
- Self-Extension Decisions
- Foundation Safety Decisions
- Graphify Setup Script
- Model Asset Fetcher
- Companion App Config
- Capability & Simulation Decisions
- Root Layout Component
- Voice & Persona Decisions
- Sleep-Cycle Decisions
- Kernel Module Guides
- Audit/Estop Schema
- Memory/Preferences Schema
- Capabilities Schema
- Heartbeat Schema
- Projects Schema
- MCP Test Server
- Next.js Config
- Next Env Types
- Swift Package Manifest
- Graph Memory Decisions
- Jarvis Companion Apps
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
- Lab Experiments Schema
- Command Center App
- Command Center Module Guide
- Trust Core System
- Spatial Hardware Spec
- Stack & Phases Plan
- Security Scope Doc
- Phase 0 Naming Decision
- Module Guide Deferral Decision
- Valkey Adoption Decision
- macOS Control Stack Decision
- Spatial Input Decision
- Session Continuity Decision
- Visual Design Decision
- Terminal Policy Decision
- Memory Injection Hardening
- Perception Core Decision
- Affect Layer Decision
- Computer-Control HAL Decision
- Self-Extension Limit Decision
- Proactivity Engine Decision
- Device-Control HAL Decision
- MCP Client Host Decision
- Secrets Vault Decision
- Contextual Awareness Decision
- Agent Runtime Decision
- Skills Registry Decision
- Workspace Knowledge Decision
- Agent Tool Reasoning Decision
- Web Research Capability Decision
- Terminal-with-Policy Decision
- Research Provenance Decision
- Untrusted Content Envelopes Decision
- Semantic Memory Decision
- Knowledge Context Decision
- Companion App Shell Decision
- Episodic Memory Decision
- Vector Recall Decision
- Prompts Registry
- Proactivity Rules
- Graph Memory System
- Anthropic API Gateway
- Gateway Observability
- Deep Reasoning Escalation
- Generation Settings Config
- Deep Reasoning Learning
- Runtime Settings Registry
- Self-Extension Activation
- In-Container Code Capabilities
- Memory Judgments & Skills
- Self-Experimentation Lab
- Docker Compose Infra
- Agent Run Endpoint
- Context Endpoint
- Core Activity Stream
- Approvals Endpoint
- Converse Endpoint
- Emergency Stop Endpoint
- Health Check Endpoint
- Reasoning Topics Endpoint
- Run-Tool Gated Loop
- Gateway Calls Endpoint
- Gateway Roles Endpoint
- Gateway Status Endpoint
- Knowledge Access Endpoints
- Lab Experiments Endpoint
- Night Lab Endpoint
- MCP Connect Endpoint
- MCP Servers Endpoint
- MCP Trust Endpoint
- Memory Entities Endpoint
- Memory Episodes Endpoint
- Memory Graph Endpoint
- Proactive Items Endpoint
- Proactive Rules Endpoint
- Proactive Run Endpoint
- Prompts Registry Endpoint
- Secrets Endpoint
- Self-Extension Registry
- Settings Endpoint
- Jarvis Ears Module
- Contextual Awareness Module
- Computer-Control HAL Module
- Workspace Files Module
- Prompts Registry Module
- Research Provenance Module
- URL Target Check

## God Nodes (most connected - your core abstractions)
1. `AuditLog` - 91 edges
2. `buildCore()` - 52 edges
3. `SettingsRegistry` - 39 edges
4. `GatewayRouter` - 36 edges
5. `EmergencyStop` - 32 edges
6. `EntityMemory` - 32 edges
7. `MemoryService` - 30 edges
8. `Tool` - 30 edges
9. `ActivityBus` - 27 edges
10. `ToolRegistry` - 27 edges

## Surprising Connections (you probably didn't know these)
- `Bench Grading Rubrics (grading.md)` --conceptually_related_to--> `D-0075 Fast-model memory judgments + self-authored/reusable skills`  [INFERRED]
  bench/rubrics/grading.md → docs/DECISION_LOG.md
- `webTools()` --references--> `web.click tool`  [EXTRACTED]
  services/kernel/src/web/tools.ts → services/kernel/src/web/CLAUDE.md
- `webTools()` --references--> `web.fill tool`  [EXTRACTED]
  services/kernel/src/web/tools.ts → services/kernel/src/web/CLAUDE.md
- `webTools()` --references--> `web.links tool`  [EXTRACTED]
  services/kernel/src/web/tools.ts → services/kernel/src/web/CLAUDE.md
- `webTools()` --references--> `web.open tool`  [EXTRACTED]
  services/kernel/src/web/tools.ts → services/kernel/src/web/CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Approved Option A hybrid architecture (D-0002)** — jarvisd_kernel, jarvis_mind, jarvis_ears, tauri_companion, command_center, postgres_pgvector, ollama_gateway, otel_jaeger, decision_d0002 [EXTRACTED 0.85]
- **R-UI functional visual language requirement group** — docs_design_system, req_r_ui_01, req_r_ui_02, req_r_ui_03, req_r_ui_04, decision_d0026 [EXTRACTED 0.85]
- **Graphify Build/Query Pipeline Components** — dot_claude_skills_graphify_skill_md_doc, dot_claude_skills_graphify_references_extraction_spec_md_doc, dot_claude_skills_graphify_references_query_md_doc, dot_claude_skills_graphify_references_update_md_doc, dot_claude_skills_graphify_references_transcribe_md_doc [EXTRACTED 0.85]
- **R-CAP-01 registry-kind pattern (MCP/devices/skills/prompts/rules)** — docs_decision_log_d0027, docs_decision_log_d0025, docs_decision_log_d0031, docs_decision_log_d0043, docs_decision_log_d0044 [EXTRACTED 0.85]
- **SIMULATION-first foundation, real activation gated on check-in** — docs_decision_log_d0022, docs_decision_log_d0023, docs_decision_log_d0024, docs_decision_log_d0025, docs_decision_log_d0026 [EXTRACTED 0.85]
- **Terminal-with-policy capability (Phase 2)** — services_kernel_src_terminal_contract_terminalrunner, services_kernel_src_terminal_policy_assesscommand, services_kernel_src_terminal_runner_localterminal, services_kernel_src_terminal_tools_terminal_inspect, services_kernel_src_terminal_tools_terminal_run [EXTRACTED 0.85]
- **Web browsing/research capability (Phase 2)** — services_kernel_src_web_contract_webbrowser, services_kernel_src_web_policy_checkwebtarget, services_kernel_src_web_playwright_playwrightbrowser, services_kernel_src_web_tools_webtools, services_kernel_src_web_tools_web_open, services_kernel_src_web_tools_web_readtext, services_kernel_src_web_tools_web_links, services_kernel_src_web_tools_web_screenshot, services_kernel_src_web_tools_web_fill, services_kernel_src_web_tools_web_click [EXTRACTED 0.85]
- **Mac bring-up capability check-in sequence (8a-8g)** — docs_mac_bringup, decision_d0022, decision_d0024, decision_d0025, decision_d0027, decision_d0026, decision_d0023 [EXTRACTED 0.90]
- **Gated Phase-2 capabilities feeding the agent via bounded/untrusted detail** — docs_decision_log_d0032, docs_decision_log_d0033, docs_decision_log_d0034, docs_decision_log_d0035, docs_decision_log_d0036, docs_decision_log_d0037 [EXTRACTED 0.90]
- **Night Lab requirements R-LAB-01..10** — r_lab_01, r_lab_02, r_lab_03, r_lab_04, r_lab_05, r_lab_06, r_lab_07, r_lab_08, r_lab_09, r_lab_10 [EXTRACTED 0.90]
- **Night Lab evidence-gated self-experimentation flow (D-0079)** — services_kernel_src_lab_surface, services_kernel_src_lab_engine, services_kernel_src_lab_bench, services_kernel_src_lab_researcher, services_kernel_src_lab_night, services_kernel_src_lab_apply, decision_d0079 [EXTRACTED 0.90]
- **Night Lab threat model deltas T-LAB-1..6** — t_lab_1, t_lab_2, t_lab_3, t_lab_4, t_lab_5, t_lab_6, concept_night_lab [EXTRACTED 0.90]
- **Phase 2 gated high-risk capabilities pattern** — services_kernel_src_terminal_policy_assesscommand, services_kernel_src_web_policy_checkwebtarget, services_kernel_src_terminal_tools_terminal_run, services_kernel_src_web_tools_web_open [INFERRED 0.60]
- **Command Center settings/A2UI panel rendering flow** — services_kernel_src_settings_claude_module [INFERRED 0.70]
- **Self-extension: draft → propose → approve → activate verification chain** — services_kernel_src_selfext_claude_module, docs_verification_stage_b_affect_2026_07_19_report, docs_verification_chat_parity_audit_2026_07_19_report, docs_verification_full_reverification_2026_07_19_report [INFERRED 0.75]
- **Memory-system bug discovery, fix, and re-verification arc** — docs_verification_observation_run_2026_07_19_report, docs_verification_d0075_memory_judgment_2026_07_20_report, docs_verification_fresh_observation_2026_07_20_report, docs_verification_ab_observation_2026_07_20_report [INFERRED 0.80]

## Communities (253 total, 118 thin omitted)

### Community 0 - "Research Evidence Gathering"
Cohesion: 0.06
Nodes (32): Evidence, GatherOptions, Researcher, ResearchFindings, SourceStatus, TargetCheck, queryTerms(), scorePassages() (+24 more)

### Community 1 - "Proactivity Engine"
Cohesion: 0.08
Nodes (27): ProactivityEngine, GateStack, inQuietHours(), priorityRank(), briefingCandidate(), calendarConflictCandidates(), commitmentCandidates(), dayKey() (+19 more)

### Community 2 - "Audio Bridge (macOS)"
Cohesion: 0.09
Nodes (28): AppKit, ApplicationServices, AudioBridge, Double, Float, EarsClient, Float, AppInfoDTO (+20 more)

### Community 3 - "Affect & Core Config"
Cohesion: 0.07
Nodes (35): AffectReading, inferAffect(), Tone, Urgency, ConfigSchema, KernelConfig, loadConfig(), Core (+27 more)

### Community 4 - "Computer Control"
Cohesion: 0.09
Nodes (12): AppInfo, AxElement, ComputerControl, ControlProvenance, ControlResult, ElementSelector, Screenshot, WindowInfo (+4 more)

### Community 5 - "Secrets Vault"
Cohesion: 0.07
Nodes (13): normalizeName(), SecretInfo, SecretsVault, gcmDecrypt(), gcmEncrypt(), Vault, WRAP_INFO, MemoryJudge (+5 more)

### Community 6 - "Sleep Consolidation"
Cohesion: 0.09
Nodes (15): ConsolidationReport, DecisionLog, SleepCycle, assessDepth(), Autotune, DEFAULT_AUTOTUNE, DepthAssessment, DepthReason (+7 more)

### Community 7 - "Capability Guard"
Cohesion: 0.11
Nodes (27): ActivationCheck, RISK_ORDER, StepRunner, CapabilityGuard, DANGEROUS_PATTERNS, GuardVerdict, manifestHash(), ScanFinding (+19 more)

### Community 8 - "Audio I/O"
Cohesion: 0.07
Nodes (21): AudioSink, AudioSource, BufferAudioSink, BufferAudioSource, _PortAudioSource, ndarray, Path, Protocol (+13 more)

### Community 9 - "Audit & Interlock"
Cohesion: 0.08
Nodes (14): AuditEntry, AuditLog, canonicalJson(), WHOLE_MATCH_PATTERNS, InterlockManager, BRAIN_TABLES, HealthReport, Ops (+6 more)

### Community 10 - "Approval Broker"
Cohesion: 0.10
Nodes (17): ActivityEvent, ApprovalBroker, PendingApproval, ToolRegistry, MemoryService, Preference, audit, config (+9 more)

### Community 11 - "Agent Runtime"
Cohesion: 0.11
Nodes (17): AgentResult, AgentRunOptions, AgentRuntime, AgentStep, LocalAgentRuntime, AutonomyStatus, TickResult, ActivityBus (+9 more)

### Community 12 - "Agenda Management"
Cohesion: 0.10
Nodes (5): Agenda, redactSecrets(), assertNotSecret(), registerMemoryRoutes(), PromptRegistry

### Community 13 - "Context Provider"
Cohesion: 0.12
Nodes (16): CommitmentContext, ContextProvider, ContextSnapshot, EpisodeSource, KnowledgeSource, KnownEntity, PinnedFact, ProactiveContext (+8 more)

### Community 14 - "Agent Tools"
Cohesion: 0.14
Nodes (10): Announcement, ActionDisclosure, RememberArgs, Tool, ToolContext, ToolResult, WorkspaceNoteArgs, HIGH_RISK_PREFIXES (+2 more)

### Community 15 - "Device Gateway"
Cohesion: 0.13
Nodes (15): DEVICE_RISK, DeviceCommand, DeviceGateway, DeviceInfo, DeviceProvenance, DeviceResult, DeviceState, DeviceType (+7 more)

### Community 16 - "Workspace Files"
Cohesion: 0.14
Nodes (16): DirEntry, EditOutcome, FileContent, FileInfo, FileKind, SearchMatch, SearchOptions, SearchResult (+8 more)

### Community 17 - "Voice HTTP Server"
Cohesion: 0.10
Nodes (24): BaseModel, TtsChunk, listen(), load_engines(), ndarray, jarvis-ears HTTP/WS surface (localhost only, R-LOC-01).  GET  /health  — real en, Run the full utterance through the streaming STT and return the transcript., A complete captured utterance @16kHz mono float32. On the Mac the audio     come (+16 more)

### Community 18 - "Core Tool Registration"
Cohesion: 0.13
Nodes (23): a2uiTools(), AgendaItem, agendaTools(), announceTools(), computerControlTools(), buildCore(), rememberPreferenceTool(), systemInfoTool (+15 more)

### Community 19 - "Command Center Dashboard"
Cohesion: 0.09
Nodes (17): activityColor(), ActivityEvent, btn(), ContextData, EmergencyStopButton(), formatActivity(), getJson(), HealthReport (+9 more)

### Community 20 - "TypeScript Config"
Cohesion: 0.07
Nodes (27): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+19 more)

### Community 21 - "MCP Client Host"
Cohesion: 0.12
Nodes (15): hashTools(), McpClientHost, McpDiscovery, McpServerConfig, McpToolSpec, McpRegistry, McpServerRow, mcpToolRisk() (+7 more)

### Community 22 - "Tauri App Config"
Cohesion: 0.07
Nodes (26): app, security, trayIcon, windows, build, devUrl, frontendDist, bundle (+18 more)

### Community 23 - "Role Overrides Store"
Cohesion: 0.12
Nodes (14): parseRolePin(), loadRoleOverrides(), persistRoleOverrides(), Store, StoredRoleOverrides, pinOf(), ChatBodySchema, registerGatewayRoutes() (+6 more)

### Community 24 - "Memory Merge Judge"
Cohesion: 0.11
Nodes (14): PrivacyClass, EntityCandidate, EntityForMerge, EntityMergeGroup, FactForMerge, GatewayMemoryJudge, JUDGE_TEMPLATES, JudgeGateway (+6 more)

### Community 25 - "Turn-Taking Voice Engine"
Cohesion: 0.14
Nodes (17): Enum, Typed, replaceable speech-engine contracts (R-VOICE-12).  Every engine is an ope, VadFrame, Full-duplex turn-taking + barge-in state machine (R-VOICE-03).  This is the ENGI, Drives the conversation's turn state from VAD frames.      Barge-in fires when,, Feed one VAD frame; returns any turn transitions it triggered., TurnEvent, TurnTaker (+9 more)

### Community 26 - "Model Provider Adapters"
Cohesion: 0.13
Nodes (9): ProviderAdapter, ProviderError, OllamaMessage, createOpenAiCompatAdapter(), ChatEvent, NeutralMessage, TargetOptions, ToolCall (+1 more)

### Community 27 - "Lab Bench Kernel"
Cohesion: 0.14
Nodes (16): Path, apply_candidate(), bench_hash(), LabKernel, load_fixtures(), main(), psql(), One turn through the real conversation path; returns the reply text. (+8 more)

### Community 28 - "Capability Activation"
Cohesion: 0.13
Nodes (4): ActivationService, CapabilityRecord, CapabilityRegistry, normalizeComposition()

### Community 29 - "Rust E-Stop Core"
Cohesion: 0.18
Nodes (19): engage_estop(), estop_engaged(), get(), is_healthy(), KernelError, parse_status(), post(), request() (+11 more)

### Community 30 - "Lab Bench Engine"
Cohesion: 0.11
Nodes (17): Campaign: persona-adherence, lab_experiments ledger (migration 0026), BenchGate, BenchScores, EpisodesLike, LabEngineOpts, validateCampaign(), LAB_FORBIDDEN_SETTING_PREFIXES (+9 more)

### Community 31 - "A2UI Registry"
Cohesion: 0.14
Nodes (14): A2uiPanel, A2uiRegistry, A2uiComponent, A2uiComponentSchema, A2uiSpec, A2uiSpecSchema, Action, Heading (+6 more)

### Community 32 - "Policy & E-Stop"
Cohesion: 0.13
Nodes (11): EmergencyStop, ActionRequest, Decision, ORDER, PolicyEngine, PROHIBITED, riskAtOrBelow(), audit (+3 more)

### Community 33 - "Gateway Config"
Cohesion: 0.15
Nodes (15): DEFAULT_GATEWAY_CONFIG, ENV_DEFAULT_KINDS, loadGatewayConfig(), NON_GENERATIVE_ROLES, resolveGatewayConfig(), createOllamaAdapter(), ContentPart, EffortLevel (+7 more)

### Community 34 - "Entity Memory"
Cohesion: 0.24
Nodes (3): assertNotSecret(), EntityMemory, seedChain()

### Community 35 - "Episodic Memory"
Cohesion: 0.19
Nodes (10): Entity, Fact, Episode, EpisodeKind, EpisodicMemory, KINDS, normalizeKind(), RecallOptions (+2 more)

### Community 36 - "Lab Applier"
Cohesion: 0.11
Nodes (8): D-0052: user-pin override evidence contract, AnnouncerLike, ApplyResult, LabApplier, PriorState, PromptsLike, SettingsLike, validateCandidate()

### Community 37 - "Settings Registry"
Cohesion: 0.17
Nodes (3): SettingSpec, SettingsRegistry, validate()

### Community 38 - "Terminal Runner"
Cohesion: 0.14
Nodes (13): CommandResult, Provenance, RunOptions, TerminalRunner, assessCommand(), Assessment, DENY, READ_ONLY (+5 more)

### Community 39 - "Voice Engine Protocols"
Cohesion: 0.12
Nodes (9): ndarray, Protocol, Feed a PCM frame; return any wake detections in that frame., Yield audio chunks as they become available (sentence-level or better)., StreamingTtsEngine, SttEngine, TtsEngine, VadEngine (+1 more)

### Community 40 - "Entity Graph Recall"
Cohesion: 0.14
Nodes (14): anyPairShareWord(), contentWords(), diceCoefficient(), EntityKind, fullestName(), GraphNeighborhood, GraphRecall, mergeAttrs() (+6 more)

### Community 41 - "Semantic Memory"
Cohesion: 0.13
Nodes (11): EmbedFn, SemanticHit, SemanticMemory, SemanticSource, toVectorLiteral(), audit, embed(), hashEmbed() (+3 more)

### Community 42 - "Kernel Module Guides"
Cohesion: 0.16
Nodes (15): bench/ — rubric conversations + grading rubric (protected path), @jarvis/kernel (jarvisd) module guide, src/core/ — Z1 trust core (audit/policy/approvals/estop/loop), src/gateway/ — model gateway, src/knowledge/ — workspace files capability, exec, PyBenchOpts, PyBenchRunner (+7 more)

### Community 43 - "Projects Tracking"
Cohesion: 0.21
Nodes (5): Project, ProjectLogEntry, Projects, projectTools(), audit

### Community 44 - "Gateway Router"
Cohesion: 0.26
Nodes (7): ajv, GatewayRouter, RoleOverride, ChatRequest, ChatResult, ModelRole, RoleTarget

### Community 45 - "Lab Night Run"
Cohesion: 0.15
Nodes (11): CampaignSpec, append(), GatewayLike, LabNightDeps, NightSummary, overlayOnSurface(), SettingsLike, SurfaceSnapshot (+3 more)

### Community 46 - "Night Lab Spec"
Cohesion: 0.23
Nodes (13): Andrej Karpathy's autoresearch (external provenance), Night Lab — evidence-gated self-experimentation concept, D-0079 — Night Lab check-in approval, R-LAB-01 — isolated lab instance + scratch DB, live memory never read/written, R-LAB-02 — Z1-held allowlist surface; bench outside it, hash-stamped, R-LAB-03 — hard safety gates auto-discard regardless of metric, R-LAB-04 — every experiment durably recorded with scores/cost/hash/provenance, R-LAB-05 — bounded by nightly + daily token caps, defers to live activity, halts on e-stop (+5 more)

### Community 47 - "TypeScript Base Config"
Cohesion: 0.13
Nodes (14): ES2023, compilerOptions, declaration, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, lib, module (+6 more)

### Community 48 - "Durable Grants"
Cohesion: 0.18
Nodes (7): DurableGrantRow, DurableGrants, Grant, RiskClass, audit, fakeSettings(), makeScheduler()

### Community 49 - "Lab Night Runner"
Cohesion: 0.26
Nodes (3): AnnouncerLike, LabNightRun, PromptsLike

### Community 50 - "Repo Architecture Overview"
Cohesion: 0.16
Nodes (13): CLAUDE.md — repo guide, Next.js/React/R3F Command Center, D-0002: Option A Hybrid Architecture (approved), D-0078: graphify key-on-disk tradeoff, D-0079: Night Lab evidence-gated self-experimentation, Night Lab verification report (2026-08-28), jarvis-ears — speech daemon (KWS/VAD/STT/TTS), jarvis-mind — Python LangGraph agent runtime (+5 more)

### Community 51 - "Acceptance Verification Reports"
Cohesion: 0.19
Nodes (14): Chat-Parity Audit — guarantees, screenshots, self-evolution gaps, Clean-Slate Evolution Acceptance Run (D-0063), Full Reverification — cold container, every layer, Gap-Fix Verification (D-0062), Living-Heartbeat Verification (D-0064), Living with J.A.R.V.I.S. — day-in-the-life + parity verdict, Phase 1 Acceptance Results (R-VER-05), Platform Acceptance Results (R-VER-05) (+6 more)

### Community 52 - "Skills Registry"
Cohesion: 0.20
Nodes (5): AgentRunOpts, Skill, SkillRegistry, SkillRow, toSkill()

### Community 53 - "Root Package Manifest"
Cohesion: 0.15
Nodes (12): description, engines, node, name, packageManager, private, scripts, build (+4 more)

### Community 54 - "Wake Word Engines"
Cohesion: 0.15
Nodes (9): WakeEvent, OpenWakeWord, ndarray, Path, Wake-word engine: openWakeWord ONNX pipeline.  Code: Apache-2.0 (dscripka/openWa, ndarray, Path, Wake-word engine: sherpa-onnx open-vocabulary keyword spotting (Apache-2.0).  Th (+1 more)

### Community 55 - "Voice Engine Tests"
Cohesion: 0.19
Nodes (12): kokoro(), ndarray, Engine tests against real models (no mocks — R-CORE-02).  Requires model assets, Real TTS -> real STT round trip: Kokoro speaks a command, STT must hear it., End-to-end: TTS speaks the wake phrase; the wake engine must detect it., _resample_24k_to_16k(), stt(), test_stt_transcribes_synthesized_speech() (+4 more)

### Community 56 - "Budget & Autonomy"
Cohesion: 0.19
Nodes (4): AUTONOMY_SOURCES, Budget, BudgetStatus, PRICE_PER_MTOK

### Community 57 - "Package Dependencies"
Cohesion: 0.17
Nodes (12): ajv, fastify, @modelcontextprotocol/sdk, playwright, dependencies, ajv, fastify, @modelcontextprotocol/sdk (+4 more)

### Community 58 - "Files Page UI"
Cohesion: 0.21
Nodes (10): btn(), Entry, Ev, FileContent, FilesPage(), formatEv(), inputStyle, Match (+2 more)

### Community 59 - "Pulse Page UI"
Cohesion: 0.18
Nodes (11): Beat, card(), ctl, dim, h2, input, Item, linkBtn (+3 more)

### Community 60 - "Skills Page UI"
Cohesion: 0.21
Nodes (10): AgentResult, btn(), Ev, formatEv(), inputStyle, Pending, pipeColor(), Skill (+2 more)

### Community 61 - "Companion App Manifest"
Cohesion: 0.17
Nodes (11): description, devDependencies, @tauri-apps/cli, name, private, scripts, build, dev (+3 more)

### Community 62 - "Kernel TS Config"
Cohesion: 0.17
Nodes (11): node, src/**/*.test.ts, src/**/*.ts, ../../tsconfig.base.json, compilerOptions, outDir, rootDir, types (+3 more)

### Community 63 - "Test Fixtures/Stubs"
Cohesion: 0.17
Nodes (11): toolReg(), seededTools(), stub(), makeTools(), loopWith(), makeEstop(), makeLoop(), makeEstop() (+3 more)

### Community 64 - "Dynamic Settings Registry"
Cohesion: 0.20
Nodes (9): DynamicSpecInput, EffectiveSetting, jaccard(), normKey(), Override, SettingOrigin, SettingType, SettingValue (+1 more)

### Community 65 - "Memory Page UI"
Cohesion: 0.22
Nodes (9): btn(), Entity, Episode, Fact, inputStyle, MemoryPage(), Recall, Rel (+1 more)

### Community 66 - "Self-Extension Page UI"
Cohesion: 0.20
Nodes (9): ActiveCap, BENIGN, btn(), Finding, MALICIOUS, Report, SelfExtPage(), Verdict (+1 more)

### Community 67 - "Tauri Permissions Config"
Cohesion: 0.18
Nodes (10): description, identifier, permissions, $schema, windows, core:default, core:window:allow-set-focus, core:window:allow-show (+2 more)

### Community 68 - "Graphify Pipeline"
Cohesion: 0.20
Nodes (11): Graphify Knowledge-Graph Build Pipeline, .claude/CLAUDE.md graphify pointer, graphify reference: add-watch, graphify reference: exports, graphify reference: extraction-spec, graphify reference: github-and-merge, graphify reference: hooks, graphify reference: query/path/explain (+3 more)

### Community 69 - "Architecture Decisions Log"
Cohesion: 0.18
Nodes (11): D-0002 Architecture option: Hybrid TS + Python (Option A), D-0006 Valkey deferred until a real queue/cache need exists, D-0008 Model gateway: thin in-house gateway; LiteLLM optional/pinned, D-0009 Agent runtime: LangGraph (Python) behind AgentRuntime interface, D-0010 Observability viewer: Jaeger v2, D-0013 Postgres encryption approach, D-0014 Desktop shell: Tauri 2, D-0021 Memory architecture + local security model approved (+3 more)

### Community 70 - "Streaming STT Engine"
Cohesion: 0.27
Nodes (5): SttPartial, ndarray, Path, Streaming STT engine: sherpa-onnx streaming zipformer transducer (Apache-2.0)., SherpaStreamingStt

### Community 72 - "Lab Experiment Engine"
Cohesion: 0.24
Nodes (4): AuditLike, ExperimentRow, LabEngine, LabCandidate

### Community 73 - "Perception Service"
Cohesion: 0.22
Nodes (3): FilePerceptionSource, PerceptionService, PerceptionSource

### Community 74 - "Agent Page UI"
Cohesion: 0.27
Nodes (8): AgentPage(), AgentResult, btn(), Ev, formatEv(), Pending, pipeColor(), Step

### Community 75 - "Command Center Manifest"
Cohesion: 0.20
Nodes (9): description, name, private, scripts, build, dev, start, typecheck (+1 more)

### Community 76 - "Dev Dependencies"
Cohesion: 0.20
Nodes (10): @types/node, devDependencies, tsx, @types/node, @types/pg, vitest, @types/node, tsx (+2 more)

### Community 77 - "Core Architecture Docs"
Cohesion: 0.22
Nodes (9): Core Interaction Loop, Honesty Rule, Option A — Hybrid TS Kernel + Python Mind, Option B — Single-Runtime TypeScript Core, Option C — Swift-Native Core, Two-Stage Self-Extension (Stage A/B), 01 Mission And Core Loop, 06 Check-ins and Verify (+1 more)

### Community 78 - "Architecture Decisions"
Cohesion: 0.20
Nodes (10): Five-State Capability Classification, D-0004: Voice Stack Pick, D-0007: Valkey over Redis, D-0008: Own Thin Adapter over LiteLLM, D-0011: Pin to Stable MCP Spec, D-0015: Custom macOS Control Bridge, 02 Requirements, 07 Session Continuity (+2 more)

### Community 79 - "Override Governance Decisions"
Cohesion: 0.24
Nodes (10): D-0052: Override contract revised (trail can outweigh a pin), D-0053: BINDING PRINCIPLE — dual-editable under override ledger, D-0054: Runtime gateway role editor (first D-0053 migration), D-0055: Conversational edit path via gated tools, D-0056: A2UI evaluation deferred (superseded by D-0061), D-0058: General runtime settings (catalog-driven SettingsRegistry), D-0059: Persist everything that matters (standing consent survives restart), D-0060: Dynamic settings — J.A.R.V.I.S. surfaces new configurable knobs (+2 more)

### Community 80 - "Mac Preflight Script"
Cohesion: 0.36
Nodes (8): bad(), have(), hdr(), note(), ok(), port_state(), mac_preflight.sh script, skip()

### Community 82 - "Devices Page UI"
Cohesion: 0.31
Nodes (6): btn(), DevicesPage(), Ev, formatEv(), pipeColor(), RunOutcome

### Community 83 - "Models Page UI"
Cohesion: 0.28
Nodes (8): CallRow, h2(), inp, ModelsPage(), Override, ProviderRow, sec(), td

### Community 84 - "Proactive Page UI"
Cohesion: 0.25
Nodes (7): btn(), ProactivePage(), Rule, ruleInput, RunResult, Suppression, Surfaced

### Community 85 - "Bench Grading Decisions"
Cohesion: 0.25
Nodes (9): Bench Grading Rubrics (grading.md), D-0052 Bounded self-adjustment evidence bar (referenced), D-0071 (referenced — episode status enum shipped), D-0073 Code capability reusability (referenced), D-0074 Code-authored capabilities run in-container (Mac claim corrected), D-0075 Fast-model memory judgments + self-authored/reusable skills, D-0076 Fresh 70/30 observation: ops.health episode-count bug + approval-wait trap, D-0077 Rhythm sync: agenda freshness gate + chat delivery (+1 more)

### Community 86 - "Activation Gate Decisions"
Cohesion: 0.22
Nodes (9): D-0022: macOS computer-control activation gate, D-0024: Proactive delivery enable, D-0025: Physical device control enable, D-0027: MCP server trust elevation, DEVELOPMENT.md — Running J.A.R.V.I.S. Locally, MAC_BRINGUP.md — Operational Runbook for the M3 Max, R-LOC-01: All services/memory/credentials remain local, R-MEM-06: No secrets in conversational memory (+1 more)

### Community 87 - "Proactivity Decisions"
Cohesion: 0.31
Nodes (9): D-0024 Proactivity engine built; live delivery gated, D-0044 User-defined proactivity rules (R-CAP-01 + R-PRO), D-0051 Bounded self-adjustment (referenced), D-0063: Memories update live AND during quiet hours, D-0064: The living heartbeat (self-authored agenda + brain pass), D-0065: Three rhythms — live / heartbeat / quiet hours, no collisions, D-0066: Spend governance (autonomy self-restraint, live turn never blocked), D-0068: Initiative to speak + advisory dissent (+1 more)

### Community 88 - "A2UI Page UI"
Cohesion: 0.29
Nodes (6): A2uiPage(), Component, ctl(), input, Panel, Setting

### Community 89 - "Control Page UI"
Cohesion: 0.36
Nodes (6): btn(), ControlPage(), Ev, formatEv(), pipeColor(), RunOutcome

### Community 90 - "Graph Page UI"
Cohesion: 0.29
Nodes (7): Bundle, chip(), EntityRow, GEdge, GNode, GraphPage(), input

### Community 91 - "Reasoning Page UI"
Cohesion: 0.36
Nodes (7): Autotune, chip(), h2(), input, ReasoningPage(), Report, sec()

### Community 92 - "Terminal Page UI"
Cohesion: 0.36
Nodes (6): btn(), Ev, formatEv(), pipeColor(), RunOutcome, TerminalPage()

### Community 93 - "Web Page UI"
Cohesion: 0.36
Nodes (6): btn(), Ev, formatEv(), pipeColor(), RunOutcome, WebPage()

### Community 94 - "Frontend Dev Dependencies"
Cohesion: 0.25
Nodes (8): devDependencies, @types/react, @types/react-dom, typescript, typescript, typescript, @types/react, @types/react-dom

### Community 95 - "Threat Model Docs"
Cohesion: 0.25
Nodes (7): R-CAP-08 — generated capabilities never touch security/audit/e-stop/credential/sandbox/installer logic, T-LAB-1 — lab optimizes its own envelope, T-LAB-2 — metric gaming / Goodhart, T-LAB-3 — prompt injection via fixtures, T-LAB-4 — spend runaway, T-LAB-5 — lab/live contamination, T-LAB-6 — kept change degrades live behavior

### Community 96 - "VAD Engine"
Cohesion: 0.32
Nodes (4): ndarray, Path, SileroVad, vad()

### Community 97 - "Lab Page UI"
Cohesion: 0.29
Nodes (4): Experiment, LabPage(), LabSetting, VERDICT_COLOR

### Community 98 - "Frontend Dependencies"
Cohesion: 0.29
Nodes (7): dependencies, next, react, react-dom, next, react, react-dom

### Community 99 - "MCP & Research Decisions"
Cohesion: 0.38
Nodes (7): D-0011 MCP spec target: 2025-11-25, D-0027 MCP client host built; trust-elevation is a check-in (T2), D-0032 Workspace knowledge / files capability, D-0033 Tool results feed the agent's reasoning (detail field), D-0034 Web browsing / research capability: real headless browser, D-0036 Research-with-provenance over the gated web browser, D-0037 Untrusted-content envelopes: prompt-injection defense (T1)

### Community 100 - "Project Phases Roadmap"
Cohesion: 0.29
Nodes (7): Phase 0 — Foundations & Approval, Phase 1 — Functional Core, Phase 2 — Computer & Knowledge, Phase 3 — Dynamic Agents & Self-Extension, Phase 4 — Communications & Proactivity, Phase 5 — Home & Hardware, Phase 6 — Workshop & Spatial Scene Service

### Community 101 - "Kernel Package Config"
Cohesion: 0.29
Nodes (6): description, main, name, private, type, version

### Community 102 - "Build/Test Scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, migrate, start, test, typecheck

### Community 105 - "Anthropic Adapter"
Cohesion: 0.33
Nodes (4): createAnthropicAdapter(), adapter(), bodies, TOOL

### Community 106 - "Lab Night Tests"
Cohesion: 0.38
Nodes (3): gatewayFake(), night(), settingsFake()

### Community 107 - "Router Tests"
Cohesion: 0.29
Nodes (3): auditRows, baseConfig, fakePool

### Community 108 - "Untrusted Content Tests"
Cohesion: 0.43
Nodes (5): audit, makeAgent(), makeEstop(), scriptedGateway(), tc()

### Community 109 - "UI Design System Rules"
Cohesion: 0.33
Nodes (5): D-0026: Design system check-in, R-UI-01: Functional visual language without Marvel IP, R-UI-02: Color semantics, motion-communicates-state, accessibility, R-UI-03: No decorative/meaningless visual elements, R-UI-04: Interface modes as real vertical slices

### Community 110 - "Memory & Context Decisions"
Cohesion: 0.40
Nodes (6): D-0012 Local model baseline set, D-0029 Contextual awareness: read-only ContextService injected into the loop, D-0038 Semantic memory: entities/facts/relations store, D-0039 Semantic memory feeds contextual awareness, D-0041 Episodic memory: recallable timeline of events, D-0042 Semantic (vector) recall over memory

### Community 111 - "Gateway & Reasoning Decisions"
Cohesion: 0.40
Nodes (6): D-0046: Gateway learns current Anthropic API (per-target effort + adaptive thinking), D-0047: Model-gateway observability (/gateway/calls + Models panel), D-0048: Deep-reasoning escalation (provider-agnostic, user-visible, overridable), D-0049: Provider-agnostic generation settings vocabulary, D-0050: Deep-reasoning learning (transparent, no opaque ML), D-0052: Reasoning panel (learning contract made visible)

### Community 112 - "Model Observation Runs"
Cohesion: 0.33
Nodes (6): A/B Observation: Opus/Sonnet vs Haiku tier, D-0075 Verification: fast-model memory judgments + self-authored skills, Fresh Full Observation Run — 70/30, un-seeded heartbeats, Observation Run — 70/30, memory/heartbeat/drift bugs found, kernel/src/agent — agent runtime module guide, kernel/src/skills — skills registry module guide

### Community 113 - "Proactive Items Schema"
Cohesion: 0.33
Nodes (5): calendar_events, commitments, proactive_domain_settings, proactive_items, proactive_snoozes

### Community 114 - "Semantic Memory Schema"
Cohesion: 0.47
Nodes (4): memory_entities, memory_facts, memory_relations, memory_episodes

### Community 115 - "Settings Catalog Tests"
Cohesion: 0.40
Nodes (3): NOTE: these three are on LAB_FORBIDDEN_SETTING_PREFIXES — the lab can, SETTINGS_CATALOG, audit

### Community 116 - "Announcement Tests"
Cohesion: 0.33
Nodes (4): activity, audit, DAY, NIGHT

### Community 117 - "Chat Page UI"
Cohesion: 0.50
Nodes (3): appendToLastAssistant(), applyFrame(), Turn

### Community 118 - "Orb Page UI"
Cohesion: 0.40
Nodes (3): OrbState, STATE_COLOR, STATE_LABEL

### Community 119 - "Persona Page UI"
Cohesion: 0.50
Nodes (4): btn(), inputStyle, PersonaPage(), Prompt

### Community 120 - "Settings Page UI"
Cohesion: 0.50
Nodes (4): ctl(), input, Setting, SettingsPage()

### Community 121 - "Self-Extension Decisions"
Cohesion: 0.40
Nodes (3): D-0023: Self-extension Stage B activation (dedicated security check-in), Product Spec (docs/PRODUCT_SPEC.md), R-CAP-08: Hard limit on generated-capability scope

### Community 122 - "Foundation Safety Decisions"
Cohesion: 0.40
Nodes (5): D-0022 Computer-control foundation built SIMULATION-first, D-0023 Self-extension built safety-first; Stage B gated, D-0025 Device-control foundation SIMULATION-first; real HA gateway gated, D-0028 Managed secrets vault: credentials encrypted, never in memory/audit, D-0078 graphify adopted as developer tooling

### Community 123 - "Graphify Setup Script"
Cohesion: 0.70
Nodes (4): bad(), ok(), graphify-setup.sh script, warn()

### Community 124 - "Model Asset Fetcher"
Cohesion: 0.60
Nodes (4): fetch(), main(), Path, Fetch jarvis-ears model assets from verifiable sources into JARVIS_EARS_MODELS.

### Community 125 - "Companion App Config"
Cohesion: 0.50
Nodes (4): apps/companion README.md, apps/companion Tauri icons README, apps/companion ui/index.html fallback page, pnpm-workspace.yaml monorepo config

### Community 126 - "Capability & Simulation Decisions"
Cohesion: 0.50
Nodes (4): D-0003 Capability parity matrix approval, D-0018 Simulator depth: full suite, D-0019 Affect/state inference (B4) scheduled as constrained opt-in, D-0020 User hardware inventory

### Community 128 - "Voice & Persona Decisions"
Cohesion: 0.67
Nodes (3): D-0004 Voice stack picks, D-0004a TTS becomes a multi-adapter routable role, D-0043 Prompts registry: persona is user-editable data

### Community 129 - "Sleep-Cycle Decisions"
Cohesion: 0.67
Nodes (3): D-0051 Sleep-cycle consolidation, D-0052 Override contract, D-0053 Dual-editable knobs binding

### Community 130 - "Kernel Module Guides"
Cohesion: 0.67
Nodes (3): kernel/src/crypto — encrypted vault module guide, kernel/src/devices — device-control HAL module guide, kernel/src/mcp — MCP client host module guide

## Ambiguous Edges - Review These
- `kernel/src/selfext/activation.ts` → `src/core/ — Z1 trust core (audit/policy/approvals/estop/loop)`  [AMBIGUOUS]
  services/kernel/CLAUDE.md · relation: references
- `Clean-Slate Evolution Acceptance Run (D-0063)` → `Living-Heartbeat Verification (D-0064)`  [AMBIGUOUS]
  docs/verification/HEARTBEAT_2026-07-19.md · relation: conceptually_related_to

## Knowledge Gaps
- **552 isolated node(s):** `AutonomyStatus`, `TickResult`, `Announcement`, `ActivityEvent`, `ContextData` (+547 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **118 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `kernel/src/selfext/activation.ts` and `src/core/ — Z1 trust core (audit/policy/approvals/estop/loop)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Clean-Slate Evolution Acceptance Run (D-0063)` and `Living-Heartbeat Verification (D-0064)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `AuditLog` connect `Audit & Interlock` to `Proactivity Engine`, `Affect & Core Config`, `Secrets Vault`, `Sleep Consolidation`, `Capability Guard`, `Approval Broker`, `Agent Runtime`, `Agenda Management`, `Agent Tools`, `Core Tool Registration`, `MCP Client Host`, `Capability Activation`, `A2UI Registry`, `Policy & E-Stop`, `Episodic Memory`, `Settings Registry`, `Entity Graph Recall`, `Semantic Memory`, `Projects Tracking`, `Durable Grants`, `Skills Registry`, `Dynamic Settings Registry`, `Untrusted Content Tests`, `Announcement Tests`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `Night Lab verification report (2026-08-28)` connect `Repo Architecture Overview` to `Lab Applier`, `Kernel Module Guides`, `Lab Night Run`, `Agent Tools`, `Bench Grading Decisions`, `Lab Bench Engine`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `D-0079 Night Lab: evidence-gated self-experimentation` connect `Bench Grading Decisions` to `Repo Architecture Overview`, `Proactivity Decisions`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Are the 25 inferred relationships involving `buildCore()` (e.g. with `.pruneSetting()` and `.add()`) actually correct?**
  _`buildCore()` has 25 INFERRED edges - model-reasoned connections that need verification._
- **What connects `AutonomyStatus`, `TickResult`, `Announcement` to the rest of the system?**
  _552 weakly-connected nodes found - possible documentation gaps or missing edges._