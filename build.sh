#!/usr/bin/env bash
set -euo pipefail

pip install -r requirements.txt

corepack enable || true
corepack prepare pnpm@10.4.1 --activate || npm install -g pnpm@10.4.1
pnpm config set ignore-scripts false
pnpm install --no-frozen-lockfile
pnpm --filter @workspace/dse-market-dashboard run build

rm -rf frontend/dist
mkdir -p frontend/dist
cp -R artifacts/dse-market-dashboard/dist/public/. frontend/dist/
echo "Frontend build complete: frontend/dist"
