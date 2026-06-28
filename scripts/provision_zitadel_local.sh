#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-$ROOT_DIR/backend/.env.production}"
COMPOSE_FILE="$ROOT_DIR/docker-compose.prod.yml"
PROJECT_NAME="${PROJECT_NAME:-halvaa}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >&2
  exit 1
fi

PUBLIC_IP=$(awk -F= '/^ZITADEL_EXTERNALDOMAIN=/{print $2}' "$ENV_FILE" 2>/dev/null || true)
if [ -z "$PUBLIC_IP" ]; then
  PUBLIC_IP="46.249.101.229"
fi

ZITADEL_DOMAIN="http://$PUBLIC_IP:8080"
PAT_PATH_IN_CONTAINER="/pat/zitadel-admin.pat"
REDIRECT_URI="http://$PUBLIC_IP:8000/api/v1/auth/callback"
POST_LOGIN_URL="http://$PUBLIC_IP/"

wait_for_zitadel() {
  for _ in $(seq 1 60); do
    if curl -fsS "$ZITADEL_DOMAIN/debug/healthz" >/dev/null 2>&1; then
      return 0
    fi
    sleep 5
  done
  echo "Zitadel did not become healthy in time" >&2
  exit 1
}

read_pat() {
  for _ in $(seq 1 30); do
    if docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T zitadel sh -lc "test -s '$PAT_PATH_IN_CONTAINER'" >/dev/null 2>&1; then
      docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T zitadel sh -lc "cat '$PAT_PATH_IN_CONTAINER'"
      return 0
    fi
    sleep 2
  done
  echo "PAT file not found in container: $PAT_PATH_IN_CONTAINER" >&2
  exit 1
}

api() {
  local method=$1
  local path=$2
  local body=${3:-}
  if [ -n "$body" ]; then
    curl -fsS -X "$method" "$ZITADEL_DOMAIN$path" \
      -H "Authorization: Bearer $PAT" \
      -H "Content-Type: application/json" \
      -d "$body"
  else
    curl -fsS -X "$method" "$ZITADEL_DOMAIN$path" \
      -H "Authorization: Bearer $PAT"
  fi
}

cd "$ROOT_DIR"
mkdir -p "$ROOT_DIR/docker/zitadel/data"

docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d zitadel
wait_for_zitadel
PAT=$(read_pat)

PROJECT_PAYLOAD='{"name":"Halvaa","projectRoleAssertion":true,"projectRoleCheck":true,"hasProjectCheck":true,"privateLabelingSetting":"PRIVATE_LABELING_SETTING_ENFORCE_PROJECT_RESOURCE_OWNER_POLICY"}'
PROJECT_RESPONSE=$(api POST "/management/v1/projects" "$PROJECT_PAYLOAD")
PROJECT_ID=$(printf '%s' "$PROJECT_RESPONSE" | jq -r '.project.id')

APP_PAYLOAD=$(jq -nc \
  --arg name "Halvaa Web" \
  --arg redirect "$REDIRECT_URI" \
  --arg postLogout "$POST_LOGIN_URL" \
  '{
    name: $name,
    redirectUris: [$redirect],
    responseTypes: ["OIDC_RESPONSE_TYPE_CODE"],
    grantTypes: ["OIDC_GRANT_TYPE_AUTHORIZATION_CODE","OIDC_GRANT_TYPE_REFRESH_TOKEN"],
    appType: "OIDC_APP_TYPE_WEB",
    authMethodType: "OIDC_AUTH_METHOD_TYPE_BASIC",
    postLogoutRedirectUris: [$postLogout],
    version: "OIDC_VERSION_1_0",
    devMode: true,
    accessTokenType: "OIDC_TOKEN_TYPE_BEARER",
    accessTokenRoleAssertion: true,
    idTokenRoleAssertion: true,
    idTokenUserinfoAssertion: true,
    clockSkew: "1s",
    additionalOrigins: ["http://'"$PUBLIC_IP"'"]
  }')
APP_RESPONSE=$(api POST "/management/v1/projects/$PROJECT_ID/apps/oidc" "$APP_PAYLOAD")
CLIENT_ID=$(printf '%s' "$APP_RESPONSE" | jq -r '.appId')
CLIENT_SECRET=$(printf '%s' "$APP_RESPONSE" | jq -r '.clientSecret')

python3 - "$BACKEND_ENV_FILE" "$ZITADEL_DOMAIN" "$CLIENT_ID" "$CLIENT_SECRET" "$REDIRECT_URI" "$POST_LOGIN_URL" <<'PY'
from pathlib import Path
import sys

env_path = Path(sys.argv[1])
domain, client_id, client_secret, callback_url, post_login = sys.argv[2:]
values = {
    "ZITADEL_DOMAIN": domain,
    "ZITADEL_CLIENT_ID": client_id,
    "ZITADEL_CLIENT_SECRET": client_secret,
    "ZITADEL_CALLBACK_URL": callback_url,
    "ZITADEL_POST_LOGIN_URL": post_login,
    "ZITADEL_POST_LOGOUT_URL": post_login,
}
lines = env_path.read_text().splitlines()
seen = set()
new_lines = []
for line in lines:
    if "=" in line and not line.lstrip().startswith("#"):
        key = line.split("=", 1)[0]
        if key in values:
            new_lines.append(f"{key}={values[key]}")
            seen.add(key)
            continue
    new_lines.append(line)
for key, value in values.items():
    if key not in seen:
        new_lines.append(f"{key}={value}")
env_path.write_text("\n".join(new_lines) + "\n")
PY

echo "ZITADEL_DOMAIN=$ZITADEL_DOMAIN"
echo "ZITADEL_CLIENT_ID=$CLIENT_ID"
echo "ZITADEL_CLIENT_SECRET=$CLIENT_SECRET"
