#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"
BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:3000/health}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE."
  exit 1
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

echo "Checking backend health: $BACKEND_URL"
curl -fsS "$BACKEND_URL"
echo
echo "All requested health checks completed."
