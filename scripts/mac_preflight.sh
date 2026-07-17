#!/usr/bin/env bash
# mac_preflight.sh — readiness check before standing J.A.R.V.I.S. up (docs/MAC_BRINGUP.md).
#
# Honest by design (R-CORE-02): every line reports MEASURED state — a tool's real
# presence/version, a port's real availability, the Keychain's real reachability.
# Nothing is assumed green. REQUIRED items gate the core stack (kernel + Command
# Center + models); MAC-ONLY items (Keychain, Xcode CLT) gate only the live
# audio/packaged-app/native-control steps and are reported as SKIP (not failure)
# when you run this off a Mac, so the script is testable anywhere.
#
# Usage:  bash scripts/mac_preflight.sh
# Exit:   0 if all REQUIRED checks pass; 1 if any REQUIRED prerequisite is missing.

set -u

pass=0; warn=0; miss=0
IS_MAC=0; [ "$(uname -s 2>/dev/null)" = "Darwin" ] && IS_MAC=1

# ---- tiny reporters -------------------------------------------------------
if [ -t 1 ]; then G="\033[32m"; Y="\033[33m"; R="\033[31m"; D="\033[2m"; Z="\033[0m"; else G=""; Y=""; R=""; D=""; Z=""; fi
ok()   { printf "  ${G}OK${Z}    %-22s %s\n"   "$1" "${2:-}"; pass=$((pass+1)); }
note() { printf "  ${Y}WARN${Z}  %-22s %s\n"   "$1" "${2:-}"; warn=$((warn+1)); }
bad()  { printf "  ${R}MISS${Z}  %-22s %s\n"   "$1" "${2:-}"; miss=$((miss+1)); }
skip() { printf "  ${D}SKIP${Z}  %-22s %s\n"   "$1" "${2:-}"; }
hdr()  { printf "\n${D}%s${Z}\n" "$1"; }

# first integer in a version string (e.g. "v22.4.1" -> 22, "pnpm 10.2" -> 10)
major() { printf '%s' "$1" | grep -oE '[0-9]+' | head -1; }
have()  { command -v "$1" >/dev/null 2>&1; }

# is a TCP port already in use? (lsof on mac, ss/nc as fallbacks). Echoes "busy"/"free".
port_state() {
  p="$1"
  if have lsof; then lsof -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1 && { echo busy; return; }
  elif have ss;  then ss -ltn 2>/dev/null | grep -q ":$p " && { echo busy; return; }
  elif have nc;  then nc -z 127.0.0.1 "$p" >/dev/null 2>&1 && { echo busy; return; }
  fi
  echo free
}

printf "J.A.R.V.I.S. bring-up preflight — %s\n" "$([ "$IS_MAC" = 1 ] && echo 'macOS (full check)' || echo 'non-Mac (core checks; Mac-only items skipped)')"

# ---- REQUIRED: JS toolchain ----------------------------------------------
hdr "Core toolchain (required for kernel + Command Center)"
if have node; then
  nv="$(node -v 2>/dev/null)"; n="$(major "$nv")"
  [ -n "$n" ] && [ "$n" -ge 22 ] 2>/dev/null && ok "node" "$nv (>=22)" || bad "node" "$nv — need >=22"
else bad "node" "not found — install Node 22+"; fi

if have pnpm; then
  pv="$(pnpm -v 2>/dev/null)"; pm="$(major "$pv")"
  [ -n "$pm" ] && [ "$pm" -ge 10 ] 2>/dev/null && ok "pnpm" "$pv (>=10)" || note "pnpm" "$pv — 10+ recommended (corepack enable)"
else bad "pnpm" "not found — run 'corepack enable'"; fi

have corepack && ok "corepack" "present" || note "corepack" "absent — ships with Node 22; enables pnpm"

# ---- REQUIRED: database ---------------------------------------------------
hdr "Database (required)"
if have docker && docker info >/dev/null 2>&1; then ok "docker" "daemon reachable"
elif have docker; then note "docker" "installed but daemon not running — start Docker Desktop/OrbStack"
elif have orb || have orbstack; then ok "orbstack" "present"
else bad "docker" "not found — install Docker Desktop or OrbStack (Postgres runs here)"; fi

# ---- REQUIRED: local models ----------------------------------------------
hdr "Local models (required for offline-capable operation, R-MODEL-04)"
if have ollama; then
  ok "ollama" "present"
  models="$(ollama list 2>/dev/null | awk 'NR>1{print $1}')"
  for m in qwen3.6 gpt-oss gemma4 nomic-embed-text; do
    if printf '%s\n' "$models" | grep -qi "$m"; then ok "model:$m" "pulled"
    else note "model:$m" "not pulled — 'ollama pull …' (see MAC_BRINGUP §2)"; fi
  done
else bad "ollama" "not found — install from https://ollama.com (local-first routing)"; fi

# ---- REQUIRED: speech service deps ---------------------------------------
hdr "Speech service (jarvis-ears)"
if have python3; then
  pyv="$(python3 -V 2>&1 | awk '{print $2}')"; pymaj="$(printf '%s' "$pyv" | cut -d. -f1)"; pymin="$(printf '%s' "$pyv" | cut -d. -f2)"
  { [ "$pymaj" -gt 3 ] 2>/dev/null || { [ "$pymaj" = 3 ] && [ "$pymin" -ge 11 ] 2>/dev/null; }; } \
    && ok "python3" "$pyv (>=3.11)" || note "python3" "$pyv — 3.11+ recommended"
else bad "python3" "not found — need 3.11+ for jarvis-ears"; fi
have uv && ok "uv" "present" || note "uv" "absent — install from https://docs.astral.sh/uv (ears venv)"

# ---- web/research browser -------------------------------------------------
hdr "Web/research browser (Chromium — the web.* / research.gather tools)"
if [ -n "${JARVIS_CHROMIUM_PATH:-}" ] && [ -x "${JARVIS_CHROMIUM_PATH:-}" ]; then ok "chromium" "JARVIS_CHROMIUM_PATH set"
elif [ -n "${PLAYWRIGHT_BROWSERS_PATH:-}" ] && [ -e "${PLAYWRIGHT_BROWSERS_PATH:-}/chromium" ]; then ok "chromium" "in PLAYWRIGHT_BROWSERS_PATH"
elif ls "$HOME/Library/Caches/ms-playwright"/chromium-* >/dev/null 2>&1; then ok "chromium" "playwright cache present"
else note "chromium" "not found — 'cd services/kernel && npx playwright install chromium' (only web.* need it)"; fi

# ---- MAC-ONLY: vault KEK + native toolchain ------------------------------
hdr "Mac-only (live audio, packaged app, native control)"
if [ "$IS_MAC" = 1 ]; then
  if have security; then ok "keychain" "security(1) available — vault KEK stored here on first run"
  else bad "keychain" "security(1) missing?! vault KEK cannot be stored"; fi
  if xcode-select -p >/dev/null 2>&1; then ok "xcode-clt" "$(xcode-select -p)"
  else bad "xcode-clt" "run 'xcode-select --install' (Swift companion)"; fi
  if have swift; then ok "swift" "$(swift --version 2>/dev/null | head -1)"; else note "swift" "not found — comes with Xcode CLT"; fi
else
  skip "keychain" "Mac-only — vault uses HKDF(JARVIS_MASTER_KEY) off-Mac"
  skip "xcode-clt" "Mac-only — Swift companion builds on the Mac"
  skip "swift"     "Mac-only"
fi

# ---- ports ----------------------------------------------------------------
hdr "Ports (must be free before 'make dev')"
for pair in "4150 kernel" "4160 command-center" "4170 jarvis-ears" "5432 postgres"; do
  p="${pair%% *}"; nm="${pair#* }"
  [ "$(port_state "$p")" = free ] && ok "port:$p" "$nm — free" || note "port:$p" "$nm — IN USE (stop the other listener)"
done

# ---- summary --------------------------------------------------------------
printf "\n%s\n" "----------------------------------------------------------"
printf "  ${G}%d OK${Z} · ${Y}%d WARN${Z} · ${R}%d MISSING${Z}\n" "$pass" "$warn" "$miss"
if [ "$miss" -eq 0 ]; then
  printf "  Required prerequisites satisfied — proceed with MAC_BRINGUP §1.\n"
  [ "$warn" -gt 0 ] && printf "  (WARNs are optional/next-step items, not blockers.)\n"
  exit 0
else
  printf "  ${R}%d required prerequisite(s) missing${Z} — install them, then re-run.\n" "$miss"
  exit 1
fi
