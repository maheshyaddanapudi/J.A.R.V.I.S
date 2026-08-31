#!/usr/bin/env bash
# Snapshot the Longitude-XL run so it survives container reclamation and can be
# CONTINUED later (the world is generated against a fixed 1000-day LIFE, so a
# later `longitude_xl.py 1000` resumes at day N+1 on the identical ground truth).
#
# Preserves: the live kernel DB (schema+data, ciphertext intact), the harness
# checkpoint (state.json — teach queue, delivery/announcement ledgers, re-pins),
# every metric row, every raw quiz answer, and the run log.
#
# Usage: scripts/longitude_xl_preserve.sh [label]     (default label: day<N>)
set -euo pipefail

SRC=/tmp/longitude_xl
DB=postgres://jarvis:jarvis-dev-only@127.0.0.1:5432/jarvis_xl
DEST="$(cd "$(dirname "$0")/.." && pwd)/docs/verification/longitude_xl"

DAY=$(python3 -c "import json;print(json.load(open('$SRC/state.json'))['next_day']-1)" 2>/dev/null || echo unknown)
LABEL="${1:-day$DAY}"
mkdir -p "$DEST"

echo "[preserve] snapshotting Longitude-XL at day $DAY (label: $LABEL)"
pg_dump "$DB" | gzip -9 > "$DEST/jarvis_xl.sql.gz"
cp "$SRC/state.json"    "$DEST/state.json"
cp "$SRC/metrics.jsonl" "$DEST/metrics.jsonl"
cp "$SRC/quizzes.jsonl" "$DEST/quizzes.jsonl"
gzip -9 -c "$SRC/run.log" > "$DEST/run.log.gz"

CATALOG_HASH=$(python3 -c "
import importlib.util,sys
sys.argv=['x','1000']
s=importlib.util.spec_from_file_location('xl','$(cd "$(dirname "$0")" && pwd)/longitude_xl.py')
m=importlib.util.module_from_spec(s); s.loader.exec_module(m); print(m.CATALOG_HASH)" 2>/dev/null || echo unknown)

cat > "$DEST/README.md" <<EOF
# Longitude-XL snapshot — $LABEL (through simulated day $DAY)

Everything needed to CONTINUE this life, not just read about it. The world is
seeded against a fixed 1000-day horizon (\`LIFE = 1000\`, catalog hash
\`$CATALOG_HASH\`), so days $((DAY+1))–1000 are already determined; a later run
picks up exactly where this one stopped.

| File | What it is |
|---|---|
| \`jarvis_xl.sql.gz\` | full kernel database — memory (encrypted at rest, ciphertext preserved), preferences, episodes, embeddings, reasoning decisions, lab ledger, audit chain |
| \`state.json\` | harness checkpoint — next day, teach queue, per-fact delivery + flip-announcement ledgers, re-pin count |
| \`metrics.jsonl\` | one row per simulated day (memory counts, spend, latency, autotune, topics) |
| \`quizzes.jsonl\` | every quiz battery: per-fact records **and** raw model answers, for re-scoring under any rubric |
| \`run.log.gz\` | complete run log |

## Restore and continue

\`\`\`bash
# 1. database
psql "\$PGURL/postgres" -Atc "CREATE DATABASE jarvis_xl OWNER jarvis"
gunzip -c jarvis_xl.sql.gz | psql "\$PGURL/jarvis_xl"

# 2. harness state + evidence
mkdir -p /tmp/longitude_xl
cp state.json metrics.jsonl quizzes.jsonl /tmp/longitude_xl/
gunzip -c run.log.gz > /tmp/longitude_xl/run.log

# 3. bring up the embedder (768-dim) and the kernel on port 4160, then:
python3 scripts/longitude_xl.py 1000 2>&1 | tee -a /tmp/longitude_xl/run.log
\`\`\`

The harness refuses to start if the regenerated catalog hash does not match
\`state.json\`, so a code or seed drift can never silently rewrite this world's
ground truth. It also self-heals the embedder and halts rather than running
semantically blind (both guards added after real incidents — see the run record).

**Do not delete this directory to save space.** It is the only durable copy;
\`/tmp\` and the container's Postgres are ephemeral.
EOF

echo "[preserve] wrote $DEST ($(du -sh "$DEST" | cut -f1))"
