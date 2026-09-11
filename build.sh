#!/usr/bin/env bash
set -euo pipefail

pip install -r requirements.txt

rm -rf /tmp/dse-dashboard frontend/dist

git clone --depth 1 https://github.com/zahirulk92-maker/DSE-Market-Data-Dashboard.git /tmp/dse-dashboard

corepack enable || true
corepack prepare pnpm@10.4.1 --activate || npm install -g pnpm@10.4.1

cd /tmp/dse-dashboard
pnpm install --frozen-lockfile
pnpm --filter @workspace/dse-market-dashboard run build

cd "$RENDER_PROJECT_DIR"
mkdir -p frontend
cp -R /tmp/dse-dashboard/artifacts/dse-market-dashboard/dist frontend/dist

echo "Frontend build complete: frontend/dist"
