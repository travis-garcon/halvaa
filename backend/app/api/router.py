from fastapi import APIRouter

from app.api.routes import auth, auth_zitadel, collaborators, explore, guestbook, media, memorials

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(auth_zitadel.router)
api_router.include_router(collaborators.router)
api_router.include_router(memorials.router)
api_router.include_router(explore.router)
api_router.include_router(guestbook.router)
api_router.include_router(guestbook.queue_router)
api_router.include_router(media.router)
