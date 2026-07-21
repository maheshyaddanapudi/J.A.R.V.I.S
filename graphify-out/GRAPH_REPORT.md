# Graph Report - /home/user/J.A.R.V.I.S  (2026-07-21)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1760 nodes · 3918 edges · 102 communities (87 shown, 15 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 51 edges (avg confidence: 0.62)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4d401bd8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 93
- Community 94
- Community 95
- Community 99
- Community 102

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
- `stt()` --calls--> `SherpaStreamingStt`  [INFERRED]
  services/ears/tests/test_engines.py → services/ears/src/jarvis_ears/stt_sherpa.py
- `kokoro()` --calls--> `KokoroTts`  [INFERRED]
  services/ears/tests/test_engines.py → services/ears/src/jarvis_ears/tts_kokoro.py
- `test_buffer_source_stops_early_on_close()` --calls--> `BufferAudioSource`  [INFERRED]
  services/ears/tests/test_audio_io.py → services/ears/src/jarvis_ears/audio_io.py
- `test_buffer_source_yields_all_frames_in_order()` --calls--> `BufferAudioSource`  [INFERRED]
  services/ears/tests/test_audio_io.py → services/ears/src/jarvis_ears/audio_io.py
- `test_buffer_sink_accumulates_and_stop_truncates()` --calls--> `BufferAudioSink`  [INFERRED]
  services/ears/tests/test_audio_io.py → services/ears/src/jarvis_ears/audio_io.py

## Import Cycles
- None detected.

## Communities (102 total, 15 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (22): Announcer, AUTONOMY_SOURCES, Budget, BudgetStatus, PRICE_PER_MTOK, Ops, DynamicSpecInput, EffectiveSetting (+14 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (30): parseJson(), sliceSpan(), ProactivityEngine, GateStack, inQuietHours(), priorityRank(), briefingCandidate(), calendarConflictCandidates() (+22 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (27): Evidence, GatherOptions, Researcher, ResearchFindings, SourceStatus, TargetCheck, queryTerms(), scorePassages() (+19 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (28): AppKit, ApplicationServices, AudioBridge, Double, Float, EarsClient, Float, AppInfoDTO (+20 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (12): AppInfo, AxElement, ComputerControl, ControlProvenance, ControlResult, ElementSelector, Screenshot, WindowInfo (+4 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (31): ActivationCheck, activationTools(), authoringTools(), RISK_ORDER, StepRunner, CapabilityGuard, DANGEROUS_PATTERNS, GuardVerdict (+23 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (21): AutonomyStatus, TickResult, AuditEntry, AuditLog, canonicalJson(), WHOLE_MATCH_PATTERNS, DurableGrantRow, DurableGrants (+13 more)

### Community 7 - "Community 7"
Cohesion: 0.08
Nodes (28): ConfigSchema, KernelConfig, loadConfig(), exec, randomKek(), resolveKek(), AppliedMigration, config (+20 more)

### Community 8 - "Community 8"
Cohesion: 0.05
Nodes (37): ajv, fastify, @modelcontextprotocol/sdk, pg, playwright, dependencies, ajv, fastify (+29 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (21): AudioSink, AudioSource, BufferAudioSink, BufferAudioSource, _PortAudioSource, ndarray, Path, Protocol (+13 more)

### Community 10 - "Community 10"
Cohesion: 0.09
Nodes (21): AgentResult, AgentRunOptions, AgentRuntime, AgentStep, LocalAgentRuntime, Core, wrapUntrusted(), ToolDefinition (+13 more)

### Community 11 - "Community 11"
Cohesion: 0.09
Nodes (13): normalizeName(), SecretInfo, SecretsVault, gcmDecrypt(), gcmEncrypt(), Vault, WRAP_INFO, audit (+5 more)

### Community 12 - "Community 12"
Cohesion: 0.11
Nodes (18): parseRolePin(), loadRoleOverrides(), persistRoleOverrides(), Store, StoredRoleOverrides, ajv, pinOf(), RoleOverride (+10 more)

### Community 13 - "Community 13"
Cohesion: 0.15
Nodes (11): Announcement, Project, ProjectLogEntry, ActionDisclosure, RememberArgs, Tool, ToolContext, ToolResult (+3 more)

### Community 14 - "Community 14"
Cohesion: 0.13
Nodes (15): DEVICE_RISK, DeviceCommand, DeviceGateway, DeviceInfo, DeviceProvenance, DeviceResult, DeviceState, DeviceType (+7 more)

### Community 15 - "Community 15"
Cohesion: 0.14
Nodes (16): DirEntry, EditOutcome, FileContent, FileInfo, FileKind, SearchMatch, SearchOptions, SearchResult (+8 more)

### Community 16 - "Community 16"
Cohesion: 0.14
Nodes (14): CommitmentContext, ContextProvider, ContextSnapshot, EpisodeSource, KnowledgeSource, KnownEntity, PinnedFact, ProactiveContext (+6 more)

### Community 17 - "Community 17"
Cohesion: 0.07
Nodes (27): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+19 more)

### Community 18 - "Community 18"
Cohesion: 0.07
Nodes (26): app, security, trayIcon, windows, build, devUrl, frontendDist, bundle (+18 more)

### Community 19 - "Community 19"
Cohesion: 0.10
Nodes (24): BaseModel, TtsChunk, listen(), load_engines(), ndarray, jarvis-ears HTTP/WS surface (localhost only, R-LOC-01).  GET  /health  — real en, Run the full utterance through the streaming STT and return the transcript., A complete captured utterance @16kHz mono float32. On the Mac the audio     come (+16 more)

### Community 20 - "Community 20"
Cohesion: 0.13
Nodes (14): hashTools(), McpClientHost, McpDiscovery, McpToolSpec, McpRegistry, McpServerRow, mcpToolRisk(), RegisteredServer (+6 more)

### Community 21 - "Community 21"
Cohesion: 0.08
Nodes (25): dependencies, next, react, react-dom, description, devDependencies, @types/node, @types/react (+17 more)

### Community 22 - "Community 22"
Cohesion: 0.14
Nodes (17): Enum, Typed, replaceable speech-engine contracts (R-VOICE-12).  Every engine is an ope, VadFrame, Full-duplex turn-taking + barge-in state machine (R-VOICE-03).  This is the ENGI, Drives the conversation's turn state from VAD frames.      Barge-in fires when,, Feed one VAD frame; returns any turn transitions it triggered., TurnEvent, TurnTaker (+9 more)

### Community 23 - "Community 23"
Cohesion: 0.12
Nodes (15): A2uiPanel, A2uiRegistry, A2uiComponent, A2uiComponentSchema, A2uiSpec, A2uiSpecSchema, Action, Heading (+7 more)

### Community 24 - "Community 24"
Cohesion: 0.13
Nodes (9): ProviderAdapter, ProviderError, OllamaMessage, createOpenAiCompatAdapter(), ChatEvent, NeutralMessage, TargetOptions, ToolCall (+1 more)

### Community 25 - "Community 25"
Cohesion: 0.15
Nodes (21): a2uiTools(), AgendaItem, agendaTools(), announceTools(), projectTools(), computerControlTools(), buildCore(), rememberPreferenceTool() (+13 more)

### Community 26 - "Community 26"
Cohesion: 0.18
Nodes (19): engage_estop(), estop_engaged(), get(), is_healthy(), KernelError, parse_status(), post(), request() (+11 more)

### Community 27 - "Community 27"
Cohesion: 0.14
Nodes (4): ActivationService, CapabilityRecord, CapabilityRegistry, normalizeComposition()

### Community 28 - "Community 28"
Cohesion: 0.16
Nodes (11): ConsolidationReport, DecisionLog, SleepCycle, assessDepth(), Autotune, DEFAULT_AUTOTUNE, DepthAssessment, DepthReason (+3 more)

### Community 29 - "Community 29"
Cohesion: 0.15
Nodes (15): DEFAULT_GATEWAY_CONFIG, ENV_DEFAULT_KINDS, loadGatewayConfig(), NON_GENERATIVE_ROLES, resolveGatewayConfig(), createOllamaAdapter(), ContentPart, EffortLevel (+7 more)

### Community 30 - "Community 30"
Cohesion: 0.17
Nodes (10): GatewayRouter, ChatRequest, ChatResult, EntityCandidate, EntityForMerge, EntityMergeGroup, FactForMerge, JudgeGateway (+2 more)

### Community 31 - "Community 31"
Cohesion: 0.25
Nodes (3): assertNotSecret(), EntityMemory, seedChain()

### Community 32 - "Community 32"
Cohesion: 0.14
Nodes (15): activityColor(), ActivityEvent, btn(), ContextData, EmergencyStopButton(), formatActivity(), HealthReport, inputStyle (+7 more)

### Community 33 - "Community 33"
Cohesion: 0.12
Nodes (9): ndarray, Protocol, Feed a PCM frame; return any wake detections in that frame., Yield audio chunks as they become available (sentence-level or better)., StreamingTtsEngine, SttEngine, TtsEngine, VadEngine (+1 more)

### Community 34 - "Community 34"
Cohesion: 0.15
Nodes (13): contentWords(), diceCoefficient(), EntityKind, fullestName(), GraphNeighborhood, GraphRecall, mergeAttrs(), nameSimilar() (+5 more)

### Community 35 - "Community 35"
Cohesion: 0.13
Nodes (11): EmbedFn, SemanticHit, SemanticMemory, SemanticSource, toVectorLiteral(), audit, embed(), hashEmbed() (+3 more)

### Community 36 - "Community 36"
Cohesion: 0.14
Nodes (9): ApprovalBroker, PendingApproval, audit, config, estop, fakePool, audit, catalog (+1 more)

### Community 37 - "Community 37"
Cohesion: 0.15
Nodes (5): redactSecrets(), Prompt, PromptKind, PromptRegistry, audit

### Community 38 - "Community 38"
Cohesion: 0.21
Nodes (3): PrivacyClass, GatewayMemoryJudge, MemoryJudge

### Community 39 - "Community 39"
Cohesion: 0.26
Nodes (3): assertNotSecret(), MemoryService, registerMemoryRoutes()

### Community 40 - "Community 40"
Cohesion: 0.13
Nodes (14): ES2023, compilerOptions, declaration, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, lib, module (+6 more)

### Community 42 - "Community 42"
Cohesion: 0.20
Nodes (5): FilePerceptionSource, Observation, PerceptionService, PerceptionSource, Provenance

### Community 43 - "Community 43"
Cohesion: 0.15
Nodes (12): description, engines, node, name, packageManager, private, scripts, build (+4 more)

### Community 44 - "Community 44"
Cohesion: 0.21
Nodes (11): kokoro(), ndarray, Engine tests against real models (no mocks — R-CORE-02).  Requires model assets, Real TTS -> real STT round trip: Kokoro speaks a command, STT must hear it., End-to-end: TTS speaks the wake phrase; the wake engine must detect it., _resample_24k_to_16k(), stt(), test_stt_transcribes_synthesized_speech() (+3 more)

### Community 47 - "Community 47"
Cohesion: 0.21
Nodes (10): btn(), Entry, Ev, FileContent, FilesPage(), formatEv(), inputStyle, Match (+2 more)

### Community 48 - "Community 48"
Cohesion: 0.18
Nodes (11): Beat, card(), ctl, dim, h2, input, Item, linkBtn (+3 more)

### Community 49 - "Community 49"
Cohesion: 0.21
Nodes (10): AgentResult, btn(), Ev, formatEv(), inputStyle, Pending, pipeColor(), Skill (+2 more)

### Community 50 - "Community 50"
Cohesion: 0.17
Nodes (11): description, devDependencies, @tauri-apps/cli, name, private, scripts, build, dev (+3 more)

### Community 51 - "Community 51"
Cohesion: 0.17
Nodes (11): node, src/**/*.test.ts, src/**/*.ts, ../../tsconfig.base.json, compilerOptions, outDir, rootDir, types (+3 more)

### Community 53 - "Community 53"
Cohesion: 0.21
Nodes (6): ActivityBus, ActivityEvent, PolicyEngine, audit, makeEstop(), makeLoop()

### Community 54 - "Community 54"
Cohesion: 0.32
Nodes (9): Entity, Fact, Episode, EpisodeKind, KINDS, RecallOptions, EpistemicStatus, Preference (+1 more)

### Community 56 - "Community 56"
Cohesion: 0.27
Nodes (5): CommandResult, Provenance, RunOptions, TerminalRunner, LocalTerminal

### Community 57 - "Community 57"
Cohesion: 0.22
Nodes (9): btn(), Entity, Episode, Fact, inputStyle, MemoryPage(), Recall, Rel (+1 more)

### Community 58 - "Community 58"
Cohesion: 0.20
Nodes (9): ActiveCap, BENIGN, btn(), Finding, MALICIOUS, Report, SelfExtPage(), Verdict (+1 more)

### Community 59 - "Community 59"
Cohesion: 0.18
Nodes (10): description, identifier, permissions, $schema, windows, core:default, core:window:allow-set-focus, core:window:allow-show (+2 more)

### Community 60 - "Community 60"
Cohesion: 0.27
Nodes (5): SttPartial, ndarray, Path, Streaming STT engine: sherpa-onnx streaming zipformer transducer (Apache-2.0)., SherpaStreamingStt

### Community 61 - "Community 61"
Cohesion: 0.14
Nodes (10): WakeEvent, OpenWakeWord, ndarray, Path, Wake-word engine: openWakeWord ONNX pipeline.  Code: Apache-2.0 (dscripka/openWa, ndarray, Path, Wake-word engine: sherpa-onnx open-vocabulary keyword spotting (Apache-2.0).  Th (+2 more)

### Community 63 - "Community 63"
Cohesion: 0.27
Nodes (8): AgentPage(), AgentResult, btn(), Ev, formatEv(), Pending, pipeColor(), Step

### Community 64 - "Community 64"
Cohesion: 0.36
Nodes (8): bad(), have(), hdr(), note(), ok(), port_state(), mac_preflight.sh script, skip()

### Community 65 - "Community 65"
Cohesion: 0.22
Nodes (5): InterlockManager, deviceTools(), audit, ctx, setup()

### Community 66 - "Community 66"
Cohesion: 0.24
Nodes (8): assessCommand(), Assessment, DENY, READ_ONLY, Verdict, audit, makeEstop(), makeLoop()

### Community 67 - "Community 67"
Cohesion: 0.31
Nodes (6): btn(), DevicesPage(), Ev, formatEv(), pipeColor(), RunOutcome

### Community 68 - "Community 68"
Cohesion: 0.28
Nodes (8): CallRow, h2(), inp, ModelsPage(), Override, ProviderRow, sec(), td

### Community 69 - "Community 69"
Cohesion: 0.25
Nodes (7): btn(), ProactivePage(), Rule, ruleInput, RunResult, Suppression, Surfaced

### Community 70 - "Community 70"
Cohesion: 0.33
Nodes (6): AffectReading, inferAffect(), Tone, Urgency, registerCoreRoutes(), sseCorsHeaders()

### Community 71 - "Community 71"
Cohesion: 0.25
Nodes (7): toolReg(), makeTools(), loopWith(), audit, makeEstop(), makeLoop(), PAGES

### Community 72 - "Community 72"
Cohesion: 0.29
Nodes (6): A2uiPage(), Component, ctl(), input, Panel, Setting

### Community 73 - "Community 73"
Cohesion: 0.36
Nodes (6): btn(), ControlPage(), Ev, formatEv(), pipeColor(), RunOutcome

### Community 74 - "Community 74"
Cohesion: 0.29
Nodes (7): Bundle, chip(), EntityRow, GEdge, GNode, GraphPage(), input

### Community 75 - "Community 75"
Cohesion: 0.36
Nodes (7): Autotune, chip(), h2(), input, ReasoningPage(), Report, sec()

### Community 76 - "Community 76"
Cohesion: 0.36
Nodes (6): btn(), Ev, formatEv(), pipeColor(), RunOutcome, TerminalPage()

### Community 77 - "Community 77"
Cohesion: 0.36
Nodes (6): btn(), Ev, formatEv(), pipeColor(), RunOutcome, WebPage()

### Community 78 - "Community 78"
Cohesion: 0.32
Nodes (4): ndarray, Path, SileroVad, vad()

### Community 81 - "Community 81"
Cohesion: 0.33
Nodes (4): createAnthropicAdapter(), adapter(), bodies, TOOL

### Community 83 - "Community 83"
Cohesion: 0.29
Nodes (3): auditRows, baseConfig, fakePool

### Community 84 - "Community 84"
Cohesion: 0.43
Nodes (5): audit, makeAgent(), makeEstop(), scriptedGateway(), tc()

### Community 86 - "Community 86"
Cohesion: 0.50
Nodes (3): appendToLastAssistant(), applyFrame(), Turn

### Community 87 - "Community 87"
Cohesion: 0.40
Nodes (3): OrbState, STATE_COLOR, STATE_LABEL

### Community 88 - "Community 88"
Cohesion: 0.50
Nodes (4): btn(), inputStyle, PersonaPage(), Prompt

### Community 89 - "Community 89"
Cohesion: 0.50
Nodes (4): ctl(), input, Setting, SettingsPage()

### Community 90 - "Community 90"
Cohesion: 0.60
Nodes (4): fetch(), main(), Path, Fetch jarvis-ears model assets from verifiable sources into JARVIS_EARS_MODELS.

## Knowledge Gaps
- **380 isolated node(s):** `Component`, `Panel`, `Setting`, `input`, `Step` (+375 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AuditLog` connect `Community 6` to `Community 0`, `Community 1`, `Community 2`, `Community 5`, `Community 7`, `Community 10`, `Community 11`, `Community 13`, `Community 20`, `Community 23`, `Community 25`, `Community 27`, `Community 28`, `Community 34`, `Community 35`, `Community 36`, `Community 37`, `Community 38`, `Community 41`, `Community 53`, `Community 54`, `Community 62`, `Community 65`, `Community 66`, `Community 70`, `Community 71`, `Community 79`, `Community 80`, `Community 82`, `Community 84`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `SimulatedDesktop` connect `Community 4` to `Community 25`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `ComputerControl` connect `Community 4` to `Community 25`, `Community 13`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `Component`, `Panel`, `Setting` to the rest of the system?**
  _380 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.052214452214452214 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07213114754098361 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06487434248977206 - nodes in this community are weakly interconnected._