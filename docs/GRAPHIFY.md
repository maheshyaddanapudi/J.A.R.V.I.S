# graphify — code knowledge graph (dev tooling)

**What it is:** a third-party OSS tool ([safishamsi/graphify](https://github.com/safishamsi/graphify),
PyPI `graphifyy`) that builds a queryable knowledge graph of this repo — code
symbols via tree-sitter AST parsing, plus docs/images via an LLM pass. It
exists so an agent (or a person) can ask *"what talks to the approval broker?"*
and get a scoped subgraph instead of grepping blind.

**Scope:** developer tooling only. It is **not** a J.A.R.V.I.S. capability, is
not part of the kernel, is not in the parity matrix, and nothing in
`services/` imports it. It reads the repo and writes `graphify-out/`.

---

## Quick start

```bash
./scripts/graphify-setup.sh          # install + key prompt + wire the hook
./scripts/graphify-setup.sh --check  # verify without changing anything
./scripts/graphify-refresh.sh        # build/refresh the graph now
```

Then query it:

```bash
graphify query "how does the approval gate work?"
graphify path "AuditLog" "EmergencyStop"
graphify explain "SettingsRegistry"
graphify god-nodes --top 15
```

Or open `graphify-out/graph.html` for the interactive force-directed view.

### What survives, what doesn't

| Committed (works on clone) | Ephemeral (setup script restores) |
|---|---|
| `/graphify` skill (`.claude/skills/graphify/`) | The `graphify` CLI itself |
| The generated graph (`graphify-out/`) | `.claude/graphify.env` (the API key) |
| These scripts + the hook config | `graphify-out/cache/` (rebuild cache) |

On a fresh container/machine the CLI and key are gone, so the auto-update hook
becomes a **silent no-op** — every guard clause exits 0 rather than erroring.
`--check` tells you which pieces are missing.

---

## The two refresh paths

Both run the same pipeline — `graphify . --mode deep` → `cluster-only` →
`label` — and share one lock (`graphify-out/.graphify-pipeline.lock`), so they
can never race each other on `graph.json`.

**Automatic** — `scripts/graphify-auto-update.sh`, fired by the `PostToolUse`
hook in `.claude/settings.json` after every Claude Code `Edit`/`Write`. Runs
detached (`setsid`) so it never blocks the edit. Uses a **non-blocking** lock:
if a run is already in flight (a burst of rapid edits), this one skips rather
than queueing another expensive run behind it — the next edit's firing picks
up whatever changed. Output: `graphify-out/.hook-deep-update.log`.

**Manual** — `scripts/graphify-refresh.sh`. Same pipeline, but a **blocking**
lock (a human asking for a refresh should wait their turn and actually run,
not silently skip) and foreground output so you can watch it.

### Delta behaviour and cost

graphify caches per-file semantic extractions, so a refresh only sends
**changed** doc/image files to the API:

- **Code-only changes** → semantic step costs **$0** (tree-sitter is local).
- **Doc changes** → only those files are re-extracted.
- **Cold cache** (fresh container, `graphify-out/cache/` gone) → full
  re-extraction, ~$4 and several minutes at 2000-node scale.

Honest caveat: `graphify label` (LLM community naming) runs on **every**
invocation of either path, not just when the community structure actually
changed. That is a deliberate choice; if it becomes annoying, drop the
`graphify label .` line from `scripts/graphify-auto-update.sh` and let the
manual script own relabeling.

---

## Model and thinking

`.claude/graphify.env` sets `ANTHROPIC_MODEL=claude-sonnet-5` (graphify's own
default is older). **No patching is needed to get extended thinking** —
verified empirically against the live API on 2026-08-25: a Sonnet 5 call with
the `thinking` parameter *omitted entirely* still reported
`thinking_tokens=42`; passing `{"type":"adaptive"}` explicitly gave `99`.
Thinking is on by default for current Claude models.

This corrects an earlier working assumption. During initial setup (graphify
0.9.24) a local patch was applied to add the thinking parameter, which then
exposed a real crash: graphify read `resp.content[0].text`, but a thinking-
enabled response puts a `ThinkingBlock` first, which has no `.text`. That bug
was genuine and hit users who never requested thinking — upstream fixed it in
`_anthropic_response_text()` (their #2697). **Since 0.9.50, stock graphify
needs no local modification**; the repo carries no fork or patch file.

`--mode deep` is a separate, orthogonal lever: a more thorough extraction
*prompt* (richer INFERRED edges), unrelated to model or thinking.

---

## Security notes

**A real API key lives on disk** at `.claude/graphify.env` (chmod 600,
gitignored). This is a deliberate, explicitly-approved tradeoff for
unattended background refresh, and it is a **deviation from this project's own
credential principle** (R-MEM-06 / the encrypted `SecretsVault` + credential
broker that J.A.R.V.I.S. itself uses). It is acceptable here only because
graphify is dev tooling wholly outside the Z1 trust core — do not treat it as
precedent for kernel credentials. See D-0078.

To remove it: `rm .claude/graphify.env`. Everything degrades to local AST-only
graphs; nothing breaks.

**What leaves the machine:** with a key configured, the contents of changed
doc/image files are sent to the Anthropic API for semantic extraction. Code
files are parsed **locally** by tree-sitter and are not transmitted. With no
key, nothing leaves the machine at all. graphify makes no other network calls
during analysis (per its `SECURITY.md`, which we reviewed before adopting it).

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Graph never updates on edit | `./scripts/graphify-setup.sh --check` — usually the CLI or key is missing after a container restart |
| `graphify: command not found` | Re-run setup; ensure `~/.local/bin` is on `PATH` |
| Hook seems to do nothing | By design when unconfigured. Check `graphify-out/.hook-deep-update.log` |
| A run appears skipped | Non-blocking lock — another run was in flight. Expected under rapid edits |
| Costs higher than expected | Cold cache after a container restart forces full re-extraction |
| Graph looks stale | `GRAPH_REPORT.md` records the commit it was built from; compare to `git rev-parse HEAD` |

**Other editors:** only Claude Code is wired up. graphify ships its own
installers for Cursor (`graphify cursor install`), Gemini, Codex, and others —
none have been run here. `graphify hook install` also offers git-hook-based
(tool-agnostic) rebuilds, which we did not adopt.
