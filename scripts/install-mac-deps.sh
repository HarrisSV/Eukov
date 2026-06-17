#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> EUKOV macOS dependency installer"
echo "    Project root: $ROOT"
echo

if ! command -v brew >/dev/null 2>&1; then
  echo "==> Installing Homebrew (you may be prompted for your password)..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

  if [[ -x /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -x /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
fi

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is not on PATH. Add it to your shell profile, then re-run this script."
  exit 1
fi

echo "==> Installing Go, Node.js 22, and Docker Desktop..."
brew install go node@22
brew install --cask docker

if ! docker info >/dev/null 2>&1; then
  echo
  echo "==> Starting Docker Desktop (first launch may take a minute)..."
  open -a Docker
  echo "Waiting for Docker to become ready..."
  for _ in $(seq 1 60); do
    if docker info >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not ready yet. Open Docker Desktop manually, then re-run this script."
  exit 1
fi

echo "==> Ensuring .env exists..."
if [[ ! -f .env ]]; then
  cp .env.example .env
fi

echo "==> Installing frontend dependencies..."
cd frontend
if [[ -x /opt/homebrew/opt/node@22/bin/npm ]]; then
  export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
fi
npm install
cd "$ROOT"

echo "==> Downloading Go modules..."
cd backend
go mod download
cd "$ROOT"

echo
echo "Done. Installed:"
go version
node --version
npm --version
docker --version
echo
echo "Next steps:"
echo "  docker compose up --build"
echo "  # or local dev:"
echo "  docker compose up postgres -d && docker compose run --rm migrate"
echo "  cd backend && set -a && source ../.env && set +a && go run ./cmd/server"
echo "  cd frontend && npm run dev"
