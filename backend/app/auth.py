"""Supabase Auth gateway. The browser only receives opaque, HttpOnly sessions."""
import base64
import hashlib
import hmac
import json
import secrets
import time
from dataclasses import dataclass

import httpx
from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import select, update, delete

from backend.app.settings import settings
from backend.app.storage import transaction, sessions, roles, digest, rate_limit

router = APIRouter(prefix="/auth", tags=["Cuenta"])
COOKIE = "lomosoma_session"
SESSION_SECONDS = 7 * 86400


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class EmailRequest(StrictModel):
    email: EmailStr = Field(max_length=254)


class VerifyRequest(EmailRequest):
    code: str = Field(pattern=r"^\d{6,8}$")


class MFARequest(StrictModel):
    factor_id: str = Field(pattern=r"^[0-9a-f-]{36}$")
    code: str = Field(pattern=r"^\d{6}$")


def provider(method: str, path: str, body=None, access_token=None):
    config = settings()
    if not config.supabase_url.startswith("https://") or not config.supabase_key:
        raise HTTPException(503, "Acceso por correo todavía no configurado")
    headers = {"apikey": config.supabase_key}
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"
    try:
        with httpx.Client(timeout=10, follow_redirects=False) as client:
            result = client.request(method, f"{config.supabase_url}/auth/v1/{path}", json=body, headers=headers)
    except httpx.HTTPError:
        raise HTTPException(503, "Servicio de acceso temporalmente no disponible") from None
    if result.status_code == 429:
        raise HTTPException(429, "Espera antes de volver a intentarlo")
    if result.status_code >= 500:
        raise HTTPException(503, "Servicio de acceso temporalmente no disponible")
    if not result.is_success:
        raise HTTPException(401, "No se pudo validar el acceso")
    return result.json() if result.content else {}


def cipher():
    if not settings().encryption_key:
        raise HTTPException(503, "Servicio de cuentas todavía no configurado")
    return Fernet(settings().encryption_key.encode())


def encrypted_tokens(data):
    return cipher().encrypt(json.dumps({key: data[key] for key in ("access_token", "refresh_token")}).encode()).decode()


def csrf_for(raw: str):
    return hmac.new(settings().encryption_key.encode(), raw.encode(), hashlib.sha256).hexdigest()


def read_claims(token):
    # Only called after Supabase /user has verified this token.
    try:
        payload = token.split(".")[1]
        return json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    except (ValueError, IndexError, TypeError):
        raise HTTPException(401, "Sesión inválida") from None


@dataclass
class Account:
    id: str
    email: str
    admin: bool
    aal: str
    access_token: str


def optional_account(request: Request):
    raw = request.cookies.get(COOKIE)
    if not raw:
        return None
    with transaction() as conn:
        row = conn.execute(select(sessions).where(sessions.c.id_hash == digest(raw)).with_for_update()).mappings().first()
        if not row or row["created_at"] + SESSION_SECONDS < time.time():
            raise HTTPException(401, "Vuelve a iniciar sesión")
        tokens = json.loads(cipher().decrypt(row["tokens"].encode()))
        if row["expires_at"] < time.time() + 30:
            tokens = provider("POST", "token?grant_type=refresh_token", {"refresh_token": tokens["refresh_token"]})
            conn.execute(update(sessions).where(sessions.c.id_hash == row["id_hash"]).values(
                tokens=encrypted_tokens(tokens),
                expires_at=int(time.time()) + tokens["expires_in"]))
        user = provider("GET", "user", access_token=tokens["access_token"])
        if user["id"] != row["user_id"]:
            raise HTTPException(401, "Sesión inválida")
        admin = conn.execute(select(roles.c.user_id).where(roles.c.user_id == user["id"])).first() is not None
        claims = read_claims(tokens["access_token"])
        return Account(user["id"], user.get("email", ""), admin, claims.get("aal", "aal1"), tokens["access_token"])


def require_account(account=Depends(optional_account)):
    if account is None:
        raise HTTPException(401, "Inicia sesión para continuar")
    return account


def require_admin(account=Depends(require_account)):
    if not account.admin or account.aal != "aal2":
        raise HTTPException(403, "Se requiere acceso administrativo y segundo factor")
    return account


@router.post("/code", status_code=202)
def send_code(body: EmailRequest, request: Request):
    rate_limit("email-code", str(body.email).lower(), 3, 900)
    rate_limit("code-ip", request.client.host, 10, 900)
    provider("POST", "otp", {"email": str(body.email).lower(), "create_user": True})
    return {"message": "Si el correo puede recibir mensajes, encontrarás un código de acceso."}


@router.post("/verify")
def verify_code(body: VerifyRequest, request: Request, response: Response):
    rate_limit("verify", str(body.email).lower(), 10, 900)
    data = provider("POST", "verify", {"email": str(body.email).lower(), "token": body.code, "type": "email"})
    raw = secrets.token_urlsafe(32)
    now = int(time.time())
    with transaction() as conn:
        conn.execute(delete(sessions).where(sessions.c.created_at < now - SESSION_SECONDS))
        previous = request.cookies.get(COOKIE)
        if previous:
            conn.execute(delete(sessions).where(sessions.c.id_hash == digest(previous)))
        conn.execute(sessions.insert().values(id_hash=digest(raw), user_id=data["user"]["id"],
            email=data["user"]["email"], tokens=encrypted_tokens(data),
            expires_at=now + data["expires_in"], created_at=now))
    response.set_cookie(COOKIE, raw, httponly=True, secure=settings().production,
                        samesite="lax", max_age=SESSION_SECONDS, path="/api")
    return {"csrf_token": csrf_for(raw)}


@router.get("/session")
def get_session(request: Request):
    try:
        account = optional_account(request)
    except HTTPException as exc:
        if exc.status_code != 401:
            raise
        account = None
    if account is None:
        raw = request.cookies.get(COOKIE)
        return {"user": None, "csrf_token": csrf_for(raw) if raw else None}
    return {"user": {"id": account.id, "email": account.email, "admin": account.admin, "aal": account.aal},
            "csrf_token": csrf_for(request.cookies[COOKIE])}


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response):
    raw = request.cookies.get(COOKIE)
    if raw:
        with transaction() as conn:
            conn.execute(delete(sessions).where(sessions.c.id_hash == digest(raw)))
    response.delete_cookie(COOKIE, path="/api", secure=settings().production, httponly=True, samesite="lax")


@router.get("/mfa")
def list_factors(account=Depends(require_account)):
    if not account.admin:
        raise HTTPException(403, "Acceso restringido")
    user = provider("GET", "user", access_token=account.access_token)
    return [{"id": f["id"], "status": f["status"]} for f in user.get("factors", []) if f.get("factor_type") == "totp"]


@router.post("/mfa/enroll")
def enroll(account=Depends(require_account)):
    if not account.admin:
        raise HTTPException(403, "Acceso restringido")
    user = provider("GET", "user", access_token=account.access_token)
    factors = [factor for factor in user.get("factors", []) if factor.get("factor_type") == "totp"]
    if any(factor.get("status") == "verified" for factor in factors):
        raise HTTPException(409, "Ya tienes un autenticador configurado")
    for factor in factors:
        provider("DELETE", f'factors/{factor["id"]}', access_token=account.access_token)
    result = provider("POST", "factors", {"factor_type": "totp", "friendly_name": "Lomosoma administración"}, account.access_token)
    return {"id": result["id"], "secret": result["totp"]["secret"]}


@router.post("/mfa/verify")
def verify_factor(body: MFARequest, request: Request, account=Depends(require_account)):
    if not account.admin:
        raise HTTPException(403, "Acceso restringido")
    rate_limit("mfa", account.id, 10, 900)
    challenge = provider("POST", f"factors/{body.factor_id}/challenge", {}, account.access_token)
    result = provider("POST", f"factors/{body.factor_id}/verify",
                      {"challenge_id": challenge["id"], "code": body.code}, account.access_token)
    with transaction() as conn:
        conn.execute(update(sessions).where(sessions.c.id_hash == digest(request.cookies[COOKIE])).values(
            tokens=encrypted_tokens(result),
            expires_at=int(time.time()) + result["expires_in"]))
    return {"message": "Segundo factor validado"}
