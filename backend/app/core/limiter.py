import sys

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from app.core.config import get_settings


def rate_limit_key(request: Request) -> str:
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return f"user:{user_id}"
    return get_remote_address(request)


settings = get_settings()
_storage_uri = "memory://" if "pytest" in sys.modules else settings.redis_url

limiter = Limiter(
    key_func=rate_limit_key,
    storage_uri=_storage_uri,
    default_limits=[settings.rate_limit_default],
)
