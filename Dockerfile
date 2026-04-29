# Stage 1: build frontend
FROM node:22-alpine AS frontend-builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app/frontend

COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ .
RUN pnpm vite build

# Stage 2: backend + static
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py db.py models.py ./
COPY alembic ./alembic
COPY alembic.ini .
COPY --from=frontend-builder /app/frontend/dist ./static

ENV DATABASE=/app/data/fitness_analytics.db
ENV STATIC_DIR=/app/static

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
