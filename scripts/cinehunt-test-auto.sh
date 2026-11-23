#!/usr/bin/env bash
# Automated CineHunt tests. No secrets printed, no SQL mutations, no payment confirmation.
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:---quick}"
case "$MODE" in --quick|--ui|--api|--all) ;; *) echo 'Usage: bash scripts/cinehunt-test-auto.sh [--quick|--ui|--api|--all]'; exit 2;; esac
if [ -x /opt/homebrew/opt/node@22/bin/node ]; then
  export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
fi
REPORT_PARENT="${CINEHUNT_REPORT_DIR:-$HOME/Projects/Cinehunt-Test-Reports}"
mkdir -p "$REPORT_PARENT" || exit 2
REPORT="$REPORT_PARENT/$(date +%Y%m%d_%H%M%S)_${MODE#--}"
mkdir -p "$REPORT"
SUMMARY="$REPORT/summary.md"
printf '# CineHunt - Automated Test Report\n\nRun: %s\nMode: %s\n\n| Check | Status |\n|---|---|\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$MODE" > "$SUMMARY"
FAIL=0
run(){
  name="$1"; dir="$2"; shift 2
  logfile="$REPORT/$(echo "$name" | tr ' /' '__').log"
  printf '\n===== %s =====\n' "$name"
  (cd "$ROOT/$dir" && "$@") > "$logfile" 2>&1
  exitcode=$?
  if [ "$exitcode" -eq 0 ]; then
    printf 'PASS %s\n' "$name"
    printf '| %s | PASS |\n' "$name" >> "$SUMMARY"
  else
    printf 'FAIL %s (exit %s)\n' "$name" "$exitcode"
    tail -n 20 "$logfile"
    printf '| %s | FAIL (%s) |\n' "$name" "$exitcode" >> "$SUMMARY"
    FAIL=$((FAIL+1))
  fi
}
if [ "$MODE" = '--quick' ] || [ "$MODE" = '--all' ]; then
  run 'Git diff' '.' git diff --check
  run 'Backend typecheck' backend ./node_modules/.bin/tsc --noEmit --incremental false
  run 'Backend tests' backend npm test
  run 'Backend lint' backend npm run lint
  run 'Backend build' backend npm run build
  run 'Admin build' admin-web npm run build
  run 'Mobile typecheck' mobile npm run typecheck
  run 'Mobile lint' mobile npm run lint:active
  run 'Mobile tests' mobile npm test
fi
if [ "$MODE" = '--ui' ] || [ "$MODE" = '--all' ]; then
  run 'Playwright Chromium' admin-web ./node_modules/.bin/playwright test --config playwright.smoke.config.ts
fi
if [ "$MODE" = '--api' ] || [ "$MODE" = '--all' ]; then
  run 'API read-only integration' '.' node scripts/cinehunt-api-smoke.cjs
  run 'API anonymous security read-only' '.' node scripts/cinehunt-api-security-smoke.cjs
fi
printf '\nReport: %s\n' "$SUMMARY"
if [ "$FAIL" -gt 0 ]; then
  printf '\nRESULT=FAIL (%s checks)\n' "$FAIL"; exit 1
fi
printf '\nRESULT=PASS\n'; exit 0
