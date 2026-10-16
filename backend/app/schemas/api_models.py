"""
Modelos Pydantic para la API REST del Sistema Inteligente de Lomas de Lima.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class CoordenadasModel(BaseModel):
    lat: float = Field(..., description="Latitud en grados decimales")
    lon: float = Field(..., description="Longitud en grados decimales")


class UserPreferencesRequest(BaseModel):
    dias_disponibles: int = Field(default=3, ge=1, le=15, description="Cantidad de días disponibles para trekking")
    presupuesto_max: float = Field(default=60.0, ge=10.0, description="Presupuesto máximo total en Soles (PEN)")
    condicion_fisica: str = Field(default="Moderado", description="Condición física: 'Fácil', 'Moderado' o 'Difícil'")
    nodo_base: CoordenadasModel = Field(
        default_factory=lambda: CoordenadasModel(lat=-12.0464, lon=-77.0428),
        description="Coordenadas del punto de partida o alojamiento (d0)"
    )
    texto_usuario: Optional[str] = Field(
        default=None,
        description="Descripción cualitativa libre de preferencias (NLP/LLM)"
    )


class LomaSummaryModel(BaseModel):
    id: str
    nombre: str
    distrito: str
    tipo: str
    dificultad: str
    coordenadas: CoordenadasModel
    saturacion_base: float
    seguridad_base: float
    clima_verdor_base: float
    accesibilidad_base: float
    costo_estimado: float
    tiempo_estimado_horas: float
    distancia_centro_min: float
    transporte_principal: str
    descripcion: str
    temporada_optima: str
    score_difuso: float = Field(default=0.0, description="Score de riesgo 0-10 calculado por el sistema difuso Mamdani")


class GuiaAccesoModel(BaseModel):
    id: str
    nombre: str
    punto_partida_recomendado: str
    medio_transporte: str
    tiempo_total_min: int
    costo_total_soles: float
    pasos: List[str]
    coordenadas_destino: CoordenadasModel


class LomaDetailModel(LomaSummaryModel):
    guia_acceso: Optional[GuiaAccesoModel] = None


class PresetZonaModel(BaseModel):
    nombre: str
    lat: float
    lon: float


class OptimizationResponse(BaseModel):
    k: int
    ruta_ids: List[str]
    destinos_ordenados: List[Dict[str, Any]]
    fitness: float
    costo_total: float
    distancia_total_km: float
    tiempo_estimado_horas: float
    nivel_exigencia: float
    riesgos_ruta: Dict[str, float]
    tramos: List[Dict[str, Any]]
    genes_reales: Dict[str, float]
    itinerario_narrativo: str
    guias_acceso: List[Dict[str, Any]]
    metodo: str
    grafica_ascii: str
    historial: List[Dict[str, Any]] = []
    llm_provider: str = Field(default="fallback", description="Proveedor del itinerario narrativo: 'gemini' o 'fallback'")
