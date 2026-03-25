@echo off
echo Starting Sonnet AI Dashboard...
cd /d "%~dp0webapp"
start "Sonnet AI Dashboard" npm run dev
echo.
echo Dashboard running at http://localhost:3000
echo Close the other window or press Ctrl+C there to stop.
pause
