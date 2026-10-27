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

    # MongoDB
    MONGO_URL: str = "mongodb://mongo:27017"
    MONGO_DB: str = "substationiq"
    # Optional Atlas credentials (ignored if MONGO_URL is set)
    MONGODB_USERNAME: str | None = None
    MONGODB_PASSWORD: str | None = None
    MONGODB_URI: str | None = None

    # Environment: "development" (default) or "production". Production refuses
    # to start with the placeholder JWT secret (see assert_production_ready).
    APP_ENV: str = "development"

    # JWT — short-lived access token + rotating refresh token (see AUTH_TRD).
    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 15
    REFRESH_EXPIRE_DAYS: int = 7
    # A refresh token that is replayed within this many seconds of its first
    # use is treated as a client race (two tabs), not as theft.
    REFRESH_REUSE_GRACE_SECONDS: int = 10

    # Redis (optional): cache, deny-list, rate-limit storage. Empty = in-memory.
    REDIS_URL: str = ""

    # CORS: comma-separated exact origins; "*.example.app" wildcards allowed.
    CORS_ALLOW_ORIGIN_REGEX: str = ""
    CORS_ALLOW_ORIGINS: str = ""

    # Rate limits (slowapi syntax). Login/register are per client IP; the
    # failed-login throttle below is per (IP, email).
    RATE_LIMIT_LOGIN: str = "30/minute"
    RATE_LIMIT_REGISTER: str = "30/hour"
    RATE_LIMIT_CHAT: str = "30/minute"
    LOGIN_MAX_FAILURES: int = 5
    LOGIN_LOCKOUT_SECONDS: int = 900

    # Demo accounts (demo@, engineer@, admin@substationiq.dev) are created only
    # when this is true. Never enable it on a public deployment without
    # setting DEMO_PASSWORD_* overrides.
    SEED_DEMO_USERS: bool = False

    # ChromaDB (absolute default so the index resolves the same regardless of
    # the launch directory; docker-compose mounts ./data at /app/data)
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
        # Unknown keys in .env must not crash startup (the README tells users
        # to `cp .env.example .env`).
        extra = "ignore"

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.lower() == "production"

    def assert_production_ready(self) -> None:
        """Fail fast on unsafe production settings instead of running insecurely."""
        if not self.is_production:
            return
        problems = []
        if self.JWT_SECRET in ("", "change-me") or self.JWT_SECRET.startswith("change-this"):
            problems.append("JWT_SECRET is unset or still a placeholder")
        if len(self.JWT_SECRET) < 32:
            problems.append("JWT_SECRET must be at least 32 characters")
        if not self.CORS_ALLOW_ORIGINS and not self.CORS_ALLOW_ORIGIN_REGEX:
            problems.append("CORS_ALLOW_ORIGINS is empty (the browser frontend would be blocked)")
        if self.SEED_DEMO_USERS:
            problems.append("SEED_DEMO_USERS must be false in production")
        if problems:
            raise RuntimeError("Unsafe production configuration: " + "; ".join(problems))


@lru_cache()
def get_settings() -> Settings:
    return Settings()
