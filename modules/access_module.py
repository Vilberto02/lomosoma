"""
Módulo de Acceso y Transporte Público (POO).
"""

import os
import json
from typing import Dict, Any, Optional
from modules.routing_service import LastMileRoutingService


class LomasAccessService:
    """Servicio logístico de transporte y accesos a las lomas."""

    def __init__(self, catalogo: Optional[Dict[str, Any]] = None):
        self._catalogo = catalogo or self._cargar_catalogo()
        self.routing_service = LastMileRoutingService(self._catalogo)

    @staticmethod
    def _cargar_catalogo() -> Dict[str, Any]:
        ruta = os.path.join(os.path.dirname(__file__), "..", "data", "destinos.json")
        if os.path.exists(ruta):
            with open(ruta, "r", encoding="utf-8") as f:
                return {d["id"]: d for d in json.load(f)}
        return {}

    def obtener_guia_acceso(self, id_destino: str, origen_lat: Optional[float] = None, origen_lon: Optional[float] = None) -> Dict[str, Any]:
        id_destino = id_destino.strip().upper()
        d = self._catalogo.get(id_destino, {})
        nombre = d.get("nombre", f"Destino {id_destino}")
        transporte = d.get("transporte_principal", "Transporte público urbano hacia la zona.")
        tiempo = d.get("distancia_centro_min", 60)
        costo = d.get("costo_estimado", 5.0)

        guia = {
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
        if id_destino in self._catalogo:
            ruta = self.routing_service.calcular_ruta_ultima_milla(
                id_destino,
                origen_lat if origen_lat is not None else -12.0464,
                origen_lon if origen_lon is not None else -77.0428,
            )
            guia.update(ruta)
            mochilero = ruta["modos_transporte"][0]
            guia.update({"tiempo_total_min": mochilero["tiempo_estimado_min"],
                         "costo_total_soles": mochilero["costo_por_persona_pen"],
                         "pasos": mochilero["pasos"], "punto_partida_recomendado": ruta["estacion_troncal"]})
        return guia


def obtener_guia_acceso(id_destino: str, origen_lat: Optional[float] = None, origen_lon: Optional[float] = None) -> Dict[str, Any]:
    return LomasAccessService().obtener_guia_acceso(id_destino, origen_lat, origen_lon)
