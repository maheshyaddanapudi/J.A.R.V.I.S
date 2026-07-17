# J.A.R.V.I.S. — development entry points
# Full setup instructions: docs/DEVELOPMENT.md

SHELL := /bin/bash
COMPOSE := docker compose -f infra/docker-compose.yml

.PHONY: help install infra infra-down migrate dev kernel ui test typecheck

help:
	@echo "make install    - install JS deps (pnpm)"
	@echo "make infra      - start Postgres (+ 'make infra PROFILE=observability' adds Jaeger)"
	@echo "make infra-down - stop local infra (data volume preserved)"
	@echo "make migrate    - apply database migrations"
	@echo "make dev        - infra + migrate + kernel + command center"
	@echo "make test       - run all tests"
	@echo "make typecheck  - typecheck all packages"

install:
	pnpm install

infra:
	$(COMPOSE) $(if $(PROFILE),--profile $(PROFILE)) up -d --wait

infra-down:
	$(COMPOSE) down

migrate:
	pnpm --filter @jarvis/kernel migrate

dev: infra migrate
	pnpm --filter @jarvis/kernel dev & \
	pnpm --filter @jarvis/command-center dev & \
	wait

kernel:
	pnpm --filter @jarvis/kernel dev

ui:
	pnpm --filter @jarvis/command-center dev

test:
	pnpm -r test

typecheck:
	pnpm -r typecheck
