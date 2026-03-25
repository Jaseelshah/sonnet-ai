#!/bin/bash
echo "Starting Sonnet AI Dashboard..."
cd "$(dirname "$0")/webapp" && npm run dev &
WEBAPP_PID=$!
echo ""
echo "Dashboard running at http://localhost:3000"
echo "Press Ctrl+C to stop"
trap "kill $WEBAPP_PID 2>/dev/null; exit" INT TERM
wait
