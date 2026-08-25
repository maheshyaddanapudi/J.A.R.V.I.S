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
    KEY="${ANTHROPIC_API_KEY:-}"
    if [ -z "$KEY" ] && [ -t 0 ]; then
      printf '  Anthropic API key (input hidden, blank to skip): '
      read -rs KEY; echo
    fi
    if [ -z "$KEY" ]; then
      warn "no key given — LLM passes will be skipped (AST-only graphs still work)"
    else
      mkdir -p .claude
      umask 077
      printf 'ANTHROPIC_API_KEY=%s\nANTHROPIC_MODEL=%s\nGRAPHIFY_MAX_OUTPUT_TOKENS=32000\n' \
        "$KEY" "${ANTHROPIC_MODEL:-$MODEL_DEFAULT}" > "$ENV_FILE"
      chmod 600 "$ENV_FILE"
      ok "written (chmod 600, gitignored), model=${ANTHROPIC_MODEL:-$MODEL_DEFAULT}"
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
