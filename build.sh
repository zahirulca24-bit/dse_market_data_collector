#!/usr/bin/env bash
set -euo pipefail

echo "==> Step 1: Installing Python dependencies..."
pip install -r requirements.txt

echo "==> Step 2: Checking frontend assets..."
if [ -f "frontend/dist/index.html" ] && [ -d "frontend/dist/assets" ]; then
    echo "✓ Pre-built production frontend detected in frontend/dist. Skipping heavy Node.js build on cloud container."
else
    echo "Pre-built frontend not found. Falling back to build from source..."
    corepack enable || true
    corepack prepare pnpm@10.4.1 --activate || npm install -g pnpm@10.4.1 || true
    pnpm config set ignore-scripts false || true
    pnpm install --no-frozen-lockfile || true
    pnpm --filter @workspace/dse-market-dashboard run build || true
    rm -rf frontend/dist
    mkdir -p frontend/dist
    cp -R artifacts/dse-market-dashboard/dist/public/. frontend/dist/ || true
fi

echo "==> Build finished successfully!"
