"""Pronostico local de lomas con observaciones meteorologicas opcionales."""

import copy
import hashlib
import json
import math
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen


LIMA_TZ = timezone(timedelta(hours=-5))
DATA_DIR = Path(__file__).resolve().parents[1] / "data"


class LomaCastService:
    """Estima condiciones de visita sin depender de conectividad."""

    FASES = (
        "Fase 1: Reposo Estival",
        "Fase 2: Primeros Brotes de Niebla",
        "Fase 3: Alfombra Verde Activa",
        "Fase 4: Floracion Plena de Amancaes",
        "Fase 5: Semillado y Transicion",
    )
    DIAS = ("Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo")

    def __init__(self, catalogo=None, usar_red=None, ahora=None):
        if catalogo is None:
            catalogo = json.loads((DATA_DIR / "destinos.json").read_text(encoding="utf-8"))
        self.catalogo = catalogo if isinstance(catalogo, dict) else {d["id"]: d for d in catalogo}
        self.usar_red = usar_red if usar_red is not None else os.getenv("USE_LIVE_WEATHER") == "1"
        self.ahora = ahora or (lambda: datetime.now(LIMA_TZ))
        self._cache = {}
        self._cache_red = {}

    @staticmethod
    def _fase(mes):
        if mes in (1, 2, 3, 12):
            return 1
        if mes in (4, 5):
            return 2
        if mes == 6:
            return 3
        if mes in (7, 8, 9):
            return 4
        return 5

    @staticmethod
    def _horas_sol(fecha, lat, lon):
        dia = fecha.timetuple().tm_yday
        angulo = 2 * math.pi * (dia - 1) / 365
        ecuacion = 229.18 * (0.000075 + 0.001868 * math.cos(angulo)
                            - 0.032077 * math.sin(angulo) - 0.014615 * math.cos(2 * angulo)
                            - 0.040849 * math.sin(2 * angulo))
        declinacion = math.radians(23.44) * math.sin(2 * math.pi * (284 + dia) / 365)
        latitud = math.radians(lat)
        cos_h = ((math.sin(math.radians(-0.833)) - math.sin(latitud) * math.sin(declinacion))
                 / (math.cos(latitud) * math.cos(declinacion)))
        arco = math.degrees(math.acos(max(-1, min(1, cos_h)))) * 4
        mediodia = 720 - 4 * lon - ecuacion - 300

        def formato(minutos):
            valor = round(minutos) % 1440
            return f"{valor // 60:02d}:{valor % 60:02d}"

        return formato(mediodia - arco), formato(mediodia + arco - 45)

    def _consultar_open_meteo(self, loma, fecha):
        if not self.usar_red or os.getenv("USE_MOCK_LLM") == "1":
            return None
        key = (loma["id"], fecha.isoformat())
        previo = self._cache_red.get(key)
        if previo and time.monotonic() - previo[0] < 900:
            return previo[1]
        params = {
            "latitude": loma["coordenadas"]["lat"], "longitude": loma["coordenadas"]["lon"],
            "current": "temperature_2m,relative_humidity_2m,wind_speed_10m",
            "daily": "temperature_2m_min,temperature_2m_max,uv_index_max,sunrise,sunset",
            "hourly": "relative_humidity_2m", "timezone": "America/Lima", "forecast_days": 7,
        }
        resultado = None
        try:
            with urlopen("https://api.open-meteo.com/v1/forecast?" + urlencode(params), timeout=1.8) as response:
                data = json.load(response)
            daily = data["daily"]
            campos = ("time", "temperature_2m_min", "temperature_2m_max", "uv_index_max", "sunrise", "sunset")
            if (all(len(daily[campo]) == 7 for campo in campos)
                    and daily["time"][0] == fecha.isoformat()
                    and all(math.isfinite(float(v)) for campo in campos[1:4] for v in daily[campo])
                    and all(math.isfinite(float(data["current"][campo])) for campo in
                            ("temperature_2m", "relative_humidity_2m", "wind_speed_10m"))
                    and len(data["hourly"]["relative_humidity_2m"]) >= 168):
                for valor in daily["sunrise"] + daily["sunset"]:
                    datetime.fromisoformat(valor)
                for valor in data["hourly"]["relative_humidity_2m"][:168]:
                    if not math.isfinite(float(valor)):
                        raise ValueError("Humedad invalida")
                resultado = data
        except (OSError, ValueError, KeyError, TypeError, OverflowError):
            pass
        self._cache_red[key] = (time.monotonic(), resultado)
        return resultado

    def obtener_reporte(self, id_destino):
        did = id_destino.strip().upper()
        loma = self.catalogo[did]
        ahora = self.ahora()
        if ahora.tzinfo is None:
            ahora = ahora.replace(tzinfo=LIMA_TZ)
        ahora = ahora.astimezone(LIMA_TZ)
        key = (did, ahora.strftime("%Y%m%d%H"))
        cached = self._cache.get(key)
        if cached and time.monotonic() - cached[0] < 900:
            return copy.deepcopy(cached[1])
        observacion = self._consultar_open_meteo(loma, ahora.date())
        pronostico = []
        altitud = float(loma.get("altitud_max_msnm", 600))
        for i in range(7):
            fecha = ahora.date() + timedelta(days=i)
            semilla = int(hashlib.sha256(f"{did}:{fecha}".encode()).hexdigest()[:8], 16)
            variacion = (semilla % 100) / 100
            invierno = (1 + math.cos(2 * math.pi * (fecha.timetuple().tm_yday - 220) / 365)) / 2
            humedad = round(min(99, 64 + 27 * invierno + 7 * variacion))
            minima = round(19 - 5 * invierno - altitud * 0.003 + variacion, 1)
            maxima = round(minima + 4 + (1 - invierno) * 3, 1)
            am, pm = self._horas_sol(fecha, **loma["coordenadas"])
            if observacion:
                daily = observacion["daily"]
                minima, maxima = daily["temperature_2m_min"][i], daily["temperature_2m_max"][i]
                muestras = observacion["hourly"]["relative_humidity_2m"][i * 24:(i + 1) * 24]
                humedad = round(max(0, min(100, sum(muestras) / len(muestras))))
                am = datetime.fromisoformat(daily["sunrise"][i]).strftime("%H:%M")
                pm = (datetime.fromisoformat(daily["sunset"][i]) - timedelta(minutes=45)).strftime("%H:%M")
            probabilidad = round(max(0, min(100, (humedad - 50) * 1.7 + (altitud - 500) * 0.025)))
            barro = "Alto" if humedad >= 92 else "Moderado" if humedad >= 80 else "Bajo"
            pronostico.append({
                "fecha": fecha.isoformat(), "dia_nombre": self.DIAS[fecha.weekday()],
                "temp_min_c": minima, "temp_max_c": maxima, "humedad_pct": humedad,
                "probabilidad_colchon_nubes_pct": probabilidad, "ventana_colchon_nubes": "06:00 a 08:30",
                "golden_hour_am": am, "golden_hour_pm": pm, "nivel_barro": barro,
                "epic_score": round(max(0, min(10, probabilidad / 12 + (1 if barro != "Alto" else 0))), 1),
            })
        hoy = pronostico[0]
        fase = self._fase(ahora.month)
        current = observacion["current"] if observacion else {}
        reporte = {
            "loma_id": did, "nombre_loma": loma["nombre"], "actualizado_en": ahora.isoformat(),
            "fuente_datos": "Open Meteo y estimacion biofisica local" if observacion else "Estimacion biofisica local determinista",
            "temp_actual_c": current.get("temperature_2m", round((hoy["temp_min_c"] + hoy["temp_max_c"]) / 2, 1)),
            "humedad_actual_pct": round(max(0, min(100, current.get("relative_humidity_2m", hoy["humedad_pct"])))),
            "indice_uv": observacion["daily"]["uv_index_max"][0] if observacion else round(4 + (100 - hoy["humedad_pct"]) / 5, 1),
            "viento_kmh": current.get("wind_speed_10m", round(8 + altitud / 180, 1)),
            "fase_floracion_index": fase, "fase_floracion_nombre": self.FASES[fase - 1],
            "indice_verdor_actual": round(min(1, loma.get("clima_verdor_base", 7) / 10 * (0.95 if ahora.month in loma.get("meses_verdor", [6, 7, 8, 9, 10]) else 0.3)), 2),
            "probabilidad_colchon_hoy_pct": hoy["probabilidad_colchon_nubes_pct"],
            "ventana_optima_hoy": hoy["ventana_colchon_nubes"],
            "golden_hour_hoy": f'{hoy["golden_hour_am"]} AM / {hoy["golden_hour_pm"]} PM',
            "estado_sendero_barro": hoy["nivel_barro"],
            "mejor_dia_semana": max(pronostico, key=lambda d: d["epic_score"])["dia_nombre"],
            "pronostico_7_dias": pronostico,
        }
        self._cache = {k: v for k, v in self._cache.items() if k[1] == key[1]}
        self._cache[key] = (time.monotonic(), reporte)
        return copy.deepcopy(reporte)
