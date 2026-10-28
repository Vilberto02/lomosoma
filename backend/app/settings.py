"""Environment configuration. Never expose this object through an API."""
import os
from functools import lru_cache
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    environment: str
    database_url: str
    supabase_url: str
    supabase_key: str
    encryption_key: str
    allowed_origins: tuple[str, ...]
    allowed_hosts: tuple[str, ...]
    yape_qr_url: str
    yape_recipient: str
    proxy_secret: str

    @property
    def production(self):
        return self.environment == "production"


@lru_cache
def settings():
    from dotenv import load_dotenv
    load_dotenv()
    environment = os.getenv("APP_ENV", "development")
    if environment not in ("development", "testing", "production"):
        raise RuntimeError("APP_ENV must be development, testing or production")
    return Settings(
        environment=environment,
        database_url=os.getenv("DATABASE_URL", ""),
        supabase_url=os.getenv("SUPABASE_URL", "").rstrip("/"),
        supabase_key=os.getenv("SUPABASE_PUBLISHABLE_KEY", ""),
        encryption_key=os.getenv("SESSION_ENCRYPTION_KEY", ""),
        allowed_origins=tuple(x.strip() for x in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if x.strip()),
        allowed_hosts=tuple(x.strip() for x in os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1,testserver").split(",") if x.strip()),
        yape_qr_url=os.getenv("YAPE_QR_URL", ""),
        yape_recipient=os.getenv("YAPE_RECIPIENT", ""),
        proxy_secret=os.getenv("PROXY_SHARED_SECRET", ""),
    )
