import uuid
from collections.abc import Generator
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlmodel import Session, select

from app.core.auth import decode_access_token
from app.core.database import get_session
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def get_db() -> Generator[Session, None, None]:
    yield from get_session()


def get_current_user_optional(
    session: Annotated[Session, Depends(get_db)],
    request: Request,
    token: Annotated[str | None, Depends(oauth2_scheme)] = None,
) -> User | None:
    # Prefer an explicit bearer token. A stale session cookie must not override
    # the account that the frontend just authenticated with OTP or password.
    if token:
        try:
            user_id = decode_access_token(token)
            user = session.get(User, user_id)
            if user and user.is_active:
                return user
        except JWTError:
            pass

    # Fall back to the Zitadel session cookie for browser-only sessions.
    try:
        user_id_str = request.session.get("user_id")
        if user_id_str:
            try:
                uid = uuid.UUID(user_id_str)
                user = session.get(User, uid)
                if user and user.is_active:
                    return user
            except (ValueError, AttributeError):
                pass
    except (AttributeError, KeyError):
        pass

    return None


def get_current_user(
    session: Annotated[Session, Depends(get_db)],
    request: Request,
    token: Annotated[str | None, Depends(oauth2_scheme)] = None,
) -> User:
    user = get_current_user_optional(session, request, token)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def set_request_user_id(user: User | None, request) -> None:
    if user is not None:
        request.state.user_id = str(user.id)
