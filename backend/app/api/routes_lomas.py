"""
Endpoints para la gestión del catálogo de lomas, búsqueda y presets de ubicación.
"""

import os
import json
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query

from backend.app.schemas.api_models import (
    LomaSummaryModel,
    LomaDetailModel,
    GuiaAccesoModel,
    CoordenadasModel,
    PresetZonaModel
)
from modules.access_module import LomasAccessService
from modules.fuzzy_module import LomasFuzzyEngine

router = APIRouter(tags=["Lomas y Presets"])

# Cargar catálogo de destinos en memoria
DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "destinos.json")

def _load_destinos():
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

DESTINOS = _load_destinos()
DESTINOS_DICT = {d["id"]: d for d in DESTINOS}
ACCESS_SERVICE = LomasAccessService(DESTINOS_DICT)
FUZZY_ENGINE = LomasFuzzyEngine()
SCORES_DIFUSOS = FUZZY_ENGINE.calcular_riesgos_catalogo(DESTINOS)

PRESETS_LIMA = [
    PresetZonaModel(nombre="Centro de Lima (Plaza Mayor / Centro Histórico)", lat=-12.0464, lon=-77.0428),
    PresetZonaModel(nombre="Miraflores / Barranco (Zona Turística Costa)", lat=-12.1215, lon=-77.0298),
    PresetZonaModel(nombre="San Isidro / Lince (Zona Financiera y Hotelera)", lat=-12.0967, lon=-77.0345),
    PresetZonaModel(nombre="Aeropuerto Internacional Jorge Chávez / Callao", lat=-12.0219, lon=-77.1143),
    PresetZonaModel(nombre="Lima Norte: Los Olivos / MegaPlaza / Comas", lat=-11.9722, lon=-77.0708),
    PresetZonaModel(nombre="Lima Norte: Carabayllo / Trapiche (Acceso Lomas Norte)", lat=-11.8580, lon=-77.0340),
    PresetZonaModel(nombre="Lima Este: San Juan de Lurigancho (Estación Bayóvar)", lat=-11.9750, lon=-76.9980),
    PresetZonaModel(nombre="Lima Este: Ate / La Molina / Santa Anita", lat=-12.0560, lon=-76.9380),
    PresetZonaModel(nombre="Lima Sur: Santiago de Surco / SJM", lat=-12.1485, lon=-76.9744),
    PresetZonaModel(nombre="Lima Sur: Villa María del Triunfo (VMT)", lat=-12.1620, lon=-76.9400),
    PresetZonaModel(nombre="Lima Sur: Lurín / Pachacámac (Acceso Lomas Sur)", lat=-12.2750, lon=-76.8700),
    PresetZonaModel(nombre="Chosica / Chaclacayo (Entrada Carretera Central)", lat=-11.9390, lon=-76.7020)
]


@router.get("/lomas", response_model=List[LomaSummaryModel])
def get_lomas(
    q: Optional[str] = Query(None, description="Búsqueda por nombre de loma o distrito"),
    distrito: Optional[str] = Query(None, description="Filtrar por distrito exacto"),
    dificultad: Optional[str] = Query(None, description="Filtrar por dificultad (Fácil, Moderado, Difícil)")
):
    """
    Retorna la lista completa de las lomas de Lima con soporte para búsqueda y filtros reactivos.
    """
    resultados = DESTINOS

    if q:
        q_lower = q.strip().lower()
        resultados = [
            d for d in resultados
            if q_lower in d["nombre"].lower() or q_lower in d["distrito"].lower() or q_lower in d.get("descripcion", "").lower()
        ]

    if distrito:
        resultados = [d for d in resultados if d["distrito"].lower() == distrito.strip().lower()]

    if dificultad:
        resultados = [d for d in resultados if d["dificultad"].lower() == dificultad.strip().lower()]

    return [{**d, "score_difuso": SCORES_DIFUSOS.get(d["id"], 0.0)} for d in resultados]


@router.get("/lomas/{id_loma}", response_model=LomaDetailModel)
def get_loma_detail(id_loma: str):
    """
    Retorna la ficha técnica y detallada de una loma específica junto a sus instrucciones de acceso y transporte público.
    """
    id_upper = id_loma.strip().upper()
    loma = DESTINOS_DICT.get(id_upper)

    if not loma:
        raise HTTPException(status_code=404, detail=f"Loma con ID '{id_loma}' no encontrada.")

    # Generar o enriquecer con guía de acceso logístico
    guia_raw = ACCESS_SERVICE.obtener_guia_acceso(id_upper)
    guia = GuiaAccesoModel(
        id=id_upper,
        nombre=guia_raw.get("nombre", loma["nombre"]),
        punto_partida_recomendado=guia_raw.get("punto_partida_recomendado", ""),
        medio_transporte=guia_raw.get("medio_transporte", loma.get("transporte_principal", "")),
        tiempo_total_min=guia_raw.get("tiempo_total_min", 60),
        costo_total_soles=guia_raw.get("costo_total_soles", loma.get("costo_estimado", 10.0)),
        pasos=guia_raw.get("pasos", []),
        coordenadas_destino=CoordenadasModel(
            lat=loma["coordenadas"]["lat"],
            lon=loma["coordenadas"]["lon"]
        )
    )

    return {**loma, "score_difuso": SCORES_DIFUSOS.get(id_upper, 0.0), "guia_acceso": guia}


@router.get("/presets", response_model=List[PresetZonaModel])
def get_presets_alojamiento():
    """
    Retorna los puntos de alojamiento y zonas de referencia rápida más comunes de Lima Metropolitana.
    """
    return PRESETS_LIMA
