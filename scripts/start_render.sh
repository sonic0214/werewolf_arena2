#!/usr/bin/env bash

set -euo pipefail

cleanup() {
  local exit_code=$?
  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
    kill "${BACKEND_PID}" 2>/dev/null || true
  fi
  wait || true
  return "${exit_code}"
}
trap cleanup EXIT

# Render single port configuration
# Render provides PORT environment variable (usually 3000)
MAIN_PORT="${PORT:-3000}"

echo "🚀 Starting Werewolf Arena for Render..."
echo "📡 Main port: ${MAIN_PORT}"

# For Render, we'll run only the backend API
# The frontend static files are served by FastAPI
cd /app/backend

# Set environment for backend to serve frontend
export PYTHONPATH=/app/backend:${PYTHONPATH:-}
export FRONTEND_BUILD_PATH=/app/frontend/.next/standalone
export FRONTEND_STATIC_PATH=/app/frontend/.next/static

# Launch FastAPI backend on Render's port
# 使用 --port 参数覆盖配置文件中的默认端口
uvicorn src.api.app:app \
  --host 0.0.0.0 \
  --port "${MAIN_PORT}" \
  --workers 1 &
BACKEND_PID=$!

echo "✅ Backend started on port ${MAIN_PORT}"
echo "🎮 Ready to serve requests!"

# Wait for backend process
wait "${BACKEND_PID}"