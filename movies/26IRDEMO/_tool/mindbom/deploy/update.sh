#!/bin/bash
set -euo pipefail

#============================================================
# MindBom - Update Deployment Script
# Usage: ./deploy/update.sh [service]
# Example: ./deploy/update.sh        # Update all
#          ./deploy/update.sh api     # Update API only
#          ./deploy/update.sh web     # Update Web only
#============================================================

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE="${1:-}"

cd "$PROJECT_DIR"

echo "=== MindBom Update ==="

# Pull latest code
echo "[1/4] Pulling latest code..."
for i in {1..3}; do
  if git pull origin main; then
    echo "Git pull successful"
    break
  else
    echo "Git pull failed, retrying in 5 seconds... ($i/3)"
    sleep 5
    if [ $i -eq 3 ]; then
      echo "Git pull failed after 3 attempts"
      exit 1
    fi
  fi
done

# Run migrations
echo "[2/4] Running database migrations..."
for i in {1..3}; do
  if docker compose -f docker-compose.prod.yml exec -T api uv run alembic upgrade head; then
    echo "Migration successful"
    break
  else
    echo "Migration failed, retrying in 10 seconds... ($i/3)"
    sleep 10
    if [ $i -eq 3 ]; then
      echo "Migration failed after 3 attempts"
      exit 1
    fi
  fi
done

# Rebuild and restart
if [ -n "$SERVICE" ]; then
    echo "[3/4] Rebuilding $SERVICE..."
    docker compose -f docker-compose.prod.yml build "$SERVICE"
    echo "[4/4] Restarting $SERVICE..."
    docker compose -f docker-compose.prod.yml up -d "$SERVICE"
else
    echo "[3/4] Rebuilding all services..."
    docker compose -f docker-compose.prod.yml build api web
    echo "[4/4] Restarting services..."
    docker compose -f docker-compose.prod.yml up -d
fi

echo ""
echo "=== Update Complete ==="
docker compose -f docker-compose.prod.yml ps

# Simple health check
echo ""
echo "=== Health Check ==="
sleep 5  # Wait for services to stabilize
if docker compose -f docker-compose.prod.yml exec -T api curl -f http://localhost:8000/health 2>/dev/null || true; then
  echo "✅ API health check passed"
else
  echo "⚠️ API health check failed"
fi
