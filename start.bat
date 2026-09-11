@echo off
echo =======================================
echo Starting DSE Market Data Collector...
echo =======================================

echo Starting Backend API...
start "DSE_Backend" cmd /c "set PYTHONPATH=src && python -m uvicorn dse_collector.web:app --host 127.0.0.1 --port 8000 --app-dir src"

echo Starting Frontend Dashboard...
start "DSE_Frontend" cmd /c "pnpm --filter @workspace/dse-market-dashboard run dev"

echo.
echo Both servers have been started in separate windows!
echo.
echo Backend API is running at: http://127.0.0.1:8000
echo Frontend Dashboard will be available at the URL shown in the Frontend window.
echo.
echo Note: Use stop.bat to stop both servers safely.
pause
