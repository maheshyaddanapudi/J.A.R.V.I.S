# MAC_BRINGUP — standing J.A.R.V.I.S. up on the M3 Max

This is the **operational runbook** for bringing the built platform up on the
target machine (MacBook Pro M3 Max, macOS 26) and driving it to functional parity
in order. Everything below is grounded in commands/ports/paths that exist in this
repo today. It complements — does not replace — `docs/DEVELOPMENT.md` (dev
environment), `docs/06_CHECKINS_AND_VERIFY.md` (the gates), and
`docs/07_SESSION_CONTINUITY.md` (resuming).

**Honesty note.** Every subsystem below is real and verified in the Linux dev
container **except** the parts that require Apple hardware/SDKs — live
mic/speakers + echo cancellation, the packaged Tauri app, real macOS control, and
real Home Assistant devices. Those are marked **[Mac-only]** and only become live
here, on this machine. Nothing is faked to look running.

---

## 0. Prerequisites
- **Node 22+, pnpm 10** — `corepack enable`
- **Docker Desktop or OrbStack** — Postgres (+ optional Jaeger)
- **[Ollama](https://ollama.com)** — local models (local-capable-first, R-MODEL-04)
- **Python 3.11+ with [`uv`](https://docs.astral.sh/uv/)** — the `jarvis-ears` speech service
- **Chromium for Playwright** — the web/research tools drive a real headless browser.
  `make install` pulls the `playwright` npm package (a kernel dependency); fetch the
  browser once with `npx playwright install chromium` (run in `services/kernel`, or
  set `JARVIS_CHROMIUM_PATH` to an existing Chromium). Without it, `web.*` /
  `research.gather` return a clear "install Playwright" error; nothing else is affected.
- **Xcode command-line tools** (`xcode-select --install`) — the Swift companion
- macOS 26 login Keychain access (the vault KEK is stored there automatically)

---

## 1. Install + database
```bash
make install          # pnpm install (all JS packages, incl. playwright for web/research)
make infra            # Postgres via docker compose (add PROFILE=observability for Jaeger)
make migrate          # apply kernel migrations 0001–0010 (immutable, sha256-tracked)
( cd services/kernel && npx playwright install chromium )   # browser for web/research tools
```
Sanity: `docker exec jarvis-db pg_isready`. The kernel self-migrates on startup too,
so `make migrate` is optional if you go straight to `make dev`.

## 2. Local models (Ollama) — local-first, offline-capable
Pull the models the gateway routes to by default (D-0012; adjust in the gateway
config JSON). Local models are what let the whole loop run with `JARVIS_OFFLINE=1`.
These are the exact tags the default config routes to
(`services/kernel/src/gateway/config.ts`):
```bash
ollama pull qwen3.6:35b-a3b      # conversation / reasoning / planning / verification (most roles)
ollama pull gpt-oss:120b         # deep reasoning / long context (fits in 128 GB)
ollama pull gemma4:26b-a4b       # vision
ollama pull nomic-embed-text     # embeddings + reranking
```
Override the whole routing table via `JARVIS_GATEWAY_CONFIG=<file.json>` if your
installed tags differ. The config lists local targets **before** remote ones per
role — that ordering *is* the local-first policy (R-MODEL-04). Model choices are
revisited each phase (D-0012).

## 3. The vault + your secrets (no plaintext credentials)
On macOS the vault **KEK comes from the login Keychain automatically** on first
run (`security add-generic-password`, service `jarvis-vault-kek`) — you do **not**
set `JARVIS_MASTER_KEY` here. The wrapped DEK lives at `~/.jarvis/vault/dek.json`
(0600). Wrong KEK is fatal by design (it never silently re-keys).

Store integration credentials in the managed **SecretsVault** (encrypted at rest,
never in memory/audit — R-MEM-06/D-0028) once the kernel is up (step 4):
```bash
# optional cloud model key (only if you want a remote provider; fully optional)
curl -X POST http://127.0.0.1:4150/secrets -H 'content-type: application/json' \
  -d '{"name":"anthropic_api_key","value":"sk-...","description":"Anthropic API key"}'
# Home Assistant long-lived token (only needed at the device check-in, step 8d)
curl -X POST http://127.0.0.1:4150/secrets -H 'content-type: application/json' \
  -d '{"name":"home_assistant_token","value":"llat-...","description":"HA token"}'
curl http://127.0.0.1:4150/secrets     # names + metadata only — never values
```

## 4. Kernel + Command Center
```bash
make dev               # infra + migrate + kernel (4150) + Command Center (4160)
# or individually: make kernel     make ui
```
- Kernel health: <http://127.0.0.1:4150/health> (real measured DB + migration state)
- Command Center: <http://127.0.0.1:4160>
- Ambient Voice Orb: <http://127.0.0.1:4160/orb> (drives off the live activity SSE
  + e-stop; try `?preview=speaking` to see states)

## 5. Voice service (`jarvis-ears`) — real local speech
```bash
cd services/ears
uv venv .venv && VIRTUAL_ENV=$PWD/.venv uv pip install -e ".[dev]"
python scripts/fetch_models.py          # Kokoro TTS, Silero VAD, sherpa STT, openWakeWord → $JARVIS_EARS_MODELS
uvicorn jarvis_ears.server:app --app-dir src --port 4170
```
- Health: <http://127.0.0.1:4170/health> (honest per-engine state)
- `POST /voice-turn` runs audio → STT → kernel gated loop → TTS audio out.
- Env: `JARVIS_EARS_MODELS` (default `/tmp/jarvis-ears-models`), `JARVIS_VOICE`
  (default `bm_george`), `JARVIS_OFFLINE=1` to forbid any remote provider.

## 6. [Mac-only] Live audio — the Swift companion (VPIO echo cancellation)
The mic/speaker path with acoustic echo cancellation is the macOS Voice-Processing
I/O audio unit, which only exists on the Mac.
```bash
cd apps/companion/swift
swift build
swift run JarvisAudio          # echo-cancelled capture+playback, streams PCM to jarvis-ears
```
Grant **Microphone** permission on first launch. This turns the container-verified
buffer audio path into a live full-duplex conversation. (`JarvisControl` in the
same package is the real macOS computer-control adapter — do not activate it until
the check-in in 8b.)

### 6b. [Mac-only] The packaged app (Tauri 2) — menu-bar e-stop + push-to-talk
The native shell is scaffolded (`apps/companion/src-tauri/`, D-0040); its
kernel-client core is std-only and already compiled/tested/live-verified here (the
tray EMERGENCY STOP drives the real kernel). Build the `.app` on the Mac:
```bash
cd apps/companion
pnpm install                              # @tauri-apps/cli
pnpm tauri icon path/to/jarvis-1024.png   # generate icons (any 1024² PNG to start)
pnpm tauri dev                            # live: hosts the running Command Center (4160)
pnpm tauri build                          # signed .app + dmg
```
Confirm the tray/global-shortcut API in `src-tauri/src/lib.rs` against the pinned
Tauri 2 version on first build. The window loads `http://localhost:4160`, so the
stack (step 4) must be up.

## 7. Verify — acceptance harnesses
With the stack up (kernel 4150, Postgres; ears 4170 + a local model for the voice
rows). Both need `httpx` (`uv pip install httpx`, or use the ears venv).

**Whole-platform check** — every subsystem end to end:
```bash
python scripts/acceptance_platform.py --kernel http://127.0.0.1:4150
```
It drives core/trust, model gateway, the gated loop, memory (+ secret refusal),
the secrets vault, context, proactivity, computer-control (SIMULATION),
device-control interlock (SIMULATION), self-extension hard limit, the MCP host, and
the REAL Phase-2 capabilities — **workspace files** (`P-KNOW-01`), **web research**
(`P-WEB-01`), **terminal-with-policy** (`P-TERM-01`), **research-with-provenance**
(`P-RESEARCH-01`), and **semantic memory** (`P-ENTMEM-01`) — printing honest
PASS / VERIFIED-ELSEWHERE / **NEEDS-MAC** / SKIP / FAIL (`21 PASS · 3
verified-elsewhere · 4 NEEDS-MAC · 0 FAIL` in-container). Only four rows are
NEEDS-MAC (real macOS control, real HA, live voice, packaged app); those turn into
real checks here on the Mac as their adapters are enabled at steps 6/8. Exits
non-zero on any real FAIL.

**Live immediately (no check-in) once the stack is up:** the workspace files,
terminal-with-policy, web/research (needs the Chromium from step 0), semantic
memory, and MCP capabilities are REAL and gated — they work as soon as the kernel
runs. Only the four Mac-hardware/adapter items in step 8 are gated behind a check-in.

**Phase-1 voice/UX criteria** (docs/06):
```bash
python scripts/acceptance_phase1.py --kernel http://127.0.0.1:4150 --ears http://127.0.0.1:4170
```

---

## 8. The check-in sequence (docs/06) — unlock capabilities in order
Each capability below is **built and gated**; it activates only after you approve
its check-in. Nothing consequential runs before its gate. Recommended order:

- **8a. Voice identity — D-0004a.** Do the expressive-TTS listening test
  (Kokoro `bm_george`/`bm_daniel` vs an optional OpenAI voice); pick the voice.
  Sets `JARVIS_VOICE` and fixes the butler voice before the UI hardens.
- **8b. macOS computer control — D-0022.** Approve enabling the real `JarvisControl`
  adapter (TCC: Accessibility, Screen & System Audio Recording, Automation) and the
  per-app/per-action approval defaults. `buildCore({control})` then injects it in
  place of the SIMULATION desktop.
- **8c. Proactive delivery — D-0024.** Approve background cadence, briefing
  schedule, notification channels, quiet-hours, per-domain defaults. Until then the
  engine only computes on demand (`POST /proactive/run`).
- **8d. Physical devices — D-0025.** Approve the HA base URL + per-device-type risk
  defaults + the hardware interlock mechanism; the token is already in the vault
  (step 3). `buildCore({devices})` then injects `homeAssistantFromVault(...)` in
  place of the Stark-residence SIMULATION.
- **8e. MCP server trust — D-0027.** For any MCP server you want above `untrusted`,
  approve it per-server (re-approved after any manifest change). `POST /mcp/connect`
  then `POST /mcp/trust`.
- **8f. Design system — D-0026.** Approve/amend `docs/DESIGN_SYSTEM.md` before the
  full Command Center UI is built out on it.
- **8g. Self-extension Stage B — D-0023 (highest risk).** The **dedicated security
  check-in**. Stage A only *generates* capabilities today (no activation path
  exists). Stage B (sandboxed generation, scans, signed install, min-permission
  activation, auto-rollback) is built only after this review, and **no** generated
  capability may ever touch security/approval/audit/e-stop/credential/sandbox logic
  (hard limit R-CAP-08).

## 9. Offline mode
Set `JARVIS_OFFLINE=1` for the kernel and `jarvis-ears`: every remote provider is
refused, wake/VAD/STT/TTS run as local ONNX on CPU, and the model runs locally via
Ollama. The full voice loop then makes zero external network connections
(verified in-container as AT1.12).

## Ports
| Service | Port | URL |
|---|---|---|
| Kernel (jarvisd) | 4150 | http://127.0.0.1:4150/health |
| Command Center | 4160 | http://127.0.0.1:4160 |
| jarvis-ears (speech) | 4170 | http://127.0.0.1:4170/health |
| Postgres | 5432 | (docker compose) |
| Jaeger UI (optional) | 16686 | `make infra PROFILE=observability` |

## Troubleshooting
- **`vault: cannot unwrap the data key`** — the Keychain KEK doesn't match
  `~/.jarvis/vault/dek.json`. You changed machines/keys; the DEK is intentionally
  not recoverable without the original KEK. Remove the keyfile only if you accept
  losing existing encrypted data.
- **`no API key … provider unconfigured`** — store the key in the vault (step 3) or
  set the env var; local-only/offline roles need no key.
- **ears `/health` shows STT not-loaded** — run `python scripts/fetch_models.py`
  and point `JARVIS_EARS_MODELS` at the download dir.
- **Migrations "already applied" mismatch** — migrations are immutable; never edit
  an applied `NNNN_name.sql`, add a new one.
