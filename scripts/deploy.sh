#!/usr/bin/env bash
# =============================================================================
# Research Data Platform — Docker Production Deploy Script
# =============================================================================
# Usage:
#   ./scripts/deploy.sh              # Build and start all services
#   ./scripts/deploy.sh --build      # Force rebuild images
#   ./scripts/deploy.sh --down       # Stop all services
#   ./scripts/deploy.sh --logs       # Tail logs
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/docker/docker-compose.prod.yml"

# Ensure .env file exists
if [ ! -f "$PROJECT_ROOT/.env" ]; then
  echo "ERROR: .env file not found at project root."
  echo "Copy .env.example to .env and fill in production values:"
  echo "  cp .env.example .env"
  exit 1
fi

# Export env vars for docker-compose
set -a
source "$PROJECT_ROOT/.env"
set +a

case "${1:-}" in
  --down)
    echo "Stopping services..."
    docker compose -f "$COMPOSE_FILE" down
    ;;
  --logs)
    docker compose -f "$COMPOSE_FILE" logs -f --tail=100
    ;;
  --build)
    echo "Building and starting services..."
    docker compose -f "$COMPOSE_FILE" up -d --build
    echo "Running database migrations..."
    docker compose -f "$COMPOSE_FILE" exec api alembic upgrade head
    echo "Deploy complete."
    ;;
  *)
    echo "Starting services..."
    docker compose -f "$COMPOSE_FILE" up -d
    echo "Running database migrations..."
    docker compose -f "$COMPOSE_FILE" exec api alembic upgrade head
    echo "Deploy complete."
    echo ""
    echo "Services:"
    echo "  Web:  http://localhost (or https://$DOMAIN)"
    echo "  API:  http://localhost:8000/api/docs"
    ;;
esac
