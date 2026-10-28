"""Transactional persistence; SQLite is only supported for local tests."""
import hashlib
import time
from contextlib import contextmanager
from functools import lru_cache

from fastapi import HTTPException
from sqlalchemy import (MetaData, Table, Column, String, Text, Integer, BigInteger,
                        ForeignKey, CheckConstraint, create_engine, select, delete)
from sqlalchemy.engine import make_url
from backend.app.settings import settings

metadata = MetaData()
roles = Table("account_roles", metadata,
    Column("user_id", String(36), primary_key=True), Column("role", String(16), nullable=False),
    CheckConstraint("role IN ('admin')"))
sessions = Table("web_sessions", metadata,
    Column("id_hash", String(64), primary_key=True), Column("user_id", String(36), nullable=False),
    Column("email", String(254), nullable=False), Column("tokens", Text, nullable=False),
    Column("expires_at", BigInteger, nullable=False), Column("created_at", BigInteger, nullable=False))
orders = Table("payment_orders", metadata,
    Column("id", String(36), primary_key=True), Column("user_id", String(36), nullable=False, index=True),
    Column("plan_id", String(32), nullable=False), Column("loma_id", String(16)),
    Column("amount_centavos", Integer, nullable=False), Column("status", String(24), nullable=False),
    Column("operation_code", String(64)), Column("payment_date", String(10)),
    Column("reported_centavos", Integer), Column("reason", String(500)),
    Column("created_at", BigInteger, nullable=False), Column("reviewed_at", BigInteger),
    Column("reviewer_id", String(36)),
    CheckConstraint("status IN ('pendiente_pago','en_revision','aprobado','rechazado')"),
    CheckConstraint("amount_centavos > 0"))
operations = Table("verified_yape_operations", metadata,
    Column("operation_key", String(100), primary_key=True),
    Column("order_id", String(36), ForeignKey("payment_orders.id"), nullable=False, unique=True))
entitlements = Table("purchase_entitlements", metadata,
    Column("user_id", String(36), primary_key=True), Column("scope", String(16), primary_key=True),
    Column("order_id", String(36), ForeignKey("payment_orders.id"), nullable=False))
audit = Table("payment_audit", metadata,
    Column("id", String(36), primary_key=True), Column("order_id", String(36), ForeignKey("payment_orders.id")),
    Column("actor_id", String(36), nullable=False), Column("action", String(32), nullable=False),
    Column("created_at", BigInteger, nullable=False))
buckets = Table("request_buckets", metadata,
    Column("key", String(64), primary_key=True), Column("window", BigInteger, primary_key=True),
    Column("count", Integer, nullable=False), Column("expires_at", BigInteger, nullable=False, index=True))


@lru_cache
def engine():
    url = settings().database_url
    if not url:
        raise HTTPException(503, "Servicio de cuentas temporalmente no disponible")
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    if settings().production and not url.startswith("postgresql+psycopg://"):
        raise RuntimeError("Production requires PostgreSQL")
    if settings().production and make_url(url).query.get("sslmode") not in ("require", "verify-ca", "verify-full"):
        raise RuntimeError("Production requires PostgreSQL TLS")
    return create_engine(url, pool_pre_ping=True, hide_parameters=True)


@contextmanager
def transaction():
    with engine().begin() as connection:
        yield connection


def digest(value: str):
    return hashlib.sha256(value.encode()).hexdigest()


def rate_limit(scope: str, identity: str, limit: int, seconds: int = 60):
    """Atomic fixed windows shared by workers, no raw identifiers persisted."""
    if not settings().database_url:
        if settings().production:
            raise HTTPException(503, "Servicio temporalmente no disponible")
        return  # Local catalogue without account configuration.
    now = int(time.time())
    key, window = digest(f"{scope}:{identity}"), now // seconds
    with transaction() as conn:
        if conn.dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import insert
        else:
            from sqlalchemy.dialects.sqlite import insert
        statement = insert(buckets).values(key=key, window=window, count=1, expires_at=(window + 1) * seconds)
        count = conn.execute(statement.on_conflict_do_update(
            index_elements=[buckets.c.key, buckets.c.window],
            set_={"count": buckets.c.count + 1}).returning(buckets.c.count)).scalar_one()
        # Bound storage to the longest configured window (24 hours).
        conn.execute(delete(buckets).where(buckets.c.expires_at < now - 60))
    if count > limit:
        raise HTTPException(429, "Demasiados intentos. Inténtalo más tarde", headers={"Retry-After": str(seconds)})


def has_access(user_id: str | None, loma_id: str):
    if loma_id == "L0":
        return True
    if not user_id:
        return False
    with transaction() as conn:
        return conn.execute(select(entitlements.c.scope).where(
            entitlements.c.user_id == user_id,
            entitlements.c.scope.in_(["all", loma_id]))).first() is not None
