#!/usr/bin/env bash
# End-to-end API test for the Phase 1 registration flow.
set -euo pipefail

API="${API_URL:-http://localhost:8080/api/v1}"
EMAIL="manual-test-$(date +%s)@example.com"
PASSWORD="password123"

echo "EUKOV Registration Flow — API Test"
echo "================================="
echo ""

echo "1. Health check"
HEALTH=$(curl -sf "$API/health")
echo "   $HEALTH"
[[ "$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")" == "healthy" ]] \
  || { echo "FAIL: backend not healthy"; exit 1; }
echo "   OK"
echo ""

echo "2. Register user ($EMAIL)"
REGISTER=$(curl -sf -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
echo "   $REGISTER"
USER_ID=$(echo "$REGISTER" | python3 -c "import sys,json; print(json.load(sys.stdin)['userId'])")
echo "   OK — userId: $USER_ID"
echo ""

echo "3. Fetch genres"
GENRES=$(curl -sf "$API/genres")
COUNT=$(echo "$GENRES" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['genres']))")
echo "   Found $COUNT genres"
[[ "$COUNT" -eq 8 ]] || { echo "FAIL: expected 8 genres"; exit 1; }
echo "   OK"
echo ""

echo "4. Save preferences (philosophy, history, science)"
PREFS=$(curl -sf -X POST "$API/user/preferences" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$USER_ID\",\"genres\":[\"philosophy\",\"history\",\"science\"]}")
echo "   $PREFS"
echo "   OK"
echo ""

echo "5. Verify preferences"
SAVED=$(curl -sf "$API/user/$USER_ID/preferences")
echo "   $SAVED"
SAVED_COUNT=$(echo "$SAVED" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['genres']))")
[[ "$SAVED_COUNT" -eq 3 ]] || { echo "FAIL: expected 3 saved genres"; exit 1; }
echo "   OK"
echo ""

echo "All API steps passed."
echo ""
echo "Manual UI test:"
echo "  Open http://localhost:3000/register"
echo "  Use a new email, password (8+ chars), pick genres, confirm dashboard."
