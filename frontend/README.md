# DSE Market Dashboard frontend

This frontend source was adapted from the dashboard ZIP supplied for this project. The React/Vite source is stored in `source.zip` and is extracted during the Render build, then built into `frontend/dist` and served by FastAPI.

The dashboard calls the same-origin `/api/market/*` endpoints provided by `src/dse_collector/web.py`.
