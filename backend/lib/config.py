import os
from urllib.parse import urlparse

from dotenv import load_dotenv

load_dotenv()


class ZitadelConfig:
    ZITADEL_DOMAIN: str = (
        urlparse(os.getenv("ZITADEL_DOMAIN", "http://localhost:8080")).scheme
        + "://"
        + urlparse(os.getenv("ZITADEL_DOMAIN", "http://localhost:8080")).netloc
    )
    ZITADEL_CLIENT_ID: str = os.getenv("ZITADEL_CLIENT_ID", "")
    ZITADEL_CLIENT_SECRET: str = os.getenv("ZITADEL_CLIENT_SECRET", "")
    ZITADEL_CALLBACK_URL: str = os.getenv(
        "ZITADEL_CALLBACK_URL",
        "http://localhost:3000/api/v1/auth/callback",
    )
    ZITADEL_POST_LOGIN_URL: str = os.getenv("ZITADEL_POST_LOGIN_URL", "/")
    ZITADEL_POST_LOGOUT_URL: str = os.getenv("ZITADEL_POST_LOGOUT_URL", "/")

    SESSION_SECRET: str = os.getenv("SESSION_SECRET", "insecure-dev-secret")
    SESSION_DURATION: int = int(os.getenv("SESSION_DURATION", "86400"))


zitadel_config = ZitadelConfig()
