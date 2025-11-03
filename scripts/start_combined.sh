#!/usr/bin/env bash

set -euo pipefail

BACKEND_PORT="${PORT:-8000}"
NEXT_INTERNAL_PORT="${NEXT_INTERNAL_PORT:-3100}"

echo "🚀 Render environment detected"
echo "📡 Main (public) port: ${BACKEND_PORT}"
echo "🧠 Internal Next.js port: ${NEXT_INTERNAL_PORT}"

cleanup() {
  local exit_code=$?
  if [[ -n "${FRONTEND_PID:-}" ]] && kill -0 "${FRONTEND_PID}" 2>/dev/null; then
    kill "${FRONTEND_PID}" 2>/dev/null || true
  fi
  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
    kill "${BACKEND_PID}" 2>/dev/null || true
  fi
  wait || true
  return "${exit_code}"
}
trap cleanup EXIT

# Launch Next.js standalone server on internal port.
if [[ ! -f /app/frontend/.next/standalone/server.js ]]; then
  echo "❌ Next.js standalone build missing at /app/frontend/.next/standalone/server.js"
  exit 1
fi
cd /app/frontend/.next/standalone
PORT="${NEXT_INTERNAL_PORT}" HOSTNAME="127.0.0.1" node server.js &
FRONTEND_PID=$!
echo "✅ Next.js frontend started (PID: ${FRONTEND_PID})"

# Launch FastAPI backend on Render-provided port.
cd /app/backend
export PYTHONPATH=/app/backend:${PYTHONPATH:-}
export FRONTEND_BUILD_PATH=/app/frontend/.next/standalone
export FRONTEND_STATIC_PATH=/app/frontend/.next/static
export NEXT_SERVER_URL="http://127.0.0.1:${NEXT_INTERNAL_PORT}"

uvicorn src.api.app:app \
  --host 0.0.0.0 \
  --port "${BACKEND_PORT}" \
  --workers 1 &
BACKEND_PID=$!
echo "✅ FastAPI backend started (PID: ${BACKEND_PID})"

# Wait until either process exits. If one crashes, terminate the other.
wait -n "${BACKEND_PID}" "${FRONTEND_PID}"
