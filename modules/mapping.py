"""
Módulo de Mapeo y Adaptación de Parámetros de Dominio (POO).
"""

from typing import Tuple, Dict, Any, Optional
from modules.dtos import UserPreferencesDTO, FuzzySemanticPreferencesDTO, CoordenadasDTO


class LomasMappingService:
    """
    Servicio de dominio para validar, mapear y adaptar las preferencias del usuario
    a la configuración matemática requerida por el Algoritmo Genético y el Motor Difuso.
    """

    @staticmethod
    def dias_a_k(dias: int) -> int:
        """
        Mapea el número de días disponibles al parámetro K de destinos activos.
        - Días <= 1: Retorna K=1 (atajo determinista).
        - Días >= 2: Retorna K = clamp(días, 2, 6).
        """
        if dias <= 1:
            return 1
        return min(max(2, int(dias)), 6)

    @classmethod
    def mapear_pesos_condicion(
        cls,
        condicion_fisica: str,
        sensibilidad_seguridad: float = 1.0
    ) -> Tuple[float, float, float]:
        """
        Traduce la condición física cualitativa a los hiperparámetros del AG:
        - delta_exigencia: Peso de penalización por desvío del esfuerzo objetivo.
        - gamma_riesgo: Penalización por riesgo difuso acumulado (modulada por sensibilidad).
        - exigencia_target: Nivel objetivo difuso [0.0 - 1.0] (Fácil ~0.20, Moderado ~0.50, Difícil ~0.85).
        """
        cond = (condicion_fisica or "Moderado").lower().strip()
        if "fácil" in cond or "facil" in cond:
            delta_base, gamma_base, target = 4.0, 2.0, 0.20
        elif "difícil" in cond or "dificil" in cond or "fuerte" in cond:
            delta_base, gamma_base, target = 3.0, 1.0, 0.85
        else:
            delta_base, gamma_base, target = 3.0, 1.5, 0.50

        gamma_ajustado = round(gamma_base * float(sensibilidad_seguridad), 3)
        return delta_base, gamma_ajustado, target

    @classmethod
    def mapear_restricciones_presupuesto(
        cls,
        presupuesto_max: float,
        k: int
    ) -> Dict[str, Any]:
        """
        Calcula las bandas de tolerancia y métricas de viabilidad presupuestal por destino.
        """
        p_val = max(10.0, float(presupuesto_max))
        k_val = max(1, int(k))
        umbral_min = round(k_val * 8.0, 2)
        es_factible = p_val >= umbral_min
        return {
            "presupuesto_total": p_val,
            "presupuesto_por_destino": round(p_val / k_val, 2),
            "umbral_minimo_viable": umbral_min,
            "es_factible": es_factible
        }

    @classmethod
    def preparar_configuracion_ag(
        cls,
        user_prefs: UserPreferencesDTO,
        fuzzy_prefs: FuzzySemanticPreferencesDTO
    ) -> Dict[str, Any]:
        """
        Consolida y adapta todas las preferencias del usuario para instanciar LomasGeneticOptimizer.
        """
        k = cls.dias_a_k(user_prefs.dias_disponibles)
        delta_exigencia, gamma_riesgo, exigencia_target = cls.mapear_pesos_condicion(
            user_prefs.condicion_fisica,
            fuzzy_prefs.sensibilidad_seguridad
        )
        nodo_dict = user_prefs.nodo_base.to_dict() if isinstance(user_prefs.nodo_base, CoordenadasDTO) else user_prefs.nodo_base

        return {
            "k": k,
            "presupuesto": float(user_prefs.presupuesto_max),
            "dias_disponibles": int(user_prefs.dias_disponibles),
            "nodo_base": nodo_dict,
            "delta_exigencia": delta_exigencia,
            "gamma_riesgo": gamma_riesgo,
            "exigencia_target": exigencia_target
        }


# Función para compatibilidad con código existente
def dias_a_k(dias: int) -> int:
    return LomasMappingService.dias_a_k(dias)


__all__ = ["LomasMappingService", "dias_a_k"]
