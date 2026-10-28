#!/usr/bin/env bash
set -euo pipefail

echo "==> Installing Python dependencies..."
pip install -r requirements.txt

echo "==> Building current frontend source (includes admin login)..."
corepack enable
corepack prepare pnpm@10.4.1 --activate
pnpm install --frozen-lockfile
pnpm --filter @workspace/dse-market-dashboard run build

test -f artifacts/dse-market-dashboard/dist/public/index.html
test -d artifacts/dse-market-dashboard/dist/public/assets
rm -rf frontend/dist
mkdir -p frontend/dist
cp -R artifacts/dse-market-dashboard/dist/public/. frontend/dist/
test -f frontend/dist/index.html
echo "==> Build finished successfully."
