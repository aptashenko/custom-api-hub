#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-root@208.116.19.64}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/customer-hub-api}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
PM2_APP="${PM2_APP:-customer-hub-api}"
HEALTH_URL="${HEALTH_URL:-https://postgresql.deniz.estate/health}"

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
curl --fail --silent --show-error "$HEALTH_URL"
echo

echo "Deploy completed."
REMOTE_SCRIPT
