"""
Módulo de Objetos de Transferencia de Datos (DTOs).
Define los contratos de datos fuertemente tipados para el sistema.
"""

from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional


@dataclass(frozen=True)
class CoordenadasDTO:
    lat: float
    lon: float

    def to_dict(self) -> Dict[str, float]:
        return {"lat": self.lat, "lon": self.lon}


@dataclass
class UserPreferencesDTO:
    """Preferencias del usuario capturadas desde la UI o CLI."""
    dias_disponibles: int
    presupuesto_max: float
    condicion_fisica: str = "Moderado"  # "Fácil", "Moderado", "Difícil"
    nodo_base: CoordenadasDTO = field(default_factory=lambda: CoordenadasDTO(lat=-12.0464, lon=-77.0428))
    texto_usuario: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "dias_disponibles": self.dias_disponibles,
            "presupuesto_max": self.presupuesto_max,
            "condicion_fisica": self.condicion_fisica,
            "nodo_base": self.nodo_base.to_dict(),
            "texto_usuario": self.texto_usuario
        }


@dataclass
class FuzzySemanticPreferencesDTO:
    """Variables cualitativas extraídas por el LLM a partir del texto libre."""
    clima_preferido: str = "Soleado"
    intereses: List[str] = field(default_factory=lambda: ["Naturaleza", "Senderismo"])
    sensibilidad_saturacion: float = 1.0  # Multiplicador de aversión a multitudes [0.5 - 1.5]
    sensibilidad_seguridad: float = 1.0


@dataclass
class OptimizationResultDTO:
    """Resultado consolidado del pipeline inteligente."""
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
    historial: List[Dict[str, Any]] = field(default_factory=list)
    llm_provider: str = "fallback"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
