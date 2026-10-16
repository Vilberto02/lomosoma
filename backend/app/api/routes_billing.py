"""Planes de pago unico y checkout de demostracion con licencia firmada."""

import base64
import hashlib
import hmac
import json
import os
import secrets
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from backend.app.api.routes_lomas import DESTINOS_DICT
from backend.app.schemas.api_models import BillingPlanModel, CheckoutRequestModel, CheckoutResponseModel


router = APIRouter(prefix="/billing", tags=["Pago unico"])
SIGNING_KEY = os.environ.get("LOMOSOMA_LICENSE_SECRET", "").encode() or secrets.token_bytes(32)
PLANS = [
    BillingPlanModel(plan_id="pack_lima_pro", nombre="Pack Vitalicio Todo Lima PRO", tipo_pago="pago_unico",
                    precio_pen=19.90, precio_usd=5.49, descripcion="Un solo pago para todas las lomas de Lima",
                    beneficios=["LomaCast 7D", "Mapas offline", "Exportacion GPX", "Pasaporte de cumbres"]),
    BillingPlanModel(plan_id="loma_individual", nombre="Desbloqueo de Loma Individual", tipo_pago="pago_unico",
                    precio_pen=4.90, precio_usd=1.49, descripcion="Acceso permanente a una loma elegida",
                    beneficios=["LomaCast 7D de la loma", "Maletin offline", "Exportacion GPX"]),
]


@router.get("/plans", response_model=list[BillingPlanModel])
def get_plans():
    return PLANS


@router.post("/checkout", response_model=CheckoutResponseModel)
def checkout(request: CheckoutRequestModel):
    plan = next((p for p in PLANS if p.plan_id == request.plan_id), None)
    if plan is None:
        raise HTTPException(status_code=422, detail="Plan desconocido")
    if request.metodo_pago not in ("yape_plin", "tarjeta"):
        raise HTTPException(status_code=422, detail="Metodo de pago desconocido")
    did = request.loma_id.strip().upper() if request.loma_id else None
    if did is not None and did not in DESTINOS_DICT:
        raise HTTPException(status_code=404, detail="Loma no encontrada")
    total = request.plan_id == "pack_lima_pro"
    if not total and not did:
        raise HTTPException(status_code=422, detail="El plan individual requiere loma_id")
    orden_id = uuid4().hex
    emitido = datetime.now(timezone.utc).isoformat()
    desbloqueadas = list(DESTINOS_DICT) if total else [did]
    claims = {"orden_id": orden_id, "plan_id": plan.plan_id, "lomas_desbloqueadas": desbloqueadas,
              "acceso_total_lima": total, "email_cliente": request.email_cliente, "emitido_en": emitido,
              "entorno": "demo"}
    payload = base64.urlsafe_b64encode(json.dumps(claims, sort_keys=True, separators=(",", ":")).encode()).decode().rstrip("=")
    firma = hmac.new(SIGNING_KEY, payload.encode(), hashlib.sha256).hexdigest()
    return CheckoutResponseModel(orden_id=orden_id, estado="aprobado_demo", plan_id=plan.plan_id,
                                 lomas_desbloqueadas=desbloqueadas, acceso_total_lima=total,
                                 monto_pagado_pen=plan.precio_pen, metodo_pago=request.metodo_pago,
                                 token_licencia=f"{payload}.{firma}", emitido_en=emitido,
                                 mensaje="Checkout de demostracion aprobado. No se realizo un cobro real.")
