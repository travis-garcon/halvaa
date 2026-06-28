import logging
from typing import cast
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, RedirectResponse
from sqlmodel import Session, select

from app.api.deps import get_db
from app.models.user import User
from lib import auth as zitadel_auth
from lib.config import zitadel_config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


def _not_implemented() -> JSONResponse:
    return JSONResponse(
        {"error": "Zitadel OAuth is not configured. Set ZITADEL_CLIENT_ID in .env"},
        status_code=501,
    )


@router.get("/signin", response_model=None)
async def signin(request: Request) -> RedirectResponse | JSONResponse:
    if not zitadel_auth.zitadel_enabled:
        return _not_implemented()
    callback = request.query_params.get("callbackUrl") or "/"
    request.session["post_login_url"] = callback
    redirect_uri = zitadel_config.ZITADEL_CALLBACK_URL
    resp = await zitadel_auth.oauth.zitadel.authorize_redirect(request, redirect_uri)
    return cast(RedirectResponse, resp)


@router.get("/callback", response_model=None)
async def callback(
    request: Request, db: Session = Depends(get_db)
) -> RedirectResponse | JSONResponse:
    if not zitadel_auth.zitadel_enabled:
        return _not_implemented()
    try:
        token = await zitadel_auth.oauth.zitadel.authorize_access_token(request)
        userinfo = await zitadel_auth.oauth.zitadel.userinfo(token=token)
    except Exception:
        logger.exception("OAuth callback failed")
        return RedirectResponse(
            "/?error=auth_failed", status_code=302
        )

    old = dict(request.session)
    request.session.clear()
    for k in ("post_login_url",):
        if k in old:
            request.session[k] = old[k]

    request.session["auth_session"] = {
        "user": dict(userinfo),
        "access_token": token.get("access_token"),
        "id_token": token.get("id_token"),
        "refresh_token": token.get("refresh_token"),
        "expires_at": token.get("expires_at"),
    }

    external_id = userinfo.get("sub", "")
    user = db.exec(select(User).where(User.external_id == external_id)).first()
    if not user:
        email = (userinfo.get("email") or f"{external_id}@zitadel.unknown")[:255]
        full_name = (
            userinfo.get("name")
            or userinfo.get("preferred_username")
            or email.split("@")[0]
        )[:255]
        user = User(
            external_id=external_id,
            email=email,
            full_name=full_name,
            hashed_password="",
            locale=userinfo.get("locale", "en")[:10],
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info("Created local user for Zitadel user %s", external_id)

    request.session["user_id"] = str(user.id)

    post_login = request.session.pop(
        "post_login_url", zitadel_config.ZITADEL_POST_LOGIN_URL
    )
    return RedirectResponse(post_login, status_code=302)


@router.post("/logout", response_model=None)
async def logout(request: Request) -> RedirectResponse | JSONResponse:
    if not zitadel_auth.zitadel_enabled:
        return _not_implemented()
    auth_session = request.session.get("auth_session")
    request.session.clear()
    id_token_hint = (
        auth_session.get("id_token") if auth_session else None
    )
    metadata = await zitadel_auth.oauth.zitadel.load_server_metadata()
    end_session = metadata.get("end_session_endpoint")
    if end_session and id_token_hint:
        params = {
            "post_logout_redirect_uri": zitadel_config.ZITADEL_POST_LOGOUT_URL,
            "id_token_hint": id_token_hint,
        }
        return RedirectResponse(
            f"{end_session}?{urlencode(params)}", status_code=302
        )
    return RedirectResponse(zitadel_config.ZITADEL_POST_LOGOUT_URL, status_code=302)
