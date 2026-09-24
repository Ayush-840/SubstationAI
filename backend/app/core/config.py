from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path

from app.core.paths import DATA_DIR

# Repo-root .env so settings load regardless of the launch directory.
_ENV_FILE = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    # LLM
    LLM_PROVIDER: str = "gemini"
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    OLLAMA_MODEL: str = "llama3.1:8b"
    OLLAMA_BASE_URL: str = "http://localhost:11434"

    # Embeddings
    EMBED_MODEL: str = "BAAI/bge-small-en-v1.5"

    # Database
    DATABASE_URL: str = "sqlite:///./app.db"

    # JWT
    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440

    # ChromaDB
    CHROMA_PATH: str = str(DATA_DIR / "chroma")

    # Retrieval
    CONFIDENCE_THRESHOLD: float = 0.35
    TOP_K_VECTOR: int = 20
    TOP_K_BM25: int = 20
    TOP_K_RERANK: int = 6

    # Upload
    MAX_UPLOAD_MB: int = 25

    # Frontend
    FRONTEND_URL: str = "http://localhost:5173"

    # Logging
    LOG_LEVEL: str = "INFO"

    class Config:
        env_file = str(_ENV_FILE)
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()