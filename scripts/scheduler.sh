#!/bin/sh
set -u

: "${CRON_SECRET:?CRON_SECRET is required}"
APP_INTERNAL_URL="${APP_INTERNAL_URL:-http://app:3000}"
PUBLISH_INTERVAL_SECONDS="${PUBLISH_INTERVAL_SECONDS:-10}"
ANALYTICS_EVERY_N_RUNS="${ANALYTICS_EVERY_N_RUNS:-15}"

n=0
while true; do
  curl -fsS -X POST -H "Authorization: Bearer ${CRON_SECRET}" \
    "${APP_INTERNAL_URL}/api/v1/jobs/publish-due" >/dev/null || true

  n=$((n + 1))
  if [ $((n % ANALYTICS_EVERY_N_RUNS)) -eq 0 ]; then
    curl -fsS -X POST -H "Authorization: Bearer ${CRON_SECRET}" \
      "${APP_INTERNAL_URL}/api/v1/jobs/sync-analytics" >/dev/null || true
  fi

  sleep "${PUBLISH_INTERVAL_SECONDS}"
done
