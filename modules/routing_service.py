"""Acceso multimodal y exportacion de circuitos geograficos."""

import copy
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET


DATA_DIR = Path(__file__).resolve().parents[1] / "data"
GPX_NS = "http://www.topografix.com/GPX/1/1"


def haversine(lat1, lon1, lat2, lon2):
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((phi2 - phi1) / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(max(0, min(1, a))))


class LastMileRoutingService:
    """Combina nodos troncales reales con estimaciones locales de conexiones."""

    ESTACIONES = (
        ("Metropolitano Naranjal", -11.9826, -77.0593),
        ("Metropolitano Central", -12.0576, -77.0365),
        ("Metropolitano Matellini", -12.1711, -77.0240),
        ("Linea 1 Bayovar", -11.9592, -76.9814),
        ("Linea 1 Miguel Grau", -12.0599, -77.0112),
        ("Linea 1 Maria Auxiliadora", -12.1671, -76.9585),
        ("Linea 1 Villa El Salvador", -12.2073, -76.9331),
    )

    def __init__(self, catalogo=None, senderos=None):
        if catalogo is None:
            catalogo = json.loads((DATA_DIR / "destinos.json").read_text(encoding="utf-8"))
        self.catalogo = catalogo if isinstance(catalogo, dict) else {d["id"]: d for d in catalogo}
        if senderos is None:
            senderos = json.loads((DATA_DIR / "senderos_lomas.geojson").read_text(encoding="utf-8"))
        self.senderos = {f["properties"]["loma_id"]: f for f in senderos["features"]}

    def calcular_ruta_ultima_milla(self, id_destino, origen_lat=-12.0464, origen_lon=-77.0428):
        if not (math.isfinite(origen_lat) and math.isfinite(origen_lon)
                and -90 <= origen_lat <= 90 and -180 <= origen_lon <= 180):
            raise ValueError("Coordenadas de origen invalidas")
        loma = self.catalogo[id_destino.strip().upper()]
        garita = loma.get("garita_control") or {**loma["coordenadas"], "nombre": "Ingreso al circuito"}
        destino = [garita["lat"], garita["lon"]]
        origen = [origen_lat, origen_lon]
        estacion = min(self.ESTACIONES, key=lambda e: haversine(*origen, e[1], e[2]))
        distancia = haversine(*origen, *destino)
        tarifa = loma.get("tarifario_oficial", {}).get("mototaxi_justo_pen", 4.0)
        tiempo_directo = max(1, round(distancia * 1.35 / 32 * 60))
        acceso_km = haversine(*origen, estacion[1], estacion[2])
        conexion_km = haversine(estacion[1], estacion[2], *destino)
        tiempo_smart = max(tiempo_directo + 10, round(acceso_km / 20 * 60 + conexion_km / 35 * 60 + 18))
        tiempo_publico = max(tiempo_smart + 15, round(acceso_km / 15 * 60 + conexion_km / 22 * 60 + 25))
        costo_publico = round(3.2 + max(2, conexion_km * 0.10) + tarifa, 2)
        costo_smart = round(max(costo_publico + 2, 3.2 + conexion_km * 0.65), 2)
        costo_taxi = round(max(10, distancia * 1.35 * 1.8, costo_smart + 2), 2)

        def modo(nombre, etiqueta, tiempo, costo, grupal, pasos):
            return {"modo": nombre, "etiqueta": etiqueta, "tiempo_estimado_min": tiempo,
                    "costo_por_persona_pen": costo, "costo_grupal_4_pen": round(grupal, 2),
                    "resumen_ruta": " > ".join(pasos), "pasos": pasos}

        modos = [
            modo("mochilero", "100% Transporte Publico", tiempo_publico, costo_publico, costo_publico * 4,
                 [f"Llegar a {estacion[0]}", "Tomar troncal y combi o alimentador hacia " + loma.get("distrito", "la loma"),
                  f"Mototaxi a {garita['nombre']}: tarifa justa S/ {tarifa:.2f}"]),
            modo("smart", "Hibrido Smart (Tren/Metropolitano + Colectivo/Taxi Final)", tiempo_smart, costo_smart, costo_smart * 4,
                 [f"Conectar con {estacion[0]}", f"Troncal y colectivo o taxi final a {garita['nombre']}"]),
            modo("directo", "Auto Propio o Taxi Directo a Garita", tiempo_directo, costo_taxi, costo_taxi,
                 [f"Taxi directo o auto propio hasta {garita['nombre']}", "Dividir la tarifa estimada de taxi entre cuatro amigos"]),
        ]
        nodos = [origen, [estacion[1], estacion[2]], [estacion[1], destino[1]], destino]
        geometria = []
        for inicio, fin in zip(nodos, nodos[1:]):
            for j in range(6):
                punto = [inicio[k] + (fin[k] - inicio[k]) * j / 6 for k in (0, 1)]
                if not geometria or punto != geometria[-1]:
                    geometria.append(punto)
        geometria.append(destino)
        return {"modos_transporte": modos, "geometria_vial": geometria,
                "fuente_geometria": "Interpolacion local aproximada sobre nodos troncales",
                "distancia_haversine_km": round(distancia, 4), "estacion_troncal": estacion[0],
                "tarifa_justa_mototaxi_pen": tarifa,
                "ultimo_transporte_retorno": garita.get("ultimo_transporte_retorno", "17:30"),
                "garita_nombre": garita["nombre"]}

    def obtener_perfil_sendero(self, id_destino):
        did = id_destino.strip().upper()
        loma = self.catalogo[did]
        feature = self.senderos[did]
        coords = copy.deepcopy(feature["geometry"]["coordinates"])
        perfil = []
        distancia = ascenso = 0.0
        altitudes = [p[2] for p in coords]
        alt_min, alt_max = min(altitudes), max(altitudes)
        for i, punto in enumerate(coords):
            tramo = desnivel = 0.0
            if i:
                previo = coords[i - 1]
                tramo = haversine(previo[1], previo[0], punto[1], punto[0])
                desnivel = punto[2] - previo[2]
                distancia += tramo
                ascenso += max(0, desnivel)
            proporcion = (punto[2] - alt_min) / max(1, alt_max - alt_min)
            superficie = "roca_granito" if proporcion > 0.7 else "barro_arcilloso" if proporcion > 0.3 else "tierra_compacta"
            perfil.append({"distancia_km": round(distancia, 6), "altitud_msnm": punto[2],
                           "pendiente_pct": round(desnivel / (tramo * 1000) * 100, 2) if tramo else 0.0,
                           "superficie": superficie})
        return {"loma_id": did, "nombre_circuito": feature["properties"]["nombre_circuito"],
                "distancia_km": round(distancia, 6), "desnivel_positivo_m": round(ascenso, 2),
                "altitud_min_msnm": alt_min, "altitud_max_msnm": alt_max,
                "coordenadas_3d": coords, "waypoints": copy.deepcopy(feature["properties"].get("waypoints", [])),
                "perfil_elevacion": perfil, "composicion_terreno": copy.deepcopy(loma.get("composicion_terreno", {}))}

    def generar_gpx_xml(self, id_destino):
        sendero = self.obtener_perfil_sendero(id_destino)
        ET.register_namespace("", GPX_NS)

        def sub(padre, nombre, texto=None, **atributos):
            elemento = ET.SubElement(padre, f"{{{GPX_NS}}}{nombre}", atributos)
            elemento.text = texto
            return elemento

        root = ET.Element(f"{{{GPX_NS}}}gpx", {"version": "1.1", "creator": "Lomosoma"})
        metadata = sub(root, "metadata")
        sub(metadata, "name", sendero["nombre_circuito"])
        for waypoint in sendero["waypoints"]:
            wpt = sub(root, "wpt", lat=str(waypoint["lat"]), lon=str(waypoint["lon"]))
            sub(wpt, "ele", str(waypoint["altitud_msnm"]))
            sub(wpt, "name", waypoint["nombre"])
            sub(wpt, "type", waypoint["tipo"])
        track = sub(root, "trk")
        sub(track, "name", sendero["nombre_circuito"])
        segment = sub(track, "trkseg")
        for lon, lat, ele in sendero["coordenadas_3d"]:
            sub(sub(segment, "trkpt", lat=str(lat), lon=str(lon)), "ele", str(ele))
        return ET.tostring(root, encoding="utf-8", xml_declaration=True).decode("utf-8")

    @staticmethod
    def calcular_checksum(pack):
        payload = {k: v for k, v in pack.items() if k != "checksum_sha256"}
        return hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode("utf-8")).hexdigest()

    def generar_offline_pack(self, id_destino, loma_detail, lomacast):
        did = id_destino.strip().upper()
        pack = {"loma_id": did, "version_pack": "2.0", "generado_en": datetime.now(timezone.utc).isoformat(),
                "loma": copy.deepcopy(loma_detail), "lomacast": copy.deepcopy(lomacast),
                "sendero": self.obtener_perfil_sendero(did), "guia_acceso": copy.deepcopy(loma_detail["guia_acceso"]),
                "gpx_xml": self.generar_gpx_xml(did)}
        pack["checksum_sha256"] = self.calcular_checksum(pack)
        return pack
