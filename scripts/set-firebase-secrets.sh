#!/usr/bin/env bash
# scripts/set-firebase-secrets.sh
#
# Sets all server-side secrets in Firebase Secret Manager.
# Run this ONCE after `firebase login` before deploying.
#
# Usage:
#   chmod +x scripts/set-firebase-secrets.sh
#   ./scripts/set-firebase-secrets.sh
#
# Each command prompts for the value (input is hidden).

set -e

PROJECT="settlement-sam-77db2"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  Settlement Sam — Firebase Secrets Setup ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Setting secrets for project: $PROJECT"
echo ""

echo "→ FIREBASE_PRIVATE_KEY (paste your service account private key, then press Enter)"
firebase functions:secrets:set FIREBASE_PRIVATE_KEY --project "$PROJECT"

echo ""
echo "→ FIREBASE_CLIENT_EMAIL (service account email)"
firebase functions:secrets:set FIREBASE_CLIENT_EMAIL --project "$PROJECT"

echo ""
echo "→ JWT_SECRET (64+ char random string)"
firebase functions:secrets:set JWT_SECRET --project "$PROJECT"

echo ""
echo "→ ADMIN_PASSWORD_HASH (bcrypt hash from npm run setup-admin)"
firebase functions:secrets:set ADMIN_PASSWORD_HASH --project "$PROJECT"

echo ""
echo "→ GMAIL_APP_PASSWORD (16-char Gmail app password)"
firebase functions:secrets:set GMAIL_APP_PASSWORD --project "$PROJECT"

echo ""
echo "→ STRIPE_SECRET_KEY (sk_live_... or sk_test_...)"
firebase functions:secrets:set STRIPE_SECRET_KEY --project "$PROJECT"

echo ""
echo "→ STRIPE_WEBHOOK_SECRET (whsec_...)"
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project "$PROJECT"

echo ""
echo "✅ All secrets set. Run 'firebase deploy' to deploy."
echo ""
