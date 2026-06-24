#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
COMPOSE_FILE="$ROOT_DIR/docker-compose.prod.yml"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
PROJECT_NAME="${PROJECT_NAME:-halvaa}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required" >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing env file: $ENV_FILE" >&2
  echo "Copy .env.prod.example to .env and fill real values first." >&2
  exit 1
fi

BACKEND_ENV_FILE=$(grep '^BACKEND_ENV_FILE=' "$ENV_FILE" | cut -d= -f2- || true)
if [ -z "$BACKEND_ENV_FILE" ]; then
  BACKEND_ENV_FILE="$ROOT_DIR/backend/.env"
elif [ "${BACKEND_ENV_FILE#./}" != "$BACKEND_ENV_FILE" ]; then
  BACKEND_ENV_FILE="$ROOT_DIR/${BACKEND_ENV_FILE#./}"
fi

if [ ! -f "$BACKEND_ENV_FILE" ]; then
  echo "Missing backend env file: $BACKEND_ENV_FILE" >&2
  echo "Copy backend/.env.production.example to your backend env path first." >&2
  exit 1
fi

cd "$ROOT_DIR"

echo "==> Building and starting containers"
docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build

echo "==> Running database migrations"
docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec backend alembic upgrade head

echo "==> Current service status"
docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

echo "==> Deployment command finished"
