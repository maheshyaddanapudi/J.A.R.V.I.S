# 06 — Check-Ins, Run & Verify, and Phase-1 Acceptance

## Check-ins (check in at decision points instead of deciding silently)
Before writing production code: present the sourced five-state parity matrix and 2–3 architecture options with a recommendation and tradeoffs, and wait for my selection.

Hold a DEDICATED design-and-security check-in for the self-extension engine before any activation path is built, and again for any high-risk generated capability.

Also check in before: finalizing the visual design system; selecting the voice stack, agent runtime, memory architecture, or local security model; enabling computer control, proactive behavior, or physical-device control; installing generated capabilities; recommending any hardware purchase; selecting Quest/Vision Pro/projector/light-field/volumetric/camera/hand-tracker architecture; adding any non-open-source dependency, proprietary hardware SDK, or required cloud service; changing the approved architecture; and deferring a requested feature or replacing real functionality with simulation. If scope exceeds the current session, surface the deferral (with prerequisites and target phase) rather than dropping it.

For each phase: state the objective and the end-to-end demos that will work, surface material decisions, build, run tests, demonstrate, record real limitations, and update the parity matrix, hardware catalog, roadmap, architecture, traceability, and security docs. Never declare a feature complete because the UI renders — verify the underlying behavior.

## Run & verify / local delivery
Provide one-command local dev startup where practical, Docker Compose for local infra, native macOS dev + production builds, a packaged macOS app, local browser access, DB migrations, seeded simulation scenarios, backup/restore/uninstall, diagnostics, health checks, logs, license + dependency inventory, and SBOM. After each phase, actually launch the full system and verify the built/packaged app end to end — do not rely only on unit tests; record failures, fix, and re-run. Honor the locality rules: do NOT deploy application data, memory, credentials, or services to Vercel or any cloud platform; outbound calls are limited to integrations I explicitly configure.

## Phase 1 is complete only when I can:
- Install and start the system using documented commands.
- Say "Jarvis" or use push-to-talk.
- Interrupt its spoken response naturally.
- Ask a question and receive a streamed spoken and visual response.
- See the current objective, execution state, selected model, tool activity, approval state, and result in the Command Center.
- Ask it to use one real read-only local tool.
- Ask it to perform one reversible Mac action after showing the proposed action, affected resources, risk, and rollback plan.
- Approve one action and deny another.
- Ask it to remember one non-sensitive preference.
- View, correct, and delete that memory.
- Restart the system and retain approved memory.
- Run using a local Ollama-compatible model, local STT, local TTS, and local embeddings.
- Disconnect external AI providers and complete the same supported offline workflow.
- Review the complete audit trail.
- Stop active execution through the emergency-stop control.

Capabilities assigned to later phases (screen/file/repo analysis → Phase 2; generated-capability Stage A and Stage B → Phase 3; proactive briefing → Phase 4; home device → Phase 5; Workshop and 3D manipulation → Phase 6) must NOT be pulled into Phase 1 merely to satisfy later acceptance criteria.
