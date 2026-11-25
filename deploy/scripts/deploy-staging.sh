#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/deploy/compose.staging.yaml"
ENV_FILE="${CINEHUNT_STAGING_ENV_FILE:-$HOME/.config/cinehunt/.env.staging}"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/cinehunt-staging"
TARGET_TAG="${1:-}"

if [[ ! "$TARGET_TAG" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: bash deploy/scripts/deploy-staging.sh <full-40-char-git-sha>" >&2
  exit 2
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing staging env file: $ENV_FILE" >&2
  exit 2
fi
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo "Docker Engine and Docker Compose plugin are required." >&2
  exit 2
fi

mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR"

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

wait_for_apps() {
  local attempt service container_id state health all_ready
  for attempt in $(seq 1 48); do
    all_ready=1
    for service in backend ai admin-web; do
      container_id="$(compose ps -q "$service" 2>/dev/null || true)"
      if [[ -z "$container_id" ]]; then
        all_ready=0
        break
      fi
      state="$(docker inspect -f '{{.State.Status}}' "$container_id" 2>/dev/null || true)"
      health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id" 2>/dev/null || true)"
      if [[ "$state" != "running" || "$health" != "healthy" ]]; then
        all_ready=0
      fi
    done
    if [[ "$all_ready" == "1" ]]; then
      return 0
    fi
    sleep 5
  done
  return 1
}

wait_http() {
  local url="$1" attempt
  for attempt in $(seq 1 30); do
    if curl --silent --show-error --fail --max-time 5 "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

apply_tag() {
  local tag="$1"
  export IMAGE_TAG="$tag"
  compose config --quiet || return 1
  compose pull || return 1
  compose up -d --no-build || return 1
  wait_for_apps || return 1
  wait_http "http://127.0.0.1:8080/" || return 1
  wait_http "http://127.0.0.1:9090/-/ready" || return 1
  wait_http "http://127.0.0.1:3001/api/health" || return 1
  return 0
}

PREVIOUS_CURRENT=""
if [[ -f "$STATE_DIR/current-image-tag" ]]; then
  PREVIOUS_CURRENT="$(tr -d '[:space:]' < "$STATE_DIR/current-image-tag")"
fi

echo "Deploying CineHunt staging image tag: $TARGET_TAG"
echo "Database target: configured externally; migrations remain disabled."
export IMAGE_TAG="$TARGET_TAG"

if ! apply_tag "$TARGET_TAG"; then
  echo "Deployment health checks failed."
  if [[ -n "$PREVIOUS_CURRENT" && "$PREVIOUS_CURRENT" != "$TARGET_TAG" ]]; then
    echo "Attempting automatic rollback to $PREVIOUS_CURRENT ..."
    if apply_tag "$PREVIOUS_CURRENT"; then
      printf '%s\n' "$TARGET_TAG" > "$STATE_DIR/previous-image-tag"
      printf '%s\n' "$PREVIOUS_CURRENT" > "$STATE_DIR/current-image-tag"
      echo "Automatic rollback succeeded."
    else
      echo "CRITICAL: automatic rollback also failed. Inspect: docker compose logs" >&2
    fi
  else
    echo "No previous healthy release is recorded; manual recovery is required."
  fi
  compose ps || true
  exit 1
fi

if [[ -n "$PREVIOUS_CURRENT" && "$PREVIOUS_CURRENT" != "$TARGET_TAG" ]]; then
  printf '%s\n' "$PREVIOUS_CURRENT" > "$STATE_DIR/previous-image-tag"
fi
printf '%s\n' "$TARGET_TAG" > "$STATE_DIR/current-image-tag"

echo
echo "DEPLOYMENT HEALTH CHECKS PASSED"
echo "Current image tag: $TARGET_TAG"
echo "Previous image tag: ${PREVIOUS_CURRENT:-none}"
compose ps
