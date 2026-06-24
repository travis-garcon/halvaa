import logging
import time
from typing import Any

from fastapi import Request
from fastapi.responses import RedirectResponse, Response

from lib.auth import oauth
from lib.config import zitadel_config

logger = logging.getLogger(__name__)


class RedirectError(Exception):
    def __init__(self, url: str) -> None:
        self.url = url
        super().__init__(f"Redirect to: {url}")


async def refresh_access_token(
    auth_session: dict[str, Any],
) -> dict[str, Any] | None:
    refresh_token = auth_session.get("refresh_token")
    if not refresh_token:
        logger.error("No refresh token available")
        auth_session["error"] = "RefreshAccessTokenError"
        return None

    try:
        metadata = await oauth.zitadel.load_server_metadata()
        token_endpoint = metadata.get("token_endpoint")

        resp = await oauth.zitadel.async_client.post(
            token_endpoint,
            data={
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            },
            auth=(
                oauth.zitadel.client_id,
                oauth.zitadel.client_secret,
            ),
        )
        resp.raise_for_status()
        new_token = resp.json()

        auth_session["access_token"] = new_token.get("access_token")
        auth_session["expires_at"] = new_token.get(
            "expires_at", int(time.time()) + 3600
        )
        auth_session["refresh_token"] = new_token.get(
            "refresh_token", refresh_token
        )
        auth_session["error"] = None
        return auth_session
    except Exception:
        logger.exception("Token refresh failed")
        auth_session["error"] = "RefreshAccessTokenError"
        return None


async def require_auth(request: Request) -> dict[str, Any]:
    session = request.session
    auth_session: dict[str, Any] | None = session.get("auth_session")

    if not auth_session or not auth_session.get("user"):
        callback = str(request.url)
        raise RedirectError(
            f"{zitadel_config.ZITADEL_DOMAIN}/auth/signin?callbackUrl={callback}"
        )

    if auth_session.get("error"):
        session.clear()
        callback = str(request.url)
        raise RedirectError(
            f"{zitadel_config.ZITADEL_DOMAIN}/auth/signin?callbackUrl={callback}"
        )

    expires_at = auth_session.get("expires_at")
    if expires_at and int(time.time()) >= expires_at:
        refreshed = await refresh_access_token(auth_session)
        if refreshed:
            session["auth_session"] = refreshed
            return refreshed

        session.clear()
        callback = str(request.url)
        raise RedirectError(
            f"{zitadel_config.ZITADEL_DOMAIN}/auth/signin?callbackUrl={callback}"
        )

    return auth_session


def redirect_exception_handler(
    _request: Request, exc: Exception
) -> Response:
    if not isinstance(exc, RedirectError):
        raise exc
    return RedirectResponse(url=exc.url, status_code=307)
