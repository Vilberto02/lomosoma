"""
Endpoint de optimización inteligente de rutas utilizando el motor heurístico híbrido (AG + Lógica Difusa + NLP).
"""

import logging
from threading import BoundedSemaphore
from fastapi import APIRouter, HTTPException, Request
from backend.app.storage import rate_limit
from backend.app.schemas.api_models import UserPreferencesRequest, OptimizationResponse
from modules.dtos import UserPreferencesDTO, CoordenadasDTO
from modules.pipeline import LomasPipelineOrchestrator

router = APIRouter(tags=["Optimización"])

# Instancia singleton del orquestador para reuso de memoria
orchestrator = LomasPipelineOrchestrator()
optimization_slot = BoundedSemaphore(1)


@router.post("/optimize", response_model=OptimizationResponse)
def optimize_route(request: UserPreferencesRequest, http_request: Request):
    """
    Ejecuta el pipeline completo de optimización de rutas:
    1. Procesa las preferencias cualitativas y cuantitativas.
    2. Modela el riesgo difuso de las lomas mediante Lógica Difusa Mamdani.
    3. Resuelve la ruta óptima mediante Algoritmo Genético Híbrido o Atajo Determinista.
    4. Genera itinerario narrativo y guías detalladas de transporte público.
    """
    rate_limit("optimize", http_request.client.host, 10, 3600)
    rate_limit("optimize-global", "all", 100, 86400)
    if not optimization_slot.acquire(blocking=False):
        raise HTTPException(429, "Hay una ruta en cálculo. Inténtalo en unos segundos", headers={"Retry-After": "10"})
    try:
        user_dto = UserPreferencesDTO(
            dias_disponibles=request.dias_disponibles,
            presupuesto_max=request.presupuesto_max,
            condicion_fisica=request.condicion_fisica,
            nodo_base=CoordenadasDTO(lat=request.nodo_base.lat, lon=request.nodo_base.lon),
            texto_usuario=request.texto_usuario.strip() if request.texto_usuario and request.texto_usuario.strip() else None
        )

        resultado_dto = orchestrator.run(user_dto)
        resultado = resultado_dto.to_dict()
        resultado["afinidad_destinos"] = resultado.pop("afinidad_Destinos")
        return resultado

    except Exception as e:
        logging.getLogger("lomosoma.optimize").error("optimization_failed type=%s", type(e).__name__)
        raise HTTPException(
            status_code=500,
            detail="No se pudo calcular la ruta. Inténtalo más tarde"
        ) from None
    finally:
        optimization_slot.release()
