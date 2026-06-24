import logging

from authlib.integrations.starlette_client import OAuth

from lib.config import zitadel_config
from lib.scopes import ZITADEL_SCOPES

logger = logging.getLogger(__name__)

oauth = OAuth()
zitadel_enabled: bool = False


def init_zitadel_oauth() -> None:
    global zitadel_enabled

    if not zitadel_config.ZITADEL_CLIENT_ID:
        logger.warning(
            "ZITADEL_CLIENT_ID not set — Zitadel OAuth is disabled. "
            "Auth routes will return 501 Not Implemented."
        )
        return

    oauth.register(
        name="zitadel",
        client_id=zitadel_config.ZITADEL_CLIENT_ID,
        client_secret=zitadel_config.ZITADEL_CLIENT_SECRET,
        server_metadata_url=(
            f"{zitadel_config.ZITADEL_DOMAIN}/.well-known/openid-configuration"
        ),
        client_kwargs={
            "scope": ZITADEL_SCOPES,
            "code_challenge_method": "S256",
        },
    )
    zitadel_enabled = True
    logger.info("Zitadel OAuth client initialized")
