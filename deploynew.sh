#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
COMPOSE_FILE="$ROOT_DIR/docker-compose.prod.yml"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
PROJECT_NAME="${PROJECT_NAME:-halvaa}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required" >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required for the local frontend checks" >&2
  exit 1
fi
if [ ! -f "$ENV_FILE" ]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

cd "$ROOT_DIR"

echo "==> Checking locale JSON"
node - <<'NODE'
const fs = require("node:fs");
for (const locale of ["en", "fa", "ar", "zh"]) {
  JSON.parse(fs.readFileSync(`frontend/messages/${locale}.json`, "utf8"));
}
console.log("locale JSON is valid");
NODE

echo "==> Running frontend typecheck"
(cd frontend && npm run typecheck)

echo "==> Running frontend lint"
(cd frontend && npm run lint)

echo "==> Building frontend locally"
(cd frontend && npm run build)

echo "==> Building production backend and frontend images"
docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build backend frontend

echo "==> Starting production services"
docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --no-deps backend frontend

echo "==> Applying database migrations"
docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec backend alembic upgrade head

echo "==> Service status"
docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

echo "==> Health checks"
curl --fail --silent --show-error http://127.0.0.1:8000/health >/dev/null
curl --fail --silent --show-error http://127.0.0.1:3000/en >/dev/null
echo "deployment completed successfully"
