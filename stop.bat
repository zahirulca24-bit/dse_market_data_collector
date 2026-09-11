@echo off
echo =======================================
echo Stopping DSE Market Data Collector...
echo =======================================

echo Closing Backend server...
taskkill /FI "WINDOWTITLE eq DSE_Backend*" /T /F >nul 2>&1

echo Closing Frontend server...
taskkill /FI "WINDOWTITLE eq DSE_Frontend*" /T /F >nul 2>&1

echo.
echo All servers stopped successfully!
pause
