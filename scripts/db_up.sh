#!/usr/bin/env bash
# The DB bring-up ladder (CLAUDE.md "Database bring-up"), Docker-first:
#
#   already up            -> done
#   Docker daemon running -> compose up db (canonical)
#   Docker installed,     -> human present: ask permission, then start it
#     daemon not running  -> no TTY (agent/CI): attempt quietly, fall through
#   Docker not installed  -> native cluster if one exists (dev container)
#   nothing runnable      -> human present: offer a direct native install
#                            else: fail loudly with both options spelled out
#
# Never hangs without a TTY, never proceeds around a missing DB, and every
# fallback says what it did — a silent wrong path is worse than a stop.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

COMPOSE="docker compose -f infra/docker-compose.yml"
say() { echo "[db-up] $*"; }
db_ready() { pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; }
# a human is present only when stdin AND stdout are a terminal
interactive() { [ -t 0 ] && [ -t 1 ]; }

if db_ready; then say "Postgres: already up"; exit 0; fi

# ---- rung 1: Docker (canonical path)
if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    say "Docker daemon running — starting db via compose (canonical)…"
    $COMPOSE up -d --wait db && exit 0
    say "compose failed — continuing down the ladder"
  else
    try_daemon=""
    if interactive; then
      read -r -p "[db-up] Docker is installed but the daemon is not running. Start it now? [Y/n] " ans
      case "${ans:-Y}" in [Nn]*) say "ok — not starting Docker" ;; *) try_daemon=1 ;; esac
    else
      try_daemon=1 # no human to ask: attempt quietly, fall through on failure
    fi
    if [ -n "$try_daemon" ]; then
      say "attempting to start the Docker daemon…"
      started=""
      case "$(uname -s)" in
        Darwin) open --background -a Docker 2>/dev/null && started=1 ;;
        Linux)
          { systemctl start docker 2>/dev/null \
            || service docker start 2>/dev/null \
            || sudo -n systemctl start docker 2>/dev/null; } && started=1 ;;
      esac
      # only wait for the daemon if some starter actually succeeded — when
      # every starter failed (e.g. this dev container) a 30s wait is pure friction
      if [ -n "$started" ]; then
        for _ in $(seq 1 15); do docker info >/dev/null 2>&1 && break; sleep 2; done
      fi
      if docker info >/dev/null 2>&1; then
        say "Docker daemon up — starting db via compose…"
        $COMPOSE up -d --wait db && exit 0
        say "compose failed — continuing down the ladder"
      else
        say "Docker daemon did not come up (normal where it cannot run, e.g. this dev container) — continuing down the ladder"
      fi
    fi
  fi
else
  say "Docker not installed — the canonical setup uses it (docs/DEVELOPMENT.md); trying fallbacks"
fi

# ---- rung 2: existing native cluster (the remote dev container's stand-in)
if command -v pg_ctlcluster >/dev/null 2>&1; then
  say "starting native Postgres cluster (fallback)…"
  pg_ctlcluster 16 main start >/dev/null 2>&1 || true
  sleep 1
  if db_ready; then say "Postgres: up (native cluster)"; exit 0; fi
fi

# ---- rung 3: nothing runnable — offer a direct install if a human is present
if interactive && command -v apt-get >/dev/null 2>&1; then
  echo ""
  say "Postgres cannot be started here. Canonical fix: install/start Docker, then 'make infra'."
  read -r -p "[db-up] Or install Postgres natively via apt right now? [y/N] " ans
  case "$ans" in
    [Yy]*)
      (apt-get install -y postgresql-16 postgresql-16-pgvector 2>/dev/null \
        || sudo apt-get install -y postgresql-16 postgresql-16-pgvector) \
        || { say "apt install failed"; exit 1; }
      pg_ctlcluster 16 main start || true
      sleep 1
      if db_ready; then
        say "Postgres: up (fresh native install)."
        say "NOTE: a fresh install has no 'jarvis' role/databases yet — see docs/DEVELOPMENT.md."
        exit 0
      fi
      ;;
  esac
fi

echo ""
say "ERROR: Postgres is down and could not be started."
say "  canonical:   install/start Docker (Docker Desktop on the Mac), then: make infra"
say "  alternative: install Postgres natively (apt: postgresql-16 + postgresql-16-pgvector; brew on macOS), then re-run"
say "Human action needed before tests, migrations, or the kernel can run."
exit 1
