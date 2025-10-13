.PHONY: help test build up down logs clean dev-proxy dev-web

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

test: ## Run all tests
	@./test.sh

build: ## Build all Docker images
	@cd compose && docker compose build

up: ## Start all services
	@cd compose && docker compose up -d
	@echo "Services starting..."
	@echo "Web UI: http://localhost:3000"
	@echo "Proxy: http://localhost:8080"
	@echo "Kafka Connect: http://localhost:8083"

down: ## Stop all services
	@cd compose && docker compose down

logs: ## Follow logs from all services
	@cd compose && docker compose logs -f

clean: ## Remove all containers and volumes
	@cd compose && docker compose down -v
	@echo "Cleaned up all containers and volumes"

dev-proxy: ## Run proxy in development mode
	@cd proxy && KAFKA_CONNECT_URL=http://localhost:8083 go run main.go

dev-web: ## Run web UI in development mode
	@cd web && npm run dev

test-proxy: ## Run proxy tests
	@cd proxy && go test -v

test-web: ## Build web UI
	@cd web && npm run build

sample-connector: ## Create a sample datagen connector
	@cd compose && ./create-sample-connector.sh

.DEFAULT_GOAL := help
