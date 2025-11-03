#!/usr/bin/env bash

set -euo pipefail

# Render single port configuration
# Render provides PORT environment variable (usually 3000)
MAIN_PORT="${PORT:-3000}"

echo "🚀 Starting Werewolf Arena for Render..."
echo "🔎 Detected PORT=${PORT:-<未设置>}, SERVER__PORT=${SERVER__PORT:-<未设置>}"
echo "📡 主服务端口: ${MAIN_PORT}"

# For Render, we'll run only the backend API
# The frontend static files are served by FastAPI
cd /app/backend

# Set environment for backend to serve frontend
export PYTHONPATH=/app/backend:${PYTHONPATH:-}
export FRONTEND_BUILD_PATH=/app/frontend/.next/standalone
export FRONTEND_STATIC_PATH=/app/frontend/.next/static

# Launch FastAPI backend on Render's port
# 使用 --port 参数覆盖配置文件中的默认端口
exec uvicorn src.api.app:app \
  --host 0.0.0.0 \
  --port "${MAIN_PORT}" \
  --workers 1
