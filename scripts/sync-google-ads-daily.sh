#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$APP_DIR"

ENV_FILE="${ENV_FILE:-${APP_DIR}/.env}"
if [ -f "$ENV_FILE" ]; then
  PORT="${PORT:-$(grep -E '^PORT=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)}"
  GOOGLE_ADS_CUSTOMER_IDS="${GOOGLE_ADS_CUSTOMER_IDS:-$(grep -E '^GOOGLE_ADS_CUSTOMER_IDS=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)}"
  GOOGLE_ADS_CUSTOMER_ID="${GOOGLE_ADS_CUSTOMER_ID:-$(grep -E '^GOOGLE_ADS_CUSTOMER_ID=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)}"
fi

PORT="${PORT:-3000}"
APP_URL="${APP_URL:-http://127.0.0.1:${PORT}}"
INSIGHTS_LOOKBACK_DAYS="${INSIGHTS_LOOKBACK_DAYS:-7}"
CLICKS_LOOKBACK_DAYS="${CLICKS_LOOKBACK_DAYS:-30}"
CLICKS_CHUNK_DAYS="${CLICKS_CHUNK_DAYS:-10}"
UNTIL="${UNTIL:-$(node -e "const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); console.log(d.toISOString().slice(0, 10))")}"
INSIGHTS_FROM="${INSIGHTS_FROM:-$(LOOKBACK_DAYS="$INSIGHTS_LOOKBACK_DAYS" node -e "const d = new Date(); d.setUTCDate(d.getUTCDate() - Number(process.env.LOOKBACK_DAYS || 7)); console.log(d.toISOString().slice(0, 10))")}"
CLICKS_FROM="${CLICKS_FROM:-$(LOOKBACK_DAYS="$CLICKS_LOOKBACK_DAYS" node -e "const d = new Date(); d.setUTCDate(d.getUTCDate() - Number(process.env.LOOKBACK_DAYS || 30)); console.log(d.toISOString().slice(0, 10))")}"
RUN_DICTIONARIES="${RUN_DICTIONARIES:-true}"
LOG_FILE="${LOG_FILE:-/tmp/google-ads-daily-sync.log}"

CUSTOMER_IDS_RAW="${GOOGLE_ADS_CUSTOMER_IDS:-${GOOGLE_ADS_CUSTOMER_ID:-}}"

if [ -z "${CUSTOMER_IDS_RAW:-}" ]; then
  echo "GOOGLE_ADS_CUSTOMER_ID or GOOGLE_ADS_CUSTOMER_IDS is empty. Set it in env or ${ENV_FILE}." >&2
  exit 1
fi

CUSTOMER_IDS_JSON="$(
  CUSTOMER_IDS_RAW="$CUSTOMER_IDS_RAW" node -e "const ids = (process.env.CUSTOMER_IDS_RAW || '').replace(/^[\"']|[\"']$/g, '').split(',').map((value) => value.trim().replaceAll('-', '')).filter(Boolean); if (ids.length === 0) process.exit(1); console.log(JSON.stringify(ids));"
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

date_add_days() {
  local date_value="$1"
  local days="$2"

  DATE_VALUE="$date_value" DAYS="$days" node -e "const d = new Date(process.env.DATE_VALUE + 'T00:00:00.000Z'); d.setUTCDate(d.getUTCDate() + Number(process.env.DAYS)); console.log(d.toISOString().slice(0, 10));"
}

date_min() {
  local left="$1"
  local right="$2"

  LEFT="$left" RIGHT="$right" node -e "console.log(process.env.LEFT <= process.env.RIGHT ? process.env.LEFT : process.env.RIGHT);"
}

sync_click_chunks() {
  local chunk_from="$CLICKS_FROM"

  while [ "$chunk_from" \< "$UNTIL" ] || [ "$chunk_from" = "$UNTIL" ]; do
    local chunk_to
    chunk_to="$(date_add_days "$chunk_from" "$((CLICKS_CHUNK_DAYS - 1))")"
    chunk_to="$(date_min "$chunk_to" "$UNTIL")"

    local clicks_payload
    clicks_payload="{\"customerIds\":${CUSTOMER_IDS_JSON},\"dateFrom\":\"${chunk_from}\",\"dateTo\":\"${chunk_to}\"}"
    local clicks_response
    clicks_response="$(request '/integrations/google-ads/sync/clicks' "$clicks_payload")"
    echo "$(timestamp) clicks ${chunk_from}..${chunk_to} ${clicks_response}"

    chunk_from="$(date_add_days "$chunk_to" 1)"
  done
}

{
  echo "$(timestamp) start app_url=${APP_URL} insights=${INSIGHTS_FROM}..${UNTIL} clicks=${CLICKS_FROM}..${UNTIL} customers=${CUSTOMER_IDS_JSON}"

  if [ "$RUN_DICTIONARIES" = "true" ]; then
    dictionaries_payload="{\"customerIds\":${CUSTOMER_IDS_JSON}}"
    dictionaries_response="$(request '/integrations/google-ads/sync/dictionaries' "$dictionaries_payload")"
    echo "$(timestamp) dictionaries ${dictionaries_response}"
  fi

  insights_payload="{\"customerIds\":${CUSTOMER_IDS_JSON},\"dateFrom\":\"${INSIGHTS_FROM}\",\"dateTo\":\"${UNTIL}\"}"
  insights_response="$(request '/integrations/google-ads/sync/insights' "$insights_payload")"
  echo "$(timestamp) insights ${insights_response}"

  sync_click_chunks

  echo "$(timestamp) finish success"
} >> "$LOG_FILE" 2>&1
