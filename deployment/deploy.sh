#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Settlement Sam — Deployment Script
# Run from your LOCAL machine: ./deployment/deploy.sh
#
# Prerequisites:
#   1. SSH access to your VPS configured in ~/.ssh/config as "sam-vps"
#   2. Node.js 22+ and PM2 installed on the server
#   3. .env file present at /var/www/settlement-sam/.env on the server
#   4. nginx installed and configured (see nginx.conf)
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

REMOTE_HOST="sam-vps"                       # SSH alias from ~/.ssh/config
REMOTE_DIR="/var/www/settlement-sam"
BRANCH="${1:-main}"

echo "▶ Deploying Settlement Sam (branch: $BRANCH) to $REMOTE_HOST"

ssh "$REMOTE_HOST" bash -s << ENDSSH
  set -euo pipefail
  echo "── Pulling latest code ──"
  cd "$REMOTE_DIR"
  git fetch origin
  git checkout "$BRANCH"
  git pull origin "$BRANCH"

  echo "── Installing dependencies ──"
  npm ci --omit=dev

  echo "── Running database migration ──"
  npm run db:migrate

  echo "── Building Next.js ──"
  npm run build

  echo "── Reloading PM2 ──"
  pm2 reload deployment/ecosystem.config.js --env production --update-env

  echo "── Reloading nginx ──"
  sudo nginx -t && sudo systemctl reload nginx

  echo "✓ Deploy complete"
ENDSSH
