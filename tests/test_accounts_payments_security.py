import base64
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from unittest.mock import Mock
import time

import pytest
from alembic import command
from alembic.config import Config
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import select, update, func

from backend.app import auth
from backend.app.main import app
from backend.app.settings import settings
from backend.app.storage import transaction, orders, entitlements, audit, sessions, rate_limit, metadata, engine

BUYER = auth.Account("11111111-1111-4111-8111-111111111111", "buyer@example.com", False, "aal1", "unused")
OTHER = auth.Account("22222222-2222-4222-8222-222222222222", "other@example.com", False, "aal1", "unused")
ADMIN = auth.Account("33333333-3333-4333-8333-333333333333", "admin@example.com", True, "aal2", "unused")


@pytest.fixture
def client():
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


def as_user(account):
    app.dependency_overrides[auth.optional_account] = lambda: account


def create(client, plan="loma_individual", loma="L1"):
    payload = {"plan_id": plan}
    if plan == "loma_individual":
        payload["loma_id"] = loma
    result = client.post("/api/billing/orders", json=payload)
    assert result.status_code == 201, result.text
    return result.json()


def reference(client, order, code="TEST1234"):
    return client.post(f'/api/billing/orders/{order["id"]}/reference', json={
        "operation_code": code, "payment_date": date.today().isoformat(), "amount_pen": order["amount_pen"]})


@pytest.mark.parametrize("plan,loma", [("loma_individual", "L1"), ("pack_lima_pro", None)])
def test_only_manual_approval_grants_access(client, plan, loma):
    as_user(BUYER)
    order = create(client, plan, loma)
    assert order["status"] == "pendiente_pago"
    assert client.get("/api/lomas/L1/gpx").status_code == 403
    assert reference(client, order).json()["status"] == "en_revision"
    assert client.get("/api/billing/entitlements").json()["loma_ids"] == ["L0"]
    as_user(ADMIN)
    result = client.post(f'/api/billing/admin/orders/{order["id"]}/review', json={"decision": "aprobado", "reason": "Abono contrastado en Yape"})
    assert result.status_code == 200, result.text
    as_user(BUYER)
    assert client.get("/api/lomas/L1/gpx").status_code == 200
    assert client.get("/api/lomas/L2/gpx").status_code == (200 if plan == "pack_lima_pro" else 403)
    assert client.get("/api/billing/entitlements").json()["all_lima"] == (plan == "pack_lima_pro")
    with transaction() as conn:
        assert conn.execute(select(func.count()).select_from(audit)).scalar() == 2


def test_ownership_roles_mfa_and_self_approval(client):
    assert client.post("/api/billing/orders", json={"plan_id": "pack_lima_pro"}).status_code == 401
    as_user(BUYER)
    order = create(client)
    assert reference(client, order).status_code == 200
    url = f'/api/billing/admin/orders/{order["id"]}/review'
    assert client.post(url, json={"decision": "aprobado", "reason": "fake"}).status_code == 403
    as_user(OTHER)
    assert client.get(f'/api/billing/orders/{order["id"]}').status_code == 404
    assert reference(client, order).status_code == 404
    assert client.get("/api/billing/orders").json() == []
    as_user(auth.Account(ADMIN.id, ADMIN.email, True, "aal1", "unused"))
    assert client.get("/api/billing/admin/orders").status_code == 403
    as_user(auth.Account(BUYER.id, BUYER.email, True, "aal2", "unused"))
    assert client.post(url, json={"decision": "aprobado", "reason": "self"}).status_code == 403


def test_duplicate_operations_and_reviews_are_transactional(client):
    as_user(BUYER)
    first, second = create(client), create(client, loma="L2")
    assert reference(client, first).status_code == 200
    assert reference(client, second).status_code == 200
    as_user(ADMIN)
    payload = {"decision": "aprobado", "reason": "Contrastado"}
    first_url = f'/api/billing/admin/orders/{first["id"]}/review'
    assert client.post(first_url, json=payload).status_code == 200
    assert client.post(first_url, json=payload).status_code == 409
    assert client.post(f'/api/billing/admin/orders/{second["id"]}/review', json=payload).status_code == 409
    with transaction() as conn:
        assert conn.execute(select(orders.c.status).where(orders.c.id == second["id"])).scalar() == "en_revision"
        assert conn.execute(select(entitlements.c.scope)).scalars().all() == ["L1"]


def test_rejection_never_grants_access(client):
    as_user(BUYER)
    order = create(client)
    reference(client, order)
    as_user(ADMIN)
    assert client.post(f'/api/billing/admin/orders/{order["id"]}/review', json={"decision": "rechazado", "reason": "No se encontró el abono"}).status_code == 200
    as_user(BUYER)
    assert client.get("/api/lomas/L1/gpx").status_code == 403
    assert client.get("/api/billing/orders").json()[0]["status"] == "rechazado"


@pytest.mark.parametrize("payload", [
    {"plan_id": "pack_lima_pro", "metodo_pago": "tarjeta"},
    {"plan_id": "pack_lima_pro", "metodo_pago": "yape_plin"},
    {"plan_id": "pack_lima_pro", "amount_pen": 0.01},
    {"plan_id": "pack_lima_pro", "user_id": OTHER.id},
    {"plan_id": "loma_individual"}, {"plan_id": "loma_individual", "loma_id": "L0"},
    {"plan_id": "loma_individual", "loma_id": "L99"},
])
def test_client_cannot_choose_amount_identity_or_other_payment_method(client, payload):
    as_user(BUYER)
    assert client.post("/api/billing/orders", json=payload).status_code == 422


@pytest.mark.parametrize("endpoint", ["lomacast", "sendero", "gpx", "offline-pack"])
def test_premium_endpoints_and_nested_details_cannot_bypass_auth(client, endpoint):
    assert client.get(f"/api/lomas/L1/{endpoint}").status_code == 401
    assert client.get(f"/api/lomas/L0/{endpoint}").status_code == 200
    data = client.get("/api/lomas/L1").json()
    assert data["lomacast"] is None and data["sendero"] is None


def test_payments_fail_closed_without_real_configuration(client, monkeypatch):
    as_user(BUYER)
    monkeypatch.setenv("YAPE_QR_URL", "")
    settings.cache_clear()
    assert client.get("/api/billing/yape").status_code == 503
    assert client.post("/api/billing/orders", json={"plan_id": "pack_lima_pro"}).status_code == 503


def test_error_sanitizing_and_request_limits(client, monkeypatch):
    from backend.app.api import routes_optimize
    monkeypatch.setattr(routes_optimize.orchestrator, "run", Mock(side_effect=RuntimeError("private-key-and-user-data")))
    response = client.post("/api/optimize", json={"dias_disponibles": 1})
    assert response.status_code == 500
    assert "private-key" not in response.text
    assert response.headers["cache-control"] == "no-store"
    assert client.post("/api/optimize", json={"texto_usuario": "x" * 2001}).status_code == 422
    assert client.post("/api/optimize", json={"nodo_base": {"lat": 91, "lon": 0}}).status_code == 422
    assert client.post("/api/optimize", content=b"x" * 17000).status_code == 413
    assert client.post("/api/optimize", content=iter([b"x" * 9000, b"x" * 9000])).status_code == 413
    for _ in range(2): rate_limit("test", "person@example.com", 2)
    with pytest.raises(HTTPException) as exc: rate_limit("test", "person@example.com", 2)
    assert exc.value.status_code == 429


def test_rate_limit_is_atomic_across_connections():
    def attempt(_):
        try: rate_limit("parallel", "same", 3); return 200
        except HTTPException as exc: return exc.status_code
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(attempt, range(12)))
    assert results.count(200) == 3
    assert results.count(429) == 9


def test_origin_csrf_and_opaque_sessions(client, monkeypatch):
    token = "header." + base64.urlsafe_b64encode(json.dumps({"aal": "aal1"}).encode()).decode().rstrip("=") + ".signature"
    provider = Mock(return_value={"access_token": token, "refresh_token": "private-refresh-token", "expires_in": 3600,
                                  "user": {"id": BUYER.id, "email": BUYER.email}})
    monkeypatch.setattr(auth, "provider", provider)
    response = client.post("/api/auth/verify", json={"email": BUYER.email, "code": "123456"})
    assert response.status_code == 200, response.text
    assert "private-refresh-token" not in response.text and token not in response.text
    cookie = response.headers["set-cookie"]
    assert "HttpOnly" in cookie and "SameSite=lax" in cookie and "Path=/api" in cookie
    with transaction() as conn:
        stored = conn.execute(select(sessions)).mappings().one()
        assert "private-refresh-token" not in stored["tokens"]
        assert stored["id_hash"] != client.cookies.get(auth.COOKIE)
    assert client.post("/api/auth/logout").status_code == 403
    headers = {"X-CSRF-Token": response.json()["csrf_token"], "Origin": "https://attacker.invalid"}
    assert client.post("/api/auth/logout", headers=headers).status_code == 403
    headers["Origin"] = "http://localhost:5173"
    assert client.post("/api/auth/logout", headers=headers).status_code == 204
    with transaction() as conn:
        assert conn.execute(select(sessions)).first() is None


def test_invalid_or_expired_otp_does_not_create_session(client, monkeypatch):
    monkeypatch.setattr(auth, "provider", Mock(side_effect=HTTPException(401, "No se pudo validar el acceso")))
    assert client.post("/api/auth/verify", json={"email": BUYER.email, "code": "000000"}).status_code == 401
    with transaction() as conn: assert conn.execute(select(sessions)).first() is None


def test_expired_cookie_can_recover_and_sign_in_again(client):
    client.cookies.set(auth.COOKIE, "stale-cookie")
    response = client.get("/api/auth/session")
    assert response.status_code == 200
    assert response.json()["user"] is None
    assert response.json()["csrf_token"] == auth.csrf_for("stale-cookie")


def test_versioned_migration_matches_runtime_schema():
    metadata.drop_all(engine())
    command.upgrade(Config("backend/alembic.ini"), "head")
    from sqlalchemy import inspect
    inspector = inspect(engine())
    for table in metadata.tables.values():
        assert {c["name"] for c in inspector.get_columns(table.name)} == set(table.columns.keys())


def test_production_only_trusts_authenticated_proxy(client, monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("PROXY_SHARED_SECRET", "test-proxy-secret-at-least-32-characters")
    settings.cache_clear()
    assert client.get("/api/health").status_code == 200
    assert client.get("/api/lomas", headers={"X-Forwarded-For": "1.2.3.4"}).status_code == 403
    headers = {"x-lomosoma-proxy": settings().proxy_secret, "x-lomosoma-client-ip": "1.2.3.4"}
    response = client.get("/api/lomas", headers=headers)
    assert response.status_code == 200
    assert "test-proxy-secret" not in response.text
    assert "x-lomosoma-proxy" not in response.headers
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]
    assert client.get("/api/lomas", headers={"x-lomosoma-proxy": settings().proxy_secret, "x-lomosoma-client-ip": "fake"}).status_code == 400


def test_session_refresh_and_recovery_of_existing_orders(client, monkeypatch):
    claims = base64.urlsafe_b64encode(json.dumps({"aal": "aal1"}).encode()).decode().rstrip("=")
    access = f"header.{claims}.signature"
    login_data = {"access_token": access, "refresh_token": "old-refresh", "expires_in": 3600,
                  "user": {"id": BUYER.id, "email": BUYER.email}}
    renewed = {"access_token": access, "refresh_token": "rotated-refresh", "expires_in": 3600}
    def provider(method, path, body=None, access_token=None):
        if path == "verify": return login_data
        if path.startswith("token?"):
            assert body == {"refresh_token": "old-refresh"}
            return renewed
        if path == "user": return login_data["user"]
        raise AssertionError(path)
    monkeypatch.setattr(auth, "provider", provider)
    assert client.post("/api/auth/verify", json={"email": BUYER.email, "code": "123456"}).status_code == 200
    with transaction() as conn:
        conn.execute(update(sessions).values(expires_at=int(time.time()) - 1))
    response = client.get("/api/auth/session")
    assert response.status_code == 200
    assert response.json()["user"]["id"] == BUYER.id
    with transaction() as conn:
        row = conn.execute(select(sessions)).mappings().one()
        assert json.loads(auth.cipher().decrypt(row["tokens"].encode()))["refresh_token"] == "rotated-refresh"
    order = client.post("/api/billing/orders", json={"plan_id": "pack_lima_pro"},
                        headers={"X-CSRF-Token": response.json()["csrf_token"]})
    assert order.status_code == 201
    assert client.get("/api/billing/orders").json()[0]["id"] == order.json()["id"]


def test_interrupted_mfa_enrollment_can_be_restarted(client, monkeypatch):
    as_user(auth.Account(ADMIN.id, ADMIN.email, True, "aal1", "unused"))
    pending_id = "44444444-4444-4444-8444-444444444444"
    provider = Mock(side_effect=[
        {"factors": [{"id": pending_id, "factor_type": "totp", "status": "unverified"}]},
        {}, {"id": pending_id, "totp": {"secret": "test-only-enrollment"}},
    ])
    monkeypatch.setattr(auth, "provider", provider)
    result = client.post("/api/auth/mfa/enroll", json={})
    assert result.status_code == 200
    assert provider.call_args_list[1].args == ("DELETE", f"factors/{pending_id}")
