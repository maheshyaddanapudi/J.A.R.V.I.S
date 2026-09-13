#!/usr/bin/env bash
# Fired by the Claude Code PostToolUse hook (.claude/settings.json) after
# every Edit/Write, via `setsid ... &` so it runs detached in the background
# and never blocks the edit that triggered it.
#
# Non-blocking lock: if a pipeline run is already in flight (e.g. a burst of
# rapid edits each fired the hook), this invocation skips rather than
# queuing another expensive run behind it. The next edit's hook firing,
# after the current run finishes, reads the filesystem fresh and picks up
# whatever changed in the meantime — nothing is silently lost, just batched.
# Contrast with scripts/graphify-refresh.sh (the manual trigger), which
# blocks and waits its turn instead, since a human explicitly asking for a
# refresh wants it to actually run, not skip.
#
# Every exit path here is silent and non-failing by design: this is a
# best-effort background nicety, never something that should surface an
# error to whoever triggered the edit.
#
# Per-edit runs are TRIMMED (2026-08-28): extraction + local clustering only.
# --no-label skips the LLM naming of ~275 communities and --no-viz skips the
# 2.4MB graph.html rewrite — together they were most of a ~12-minute fixed
# cost per edit, regardless of change size. query/path/explain stay current
# (nodes/edges/communities update); fresh community NAMES and graph.html come
# from the full pipeline in scripts/graphify-refresh.sh.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 0

[ -f .claude/graphify.env ] || exit 0
command -v graphify >/dev/null 2>&1 || exit 0
command -v flock >/dev/null 2>&1 || exit 0

set -a
# shellcheck disable=SC1091
. ./.claude/graphify.env
set +a

flock -n graphify-out/.graphify-pipeline.lock -c '
  graphify . --mode deep --no-label --no-viz
'
