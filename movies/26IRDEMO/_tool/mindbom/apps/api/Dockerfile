FROM python:3.11-slim AS base

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf-2.0-0 \
        libffi-dev libcairo2 libglib2.0-0 shared-mime-info \
        libpangoft2-1.0-0 fonts-nanum && \
    rm -rf /var/lib/apt/lists/* && \
    fc-cache -f

RUN pip install --no-cache-dir uv

# --- Build stage ---
FROM base AS build
WORKDIR /app

COPY pyproject.toml uv.lock* ./
RUN uv sync --no-dev --frozen

COPY . .

# --- Production stage ---
FROM base AS production
WORKDIR /app

RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --home /home/appuser appuser

COPY --from=build --chown=appuser:appgroup /app /app

ENV UV_CACHE_DIR=/tmp/.uv-cache
USER appuser

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
