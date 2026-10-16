"""
Módulo de Acceso y Transporte Público (POO).
"""

import os
import json
from typing import Dict, Any, Optional


class LomasAccessService:
    """Servicio logístico de transporte y accesos a las lomas."""

    def __init__(self, catalogo: Optional[Dict[str, Any]] = None):
        self._catalogo = catalogo or self._cargar_catalogo()

    @staticmethod
    def _cargar_catalogo() -> Dict[str, Any]:
        ruta = os.path.join(os.path.dirname(__file__), "..", "data", "destinos.json")
        if os.path.exists(ruta):
            with open(ruta, "r", encoding="utf-8") as f:
                return {d["id"]: d for d in json.load(f)}
        return {}

    def obtener_guia_acceso(self, id_destino: str) -> Dict[str, Any]:
        d = self._catalogo.get(id_destino, {})
        nombre = d.get("nombre", f"Destino {id_destino}")
        transporte = d.get("transporte_principal", "Transporte público urbano hacia la zona.")
        tiempo = d.get("distancia_centro_min", 60)
        costo = d.get("costo_estimado", 5.0)

        return {
            "nombre": nombre,
            "punto_partida_recomendado": f"Estación central o alimentador hacia {d.get('distrito', 'Lima')}",
            "medio_transporte": transporte,
            "tiempo_total_min": tiempo,
            "costo_total_soles": costo,
            "pasos": [
                f"1. Abordar transporte público hacia {d.get('distrito', 'el distrito de destino')}.",
                f"2. Tomar conexión local indicada: {transporte}.",
                "3. Llegar al punto de control e inicio de senderos."
            ],
            "recomendaciones": "Llevar efectivo para pasajes locales e iniciar el recorrido por la mañana."
        }


def obtener_guia_acceso(id_destino: str) -> Dict[str, Any]:
    return LomasAccessService().obtener_guia_acceso(id_destino)
