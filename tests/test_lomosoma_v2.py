"""Verificacion de clima, rutas, maletin offline y licencias de demostracion."""

import base64
import copy
import hashlib
import hmac
import io
import json
import math
from datetime import datetime, timedelta
from unittest.mock import Mock
from xml.etree import ElementTree as ET

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.api import routes_billing, routes_lomas
from backend.app.schemas.api_models import LomaCastReportModel, SenderoProfileModel
from modules.access_module import LomasAccessService
from modules.dtos import CoordenadasDTO, FuzzySemanticPreferencesDTO, UserPreferencesDTO
from modules.mapping import LomasMappingService
from modules.pipeline import LomasPipelineOrchestrator
from modules.routing_service import GPX_NS, LastMileRoutingService, haversine
from modules.weather_service import LIMA_TZ, LomaCastService


@pytest.fixture
def client():
    with TestClient(app) as instance:
        yield instance


@pytest.fixture
def clima():
    return LomaCastService(usar_red=False, ahora=lambda: datetime(2026, 8, 10, 7, tzinfo=LIMA_TZ))


@pytest.fixture
def rutas():
    return LastMileRoutingService()


def test_lomacast_determinista_siete_dias_y_cache_aislada(clima):
    reporte = clima.obtener_reporte(" l0 ")
    LomaCastReportModel.model_validate(reporte)
    assert reporte == clima.obtener_reporte("L0")
    assert "determinista" in reporte["fuente_datos"]
    assert len(reporte["pronostico_7_dias"]) == 7
    for i, dia in enumerate(reporte["pronostico_7_dias"]):
        assert dia["fecha"] == (datetime(2026, 8, 10) + timedelta(days=i)).date().isoformat()
        assert 0 <= dia["humedad_pct"] <= 100
        assert 0 <= dia["probabilidad_colchon_nubes_pct"] <= 100
        assert dia["temp_min_c"] <= dia["temp_max_c"]
        assert 0 <= dia["epic_score"] <= 10
        assert dia["nivel_barro"] in ("Bajo", "Moderado", "Alto")
        for campo in ("golden_hour_am", "golden_hour_pm"):
            datetime.strptime(dia[campo], "%H:%M")
    reporte["pronostico_7_dias"].clear()
    assert len(clima.obtener_reporte("L0")["pronostico_7_dias"]) == 7


@pytest.mark.parametrize("mes,fase", [(2, 1), (5, 2), (6, 3), (8, 4), (10, 5)])
def test_cinco_fases_de_amancaes(mes, fase):
    service = LomaCastService(usar_red=False, ahora=lambda: datetime(2026, mes, 10, tzinfo=LIMA_TZ))
    reporte = service.obtener_reporte("L0")
    assert reporte["fase_floracion_index"] == fase
    assert reporte["fase_floracion_nombre"] == service.FASES[fase - 1]


@pytest.mark.parametrize("problema", [OSError("sin red"), ValueError("JSON invalido")])
def test_lomacast_fallback_timeout_y_cache_negativa(monkeypatch, problema):
    monkeypatch.delenv("USE_MOCK_LLM", raising=False)
    abrir = Mock(side_effect=problema)
    monkeypatch.setattr("modules.weather_service.urlopen", abrir)
    service = LomaCastService(usar_red=True)
    reporte = service.obtener_reporte("L0")
    assert len(reporte["pronostico_7_dias"]) == 7
    assert "determinista" in reporte["fuente_datos"]
    service.obtener_reporte("L0")
    assert abrir.call_count == 1
    assert abrir.call_args.kwargs["timeout"] == 1.8


def test_lomacast_open_meteo_aplica_observaciones(monkeypatch):
    monkeypatch.delenv("USE_MOCK_LLM", raising=False)
    fecha = datetime(2026, 8, 10, 7, tzinfo=LIMA_TZ)
    dias = [(fecha + timedelta(days=i)).date().isoformat() for i in range(7)]
    payload = {"current": {"temperature_2m": 15.2, "relative_humidity_2m": 94, "wind_speed_10m": 12.5},
               "daily": {"time": dias, "temperature_2m_min": [12] * 7, "temperature_2m_max": [18] * 7,
                         "uv_index_max": [3.1] * 7, "sunrise": [d + "T06:15" for d in dias],
                         "sunset": [d + "T18:00" for d in dias]},
               "hourly": {"relative_humidity_2m": [95] * 168}}
    monkeypatch.setattr("modules.weather_service.urlopen", lambda *a, **k: io.StringIO(json.dumps(payload)))
    service = LomaCastService(usar_red=True, ahora=lambda: fecha)
    reporte = service.obtener_reporte("L0")
    assert "Open Meteo" in reporte["fuente_datos"]
    assert reporte["temp_actual_c"] == 15.2
    assert reporte["humedad_actual_pct"] == 94
    assert reporte["pronostico_7_dias"][0]["golden_hour_pm"] == "17:15"
    assert reporte["pronostico_7_dias"][0]["nivel_barro"] == "Alto"


def test_citymapper_origen_dinamico_y_garita(rutas):
    centro = rutas.calcular_ruta_ultima_milla("L0")
    sur = rutas.calcular_ruta_ultima_milla("L0", -12.17, -76.96)
    assert centro["estacion_troncal"] != sur["estacion_troncal"]
    assert centro["distancia_haversine_km"] != sur["distancia_haversine_km"]
    assert centro["geometria_vial"][0] == [-12.0464, -77.0428]
    garita = rutas.catalogo["L0"]["garita_control"]
    assert centro["geometria_vial"][-1] == [garita["lat"], garita["lon"]]
    esperado = haversine(-12.0464, -77.0428, garita["lat"], garita["lon"])
    assert centro["distancia_haversine_km"] == pytest.approx(esperado, abs=0.0001)
    publico, smart, directo = centro["modos_transporte"]
    assert [m["modo"] for m in centro["modos_transporte"]] == ["mochilero", "smart", "directo"]
    assert publico["costo_por_persona_pen"] < smart["costo_por_persona_pen"] < directo["costo_por_persona_pen"]
    assert publico["tiempo_estimado_min"] > smart["tiempo_estimado_min"] > directo["tiempo_estimado_min"]
    assert directo["costo_grupal_4_pen"] == directo["costo_por_persona_pen"]
    assert "aproximada" in centro["fuente_geometria"]
    cero = rutas.calcular_ruta_ultima_milla("L0", garita["lat"], garita["lon"])
    assert cero["distancia_haversine_km"] == 0


@pytest.mark.parametrize("lat,lon", [(91, -77), (-12, 181), (math.nan, -77)])
def test_rutas_rechaza_coordenadas_invalidas(rutas, lat, lon):
    with pytest.raises(ValueError):
        rutas.calcular_ruta_ultima_milla("L0", lat, lon)


def test_perfil_calculado_desde_puntos_geojson(rutas):
    perfil = rutas.obtener_perfil_sendero("L0")
    SenderoProfileModel.model_validate(perfil)
    coords = rutas.senderos["L0"]["geometry"]["coordinates"]
    assert perfil["coordenadas_3d"] == coords
    distancia = sum(haversine(a[1], a[0], b[1], b[0]) for a, b in zip(coords, coords[1:]))
    assert perfil["distancia_km"] == pytest.approx(distancia, abs=0.000001)
    assert perfil["perfil_elevacion"][-1]["distancia_km"] == perfil["distancia_km"]
    assert perfil["desnivel_positivo_m"] == sum(max(0, b[2] - a[2]) for a, b in zip(coords, coords[1:]))
    assert perfil["altitud_max_msnm"] == max(p[2] for p in coords)
    assert len({p["superficie"] for p in perfil["perfil_elevacion"]}) == 3
    a, b = coords[:2]
    assert perfil["perfil_elevacion"][1]["pendiente_pct"] == pytest.approx((b[2] - a[2]) / (haversine(a[1], a[0], b[1], b[0]) * 10), abs=0.01)


def test_gpx_estandar_preserva_waypoints_y_altitudes(rutas):
    root = ET.fromstring(rutas.generar_gpx_xml("L0"))
    ns = {"g": GPX_NS}
    assert root.tag == f"{{{GPX_NS}}}gpx"
    assert root.attrib["version"] == "1.1"
    perfil = rutas.obtener_perfil_sendero("L0")
    assert len(root.findall("g:wpt", ns)) == len(perfil["waypoints"])
    puntos = root.findall("g:trk/g:trkseg/g:trkpt", ns)
    assert len(puntos) == len(perfil["coordenadas_3d"])
    for xml, (lon, lat, ele) in zip(puntos, perfil["coordenadas_3d"]):
        assert float(xml.attrib["lat"]) == lat
        assert float(xml.attrib["lon"]) == lon
        assert float(xml.find("g:ele", ns).text) == ele


def test_guia_preserva_contrato_y_coordenada_cero():
    service = LomasAccessService()
    guia = service.obtener_guia_acceso("L0", 0, 0)
    assert {"nombre", "punto_partida_recomendado", "medio_transporte", "tiempo_total_min",
            "costo_total_soles", "pasos", "recomendaciones", "modos_transporte", "geometria_vial",
            "tarifa_justa_mototaxi_pen", "ultimo_transporte_retorno", "garita_nombre"} <= guia.keys()
    assert guia["geometria_vial"][0] == [0, 0]


def test_catalogo_filtro_natural_y_resumen(client):
    todos = client.get("/api/lomas").json()
    naturales = client.get("/api/lomas?solo_naturales=true").json()
    assert len(todos) == 15
    assert len(naturales) == 13
    assert len(client.get("/api/lomas?solo_naturales=false").json()) == 15
    assert all(d["es_loma_natural"] for d in naturales)
    assert all(d["lomacast_resumen"]["fase_floracion_index"] in range(1, 6) for d in todos)


@pytest.mark.parametrize("did", [f"L{i}" for i in range(15)])
def test_detalle_y_servicios_para_todo_catalogo(client, did):
    response = client.get(f"/api/lomas/{did}", params={"user_lat": -12.17, "user_lon": -76.96})
    assert response.status_code == 200, response.text
    data = response.json()
    assert len(data["guia_acceso"]["modos_transporte"]) == 3
    assert data["guia_acceso"]["geometria_vial"][0] == [-12.17, -76.96]
    assert len(data["lomacast"]["pronostico_7_dias"]) == 7
    assert data["sendero"]["loma_id"] == did


@pytest.mark.parametrize("endpoint", ["lomacast", "sendero", "gpx", "offline-pack"])
def test_nuevos_endpoints_y_404(client, endpoint):
    response = client.get(f"/api/lomas/L0/{endpoint}")
    assert response.status_code == 200, response.text
    assert client.get(f"/api/lomas/NO_EXISTE/{endpoint}").status_code == 404
    if endpoint == "gpx":
        assert response.headers["content-type"].startswith("application/gpx+xml")
        ET.fromstring(response.content)


def test_offline_checksum_sobre_respuesta_http_y_alteracion(client, rutas):
    response = client.get("/api/lomas/L0/offline-pack", params={"user_lat": -12.17, "user_lon": -76.96})
    assert response.status_code == 200
    pack = response.json()
    checksum = pack.pop("checksum_sha256")
    calculado = hashlib.sha256(json.dumps(pack, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode()).hexdigest()
    assert checksum == calculado
    assert len(checksum) == 64
    assert pack["guia_acceso"] == pack["loma"]["guia_acceso"]
    assert pack["guia_acceso"]["geometria_vial"][0] == [-12.17, -76.96]
    assert pack["sendero"] == pack["loma"]["sendero"]
    assert pack["lomacast"] == pack["loma"]["lomacast"]
    pack["guia_acceso"]["pasos"].append("Alterado")
    assert rutas.calcular_checksum(pack) != checksum


def test_reportes_en_memoria_y_validacion(client):
    with routes_lomas.REPORTES_LOCK:
        anteriores = copy.deepcopy(routes_lomas.REPORTES["L0"])
    try:
        payload = {"autor": "Visitante", "comentario": "Niebla al amanecer", "flor_amancaes_vista": True}
        response = client.post("/api/lomas/L0/reportes", json=payload)
        assert response.status_code == 201
        reporte = response.json()
        recientes = client.get("/api/lomas/L0").json()["reportes_recientes"]
        assert recientes[0] == reporte
        assert client.post("/api/lomas/NO_EXISTE/reportes", json=payload).status_code == 404
        assert client.post("/api/lomas/L0/reportes", json={"comentario": " "}).status_code == 422
        assert client.post("/api/lomas/L0/reportes", json={"comentario": "x" * 2001}).status_code == 422
    finally:
        with routes_lomas.REPORTES_LOCK:
            routes_lomas.REPORTES["L0"] = anteriores


@pytest.mark.parametrize("query", ["user_lat=91&user_lon=0", "user_lat=0&user_lon=181", "user_lat=0", "user_lon=0"])
def test_coordenadas_api_invalidas(client, query):
    assert client.get("/api/lomas/L0?" + query).status_code == 422
    assert client.get("/api/lomas/L0/offline-pack?" + query).status_code == 422


def test_planes_pago_unico(client):
    response = client.get("/api/billing/plans")
    assert response.status_code == 200
    planes = response.json()
    assert {p["plan_id"]: p["precio_pen"] for p in planes} == {"pack_lima_pro": 19.9, "loma_individual": 4.9}
    assert all(p["tipo_pago"] == "pago_unico" for p in planes)


@pytest.mark.parametrize("plan,metodo", [("pack_lima_pro", "yape_plin"), ("loma_individual", "tarjeta")])
def test_checkout_licencia_firmada_y_alcance(client, plan, metodo):
    response = client.post("/api/billing/checkout", json={"plan_id": plan, "loma_id": "L1", "metodo_pago": metodo})
    assert response.status_code == 200
    data = response.json()
    assert data["estado"] == "aprobado_demo"
    assert data["acceso_total_lima"] == (plan == "pack_lima_pro")
    assert len(data["lomas_desbloqueadas"]) == (15 if data["acceso_total_lima"] else 1)
    assert data["monto_pagado_pen"] == (19.9 if data["acceso_total_lima"] else 4.9)
    payload, firma = data["token_licencia"].split(".")
    esperado = hmac.new(routes_billing.SIGNING_KEY, payload.encode(), hashlib.sha256).hexdigest()
    assert hmac.compare_digest(firma, esperado)
    claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    assert claims["lomas_desbloqueadas"] == data["lomas_desbloqueadas"]
    assert claims["entorno"] == "demo"
    assert not hmac.compare_digest(firma, hmac.new(routes_billing.SIGNING_KEY, (payload + "x").encode(), hashlib.sha256).hexdigest())


@pytest.mark.parametrize("payload,status", [({"plan_id": "suscripcion"}, 422),
                                              ({"plan_id": "loma_individual"}, 422),
                                              ({"plan_id": "loma_individual", "loma_id": "NO_EXISTE"}, 404),
                                              ({"plan_id": "pack_lima_pro", "metodo_pago": "otro"}, 422)])
def test_checkout_rechaza_solicitudes_invalidas(client, payload, status):
    assert client.post("/api/billing/checkout", json=payload).status_code == status


def test_afinidad_semantica_y_checklist_modifican_resultado(monkeypatch):
    monkeypatch.setenv("USE_MOCK_LLM", "1")
    service = LomasPipelineOrchestrator()
    preferencias = FuzzySemanticPreferencesDTO(clima_preferido="Garua", intereses=["Arqueologia", "Fotografia"])
    beneficios = LomasMappingService.calcular_beneficios_personalizados(service.destinos, preferencias)
    neutros = LomasMappingService.calcular_beneficios_personalizados(service.destinos, FuzzySemanticPreferencesDTO(intereses=[]))
    assert beneficios != neutros
    llm = Mock()
    llm.extraer_preferencias_cualitativas.return_value = preferencias
    llm.generar_itinerario_narrativo.return_value = "Itinerario de prueba"
    llm.ultimo_origen = "fallback"
    service.llm_service = llm
    origen = CoordenadasDTO(lat=-12.17, lon=-76.96)
    result = service.run(UserPreferencesDTO(dias_disponibles=1, presupuesto_max=100, nodo_base=origen))
    esperado = max(service.destinos, key=lambda d: beneficios[d["id"]] - 0.15 * service.fuzzy_engine.calcular_riesgos_catalogo(service.destinos)[d["id"]])
    assert result.ruta_ids == [esperado["id"]]
    assert result.tramos == []
    assert result.afinidad_Destinos == beneficios
    assert result.checklist_equipamiento
    assert "Camara con proteccion contra humedad" in result.checklist_equipamiento
    assert result.guias_acceso[0]["geometria_vial"][0] == [origen.lat, origen.lon]


def test_optimize_expone_afinidad_y_checklist(client, monkeypatch):
    monkeypatch.setenv("USE_MOCK_LLM", "1")
    response = client.post("/api/optimize", json={"dias_disponibles": 1, "presupuesto_max": 100,
                                                "texto_usuario": "Quiero fotografiar miradores con garua"})
    assert response.status_code == 200
    data = response.json()
    assert len(data["afinidad_destinos"]) == 15
    assert len(data["checklist_equipamiento"]) >= 6
    assert data["tramos"] == []


def test_servicios_rechazan_destino_desconocido(clima, rutas):
    for metodo in (clima.obtener_reporte, rutas.obtener_perfil_sendero, rutas.calcular_ruta_ultima_milla, rutas.generar_gpx_xml):
        with pytest.raises(KeyError):
            metodo("NO_EXISTE")
