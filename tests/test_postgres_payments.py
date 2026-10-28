"""Real row-lock/RLS checks for the dedicated CI PostgreSQL database."""
import os
import time
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi import HTTPException
from sqlalchemy import text, select, func
from sqlalchemy.engine import make_url

from backend.app.api.routes_billing import review_order, ReviewRequest
from backend.app.auth import Account
from backend.app.settings import settings
from backend.app.storage import engine, metadata, orders, entitlements, audit, transaction


@pytest.mark.skipif(not os.getenv("TEST_POSTGRES_URL"), reason="Requires dedicated CI PostgreSQL")
def test_postgres_row_lock_and_rls(monkeypatch):
    url = os.environ["TEST_POSTGRES_URL"]
    assert make_url(url).database == "lomosoma_test", "Never run destructive integration setup against another database"
    monkeypatch.setenv("DATABASE_URL", url)
    settings.cache_clear()
    engine.cache_clear()
    db = engine()
    try:
        with db.begin() as conn:
            for role in ("anon", "authenticated"):
                conn.execute(text(f"DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='{role}') THEN CREATE ROLE {role}; END IF; END $$"))
        metadata.drop_all(db)
        with db.begin() as conn:
            conn.execute(text("DROP TABLE IF EXISTS alembic_version"))
        command.upgrade(Config("backend/alembic.ini"), "head")
        order_id, user_id = str(uuid4()), str(uuid4())
        with transaction() as conn:
            conn.execute(orders.insert().values(id=order_id, user_id=user_id, plan_id="loma_individual", loma_id="L1",
                amount_centavos=490, status="en_revision", operation_code="PG123456", payment_date="2026-10-22",
                reported_centavos=490, created_at=int(time.time())))
        admin = Account(str(uuid4()), "admin@example.com", True, "aal2", "unused")
        def approve(_):
            try:
                review_order(order_id, ReviewRequest(decision="aprobado", reason="Verificado en Yape"), admin)
                return 200
            except HTTPException as error:
                return error.status_code
        with ThreadPoolExecutor(max_workers=2) as pool:
            assert sorted(pool.map(approve, range(2))) == [200, 409]
        with transaction() as conn:
            assert conn.execute(select(func.count()).select_from(entitlements)).scalar() == 1
            assert conn.execute(select(func.count()).select_from(audit)).scalar() == 1
            for table in metadata.tables:
                assert conn.execute(text("SELECT relrowsecurity FROM pg_class WHERE relname=:name"), {"name": table}).scalar() is True
                assert not conn.execute(text("SELECT has_table_privilege('anon', :name, 'SELECT')"), {"name": table}).scalar()
                assert not conn.execute(text("SELECT has_table_privilege('authenticated', :name, 'SELECT')"), {"name": table}).scalar()
            assert conn.execute(text("SELECT has_table_privilege('lomosoma_api', 'account_roles', 'INSERT')")).scalar() is False
            assert conn.execute(text("SELECT has_table_privilege('lomosoma_api', 'payment_audit', 'DELETE')")).scalar() is False
    finally:
        db.dispose()
        engine.cache_clear()
        settings.cache_clear()
