"""
Módulo Orquestador del Pipeline Inteligente (Facade Pattern).
Coordina las instancias de todas las clases del sistema con inyección de dependencias.
"""

import os
import json
from typing import List, Dict, Any, Optional

from modules.dtos import (
    UserPreferencesDTO,
    CoordenadasDTO,
    FuzzySemanticPreferencesDTO,
    OptimizationResultDTO
)
from modules.mapping import LomasMappingService
from modules.fuzzy_module import LomasFuzzyEngine
from modules.genetic_algorithm import LomasGeneticOptimizer
from modules.llm_module import LomasLLMService
from modules.access_module import LomasAccessService


class LomasPipelineOrchestrator:
    """Orquestador central para la ejecución end-to-end del sistema."""

    def __init__(
        self,
        catalogo: Optional[List[Dict[str, Any]]] = None,
        mapping_service: Optional[LomasMappingService] = None,
        fuzzy_engine: Optional[LomasFuzzyEngine] = None,
        llm_service: Optional[LomasLLMService] = None,
        access_service: Optional[LomasAccessService] = None
    ):
        self.destinos = catalogo if catalogo is not None else self._cargar_catalogo()
        self.destinos_dict = {d["id"]: d for d in self.destinos}

        # Instanciación e Inyección de Clases de Servicios
        self.mapping_service = mapping_service or LomasMappingService()
        self.fuzzy_engine = fuzzy_engine or LomasFuzzyEngine()
        self.llm_service = llm_service or LomasLLMService()
        self.access_service = access_service or LomasAccessService({d["id"]: d for d in self.destinos})

    @staticmethod
    def _cargar_catalogo() -> List[Dict[str, Any]]:
        ruta_json = os.path.join(os.path.dirname(__file__), "..", "data", "destinos.json")
        with open(ruta_json, "r", encoding="utf-8") as f:
            return json.load(f)

    def run(self, user_prefs: UserPreferencesDTO) -> OptimizationResultDTO:
        """
        Ejecuta el pipeline completo de principio a fin coordinando las clases y adaptando parámetros al usuario.
        """
        # 1. Extracción de semántica cualitativa mediante LomasLLMService
        fuzzy_prefs = self.llm_service.extraer_preferencias_cualitativas(user_prefs.texto_usuario)

        # 2. Inferencia difusa: Nivel de Riesgo del catálogo mediante LomasFuzzyEngine
        riesgos_todos = self.fuzzy_engine.calcular_riesgos_catalogo(self.destinos)

        # 3. Beneficios base intrínsecos del catálogo (con bonificación por patrimonio)
        beneficios_base = {
            d['id']: round(7.0 + (1.0 if d.get('patrimonio', False) else 0.0), 2)
            for d in self.destinos
        }

        # 4. Mapeo y adaptación de parámetros mediante LomasMappingService
        config_ag = self.mapping_service.preparar_configuracion_ag(user_prefs, fuzzy_prefs)

        # 5. Optimización evolutiva mediante LomasGeneticOptimizer
        optimizador = LomasGeneticOptimizer(
            destinos=self.destinos,
            beneficios_base=beneficios_base,
            fuzzy_engine=self.fuzzy_engine,
            **config_ag
        )
        resultado_ag = optimizador.optimizar()

        # 7. Guías de Transporte y Acceso mediante LomasAccessService
        guias_acceso = [self.access_service.obtener_guia_acceso(did) for did in resultado_ag["ruta_ids"]]

        # 8. Itinerario Narrativo generado por LomasLLMService
        perfil_combinado = {
            **user_prefs.to_dict(),
            "clima_preferido": fuzzy_prefs.clima_preferido,
            "intereses": fuzzy_prefs.intereses
        }
        itinerario_narrativo = self.llm_service.generar_itinerario_narrativo(resultado_ag, perfil_combinado)

        # 9. Empaquetado final en DTO fuertemente tipado
        return OptimizationResultDTO(
            k=config_ag["k"],
            ruta_ids=resultado_ag["ruta_ids"],
            destinos_ordenados=resultado_ag["destinos_ordenados"],
            fitness=resultado_ag["fitness"],
            costo_total=resultado_ag["costo_total"],
            distancia_total_km=resultado_ag["distancia_total_km"],
            tiempo_estimado_horas=resultado_ag["tiempo_estimado_horas"],
            nivel_exigencia=resultado_ag.get("nivel_exigencia", 0.0),
            riesgos_ruta=resultado_ag.get("riesgos_ruta", {did: riesgos_todos.get(did, 5.0) for did in resultado_ag["ruta_ids"]}),
            tramos=resultado_ag.get("tramos", []),
            genes_reales=resultado_ag.get("genes_reales", {}),
            itinerario_narrativo=itinerario_narrativo,
            guias_acceso=guias_acceso,
            metodo=resultado_ag.get("metodo", "algoritmo_genetico"),
            grafica_ascii=resultado_ag.get("grafica_ascii", ""),
            historial=resultado_ag.get("historial", []),
            llm_provider=getattr(self.llm_service, "ultimo_origen", "fallback")
        )
