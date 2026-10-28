"""Tests never call live Gemini/Supabase or connect to a configured production DB."""
import os
os.environ["APP_ENV"] = "testing"
os.environ["USE_MOCK_LLM"] = "1"
os.environ["DATABASE_URL"] = ""

import pytest
from cryptography.fernet import Fernet

from backend.app.settings import settings
from backend.app.storage import engine, metadata


@pytest.fixture(autouse=True)
def isolated_database(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{(tmp_path / 'accounts.db').as_posix()}")
    monkeypatch.setenv("SESSION_ENCRYPTION_KEY", Fernet.generate_key().decode())
    monkeypatch.setenv("YAPE_QR_URL", "/payments/test-qr.png")
    monkeypatch.setenv("YAPE_RECIPIENT", "Titular de pruebas")
    settings.cache_clear()
    engine.cache_clear()
    db = engine()
    metadata.create_all(db)
    yield
    db.dispose()
    engine.cache_clear()
    settings.cache_clear()
