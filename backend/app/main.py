from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import get_settings
from app.db.session import engine, Base
from app.db import models
from app.api import auth, chat, catalog, procedures, diagnosis, learn, admin, feedback

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="SubstationIQ API",
    description="Intelligent chatbot for substation asset maintenance",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(catalog.router)
app.include_router(procedures.router)
app.include_router(diagnosis.router)
app.include_router(learn.router)
app.include_router(admin.router)
app.include_router(feedback.router)


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "substationiq-api"}


@app.get("/")
def root():
    return {"message": "SubstationIQ API", "docs": "/docs"}