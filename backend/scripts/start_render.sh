#!/usr/bin/env bash

set -euo pipefail

# Render provides port 10000 for web services
BACKEND_PORT="${PORT:-10000}"
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
STANDALONE_ROOT="/app/frontend/.next/standalone"
NEXT_SERVER_ENTRY="${NEXT_SERVER_ENTRY:-}"

if [[ -z "${NEXT_SERVER_ENTRY}" ]]; then
  for candidate in server.js server.mjs server.cjs index.js; do
    if [[ -f "${STANDALONE_ROOT}/${candidate}" ]]; then
      NEXT_SERVER_ENTRY="${candidate}"
      break
    fi
  done
fi

if [[ -z "${NEXT_SERVER_ENTRY}" ]]; then
  NEXT_SERVER_ENTRY="$(find "${STANDALONE_ROOT}" -maxdepth 2 -type f \( -name 'server.js' -o -name 'server.mjs' -o -name 'server.cjs' -o -name 'index.js' \) | head -n1 || true)"
  if [[ -n "${NEXT_SERVER_ENTRY}" ]]; then
    NEXT_SERVER_ENTRY="${NEXT_SERVER_ENTRY#${STANDALONE_ROOT}/}"
  fi
fi

if [[ -z "${NEXT_SERVER_ENTRY}" ]]; then
  echo "❌ Next.js standalone build entrypoint missing in ${STANDALONE_ROOT}"
  if [[ -d "${STANDALONE_ROOT}" ]]; then
    echo "📂 Contents of ${STANDALONE_ROOT}:"
    ls -al "${STANDALONE_ROOT}" || true
  else
    echo "📂 Standalone directory not found at ${STANDALONE_ROOT}"
    find /app/frontend -name "*.next" -type d || true
    echo "📂 All frontend contents:"
    ls -la /app/frontend || true
  fi
  exit 1
fi

cd "${STANDALONE_ROOT}"
echo "▶️ Using Next.js entrypoint: ${NEXT_SERVER_ENTRY}"
PORT="${NEXT_INTERNAL_PORT}" HOSTNAME="127.0.0.1" node "${NEXT_SERVER_ENTRY}" &
FRONTEND_PID=$!
echo "✅ Next.js frontend started (PID: ${FRONTEND_PID}) on port ${NEXT_INTERNAL_PORT}"

# Launch FastAPI backend on Render-provided port.
cd /app/backend
export PYTHONPATH=/app/backend:${PYTHONPATH:-}
export FRONTEND_BUILD_PATH=/app/frontend/.next/standalone
export FRONTEND_STATIC_PATH=/app/frontend/.next/static
export NEXT_SERVER_URL="http://127.0.0.1:${NEXT_INTERNAL_PORT}"

echo "🔧 Starting FastAPI backend on port ${BACKEND_PORT}..."
uvicorn src.api.app:app \
  --host 0.0.0.0 \
  --port "${BACKEND_PORT}" \
  --workers 1 &
BACKEND_PID=$!
echo "✅ FastAPI backend started (PID: ${BACKEND_PID}) on port ${BACKEND_PORT}"

# Wait until either process exits. If one crashes, terminate the other.
wait -n "${BACKEND_PID}" "${FRONTEND_PID}"
