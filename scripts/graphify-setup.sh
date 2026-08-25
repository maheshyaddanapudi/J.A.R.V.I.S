#!/usr/bin/env bash
# One-command setup for the graphify knowledge-graph integration.
#
# Re-establishes everything that does NOT survive in git: the graphify CLI
# itself and the local API-key file. Safe to re-run (idempotent).
#
#   ./scripts/graphify-setup.sh                 # install + key prompt + wire hook
#   ANTHROPIC_API_KEY=sk-... ./scripts/graphify-setup.sh   # non-interactive key
#   ./scripts/graphify-setup.sh --check         # verify only, change nothing
#   ./scripts/graphify-setup.sh --skip-hook     # don't touch .claude/settings.json
#   ./scripts/graphify-setup.sh --skip-key      # don't write .claude/graphify.env
#
# What is committed and needs no setup: the /graphify skill, the generated
# graph under graphify-out/, and the refresh/auto-update scripts.
#
# NOTE ON THINKING: no patching is needed. Extended thinking is ON BY DEFAULT
# for current Claude models — verified empirically against the live API
# (a Sonnet 5 call with no `thinking` parameter still reported
# thinking_tokens > 0). Stock graphify + ANTHROPIC_MODEL=claude-sonnet-5 is
# all it takes; graphify >= 0.9.50 also handles the leading ThinkingBlock in
# the response correctly (their #2697), which older versions did not.
set -euo pipefail
cd "$(dirname "$0")/.."

MODEL_DEFAULT="claude-sonnet-5"
ENV_FILE=".claude/graphify.env"
HOOK_CMD='command -v setsid >/dev/null 2>&1 && [ -x scripts/graphify-auto-update.sh ] && setsid scripts/graphify-auto-update.sh > graphify-out/.hook-deep-update.log 2>&1 < /dev/null &'

CHECK_ONLY=0; SKIP_HOOK=0; SKIP_KEY=0; SKIP_INSTALL=0
for arg in "$@"; do
  case "$arg" in
    --check)        CHECK_ONLY=1 ;;
    --skip-hook)    SKIP_HOOK=1 ;;
    --skip-key)     SKIP_KEY=1 ;;
    --skip-install) SKIP_INSTALL=1 ;;
    -h|--help)      sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "unknown option: $arg (try --help)" >&2; exit 2 ;;
  esac
done

ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$1"; }

# ---------------------------------------------------------------- check mode
if [ "$CHECK_ONLY" = 1 ]; then
  echo "graphify setup status:"
  rc=0
  if command -v graphify >/dev/null 2>&1; then ok "graphify installed ($(graphify --version 2>&1 | head -1))"
  else bad "graphify not on PATH — run ./scripts/graphify-setup.sh"; rc=1; fi
  if [ -f "$ENV_FILE" ]; then ok "$ENV_FILE present (model: $(grep -oP '(?<=^ANTHROPIC_MODEL=).*' "$ENV_FILE" 2>/dev/null || echo 'unset'))"
  else warn "$ENV_FILE missing — LLM passes will be skipped, AST-only still works"; fi
  if grep -q 'graphify-auto-update.sh' .claude/settings.json 2>/dev/null; then ok "PostToolUse auto-update hook wired"
  else warn "auto-update hook not wired in .claude/settings.json"; fi
  if [ -f graphify-out/graph.json ]; then ok "graph present ($(grep -o '"id"' graphify-out/graph.json | wc -l | tr -d ' ') node refs)"
  else warn "no graph yet — run ./scripts/graphify-refresh.sh"; fi
  exit $rc
fi

# ------------------------------------------------------------------ install
if [ "$SKIP_INSTALL" = 0 ]; then
  echo "==> Installing graphify"
  if command -v graphify >/dev/null 2>&1; then
    ok "already installed ($(graphify --version 2>&1 | head -1))"
  elif command -v uv >/dev/null 2>&1; then
    uv tool install "graphifyy[anthropic,sql]" >/dev/null 2>&1 && ok "installed via uv"
  elif command -v pipx >/dev/null 2>&1; then
    pipx install "graphifyy[anthropic,sql]" >/dev/null 2>&1 && ok "installed via pipx"
  elif command -v pip3 >/dev/null 2>&1; then
    pip3 install --quiet "graphifyy[anthropic,sql]" 2>/dev/null \
      || pip3 install --quiet --break-system-packages "graphifyy[anthropic,sql]"
    ok "installed via pip3"
  else
    bad "no uv/pipx/pip3 found — install one, then re-run"; exit 1
  fi
  command -v graphify >/dev/null 2>&1 || {
    bad "graphify still not on PATH; ensure ~/.local/bin is in PATH"; exit 1; }
fi

# ---------------------------------------------------------------- key file
# Holds the Anthropic key used by BOTH the auto-update hook and the manual
# refresh script. Gitignored and chmod 600 — it is a real credential on disk,
# a deliberate tradeoff for unattended refresh (see docs/GRAPHIFY.md).
if [ "$SKIP_KEY" = 0 ]; then
  echo "==> Configuring $ENV_FILE"
  if [ -f "$ENV_FILE" ]; then
    ok "already present (delete it to re-enter a key)"
  else
    MODEL="${ANTHROPIC_MODEL:-$MODEL_DEFAULT}"
    KEY="${ANTHROPIC_API_KEY:-}"
    [ -n "$KEY" ] && ok "using ANTHROPIC_API_KEY from the environment"

    # Prompt on the CONTROLLING TERMINAL (/dev/tty), not stdin. This script is
    # frequently run where stdin is not a tty — from an agent, behind a pipe,
    # `bash setup.sh < file` — and the previous `[ -t 0 ]` guard silently
    # skipped the prompt in every one of those cases, leaving the user with no
    # key and only a warning. /dev/tty prompts correctly whenever a terminal is
    # attached at all, regardless of what stdin points at.
    # `[ -r /dev/tty ]` is NOT a sufficient guard: with no controlling terminal
    # the node still passes the readability test but OPENING it fails with
    # "No such device or address", which under `set -e` kills the script in
    # precisely the non-interactive case this is meant to degrade gracefully
    # in. Probing with a real open in a subshell is the only reliable check.
    HAVE_TTY=0
    if ( : < /dev/tty ) 2>/dev/null; then HAVE_TTY=1; fi

    if [ -z "$KEY" ] && [ "$HAVE_TTY" = 1 ]; then
      for attempt in 1 2 3; do
        printf '  Anthropic API key (input hidden, blank to skip): ' > /dev/tty
        IFS= read -rs KEY < /dev/tty || KEY=""
        printf '\n' > /dev/tty
        [ -z "$KEY" ] && break                      # blank = deliberate skip
        case "$KEY" in
          sk-ant-*) break ;;
          *) KEY=""
             if [ "$attempt" -lt 3 ]; then
               printf '  that does not look like an Anthropic key (expected sk-ant-…) — try again\n' > /dev/tty
             else
               printf '  three malformed attempts; continuing without a key\n' > /dev/tty
             fi ;;
        esac
      done
    fi

    if [ -z "$KEY" ]; then
      warn "no key configured — LLM passes will be skipped (AST-only graphs still work)"
      [ "$HAVE_TTY" = 1 ] || warn "no terminal available to prompt; pass ANTHROPIC_API_KEY=... to set one non-interactively"
    else
      # Verify BEFORE writing: a bad key stored here surfaces much later as a
      # failed (and already paid-for) refresh, which is a miserable way to find
      # out. One max_tokens=1 call costs effectively nothing.
      if command -v curl >/dev/null 2>&1; then
        HTTP=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 \
          https://api.anthropic.com/v1/messages \
          -H "x-api-key: $KEY" -H "anthropic-version: 2023-06-01" \
          -H "content-type: application/json" \
          -d "{\"model\":\"$MODEL\",\"max_tokens\":1,\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}]}" \
          2>/dev/null || echo 000)
        case "$HTTP" in
          200)     ok "key verified against the Anthropic API (model $MODEL)" ;;
          401|403) bad "key rejected by the API (HTTP $HTTP) — NOT written"; unset KEY; exit 1 ;;
          404)     warn "model '$MODEL' not found (HTTP 404) — key looks usable; check ANTHROPIC_MODEL" ;;
          400)     warn "API returned HTTP 400 (often a billing/credit issue, not a bad key) — writing anyway" ;;
          000)     warn "could not reach the API to verify (offline / proxy?) — writing unverified" ;;
          *)       warn "unexpected HTTP $HTTP while verifying — writing anyway" ;;
        esac
      fi
      mkdir -p .claude
      umask 077
      printf 'ANTHROPIC_API_KEY=%s\nANTHROPIC_MODEL=%s\nGRAPHIFY_MAX_OUTPUT_TOKENS=32000\n' \
        "$KEY" "$MODEL" > "$ENV_FILE"
      chmod 600 "$ENV_FILE"
      ok "written (chmod 600, gitignored), model=$MODEL"
    fi
    unset KEY
  fi
fi

# ------------------------------------------------------------------- hook
if [ "$SKIP_HOOK" = 0 ]; then
  echo "==> Wiring the Claude Code PostToolUse auto-update hook"
  HOOK_CMD="$HOOK_CMD" python3 - <<'PYEOF'
import json, os, pathlib
p = pathlib.Path(".claude/settings.json")
cfg = {}
if p.exists():
    try:
        cfg = json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        raise SystemExit("  \033[31m✗\033[0m .claude/settings.json is not valid JSON — fix it, then re-run")
hooks = cfg.setdefault("hooks", {})
post = hooks.setdefault("PostToolUse", [])
# Idempotent: drop any prior graphify auto-update entry (including the older
# inline command this replaces) before appending the current one.
post[:] = [h for h in post if "graphify" not in json.dumps(h)]
post.append({"matcher": "Edit|Write",
             "hooks": [{"type": "command", "command": os.environ["HOOK_CMD"]}]})
p.parent.mkdir(parents=True, exist_ok=True)
p.write_text(json.dumps(cfg, indent=2) + "\n", encoding="utf-8")
print("  \033[32m✓\033[0m PostToolUse Edit|Write -> scripts/graphify-auto-update.sh")
PYEOF
fi

echo
echo "Done. Next:"
echo "  ./scripts/graphify-setup.sh --check   # verify"
echo "  ./scripts/graphify-refresh.sh         # build/refresh the graph now"
echo "  graphify query \"how does approval work?\""
