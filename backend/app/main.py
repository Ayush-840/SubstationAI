from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import get_settings
from app.db.session import engine, Base
from app.api import auth, chat, catalog, procedures, diagnosis, learn, admin, feedback
from app.api.v1 import api_router
from app.db.mongo import get_mongo, close_mongo
from anyio import create_task_group
import anyio

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    # Warm a singleton Motor client at startup so the first request does not
    # pay connection-setup latency. The client is closed on shutdown.
    try:
        app.state.mongo = await get_mongo()
    except Exception:
        app.state.mongo = None

    global _MONGO_MIRROR_TG
    async with create_task_group() as tg:
        _MONGO_MIRROR_TG = tg
        app.state._mongo_mirror_tg = tg
        yield
        _MONGO_MIRROR_TG = None
    await close_mongo()


app = FastAPI(
    title="SubstationIQ API",
    description="Intelligent chatbot for substation asset maintenance",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "substationiq-api"}


@app.get("/")
def root():
    return {"message": "SubstationIQ API", "docs": "/docs"}
