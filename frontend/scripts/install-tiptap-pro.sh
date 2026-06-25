#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -z "${TIPTAP_PRO_TOKEN:-}" ]]; then
  echo "Missing TIPTAP_PRO_TOKEN."
  echo "Get your token from https://cloud.tiptap.dev → My features → Pro Extensions"
  echo "Then run: TIPTAP_PRO_TOKEN=your-token npm run tiptap:pro"
  exit 1
fi

npm install \
  @tiptap-pro/extension-convert-kit \
  @tiptap-pro/extension-pages-tablekit \
  @tiptap-pro/extension-pages

echo "TipTap Pages installed. Set NEXT_PUBLIC_USE_TIPTAP_PAGES=true in .env and restart the dev server."
