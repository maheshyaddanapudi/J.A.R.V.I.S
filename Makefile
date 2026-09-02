# J.A.R.V.I.S. — development entry points
# Full setup instructions: docs/DEVELOPMENT.md

SHELL := /bin/bash
COMPOSE := docker compose -f infra/docker-compose.yml

.PHONY: help preflight install infra infra-down db-up migrate dev kernel ui test typecheck

help:
	@echo "make preflight  - check bring-up prerequisites (docs/MAC_BRINGUP.md §0)"
	@echo "make install    - install JS deps (pnpm)"
	@echo "make infra      - start Postgres (+ 'make infra PROFILE=observability' adds Jaeger)"
	@echo "make infra-down - stop local infra (data volume preserved)"
	@echo "make db-up      - ensure Postgres is reachable (compose, else native fallback, else instructions)"
	@echo "make migrate    - apply database migrations (brings the DB up first)"
	@echo "make dev        - infra + migrate + kernel + command center"
	@echo "make test       - bring DB up + run all tests; FAILS on skipped tests (no silent green)"
	@echo "make typecheck  - typecheck all packages"

preflight:
	@# the script's own summary is the signal; '-' keeps a "missing prereq" exit
	@# from surfacing as a make error (run the script directly to get its exit code)
	-@bash scripts/mac_preflight.sh

install:
	pnpm install

infra:
	$(COMPOSE) $(if $(PROFILE),--profile $(PROFILE)) up -d --wait

infra-down:
	$(COMPOSE) down

# The DB bring-up ladder (CLAUDE.md "Database bring-up") lives in
# scripts/db_up.sh: Docker-first (starts the daemon with permission when a
# human is present, quietly attempts it when not), native-cluster fallback,
# offered direct install, else fail with instructions — never a silent skip.
db-up:
	@bash scripts/db_up.sh

migrate: db-up
	pnpm --filter @jarvis/kernel migrate

dev: infra migrate
	pnpm --filter @jarvis/kernel dev & \
	pnpm --filter @jarvis/command-center dev & \
	wait

kernel:
	pnpm --filter @jarvis/kernel dev

ui:
	pnpm --filter @jarvis/command-center dev

# Runs the suites only with a live DB, then REFUSES a "green" that contains
# skipped tests: vitest exits 0 while skipping every DB-dependent file when
# Postgres is down (silent-green incidents: 2026-08-28 x3). With the DB up the
# suite runs 100%, so any skip means something is wrong with the environment.
test: db-up
	@set -o pipefail; pnpm -r test 2>&1 | tee /tmp/jarvis-test-out.log; status=$$?; \
	if grep -qE "[1-9][0-9]* skipped" /tmp/jarvis-test-out.log; then \
	  echo ""; \
	  echo "ERROR: this run SKIPPED tests (see above). With Postgres up nothing"; \
	  echo "should skip — a skipped-but-exit-0 run is NOT green (CLAUDE.md rule)."; \
	  exit 1; \
	fi; \
	exit $$status

typecheck:
	pnpm -r typecheck
