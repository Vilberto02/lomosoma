"""
Endpoint de optimización inteligente de rutas utilizando el motor heurístico híbrido (AG + Lógica Difusa + NLP).
"""

from fastapi import APIRouter, HTTPException
from backend.app.schemas.api_models import UserPreferencesRequest, OptimizationResponse
from modules.dtos import UserPreferencesDTO, CoordenadasDTO
from modules.pipeline import LomasPipelineOrchestrator

router = APIRouter(tags=["Optimización"])

# Instancia singleton del orquestador para reuso de memoria
orchestrator = LomasPipelineOrchestrator()


@router.post("/optimize", response_model=OptimizationResponse)
def optimize_route(request: UserPreferencesRequest):
    """
    Ejecuta el pipeline completo de optimización de rutas:
    1. Procesa las preferencias cualitativas y cuantitativas.
    2. Modela el riesgo difuso de las lomas mediante Lógica Difusa Mamdani.
    3. Resuelve la ruta óptima mediante Algoritmo Genético Híbrido o Atajo Determinista.
    4. Genera itinerario narrativo y guías detalladas de transporte público.
    """
    try:
        user_dto = UserPreferencesDTO(
            dias_disponibles=request.dias_disponibles,
            presupuesto_max=request.presupuesto_max,
            condicion_fisica=request.condicion_fisica,
            nodo_base=CoordenadasDTO(lat=request.nodo_base.lat, lon=request.nodo_base.lon),
            texto_usuario=request.texto_usuario.strip() if request.texto_usuario and request.texto_usuario.strip() else None
        )

        resultado_dto = orchestrator.run(user_dto)
        return resultado_dto.to_dict()

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error durante el cálculo de la ruta óptima: {str(e)}"
        )
