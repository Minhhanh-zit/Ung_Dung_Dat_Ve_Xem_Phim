#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE."
  exit 1
fi

echo "Stopping current CineHunt services..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" down

echo "Restarting services from existing local images..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --no-build
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
