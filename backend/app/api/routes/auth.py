from typing import Annotated
import logging
import re
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select

from app.api.deps import get_current_user, get_db
from app.core.auth import create_access_token, hash_password, verify_password
from app.core.config import get_settings
from app.core.limiter import limiter
from app.models.auth_otp import AuthOtp
from app.models.base import utc_now
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    OtpStartRequest,
    OtpStartResponse,
    OtpVerifyRequest,
    RegisterRequest,
    TokenResponse,
    UserPublic,
)
from app.services.otp import OtpDeliveryError, generate_otp_code, hash_otp_code, otp_expiry, send_otp_message, verify_otp_code

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()
logger = logging.getLogger(__name__)


def _normalize_otp_identifier(payload: OtpStartRequest) -> tuple[str, str | None]:
    raw = (payload.identifier or str(payload.email or "")).strip()
    if not raw:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Email or phone number is required")
    if "@" in raw:
        return raw.lower(), payload.phone_number
    phone = re.sub(r"[^\d+]", "", raw)
    if len(phone) < 8:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Enter a valid email or phone number")
    synthetic_email = f"{phone.replace('+', '')}@phone.halvaa.local"
    return synthetic_email, phone


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
    email, phone_number = _normalize_otp_identifier(payload)
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
        delivery_provider = await send_otp_message(email=email, code=code, phone_number=otp.phone_number)
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
def me(current_user: Annotated[User, Depends(get_current_user)]) -> UserPublic:
    return UserPublic.model_validate(current_user)


@router.get("/google/signin", response_model=None)
async def google_signin(request: Request) -> RedirectResponse | JSONResponse:
    if not settings.google_client_id:
        return JSONResponse(
            {"error": "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."},
            status_code=501,
        )
    callback = request.query_params.get("callbackUrl") or settings.google_post_login_url
    request.session["post_login_url"] = callback
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_callback_url,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}", status_code=302)


@router.get("/google/callback", response_model=None)
async def google_callback() -> JSONResponse:
    return JSONResponse(
        {"error": "Google OAuth callback is waiting for production credentials."},
        status_code=501,
    )
