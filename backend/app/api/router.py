from fastapi import APIRouter

from app.api.routes import admin, auth, auth_zitadel, collaborators, contributions, explore, guestbook, media, memorials, store

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(auth_zitadel.router)
api_router.include_router(collaborators.router)
api_router.include_router(memorials.router)
api_router.include_router(explore.router)
api_router.include_router(guestbook.router)
api_router.include_router(guestbook.queue_router)
api_router.include_router(media.router)
api_router.include_router(store.router)
api_router.include_router(admin.router)
api_router.include_router(contributions.router)
api_router.include_router(contributions.queue_router)
