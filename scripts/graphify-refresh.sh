#!/usr/bin/env bash
# Manually re-run the full graphify pipeline (deep-mode semantic extraction +
# community clustering + LLM relabeling) with the same Sonnet-5 + adaptive-
# thinking config the Claude Code auto-update hook uses.
#
# Delta-compatible: graphify's own incremental cache means this only sends
# *changed* doc/image files to the LLM (code-only changes since the last run
# cost $0 for the semantic step); community relabeling still runs every time
# this script is invoked, same tradeoff as the automatic hook.
#
# Safe to run manually at any point, including while the automatic
# PostToolUse hook might be mid-run from a recent edit: both share the same
# lock file (graphify-out/.graphify-pipeline.lock), so this waits its turn
# instead of racing a concurrent write to graph.json.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .claude/graphify.env ]; then
  echo "error: .claude/graphify.env not found — no Anthropic key configured for this repo." >&2
  echo "This script needs the same key/model file the auto-update hook reads." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
. ./.claude/graphify.env
set +a

echo "Refreshing graphify graph (Sonnet 5, deep mode, adaptive thinking)..."
flock graphify-out/.graphify-pipeline.lock -c '
  graphify . --mode deep &&
  graphify cluster-only . &&
  graphify label .
'
echo "Done. See graphify-out/GRAPH_REPORT.md and graphify-out/graph.html."
