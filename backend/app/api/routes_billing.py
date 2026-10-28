"""Yape orders. Only a verified administrator can grant purchased access."""
import time
from datetime import date
from decimal import Decimal
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from backend.app.auth import StrictModel, require_account, require_admin
from backend.app.settings import settings
from backend.app.storage import transaction, orders, operations, entitlements, audit, rate_limit
from backend.app.api.routes_lomas import DESTINOS_DICT

router = APIRouter(prefix="/billing", tags=["Pagos Yape"])
PLANS = [
    {"plan_id": "pack_lima_pro", "nombre": "Todo Lima PRO", "tipo_pago": "pago_unico", "precio_pen": 19.90,
     "descripcion": "Acceso permanente a todas las lomas", "beneficios": ["LomaCast 7D", "Mapas offline", "Exportación GPX"]},
    {"plan_id": "loma_individual", "nombre": "Loma individual", "tipo_pago": "pago_unico", "precio_pen": 4.90,
     "descripcion": "Acceso permanente a una loma", "beneficios": ["LomaCast 7D", "Mapa offline", "Exportación GPX"]},
]


class OrderRequest(StrictModel):
    plan_id: Literal["pack_lima_pro", "loma_individual"]
    loma_id: str | None = Field(default=None, pattern=r"^L\d{1,2}$")


class ReferenceRequest(StrictModel):
    operation_code: str = Field(pattern=r"^[A-Za-z0-9-]{4,64}$")
    payment_date: date
    amount_pen: Decimal = Field(gt=0, le=10000, decimal_places=2)


class ReviewRequest(StrictModel):
    decision: Literal["aprobado", "rechazado"]
    reason: str = Field(min_length=3, max_length=500, pattern=r"\S")


def public_order(row, admin=False):
    result = {key: row[key] for key in ["id", "plan_id", "loma_id", "status", "reason", "created_at", "reviewed_at", "payment_date"]}
    result.update(amount_pen=row["amount_centavos"] / 100, metodo_pago="yape")
    if admin:
        result.update(operation_code=row["operation_code"], reported_amount_pen=(row["reported_centavos"] or 0) / 100)
    return result


@router.get("/plans")
def get_plans():
    return PLANS


@router.get("/yape")
def yape_config():
    config = settings()
    if not config.yape_recipient or not config.yape_qr_url.startswith("/payments/"):
        raise HTTPException(503, "Los pagos Yape todavía no están habilitados")
    return {"qr_url": config.yape_qr_url, "recipient": config.yape_recipient,
            "message": "La activación requiere revisión manual del abono en Yape."}


@router.post("/orders", status_code=201)
def create_order(body: OrderRequest, account=Depends(require_account)):
    yape_config()
    rate_limit("orders", account.id, 10, 3600)
    if body.plan_id == "loma_individual" and body.loma_id not in DESTINOS_DICT:
        raise HTTPException(422, "Selecciona una loma válida")
    if body.plan_id == "pack_lima_pro" and body.loma_id is not None:
        raise HTTPException(422, "El pack completo no requiere una loma individual")
    if body.loma_id == "L0":
        raise HTTPException(422, "L0 ya está disponible gratis")
    target = "all" if body.plan_id == "pack_lima_pro" else body.loma_id
    with transaction() as conn:
        owned = conn.execute(select(entitlements.c.scope).where(
            entitlements.c.user_id == account.id, entitlements.c.scope.in_(["all", target]))).first()
        if owned:
            raise HTTPException(409, "Ya tienes acceso a este contenido")
        row = dict(id=str(uuid4()), user_id=account.id, plan_id=body.plan_id, loma_id=body.loma_id,
                   amount_centavos=1990 if target == "all" else 490, status="pendiente_pago", created_at=int(time.time()))
        conn.execute(orders.insert().values(**row))
        result = conn.execute(select(orders).where(orders.c.id == row["id"])).mappings().one()
        return public_order(result)


@router.get("/orders")
def list_orders(account=Depends(require_account)):
    with transaction() as conn:
        return [public_order(row) for row in conn.execute(select(orders).where(
            orders.c.user_id == account.id).order_by(orders.c.created_at.desc()).limit(100)).mappings()]


@router.get("/orders/{order_id}")
def get_order(order_id: str, account=Depends(require_account)):
    with transaction() as conn:
        row = conn.execute(select(orders).where(orders.c.id == order_id, orders.c.user_id == account.id)).mappings().first()
        if not row:
            raise HTTPException(404, "Orden no encontrada")
        return public_order(row)


@router.post("/orders/{order_id}/reference")
def submit_reference(order_id: str, body: ReferenceRequest, account=Depends(require_account)):
    rate_limit("references", account.id, 10, 3600)
    if body.payment_date > date.today():
        raise HTTPException(422, "La fecha no puede estar en el futuro")
    with transaction() as conn:
        row = conn.execute(select(orders).where(orders.c.id == order_id, orders.c.user_id == account.id).with_for_update()).mappings().first()
        if not row:
            raise HTTPException(404, "Orden no encontrada")
        if row["status"] != "pendiente_pago":
            raise HTTPException(409, "La orden ya fue enviada a revisión")
        if int(body.amount_pen * 100) != row["amount_centavos"]:
            raise HTTPException(422, "El importe debe coincidir con la orden")
        conn.execute(update(orders).where(orders.c.id == order_id).values(status="en_revision",
            operation_code=body.operation_code.upper(), payment_date=body.payment_date.isoformat(),
            reported_centavos=int(body.amount_pen * 100)))
        conn.execute(audit.insert().values(id=str(uuid4()), order_id=order_id, actor_id=account.id,
                                          action="reference_submitted", created_at=int(time.time())))
    return get_order(order_id, account)


@router.get("/entitlements")
def get_entitlements(account=Depends(require_account)):
    with transaction() as conn:
        scopes = conn.execute(select(entitlements.c.scope).where(entitlements.c.user_id == account.id)).scalars().all()
    return {"all_lima": "all" in scopes, "loma_ids": list(DESTINOS_DICT) if "all" in scopes else sorted(set(scopes) | {"L0"})}


@router.get("/admin/orders")
def admin_orders(account=Depends(require_admin)):
    with transaction() as conn:
        rows = conn.execute(select(orders).where(orders.c.status == "en_revision").order_by(orders.c.created_at).limit(100)).mappings()
        return [public_order(row, admin=True) for row in rows]


@router.post("/admin/orders/{order_id}/review")
def review_order(order_id: str, body: ReviewRequest, account=Depends(require_admin)):
    rate_limit("reviews", account.id, 60, 3600)
    try:
        with transaction() as conn:
            row = conn.execute(select(orders).where(orders.c.id == order_id).with_for_update()).mappings().first()
            if not row:
                raise HTTPException(404, "Orden no encontrada")
            if row["user_id"] == account.id:
                raise HTTPException(403, "No puedes revisar tu propio pago")
            if row["status"] != "en_revision":
                raise HTTPException(409, "La orden ya fue resuelta o no está en revisión")
            now = int(time.time())
            if body.decision == "aprobado":
                conn.execute(operations.insert().values(operation_key=f'{row["payment_date"]}:{row["operation_code"]}', order_id=order_id))
                scope = "all" if row["plan_id"] == "pack_lima_pro" else row["loma_id"]
                if conn.dialect.name == "postgresql":
                    from sqlalchemy.dialects.postgresql import insert
                else:
                    from sqlalchemy.dialects.sqlite import insert
                conn.execute(insert(entitlements).values(user_id=row["user_id"], scope=scope, order_id=order_id).on_conflict_do_nothing())
            conn.execute(update(orders).where(orders.c.id == order_id).values(status=body.decision,
                reason=body.reason.strip(), reviewer_id=account.id, reviewed_at=now))
            conn.execute(audit.insert().values(id=str(uuid4()), order_id=order_id, actor_id=account.id,
                                              action=body.decision, created_at=now))
            return public_order(conn.execute(select(orders).where(orders.c.id == order_id)).mappings().one(), admin=True)
    except IntegrityError:
        raise HTTPException(409, "Este movimiento Yape ya fue utilizado") from None
