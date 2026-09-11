#!/usr/bin/env bash
set -euo pipefail
rm -rf frontend/src frontend/public frontend/dist
python - <<'PY'
from zipfile import ZipFile
from pathlib import Path
p=Path('frontend/source.zip')
with ZipFile(p) as z:
    z.extractall('frontend')
PY
npm install --prefix frontend
npm run build --prefix frontend
pip install -r requirements.txt
