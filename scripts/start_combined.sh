#!/usr/bin/env bash

set -euo pipefail

# Detect Render single-port deployment
if [[ -n "${PORT:-}" ]]; then
  MAIN_PORT="${PORT}"
  echo "🚀 Detected Render single-port environment"
  echo "📡 Main port: ${MAIN_PORT}"

  cd /app/backend
  export PYTHONPATH=/app/backend:${PYTHONPATH:-}
  export FRONTEND_BUILD_PATH=/app/frontend/.next/standalone
  export FRONTEND_STATIC_PATH=/app/frontend/.next/static

  exec uvicorn src.api.app:app \
    --host 0.0.0.0 \
    --port "${MAIN_PORT}" \
    --workers 1
fi

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

# Port configuration for Render deployment
# Render automatically sets PORT environment variable for the main service
export BACKEND_PORT="${BACKEND_PORT:-8000}"
export FRONTEND_PORT="${PORT:-3000}"

# Launch FastAPI backend.
cd /app/backend
uvicorn src.api.app:app --host 0.0.0.0 --port "${BACKEND_PORT}" &
BACKEND_PID=$!

# Launch Next.js frontend.
cd /app/frontend
PORT="${FRONTEND_PORT}" node server.js --hostname 0.0.0.0 --port "${FRONTEND_PORT}" &
FRONTEND_PID=$!

# Wait until either process exits. If one crashes, terminate the other.
wait -n "${BACKEND_PID}" "${FRONTEND_PID}"
