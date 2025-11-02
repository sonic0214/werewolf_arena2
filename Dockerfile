########################################
# Werewolf Arena unified Fly.io image  #
########################################

# --- Frontend build stage ---------------------------------------------------
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend

ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_WS_URL=ws://localhost:8000
ARG BACKEND_URL=http://127.0.0.1:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
ENV BACKEND_URL=${BACKEND_URL}

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .
RUN npm run build

# --- Backend dependency stage -----------------------------------------------
FROM python:3.11-alpine AS backend-builder
WORKDIR /app/backend

COPY backend/requirements.txt .
RUN pip install --upgrade pip \
    && pip wheel --wheel-dir /tmp/wheels -r requirements.txt

COPY backend/ .

# --- Final runtime image ----------------------------------------------------
FROM python:3.11-alpine
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    BACKEND_PORT=8000 \
    FRONTEND_PORT=3000 \
    BACKEND_URL=http://127.0.0.1:8000 \
    NEXT_PUBLIC_API_URL=/api \
    NEXT_PUBLIC_WS_URL=ws://localhost:8000

# Install backend dependencies from cached wheels.
COPY --from=backend-builder /tmp/wheels /tmp/wheels
COPY backend/requirements.txt /app/backend/requirements.txt

# Install Node.js and backend dependencies to avoid C++ ABI issues
RUN apk add --no-cache nodejs npm bash \
    && pip install --no-cache-dir --upgrade pip \
    && pip install --no-index --find-links=/tmp/wheels -r /app/backend/requirements.txt

# Copy application code.
COPY --from=backend-builder /app/backend /app/backend
COPY --from=frontend-builder /app/frontend/.next/standalone /app/frontend
COPY --from=frontend-builder /app/frontend/.next/static /app/frontend/.next/static
COPY --from=frontend-builder /app/frontend/public /app/frontend/public
COPY scripts/start_combined.sh /app/start.sh

RUN chmod +x /app/start.sh

# Expose both ports; Fly will route 80/443 to 3000 by default.
EXPOSE 3000 8000

ENTRYPOINT ["/app/start.sh"]
