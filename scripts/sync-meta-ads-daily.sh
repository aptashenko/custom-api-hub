#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$APP_DIR"

ENV_FILE="${ENV_FILE:-${APP_DIR}/.env}"
if [ -f "$ENV_FILE" ]; then
  PORT="${PORT:-$(grep -E '^PORT=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)}"
  META_AD_ACCOUNT_IDS="${META_AD_ACCOUNT_IDS:-$(grep -E '^META_AD_ACCOUNT_IDS=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)}"
fi

PORT="${PORT:-3000}"
APP_URL="${APP_URL:-http://127.0.0.1:${PORT}}"
LOOKBACK_DAYS="${LOOKBACK_DAYS:-7}"
UNTIL="${UNTIL:-$(node -e "console.log(new Date().toISOString().slice(0, 10))")}"
SINCE="${SINCE:-$(node -e "const d = new Date(); d.setUTCDate(d.getUTCDate() - Number(process.env.LOOKBACK_DAYS || 7)); console.log(d.toISOString().slice(0, 10))")}"
RUN_DICTIONARIES="${RUN_DICTIONARIES:-true}"
ACTIVE_SCAN_CHUNK_DAYS="${ACTIVE_SCAN_CHUNK_DAYS:-30}"
LOG_FILE="${LOG_FILE:-/tmp/meta-ads-daily-sync.log}"

if [ -z "${META_AD_ACCOUNT_IDS:-}" ]; then
  echo "META_AD_ACCOUNT_IDS is empty. Set it in env or ${ENV_FILE}." >&2
  exit 1
fi

ACCOUNT_IDS_JSON="$(
  META_AD_ACCOUNT_IDS="$META_AD_ACCOUNT_IDS" node -e "const ids = (process.env.META_AD_ACCOUNT_IDS || '').replace(/^[\"']|[\"']$/g, '').split(',').map((value) => value.trim()).filter(Boolean); if (ids.length === 0) process.exit(1); console.log(JSON.stringify(ids));"
)"

request() {
  local path="$1"
  local payload="$2"

  curl --fail --silent --show-error \
    -X POST "${APP_URL}${path}" \
    -H 'Content-Type: application/json' \
    -d "$payload"
}

timestamp() {
  date '+%Y-%m-%dT%H:%M:%S%z'
}

{
  echo "$(timestamp) start app_url=${APP_URL} since=${SINCE} until=${UNTIL} accounts=${ACCOUNT_IDS_JSON}"

  if [ "$RUN_DICTIONARIES" = "true" ]; then
    dictionaries_payload="{\"accountIds\":${ACCOUNT_IDS_JSON}}"
    dictionaries_response="$(request '/integrations/meta-ads/sync/dictionaries' "$dictionaries_payload")"
    echo "$(timestamp) dictionaries ${dictionaries_response}"
  fi

  insights_payload="{\"accountIds\":${ACCOUNT_IDS_JSON},\"since\":\"${SINCE}\",\"until\":\"${UNTIL}\",\"chunkDays\":1,\"activeDaysOnly\":true,\"activeScanChunkDays\":${ACTIVE_SCAN_CHUNK_DAYS}}"
  insights_response="$(request '/integrations/meta-ads/sync/insights/history' "$insights_payload")"
  echo "$(timestamp) insights ${insights_response}"

  echo "$(timestamp) finish success"
} >> "$LOG_FILE" 2>&1
