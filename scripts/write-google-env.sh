#!/usr/bin/env bash
set -euo pipefail

export PATH="/opt/homebrew/bin:/opt/homebrew/share/google-cloud-sdk/bin:${PATH:-}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"
FRONTEND_ENV="$ROOT/frontend/.env.local"
PROJECT_ID="eukov-drive"
KEY_RESOURCE="projects/1045117004627/locations/global/keys/ec167b5c-2006-46dc-9351-cb8bc0905628"
PROJECT_NUMBER="1045117004627"
CLIENT_ID="${1:-}"

if [[ -z "$CLIENT_ID" ]]; then
  echo "Usage: $0 <oauth-client-id>"
  echo "Create a Web OAuth client at:"
  echo "https://console.cloud.google.com/apis/credentials/oauthclient?project=${PROJECT_ID}"
  exit 1
fi

API_KEY="$(gcloud services api-keys get-key-string "$KEY_RESOURCE" --project="$PROJECT_ID" --format='value(keyString)')"

upsert_env() {
  local key="$1" value="$2" file="$3"
  touch "$file"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i '' "s|^${key}=.*|${key}=${value}|" "$file"
  else
    printf '\n%s=%s\n' "$key" "$value" >>"$file"
  fi
}

upsert_env "NEXT_PUBLIC_GOOGLE_CLIENT_ID" "$CLIENT_ID" "$ENV_FILE"
upsert_env "NEXT_PUBLIC_GOOGLE_API_KEY" "$API_KEY" "$ENV_FILE"
upsert_env "NEXT_PUBLIC_GOOGLE_APP_ID" "$PROJECT_NUMBER" "$ENV_FILE"

cat >"$FRONTEND_ENV" <<EOF
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_GOOGLE_CLIENT_ID=$CLIENT_ID
NEXT_PUBLIC_GOOGLE_API_KEY=$API_KEY
NEXT_PUBLIC_GOOGLE_APP_ID=$PROJECT_NUMBER
EOF

echo "Saved Google Drive credentials."
