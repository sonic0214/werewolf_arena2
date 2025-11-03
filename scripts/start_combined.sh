#!/usr/bin/env bash

set -euo pipefail

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
DEFAULT_FRONTEND_ROOT="/app/frontend/.next/standalone"
declare -a FRONTEND_CANDIDATES=()
if [[ -n "${FRONTEND_BUILD_PATH:-}" ]]; then
  FRONTEND_CANDIDATES+=("${FRONTEND_BUILD_PATH}")
fi
FRONTEND_CANDIDATES+=("${DEFAULT_FRONTEND_ROOT}" "/app/frontend")

STANDALONE_ROOT=""
NEXT_SERVER_ENTRY_VALUE="${NEXT_SERVER_ENTRY:-}"
FOUND_ENTRY=""

for candidate_root in "${FRONTEND_CANDIDATES[@]}"; do
  if [[ ! -d "${candidate_root}" ]]; then
    continue
  fi

  STANDALONE_ROOT="${candidate_root}"
  candidate_entry="${NEXT_SERVER_ENTRY_VALUE}"

  if [[ -n "${candidate_entry}" ]]; then
    if [[ -f "${STANDALONE_ROOT}/${candidate_entry}" ]]; then
      FOUND_ENTRY="${candidate_entry}"
      break
    fi
  fi

  for entry in server.js server.mjs server.cjs index.js; do
    if [[ -f "${STANDALONE_ROOT}/${entry}" ]]; then
      FOUND_ENTRY="${entry}"
      break
    fi
  done
  if [[ -n "${FOUND_ENTRY}" ]]; then
    break
  fi

  found_path="$(find "${STANDALONE_ROOT}" -maxdepth 2 -type f \( -name 'server.js' -o -name 'server.mjs' -o -name 'server.cjs' -o -name 'index.js' \) | head -n1 || true)"
  if [[ -n "${found_path}" ]]; then
    FOUND_ENTRY="${found_path#${STANDALONE_ROOT}/}"
    break
  fi
done

if [[ -z "${FOUND_ENTRY}" || -z "${STANDALONE_ROOT}" ]]; then
  echo "❌ Next.js standalone build entrypoint missing."
  for candidate_root in "${FRONTEND_CANDIDATES[@]}"; do
    if [[ -d "${candidate_root}" ]]; then
      echo "📂 Contents of ${candidate_root}:"
      ls -al "${candidate_root}" || true
    else
      echo "📂 Directory not found: ${candidate_root}"
    fi
  done
  exit 1
fi

NEXT_SERVER_ENTRY="${FOUND_ENTRY}"

cd "${STANDALONE_ROOT}"
echo "▶️ Using Next.js entrypoint: ${NEXT_SERVER_ENTRY}"
PORT="${NEXT_INTERNAL_PORT}" HOSTNAME="127.0.0.1" node "${NEXT_SERVER_ENTRY}" &
FRONTEND_PID=$!
echo "✅ Next.js frontend started (PID: ${FRONTEND_PID})"

# Launch FastAPI backend on Render-provided port.
cd /app/backend
export PYTHONPATH=/app/backend:${PYTHONPATH:-}
export FRONTEND_BUILD_PATH="${STANDALONE_ROOT}"

DEFAULT_STATIC_PATH="/app/frontend/.next/static"
if [[ -n "${FRONTEND_STATIC_PATH:-}" && -d "${FRONTEND_STATIC_PATH}" ]]; then
  export FRONTEND_STATIC_PATH="${FRONTEND_STATIC_PATH}"
elif [[ -d "${DEFAULT_STATIC_PATH}" ]]; then
  export FRONTEND_STATIC_PATH="${DEFAULT_STATIC_PATH}"
elif [[ -d "${STANDALONE_ROOT}/.next/static" ]]; then
  export FRONTEND_STATIC_PATH="${STANDALONE_ROOT}/.next/static"
fi
export NEXT_SERVER_URL="http://127.0.0.1:${NEXT_INTERNAL_PORT}"

uvicorn src.api.app:app \
  --host 0.0.0.0 \
  --port "${BACKEND_PORT}" \
  --workers 1 &
BACKEND_PID=$!
echo "✅ FastAPI backend started (PID: ${BACKEND_PID})"

# Wait until either process exits. If one crashes, terminate the other.
wait -n "${BACKEND_PID}" "${FRONTEND_PID}"
