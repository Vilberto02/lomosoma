"""
Endpoints para la gestión del catálogo de lomas, búsqueda y presets de ubicación.
"""

import os
import json
from collections import defaultdict, deque
from datetime import datetime, timezone
from threading import Lock
from uuid import uuid4
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Response

from backend.app.schemas.api_models import (
    LomaSummaryModel,
    LomaDetailModel,
    GuiaAccesoModel,
    CoordenadasModel,
    PresetZonaModel,
    LomaCastReportModel,
    SenderoProfileModel,
    OfflinePackResponseModel,
    ReporteCiudadanoCreateRequest,
    ReporteCiudadanoModel,
)
from modules.access_module import LomasAccessService
from modules.fuzzy_module import LomasFuzzyEngine
from modules.weather_service import LomaCastService
from modules.routing_service import LastMileRoutingService

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
WEATHER_SERVICE = LomaCastService(DESTINOS_DICT)
ROUTING_SERVICE = LastMileRoutingService(DESTINOS_DICT)
REPORTES = defaultdict(lambda: deque(maxlen=100))
REPORTES_LOCK = Lock()


def _obtener_loma(id_loma):
    did = id_loma.strip().upper()
    if did not in DESTINOS_DICT:
        raise HTTPException(status_code=404, detail="Loma no encontrada")
    return did, DESTINOS_DICT[did]


def _resumen_clima(did):
    reporte = WEATHER_SERVICE.obtener_reporte(did)
    return {k: reporte[k] for k in ("fase_floracion_index", "fase_floracion_nombre", "indice_verdor_actual",
                                    "probabilidad_colchon_hoy_pct", "estado_sendero_barro", "temp_actual_c")}

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
    dificultad: Optional[str] = Query(None, description="Filtrar por dificultad (Fácil, Moderado, Difícil)"),
    solo_naturales: Optional[bool] = Query(None),
):
    """
    Retorna la lista completa de las lomas de Lima con soporte para búsqueda y filtros reactivos.
    """
    resultados = DESTINOS
    if solo_naturales is True:
        resultados = [d for d in resultados if d.get("es_loma_natural", True)]

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

    return [{**d, "score_difuso": SCORES_DIFUSOS.get(d["id"], 0.0), "lomacast_resumen": _resumen_clima(d["id"])} for d in resultados]


@router.get("/lomas/{id_loma}", response_model=LomaDetailModel)
def get_loma_detail(id_loma: str, user_lat: Optional[float] = Query(None, ge=-90, le=90),
                    user_lon: Optional[float] = Query(None, ge=-180, le=180)):
    """
    Retorna la ficha técnica y detallada de una loma específica junto a sus instrucciones de acceso y transporte público.
    """
    id_upper, loma = _obtener_loma(id_loma)
    if (user_lat is None) != (user_lon is None):
        raise HTTPException(status_code=422, detail="Enviar user_lat y user_lon juntos")
    guia_raw = ACCESS_SERVICE.obtener_guia_acceso(id_upper, user_lat, user_lon)
    garita = loma.get("garita_control") or loma["coordenadas"]
    guia = GuiaAccesoModel(**guia_raw, id=id_upper,
                          coordenadas_destino=CoordenadasModel(lat=garita["lat"], lon=garita["lon"]))
    with REPORTES_LOCK:
        recientes = list(REPORTES[id_upper])
    return {**loma, "score_difuso": SCORES_DIFUSOS.get(id_upper, 0.0), "guia_acceso": guia,
            "lomacast_resumen": _resumen_clima(id_upper), "lomacast": WEATHER_SERVICE.obtener_reporte(id_upper),
            "sendero": ROUTING_SERVICE.obtener_perfil_sendero(id_upper), "reportes_recientes": recientes}


@router.get("/lomas/{id_loma}/lomacast", response_model=LomaCastReportModel)
def get_lomacast(id_loma: str):
    did, _ = _obtener_loma(id_loma)
    return WEATHER_SERVICE.obtener_reporte(did)


@router.get("/lomas/{id_loma}/sendero", response_model=SenderoProfileModel)
def get_sendero(id_loma: str):
    did, _ = _obtener_loma(id_loma)
    return ROUTING_SERVICE.obtener_perfil_sendero(did)


@router.get("/lomas/{id_loma}/gpx")
def get_gpx(id_loma: str):
    did, _ = _obtener_loma(id_loma)
    return Response(content=ROUTING_SERVICE.generar_gpx_xml(did), media_type="application/gpx+xml",
                    headers={"Content-Disposition": f'attachment; filename="lomosoma_{did}.gpx"'})


@router.get("/lomas/{id_loma}/offline-pack", response_model=OfflinePackResponseModel)
def get_offline_pack(id_loma: str, user_lat: Optional[float] = Query(None, ge=-90, le=90),
                     user_lon: Optional[float] = Query(None, ge=-180, le=180)):
    detail = LomaDetailModel.model_validate(get_loma_detail(id_loma, user_lat, user_lon)).model_dump(mode="json")
    pack = ROUTING_SERVICE.generar_offline_pack(detail["id"], detail, detail["lomacast"])
    pack = OfflinePackResponseModel.model_validate(pack).model_dump(mode="json")
    pack["checksum_sha256"] = ROUTING_SERVICE.calcular_checksum(pack)
    return pack


@router.post("/lomas/{id_loma}/reportes", response_model=ReporteCiudadanoModel, status_code=201)
def post_reporte(id_loma: str, request: ReporteCiudadanoCreateRequest):
    did, _ = _obtener_loma(id_loma)
    if not request.comentario.strip() or len(request.comentario) > 2000:
        raise HTTPException(status_code=422, detail="Comentario requerido con maximo de 2000 caracteres")
    reporte = ReporteCiudadanoModel(**request.model_dump(), id=uuid4().hex, loma_id=did,
                                    fecha_iso=datetime.now(timezone.utc).isoformat())
    with REPORTES_LOCK:
        REPORTES[did].appendleft(reporte)
    return reporte


@router.get("/presets", response_model=List[PresetZonaModel])
def get_presets_alojamiento():
    """
    Retorna los puntos de alojamiento y zonas de referencia rápida más comunes de Lima Metropolitana.
    """
    return PRESETS_LIMA
