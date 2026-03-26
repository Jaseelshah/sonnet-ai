@echo off
setlocal

echo ============================================
echo   Sentinel AI - Full SIEM Demo
echo ============================================
echo.

:: ── 1. Start Docker containers ──────────────────────────────────
echo [1/5] Starting Elasticsearch and Kibana...
docker-compose up -d
if %ERRORLEVEL% neq 0 (
    echo ERROR: Docker Compose failed. Is Docker running?
    pause
    exit /b 1
)

:: ── 2. Wait for Elasticsearch ───────────────────────────────────
echo [2/5] Waiting for Elasticsearch...
set RETRIES=0
set MAX_RETRIES=24
:wait_loop
if %RETRIES% geq %MAX_RETRIES% (
    echo ERROR: Elasticsearch did not start within 120 seconds.
    pause
    exit /b 1
)
curl -sf http://localhost:9200/_cluster/health >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo        Elasticsearch is ready.
    goto es_ready
)
set /a RETRIES+=1
echo        Waiting... (%RETRIES%/%MAX_RETRIES%)
timeout /t 5 /nobreak >nul
goto wait_loop
:es_ready

:: ── 3. Launch services in minimised windows ─────────────────────
echo [3/5] Starting alert generator...
start /min "Sentinel - Alert Generator" cmd /c "python simulators\elastic_generator.py"

echo [4/5] Starting triage agent (Elasticsearch mode)...
start /min "Sentinel - Triage Agent" cmd /c "python main.py --source elastic"

echo [5/5] Starting web dashboard...
start /min "Sentinel - Dashboard" cmd /c "cd webapp && npm run dev"

echo.
echo ============================================
echo   Sentinel AI is running!
echo.
echo   Dashboard:     http://localhost:3000
echo   Kibana:        http://localhost:5601
echo   Elasticsearch: http://localhost:9200
echo ============================================
echo.
echo Press any key to stop all services...
pause >nul

echo.
echo Stopping services...
taskkill /FI "WINDOWTITLE eq Sentinel - Alert Generator" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Sentinel - Triage Agent" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Sentinel - Dashboard" /F >nul 2>&1
docker-compose down
echo Done.
