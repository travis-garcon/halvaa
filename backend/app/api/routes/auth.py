from typing import Annotated, Any
import logging
from pathlib import Path
import re
import secrets
import shutil
from urllib.parse import urlencode, urlparse, parse_qsl, urlunparse

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select

from app.api.deps import get_current_user, get_db
from app.core.auth import create_access_token, hash_password, verify_password
from app.core.config import get_settings
from app.core.limiter import limiter
from app.models.auth_otp import AuthOtp
from app.models.base import utc_now
from app.models.enums import MediaType, UserRole
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    OtpStartRequest,
    OtpStartResponse,
    OtpVerifyRequest,
    RegisterRequest,
    TokenResponse,
    UserUpdateRequest,
    UserPublic,
)
from app.services.entitlements import get_account_entitlements
from app.services.media_processor import generate_webp_thumbnail
from app.services.otp import OtpDeliveryError, generate_otp_code, hash_otp_code, otp_expiry, send_otp_message, verify_otp_code
from app.services.upload_validator import validate_upload
from app.services.profile_completion import PROFILE_COMPLETION_FIELDS, missing_profile_fields, profile_is_complete

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()
logger = logging.getLogger(__name__)
def _user_to_public(user: User, session: Session | None = None) -> UserPublic:
    missing = missing_profile_fields(user)

    completed = len(PROFILE_COMPLETION_FIELDS) - len(missing)
    entitlements = get_account_entitlements(session, user) if session is not None else None
    return UserPublic(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        locale=user.locale,
        avatar_url=user.avatar_url,
        phone_number=user.phone_number,
        address=user.address,
        profile_completed=len(missing) == 0,
        locked_email=user.locked_email,
        locked_phone_number=user.locked_phone_number,
        profile_completion_percent=round((completed / len(PROFILE_COMPLETION_FIELDS)) * 100),
        missing_profile_fields=missing,
        entitlements={
            "memorial_limit": entitlements.memorial_limit if entitlements else 0,
            "memorials_used": entitlements.memorials_used if entitlements else 0,
            "memorials_remaining": entitlements.memorials_remaining if entitlements else 0,
            "custom_id_limit": entitlements.custom_id_limit if entitlements else 0,
            "custom_ids_used": entitlements.custom_ids_used if entitlements else 0,
            "custom_ids_remaining": entitlements.custom_ids_remaining if entitlements else 0,
        },
        is_superuser=user.is_superuser,
        role=user.role.value,
    )


def _normalize_otp_identifier(payload: OtpStartRequest) -> tuple[str, str | None, bool]:
    raw = (payload.identifier or str(payload.email or "")).strip()
    if not raw:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Email or phone number is required")
    if "@" in raw:
        return raw.lower(), payload.phone_number, False
    phone = re.sub(r"[^\d+]", "", raw)
    if len(phone) < 8:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Enter a valid email or phone number")
    synthetic_email = f"{phone.replace('+', '')}@phone.halvaa.local"
    return synthetic_email, phone, True


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.rate_limit_auth)
def register(
    request: Request,
    payload: RegisterRequest,
    session: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    existing = session.exec(select(User).where(User.email == payload.email)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        locale=payload.locale,
        hashed_password=hash_password(payload.password),
        profile_completed=True,
        locked_email=True,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    request.state.user_id = str(user.id)
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/otp/start", response_model=OtpStartResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.rate_limit_auth)
async def start_otp(
    request: Request,
    payload: OtpStartRequest,
    session: Annotated[Session, Depends(get_db)],
) -> OtpStartResponse:
    email, phone_number, use_phone_delivery = _normalize_otp_identifier(payload)
    user = session.exec(select(User).where(User.email == email)).first()
    is_new_user = user is None
    if user is not None:
        if payload.full_name and not user.full_name:
            user.full_name = payload.full_name
        if phone_number:
            user.phone_number = phone_number

    code = generate_otp_code()
    otp = AuthOtp(
        email=email,
        code_hash=hash_otp_code(code),
        full_name=payload.full_name or (user.full_name if user else None),
        locale=payload.locale,
        phone_number=phone_number or (user.phone_number if user else None),
        sms_provider=settings.sms_provider,
        expires_at=otp_expiry(),
        requested_by_ip=request.client.host if request.client else None,
        user_id=user.id if user else None,
    )
    session.add(otp)
    session.flush()
    try:
        delivery_provider = await send_otp_message(
            email=email,
            code=code,
            phone_number=otp.phone_number if use_phone_delivery else None,
        )
    except OtpDeliveryError as exc:
        session.rollback()
        logger.warning("OTP delivery failed for %s: %s", email, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not send verification code. Email or SMS delivery is not configured correctly.",
        ) from exc
    otp.sms_provider = delivery_provider
    session.add(otp)
    session.commit()
    return OtpStartResponse(
        otp_id=otp.id,
        delivery_provider=delivery_provider,
        expires_in_seconds=settings.otp_expire_minutes * 60,
        is_new_user=is_new_user,
        debug_code=code if delivery_provider == "console" and settings.environment != "production" else None,
    )


@router.post("/otp/verify", response_model=TokenResponse)
@limiter.limit(settings.rate_limit_auth)
async def verify_otp(
    request: Request,
    payload: OtpVerifyRequest,
    session: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    otp = session.get(AuthOtp, payload.otp_id)
    if otp is None or otp.consumed_at is not None or otp.expires_at < utc_now():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired code")
    otp.attempts += 1
    if otp.attempts > settings.otp_max_attempts:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many attempts")
    if not verify_otp_code(payload.code, otp.code_hash):
        session.add(otp)
        session.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired code")

    user = session.exec(select(User).where(User.email == otp.email)).first()
    if user is None:
        user = User(
            email=otp.email,
            full_name=otp.full_name or otp.email.split("@")[0],
            locale=otp.locale,
            phone_number=otp.phone_number,
            profile_completed=bool(otp.full_name),
            locked_email=True,
            locked_phone_number=bool(otp.phone_number),
            role=UserRole.USER,
        )
        session.add(user)
        session.flush()
    else:
        if otp.full_name and not user.full_name:
            user.full_name = otp.full_name
        if otp.phone_number and not user.phone_number:
            user.phone_number = otp.phone_number

    otp.consumed_at = utc_now()
    session.add(otp)
    session.commit()
    request.state.user_id = str(user.id)
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/login", response_model=TokenResponse)
@limiter.limit(settings.rate_limit_auth)
def login(
    request: Request,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    session: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    user = session.exec(select(User).where(User.email == form_data.username)).first()
    if user is None or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")
    request.state.user_id = str(user.id)
    return TokenResponse(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserPublic)
def me(
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserPublic:
    return _user_to_public(current_user, session)


@router.patch("/me", response_model=UserPublic)
def update_me(
    payload: UserUpdateRequest,
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserPublic:
    update_data = payload.model_dump(exclude_unset=True)
    if "email" in update_data and update_data["email"] != current_user.email:
        if current_user.locked_email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The sign-in email cannot be changed")
        existing = session.exec(select(User).where(User.email == update_data["email"], User.id != current_user.id)).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
        current_user.email = update_data["email"]

    if "phone_number" in update_data and update_data["phone_number"] != current_user.phone_number:
        if current_user.locked_phone_number:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The sign-in phone number cannot be changed")
        current_user.phone_number = update_data["phone_number"] or None

    if "full_name" in update_data and update_data["full_name"] is not None:
        current_user.full_name = update_data["full_name"]
    if "locale" in update_data and update_data["locale"] is not None:
        current_user.locale = update_data["locale"]
    if "avatar_url" in update_data:
        current_user.avatar_url = update_data["avatar_url"] or None
    if "address" in update_data:
        current_user.address = update_data["address"] or None

    current_user.profile_completed = profile_is_complete(current_user)
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return _user_to_public(current_user, session)


@router.post("/me/avatar", response_model=UserPublic)
async def upload_my_avatar(
    session: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    file: UploadFile = File(...),
) -> UserPublic:
    validated = await validate_upload(file)
    if validated.media_type != MediaType.IMAGE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Profile photo must be an image")

    avatar_dir = Path(settings.upload_dir) / "users" / str(current_user.id)
    shutil.rmtree(avatar_dir, ignore_errors=True)
    avatar_dir.mkdir(parents=True, exist_ok=True)
    avatar_bytes, _, _ = generate_webp_thumbnail(validated.content, 800)
    avatar_path = avatar_dir / "avatar.webp"
    avatar_path.write_bytes(avatar_bytes)

    relative_path = f"/uploads/users/{current_user.id}/avatar.webp?v={int(utc_now().timestamp())}"
    base_url = settings.public_api_base_url.rstrip("/")
    current_user.avatar_url = relative_path if urlparse(base_url).hostname in {"localhost", "127.0.0.1"} else f"{base_url}{relative_path}"
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return _user_to_public(current_user, session)


@router.get("/google/signin", response_model=None)
async def google_signin(request: Request) -> RedirectResponse | JSONResponse:
    if not settings.google_client_id or not settings.google_client_secret:
        callback = request.query_params.get("callbackUrl") or settings.google_post_login_url
        return RedirectResponse(_append_query(callback, {"auth_error": "google_not_configured"}), status_code=302)
    callback = request.query_params.get("callbackUrl") or settings.google_post_login_url
    state = secrets.token_urlsafe(24)
    request.session["post_login_url"] = callback
    request.session["google_oauth_state"] = state
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_callback_url,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
        "state": state,
    }
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}", status_code=302)


@router.get("/google/callback", response_model=None)
async def google_callback(
    request: Request,
    session: Annotated[Session, Depends(get_db)],
) -> RedirectResponse:
    post_login_url = request.session.pop("post_login_url", settings.google_post_login_url)
    expected_state = request.session.pop("google_oauth_state", None)
    received_state = request.query_params.get("state")
    code = request.query_params.get("code")
    if not code or not expected_state or not secrets.compare_digest(expected_state, received_state or ""):
        return RedirectResponse(_append_query(post_login_url, {"auth_error": "google_state"}), status_code=302)
    if not settings.google_client_id or not settings.google_client_secret:
        return RedirectResponse(_append_query(post_login_url, {"auth_error": "google_not_configured"}), status_code=302)

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": settings.google_callback_url,
                },
            )
            token_response.raise_for_status()
            google_token = token_response.json()
            userinfo_response = await client.get(
                "https://openidconnect.googleapis.com/v1/userinfo",
                headers={"Authorization": f"Bearer {google_token['access_token']}"},
            )
            userinfo_response.raise_for_status()
            userinfo: dict[str, Any] = userinfo_response.json()
    except Exception:
        logger.exception("Google OAuth callback failed")
        return RedirectResponse(_append_query(post_login_url, {"auth_error": "google_exchange"}), status_code=302)

    email = str(userinfo.get("email") or "").lower().strip()
    if not email:
        return RedirectResponse(_append_query(post_login_url, {"auth_error": "google_email"}), status_code=302)

    user = session.exec(select(User).where(User.email == email)).first()
    if user is None:
        user = User(
            email=email,
            full_name=str(userinfo.get("name") or email.split("@")[0]),
            locale="en",
            avatar_url=userinfo.get("picture"),
            external_id=f"google:{userinfo.get('sub')}",
            locked_email=True,
            profile_completed=False,
            role=UserRole.USER,
        )
        session.add(user)
        session.flush()
    else:
        if not user.external_id and userinfo.get("sub"):
            user.external_id = f"google:{userinfo.get('sub')}"
        if not user.avatar_url and userinfo.get("picture"):
            user.avatar_url = userinfo.get("picture")
        if user.full_name == user.email.split("@")[0] and userinfo.get("name"):
            user.full_name = str(userinfo["name"])
        session.add(user)

    session.commit()
    session.refresh(user)
    return RedirectResponse(_append_query(post_login_url, {"access_token": create_access_token(user.id), "auth_provider": "google"}), status_code=302)


def _append_query(url: str, params: dict[str, str]) -> str:
    parsed = urlparse(url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query.update(params)
    return urlunparse(parsed._replace(query=urlencode(query)))
