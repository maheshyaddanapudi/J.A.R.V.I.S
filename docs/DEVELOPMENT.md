# DEVELOPMENT — running J.A.R.V.I.S. locally

**Target machine:** the user's MacBook Pro (M3 Max, macOS 26). Development can happen
anywhere; **acceptance runs happen on the real Mac** (R-VER-04). Everything binds to
localhost; nothing is deployed to any cloud (R-LOC-01/03).

## Prerequisites (Mac)
- Node 22+, pnpm 10 (`corepack enable`)
- Docker Desktop or OrbStack (for Postgres + optional Jaeger)
- (from slice 1.2) [Ollama](https://ollama.com) — local models
- (from slice 1.3) Python 3.11+ managed with `uv` — speech services

## Quick start
```bash
make install   # pnpm install
make dev       # starts Postgres, applies migrations, runs kernel + Command Center
```
- Kernel: http://127.0.0.1:4150/health
- Command Center: http://127.0.0.1:4160 (live system page)

## Tests
```bash
make test        # all packages; kernel DB tests skip when Postgres is absent
make typecheck
```
Kernel integration tests use `JARVIS_TEST_DATABASE_URL`
(default `postgres://jarvis:jarvis-dev-only@127.0.0.1:5432/jarvis_test`):
```bash
docker exec jarvis-db createdb -U jarvis jarvis_test   # once
```

## Configuration (env vars, all optional in dev)
| Var | Default | Meaning |
|---|---|---|
| `JARVIS_ENV` | `dev` | dev/test/prod |
| `JARVIS_KERNEL_PORT` | `4150` | kernel HTTP port (loopback only, not configurable otherwise) |
| `JARVIS_DATABASE_URL` | local dev DSN | Postgres connection |
| `JARVIS_OTLP_ENDPOINT` | *(empty = disabled)* | OTLP HTTP endpoint, e.g. `http://127.0.0.1:4318` with `make infra PROFILE=observability` |
| `JARVIS_LOG_LEVEL` | `info` | kernel log level |
| `NEXT_PUBLIC_JARVIS_KERNEL_URL` | `http://127.0.0.1:4150` | Command Center → kernel |

## Notes
- The dev DB password is a compose default for localhost development only; real
  credentials belong in the macOS Keychain / encrypted vault (R-MEM-06) — never in env
  files committed to the repo.
- Migrations are immutable once applied (sha256-tracked); add new `NNNN_name.sql`
  files, never edit old ones.
