#!/usr/bin/env bash
# Run Phase 3 Playwright E2E with the same env as local backend (Build/.env).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FRONTEND="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ROOT/.env"
  set +a
fi

if [[ -f "$FRONTEND/tests/e2e/.env.e2e" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$FRONTEND/tests/e2e/.env.e2e"
  set +a
fi

cd "$FRONTEND"
exec npx playwright test tests/e2e/phase3-docket.spec.ts --project=chromium "$@"
