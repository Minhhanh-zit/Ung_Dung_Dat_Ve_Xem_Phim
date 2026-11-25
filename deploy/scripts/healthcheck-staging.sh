#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/deploy/compose.staging.yaml"
ENV_FILE="${CINEHUNT_STAGING_ENV_FILE:-$HOME/.config/cinehunt/.env.staging}"

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

echo "===== CONTAINER STATUS ====="
compose ps

echo
echo "===== APPLICATION HEALTH ====="
compose exec -T backend node -e "fetch('http://127.0.0.1:3000/health').then(async r=>{console.log('Backend:',r.status,await r.text());process.exit(r.status===200?0:1)}).catch(e=>{console.error(e);process.exit(1)})"
compose exec -T ai python -c "import urllib.request; r=urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=5); print('AI:', r.status, r.read().decode())"
curl -fsS http://127.0.0.1:8080/ >/dev/null
echo "Admin Web: HTTP 200"

echo
echo "===== MONITORING HEALTH ====="
curl -fsS http://127.0.0.1:9090/-/ready
echo "Prometheus: READY"
curl -fsS http://127.0.0.1:3001/api/health
echo
echo "Grafana: READY"

echo
echo "===== PROMETHEUS TARGETS ====="
python3 - <<'PY'
import json
import urllib.request

with urllib.request.urlopen("http://127.0.0.1:9090/api/v1/targets", timeout=10) as response:
    payload = json.load(response)

targets = payload.get("data", {}).get("activeTargets", [])
for target in targets:
    print(f"{target.get('health', 'unknown'):8} {target.get('labels', {}).get('job', '?'):20} {target.get('scrapeUrl', '')}")
if not targets or any(target.get("health") != "up" for target in targets):
    raise SystemExit("One or more Prometheus targets are not UP.")
PY

echo
echo "HEALTH CHECK: PASS"
