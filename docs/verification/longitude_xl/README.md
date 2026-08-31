# Longitude-XL snapshot — day500 (through simulated day 500)

Everything needed to CONTINUE this life, not just read about it. The world is
seeded against a fixed 1000-day horizon (`LIFE = 1000`, catalog hash
`9206ceb12fd98ad6`), so days 501–1000 are already determined; a later run
picks up exactly where this one stopped.

| File | What it is |
|---|---|
| `jarvis_xl.sql.gz` | full kernel database — memory (encrypted at rest, ciphertext preserved), preferences, episodes, embeddings, reasoning decisions, lab ledger, audit chain |
| `state.json` | harness checkpoint — next day, teach queue, per-fact delivery + flip-announcement ledgers, re-pin count |
| `metrics.jsonl` | one row per simulated day (memory counts, spend, latency, autotune, topics) |
| `quizzes.jsonl` | every quiz battery: per-fact records **and** raw model answers, for re-scoring under any rubric |
| `run.log.gz` | complete run log |

## Restore and continue

```bash
# 1. database
psql "$PGURL/postgres" -Atc "CREATE DATABASE jarvis_xl OWNER jarvis"
gunzip -c jarvis_xl.sql.gz | psql "$PGURL/jarvis_xl"

# 2. harness state + evidence
mkdir -p /tmp/longitude_xl
cp state.json metrics.jsonl quizzes.jsonl /tmp/longitude_xl/
gunzip -c run.log.gz > /tmp/longitude_xl/run.log

# 3. bring up the embedder (768-dim) and the kernel on port 4160, then:
python3 scripts/longitude_xl.py 1000 2>&1 | tee -a /tmp/longitude_xl/run.log
```

The harness refuses to start if the regenerated catalog hash does not match
`state.json`, so a code or seed drift can never silently rewrite this world's
ground truth. It also self-heals the embedder and halts rather than running
semantically blind (both guards added after real incidents — see the run record).

**Do not delete this directory to save space.** It is the only durable copy;
`/tmp` and the container's Postgres are ephemeral.
