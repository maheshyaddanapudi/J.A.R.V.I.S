# 01 — Mission, Honesty Rule, Machine, and Core Loop

## Mission
Build J.A.R.V.I.S. — Just A Rather Very Intelligent System — as a real, working, local-first personal AI operating system on my Mac, with functional and experiential parity with the J.A.R.V.I.S. across the Iron Man and Avengers movies: voice interaction, contextual awareness, proactive behavior, a cinematic interface language, computer control, device control, memory, and the ability to create its own new capabilities. This is a long-lived, extensible platform, not a one-off cinematic demo.

It must be BOTH:
1. A genuine assistant that performs useful work — operates my Mac, controls connected devices, talks to my applications, manages information, learns my preferences, acts proactively, and extends itself with new capabilities.
2. A cinematic J.A.R.V.I.S. experience — a restrained British-butler voice, animated HUDs, an engineering workshop, holographic-style visualizations, gesture and gaze input where supported, and cross-device presence.

## The honesty rule (binds from the first keystroke)
Implement every capability that is physically, legally, and technically achievable as a real working feature. Do NOT substitute mock data, hardcoded demos, fake terminal output, decorative screens, pre-recorded responses, simulated tool execution, or placeholder integrations for functionality that is actually achievable.

- Capabilities that depend on hardware I don't yet own must use production-quality typed hardware-abstraction interfaces with realistic development adapters and tested simulators until real hardware is added — a simulator must implement the same typed contract a future real plugin would.
- Capabilities that are fictional, physically impossible, unsafe, illegal, or dependent on unavailable private systems may use clearly-marked SIMULATION adapters, but must never be silently omitted, and must never be represented as live.
- Never claim that a simulated, inferred, or unavailable capability is real.

## My machine
MacBook Pro, M3 Max, 128 GB unified memory, 1 TB storage. Single-user local system. Expandable later to local servers, GPUs, edge devices, and room hardware.

## The core loop (the Phase 1 vertical slice — must work end to end before building outward)
- In Phase 1, I initiate interaction by saying "Jarvis" (configurable wake word), using push-to-talk, typing, or selecting supported desktop content. Later phases add spatial-object selection, webcam and dedicated hand gestures, gaze-mediated system interactions, XR controllers, head/body tracking, and room sensors through the shared input abstraction.
- It identifies the active context, and evaluates my request as an OBJECTIVE, not just a literal command.
- It decides whether to answer, retrieve, plan, use an available tool, delegate to an available agent, request approval, or take a permitted action. Before the self-extension system is implemented in Phase 3, it may identify and record a missing capability but must NOT claim it can generate, install, or activate that capability. After Phase 3, capability generation must follow the approved two-stage lifecycle.
- It streams its spoken AND visual response while work continues, showing concise execution state (never exposing hidden chain-of-thought).
- It executes permitted work, independently verifies the outcome, records the result/artifacts/decisions/audit trail/memory, and suggests or performs the next permitted action when useful.

Prove this loop works — real voice in, real reasoning, real gated action, real voice out, cinematic display — before anything else. It must run locally, including a full offline path.
