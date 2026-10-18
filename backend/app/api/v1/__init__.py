from fastapi import APIRouter

from app.api import auth, chat, catalog, procedures, diagnosis, learn, admin, feedback

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(chat.router)
api_router.include_router(catalog.router)
api_router.include_router(procedures.router)
api_router.include_router(diagnosis.router)
api_router.include_router(learn.router)
api_router.include_router(admin.router)
api_router.include_router(feedback.router)
