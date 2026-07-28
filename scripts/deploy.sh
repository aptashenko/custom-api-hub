#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-root@208.116.19.64}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/customer-hub-api}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
PM2_APP="${PM2_APP:-customer-hub-api}"
HEALTH_URL="${HEALTH_URL:-https://postgresql.deniz.estate/health}"

usage() {
  cat <<'USAGE'
Usage:
  scripts/deploy.sh [branch]
  scripts/deploy.sh --branch <branch>

Environment overrides:
  DEPLOY_HOST    Remote SSH host. Default: root@208.116.19.64
  DEPLOY_PATH    Remote project path. Default: /var/www/customer-hub-api
  DEPLOY_BRANCH  Branch to deploy. Default: main
  PM2_APP        PM2 app name. Default: customer-hub-api
  HEALTH_URL     Health check URL.

Examples:
  scripts/deploy.sh main
  scripts/deploy.sh looker-readonly-db-access
  scripts/deploy.sh --branch release/customer-hub
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    -b|--branch)
      if [ "$#" -lt 2 ]; then
        echo "Missing value for $1" >&2
        usage >&2
        exit 1
      fi
      DEPLOY_BRANCH="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
    *)
      if [ "${BRANCH_ARG_SET:-0}" = "1" ]; then
        echo "Only one branch argument is allowed." >&2
        usage >&2
        exit 1
      fi
      DEPLOY_BRANCH="$1"
      BRANCH_ARG_SET=1
      shift
      ;;
  esac
done

if ! git check-ref-format --branch "$DEPLOY_BRANCH" >/dev/null 2>&1; then
  echo "Invalid branch name: ${DEPLOY_BRANCH}" >&2
  exit 1
fi

SSH_OPTS=(
  -o StrictHostKeyChecking=accept-new
)

echo "Deploying ${DEPLOY_BRANCH} to ${DEPLOY_HOST}:${DEPLOY_PATH}"

ssh "${SSH_OPTS[@]}" "${DEPLOY_HOST}" \
  "DEPLOY_PATH='${DEPLOY_PATH}' DEPLOY_BRANCH='${DEPLOY_BRANCH}' PM2_APP='${PM2_APP}' HEALTH_URL='${HEALTH_URL}' bash -se" <<'REMOTE_SCRIPT'
set -Eeuo pipefail

cd "$DEPLOY_PATH"

echo "Checking remote repository state..."
if [ -n "$(git status --porcelain --untracked-files=no -- . ':(exclude)docker-compose.yml')" ]; then
  echo "Remote repository has uncommitted changes. Stop."
  git status --short -- . ':(exclude)docker-compose.yml'
  exit 1
fi

echo "Pulling latest code..."
git fetch origin "$DEPLOY_BRANCH"
git checkout "$DEPLOY_BRANCH"
git pull --ff-only origin "$DEPLOY_BRANCH"

echo "Installing dependencies..."
npm ci

echo "Building project..."
npm run build

echo "Running database migrations..."
npm run typeorm:migration:run

echo "Restarting PM2 app..."
if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP" --update-env
else
  pm2 start npm --name "$PM2_APP" -- run start:prod
fi
pm2 save

echo "Checking health endpoint..."
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl --fail --silent --show-error "$HEALTH_URL"; then
    echo
    break
  fi

  if [ "$attempt" -eq 10 ]; then
    echo "Health check failed after ${attempt} attempts."
    exit 1
  fi

  echo "Health check failed, retrying in 3 seconds..."
  sleep 3
done

echo "Deploy completed."
REMOTE_SCRIPT
