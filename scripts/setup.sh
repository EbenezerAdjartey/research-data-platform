#!/bin/bash
set -e

echo "=== Research Data Platform Setup ==="

# Install frontend dependencies
echo "Installing Node.js dependencies..."
pnpm install

# Set up Python virtual environment
echo "Setting up Python environment..."
cd apps/api
python -m venv .venv
source .venv/bin/activate || source .venv/Scripts/activate
pip install -r requirements.txt
cd ../..

# Start Docker services
echo "Starting PostgreSQL and Redis..."
docker compose -f docker/docker-compose.yml up -d

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
sleep 5

# Run database migrations
echo "Running database migrations..."
cd apps/api
alembic upgrade head
cd ../..

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To start development:"
echo "  Backend:  cd apps/api && uvicorn app.main:app --reload"
echo "  Frontend: pnpm dev:web"
echo "  Docker:   docker compose -f docker/docker-compose.yml up -d"
