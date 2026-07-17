# PHASE 1 — ACCEPTANCE RESULTS (R-VER-05)

**Recorded:** 2026-07-17 · **Environment:** Linux dev container (NOT the target Mac).
**Harness:** `scripts/acceptance_phase1.py`, run against the live stack (kernel :4150,
jarvis-ears :4170, local model via llama.cpp :8081, Postgres :5433).
**Result:** 9 PASS · 5 PARTIAL (needs-Mac) · 0 FAIL.

This is an honest record (honesty rule R-CORE-02): criteria fully verifiable in the
container are **PASS**; criteria whose remaining piece is Apple audio hardware or the
packaged `.app` are **PARTIAL / NEEDS-MAC** — never marked pass on hardware we don't
have. Re-run this harness on the M3 Max to close the PARTIAL rows.

| # | Criterion (docs/06) | Status | Evidence |
|---|---|---|---|
| AT1.1 | Install & start via documented commands | **PASS** (dev) / NEEDS-MAC (`.app`) | dev stack starts via `make dev`; kernel 0.1.0 healthy. Packaged/signed macOS app = slice 1.8. |
| AT1.2 | Say "Jarvis" / push-to-talk | **PARTIAL** | Wake engine (openWakeWord) loaded and verified detecting synthesized "hey jarvis" while ignoring other speech; **live microphone = NEEDS-MAC** (CoreAudio; Swift bridge source in `apps/companion/swift/`). |
| AT1.3 | Interrupt spoken response (barge-in) | **PARTIAL** | Turn-taking/barge-in state machine built + tested (fires on sustained speech, ignores coughs); **live echo-cancel = NEEDS-MAC** (macOS VPIO). |
| AT1.4 | Streamed spoken + visual answer | **PARTIAL** | 29 tokens streamed through the gated core loop from the local model; `/voice-turn` produces real TTS audio end-to-end; visual timeline live in Command Center; **live speaker playback = NEEDS-MAC**. |
| AT1.5 | Command Center shows objective/state/model/tools/approval/result | **PASS** | 3 tools registered; model-role table live; audit/approvals/activity/memory panels all render live kernel data (browser-verified). |
| AT1.6 | One real read-only tool | **PASS** | `system.info` returned real host state: `vm · linux/x64 · 13.4/15.7 GB free · load 0.6`. |
| AT1.7 | Reversible Mac action with disclosure + rollback | **PASS** | `workspace.writeNote` wrote a real file after approval; pre-action disclosure + pre-captured undo. (On the Mac, the macOS control tools of Phase 2 extend this.) |
| AT1.8 | Approve one, deny another | **PASS** | AT1.7 approved → file written; a second write denied → `denied=true`, no file. |
| AT1.9 | Remember a preference | **PASS** | `memory.remember` via the loop stored `accept_pref_… = verdigris` (user_statement, provenance recorded). |
| AT1.10 | View, correct, delete that memory | **PASS** | view=`verdigris` → correct=`teal` → delete → 404 (excluded immediately). |
| AT1.11 | Restart retains approved memory | **PASS** (verified in slice 1.6 run) | Preference + conversation survived a real kernel restart; superseded history preserved. |
| AT1.12 | Local-only + offline workflow | **PASS** (offline path) | Full voice-turn ran with `JARVIS_OFFLINE=1`: remote provider disabled, wake/STT/TTS/model all local, **zero external network connections** (checked /proc/net/tcp). Live-audio device on the Mac is the only remainder. |
| AT1.13 | Review the complete audit trail | **PASS** | Hash chain intact over 64 entries; every tool call, approval, e-stop, memory op recorded. |
| AT1.14 | Emergency stop halts execution | **PASS** | Engaged → tool denied; resumed → tool works. Halts tools + conversation; persisted latch. |

## What each PARTIAL needs (all Mac-hardware, none faked)

- **Live microphone + speaker device I/O** (CoreAudio) — the Swift audio bridge
  (`apps/companion/swift/JarvisAudio`) is written; `swift run JarvisAudio` on the Mac.
- **VPIO echo cancellation** — same bridge; gives barge-in on open speakers (a headset
  works without it).
- **Packaged/signed `.app`** and one-command launch — slice 1.8 (Tauri, macOS SDK).
- **Real-audio latency metrics** (R-VOICE-09) — measured on real hardware.
- **Expressive-voice identity pick** (D-0004a) — a listening decision, pending with you.

## Reproduce

```bash
make dev                                   # kernel + gateway + Command Center
python services/ears/scripts/fetch_models.py
# start jarvis-ears (see services/ears/CLAUDE.md), then:
python scripts/acceptance_phase1.py
```
