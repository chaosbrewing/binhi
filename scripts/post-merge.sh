#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# This hook is only for the development workspace. Production schema
# changes belong to Replit Publish, never this script.
if [[ "${NODE_ENV:-}" == "production" || -n "${REPLIT_DEPLOYMENT:-}" ]]; then
  echo "Post-merge setup must run in the development workspace, not production." >&2
  exit 1
fi

npm ci --no-audit --no-fund
npm run db:migrate
npm run build
