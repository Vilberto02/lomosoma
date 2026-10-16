"""
Módulo de Mapeo y Adaptación de Parámetros de Dominio (POO).
"""

from typing import Tuple, Dict, Any, Optional
import unicodedata
from modules.dtos import UserPreferencesDTO, FuzzySemanticPreferencesDTO, CoordenadasDTO


class LomasMappingService:
    """Adaptacion de preferencias al optimizador de rutas."""

    @staticmethod
    def _normalizar(texto):
        return "".join(c for c in unicodedata.normalize("NFD", str(texto).lower()) if not unicodedata.combining(c))

    @classmethod
    def calcular_beneficios_personalizados(cls, destinos, fuzzy_prefs):
        grupos = {
            "arqueologia": ("arqueolog", "ruina", "patrimonio", "histori", "cultural"),
            "naturaleza": ("naturaleza", "flora", "flor", "vegetacion", "ecosistema"),
            "senderismo": ("sender", "trekking", "circuito", "caminata"),
            "vistas panoramicas": ("mirador", "panoram", "vista", "colchon"),
            "fotografia": ("mirador", "panoram", "amancaes", "colchon"),
            "aves y fauna": ("ave", "fauna", "vizcacha", "zorro"),
        }
        beneficios = {}
        for d in destinos:
            texto = cls._normalizar(" ".join([d.get("tipo", ""), d.get("descripcion", ""), *d.get("atractivos_principales", [])]))
            valor = 7.0 + (1 if d.get("patrimonio") else 0)
            for interes in set(cls._normalizar(x) for x in fuzzy_prefs.intereses):
                if interes == "tranquilidad":
                    valor += 2 * (1 - float(d.get("saturacion_base", 0.5)))
                elif any(p in texto for p in grupos.get(interes, (interes,))):
                    valor += 2
            if "garua" in cls._normalizar(fuzzy_prefs.clima_preferido):
                valor += float(d.get("clima_verdor_base", 5)) / 10
            else:
                valor += (10 - float(d.get("clima_verdor_base", 5))) / 10
            beneficios[d["id"]] = round(valor, 2)
        return beneficios

    @classmethod
    def generar_checklist_equipamiento(cls, destinos_ordenados, fuzzy_prefs, condicion_fisica):
        lista = ["Agua potable y refrigerio", "Calzado de trekking con buen agarre", "Protector solar y gorra",
                 "Efectivo para transporte y entrada", "Mapa offline y bateria externa", "Botiquin y silbato"]
        if "garua" in cls._normalizar(fuzzy_prefs.clima_preferido) or any(d.get("es_loma_natural", True) for d in destinos_ordenados):
            lista.append("Casaca impermeable y capa para neblina")
        if ("facil" in cls._normalizar(condicion_fisica)
                or any(d.get("pendiente_max_pct", 0) >= 20 for d in destinos_ordenados)):
            lista.append("Bastones de trekking")
        intereses = cls._normalizar(" ".join(fuzzy_prefs.intereses))
        if "foto" in intereses or "vista" in intereses:
            lista.append("Camara con proteccion contra humedad")
        if "aves" in intereses or "fauna" in intereses:
            lista.append("Binoculares")
        return lista

    @staticmethod
    def dias_a_k(dias: int) -> int:
        """
        Mapea el número de días disponibles al parámetro K de destinos activos.
        Hasta un dia retorna un destino mediante seleccion determinista.
        Desde dos dias limita la cantidad de destinos entre dos y seis.
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
        delta_exigencia pondera el desvio del esfuerzo objetivo.
        gamma_riesgo penaliza el riesgo segun la sensibilidad del usuario.
        exigencia_target fija el objetivo entre cero y uno segun condicion fisica.
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
