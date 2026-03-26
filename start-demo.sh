#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PIDS=()

cleanup() {
    printf "\nStopping all services...\n"
    for pid in "${PIDS[@]}"; do
        kill "$pid" 2>/dev/null && wait "$pid" 2>/dev/null || true
    done
    docker-compose down
    printf "All services stopped.\n"
    exit 0
}

trap cleanup INT TERM

printf "============================================\n"
printf "  Sentinel AI - Full SIEM Demo\n"
printf "============================================\n\n"

# ── 1. Start Docker containers ──────────────────────────────────
printf "[1/5] Starting Elasticsearch and Kibana...\n"
docker-compose up -d

# ── 2. Wait for Elasticsearch ───────────────────────────────────
printf "[2/5] Waiting for Elasticsearch...\n"
RETRIES=0
MAX_RETRIES=24
until curl -sf http://localhost:9200/_cluster/health >/dev/null 2>&1; do
    RETRIES=$((RETRIES + 1))
    if [ "$RETRIES" -ge "$MAX_RETRIES" ]; then
        printf "ERROR: Elasticsearch did not start within 120 seconds.\n"
        exit 1
    fi
    printf "       Waiting... (%d/%d)\n" "$RETRIES" "$MAX_RETRIES"
    sleep 5
done
printf "       Elasticsearch is ready.\n"

# ── 3. Launch services in background ────────────────────────────
printf "[3/5] Starting alert generator...\n"
python3 simulators/elastic_generator.py &
PIDS+=($!)

printf "[4/5] Starting triage agent (Elasticsearch mode)...\n"
python3 main.py --source elastic &
PIDS+=($!)

printf "[5/5] Starting web dashboard...\n"
(cd webapp && npm run dev) &
PIDS+=($!)

printf "\n============================================\n"
printf "  Sentinel AI is running!\n"
printf "\n"
printf "  Dashboard:     http://localhost:3000\n"
printf "  Kibana:        http://localhost:5601\n"
printf "  Elasticsearch: http://localhost:9200\n"
printf "============================================\n\n"
printf "Press Ctrl+C to stop all services...\n"

wait
