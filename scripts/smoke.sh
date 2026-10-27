#!/usr/bin/env bash
# Post-deploy smoke test (DEPLOY_FIX_TRD.md §4.3). Run after every deploy:
#   API=https://<service>.onrender.com WEB=https://<your-frontend>.vercel.app scripts/smoke.sh
set -euo pipefail

API="${API:-https://<your-render-service>.onrender.com}"
WEB="${WEB:-https://<your-frontend>.vercel.app}"
EMAIL="${EMAIL:-smoke-$(date +%s)@example.com}"

echo "1. Health"
curl -sf "$API/health" && echo

echo "2. CORS preflight from $WEB"
curl -si -X OPTIONS "$API/api/auth/login" \
  -H "Origin: $WEB" \
  -H 'Access-Control-Request-Method: POST' \
  | grep -iE "^HTTP|access-control-allow-origin" || true

echo "3. Register (expect 201)"
curl -s -o /tmp/siq-register.json -w "%{http_code}\n" \
  -X POST "$API/api/auth/register" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"Smoke Test\",\"email\":\"$EMAIL\",\"password\":\"smokepass1\"}"
cat /tmp/siq-register.json; echo

echo "4. Login (expect 200 + access_token)"
curl -s -o /tmp/siq-login.json -w "%{http_code}\n" \
  -X POST "$API/api/auth/login" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"smokepass1\"}"
grep -q access_token /tmp/siq-login.json && echo "login OK"

echo "Done. Then in the browser: sign in, reload (stays signed in), open /history directly, sign out."
