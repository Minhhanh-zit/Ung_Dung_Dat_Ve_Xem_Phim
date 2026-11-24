#!/usr/bin/env bash
set -Eeuo pipefail

LOCAL_SQL_PORT="${LOCAL_SQL_PORT:-14332}"
PROXY_PORT="${PROXY_PORT:-14333}"
MAC_TAILSCALE_IP="${MAC_TAILSCALE_IP:-}"

if [[ -z "$MAC_TAILSCALE_IP" ]]; then
  if ! command -v tailscale >/dev/null 2>&1; then
    echo "Tailscale CLI not found. Install/sign in to Tailscale on this Mac first." >&2
    exit 1
  fi
  MAC_TAILSCALE_IP="$(tailscale ip -4 | head -n 1)"
fi

if [[ -z "$MAC_TAILSCALE_IP" ]]; then
  echo "Could not determine the Mac Tailscale IPv4 address." >&2
  exit 1
fi
if ! command -v socat >/dev/null 2>&1; then
  echo "Install socat first: brew install socat" >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI not found." >&2
  exit 1
fi
if [[ "$(docker inspect -f '{{.State.Running}}' cinehunt-sql-dev 2>/dev/null || true)" != "true" ]]; then
  echo "Expected existing container cinehunt-sql-dev is not running. No container was changed." >&2
  exit 1
fi
if ! docker port cinehunt-sql-dev 1433/tcp | grep -q "127.0.0.1:$LOCAL_SQL_PORT"; then
  echo "Expected cinehunt-sql-dev to publish 127.0.0.1:$LOCAL_SQL_PORT. Actual mapping:" >&2
  docker port cinehunt-sql-dev 1433/tcp >&2 || true
  exit 1
fi

echo "Proxying Tailscale $MAC_TAILSCALE_IP:$PROXY_PORT -> 127.0.0.1:$LOCAL_SQL_PORT"
echo "This is TCP forwarding only; it does not alter or restart SQL Server."
echo "Leave this terminal running. Press Ctrl+C to stop the proxy."
exec socat -d -d "TCP-LISTEN:$PROXY_PORT,bind=$MAC_TAILSCALE_IP,reuseaddr,fork" "TCP:127.0.0.1:$LOCAL_SQL_PORT"
