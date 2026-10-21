from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import get_settings
from app.db.session import engine, Base
from app.db.migrate import migrate_user_roles
from app.api import auth, chat, catalog, procedures, diagnosis, learn, admin, feedback
from app.api.v1 import api_router
from app.db.mongo import get_mongo, close_mongo, ensure_indexes

settings = get_settings()

# During the sprint both trees stay mounted: the legacy /api/... paths the
# frontend and the eval harness already call, and the /api/v1 tree the sprint
# is migrating to (TRD §3.5 — old paths keep working until Day 10).
LEGACY_ROUTERS = (
    auth.router,
    chat.router,
    catalog.router,
    procedures.router,
    diagnosis.router,
    learn.router,
    admin.router,
    feedback.router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    migrate_user_roles(engine)
    # One fast probe (1.5 s) at startup; get_mongo() returns None and backs off
    # while MongoDB is down so SQLite-backed requests are never stalled.
    mongo_db = await get_mongo()
    if mongo_db is not None:
        await ensure_indexes(mongo_db)
    yield
    await close_mongo()


app = FastAPI(
    title="SubstationIQ API",
    description="Intelligent chatbot for substation asset maintenance",
    version="1.0.0",
    lifespan=lifespan,
)

import os

# Allow the configured FRONTEND_URL plus any Vercel preview deployment.
_cors_origins = [settings.FRONTEND_URL]
_vercel_url = os.environ.get("VERCEL_URL", "")
if _vercel_url:
    _cors_origins.append(f"https://{_vercel_url}")
# Also allow the *.vercel.app wildcard for preview deployments.
_cors_origins.append("https://*.vercel.app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
for legacy_router in LEGACY_ROUTERS:
    app.include_router(legacy_router)


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "substationiq-api"}


@app.get("/")
def root():
    return {"message": "SubstationIQ API", "docs": "/docs"}
