.PHONY: help up down build rebuild logs clean db-migrate db-reset install

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-15s %s\n", $$1, $$2}'

install: ## Install root dependencies
	pnpm install

up: ## Start all services
	docker compose up

up-d: ## Start all services in detached mode
	docker compose up -d

down: ## Stop all services
	docker compose down

build: ## Build all services
	docker compose build

rebuild: ## Rebuild and start all services
	docker compose up --build

logs: ## Show logs for all services
	docker compose logs -f

logs-api: ## Show API logs
	docker compose logs -f api

logs-web: ## Show Web logs
	docker compose logs -f web

logs-db: ## Show PostgreSQL logs
	docker compose logs -f postgres

# Database commands
db-migrate: ## Run database migrations
	docker compose exec api uv run alembic upgrade head

db-reset: ## Reset database (WARNING: destroys all data)
	docker compose down -v
	docker compose up -d postgres
	@echo "Waiting for database to be ready..."
	@sleep 5
	docker compose up -d api
	docker compose exec api uv run alembic upgrade head

db-revision: ## Create new migration (usage: make db-revision MSG="description")
	docker compose exec api uv run alembic revision --autogenerate -m "$(MSG)"

# Service-specific commands
api-shell: ## Access API container shell
	docker compose exec api /bin/sh

web-shell: ## Access Web container shell
	docker compose exec web /bin/sh

db-shell: ## Access PostgreSQL shell
	docker compose exec postgres psql -U imomtae -d imomtae

# Cleanup commands
clean: ## Stop containers and remove volumes
	docker compose down -v

clean-all: ## Remove everything including images
	docker compose down -v --rmi all

restart: ## Restart all services
	docker compose restart

restart-api: ## Restart API service only
	docker compose restart api

restart-web: ## Restart Web service only
	docker compose restart web
