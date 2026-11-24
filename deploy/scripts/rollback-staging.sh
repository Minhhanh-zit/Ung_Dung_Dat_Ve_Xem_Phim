#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/cinehunt-staging"
PREVIOUS_FILE="$STATE_DIR/previous-image-tag"

if [[ ! -s "$PREVIOUS_FILE" ]]; then
  echo "No previous successful image tag is recorded." >&2
  exit 1
fi

PREVIOUS_TAG="$(tr -d '[:space:]' < "$PREVIOUS_FILE")"
if [[ ! "$PREVIOUS_TAG" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Previous image tag is invalid: $PREVIOUS_TAG" >&2
  exit 1
fi

echo "Rolling back CineHunt staging to $PREVIOUS_TAG"
bash "$SCRIPT_DIR/deploy-staging.sh" "$PREVIOUS_TAG"
