"""
Módulo 1: Procesamiento de Lenguaje Natural e IA Generativa (POO).
Implementa LomasLLMService con integración nativa al SDK de Google Gemini
y arquitectura de fallback heurístico/estático tolerante a fallos.
"""

import os
import re
import json
import logging
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

from modules.dtos import FuzzySemanticPreferencesDTO

# Carga variables de entorno desde .env
load_dotenv()

# Logger del módulo
logger = logging.getLogger("LomasLLMService")

# Importación condicional del SDK oficial de Google GenAI
try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False
    logger.warning("El paquete 'google-genai' no está instalado. Se utilizarán fallbacks locales.")


class LomasLLMService:
    """Servicio de Procesamiento de Lenguaje Natural e IA Generativa con Google Gemini para Trekking."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        if api_key is not None:
            self.api_key = api_key.strip() if api_key.strip() else None
        else:
            self.api_key = (
                os.getenv("GEMINI_API_KEY")
                or os.getenv("GOOGLE_API_KEY")
                or os.getenv("OPENAI_API_KEY")
            )
        self.model_name = model or os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
        self.client = None
        self.ultimo_origen = "fallback"

        mock_mode = os.getenv("USE_MOCK_LLM", "").strip().lower() in ("1", "true", "yes")
        if mock_mode:
            logger.info("USE_MOCK_LLM activo: se forzarán los fallbacks locales sin llamar a Gemini.")
        elif self.api_key and GENAI_AVAILABLE:
            try:
                self.client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.warning(f"No se pudo inicializar el cliente de Gemini: {e}")
                self.client = None

    def is_gemini_active(self) -> bool:
        """Indica si el cliente de Gemini está configurado y listo para recibir peticiones."""
        return self.client is not None

    def extraer_preferencias_cualitativas(self, texto: Optional[str]) -> FuzzySemanticPreferencesDTO:
        """
        Extrae variables semánticas cualitativas (clima preferido, intereses, sensibilidad a saturación y seguridad)
        a partir del texto libre del usuario mediante Gemini o fallback heurístico.
        """
        if not texto or not str(texto).strip():
            return FuzzySemanticPreferencesDTO()

        if self.is_gemini_active():
            try:
                resultado = self._extraer_con_api(texto)
                if resultado:
                    self.ultimo_origen = "gemini"
                    return resultado
            except Exception as e:
                logger.warning(f"Error al llamar a la API de Gemini en extraer_preferencias_cualitativas: {e}")

        self.ultimo_origen = "fallback"
        return self._extraer_fallback_heuristico(texto)

    @staticmethod
    def _sanitizar_y_cargar_json(raw_text: str) -> Optional[Dict[str, Any]]:
        """Limpia bloques markdown y carga JSON de manera resiliente."""
        if not raw_text or not raw_text.strip():
            return None

        texto = raw_text.strip()
        # Remover bloques de código markdown ```json ... ```
        if "```" in texto:
            patron = r"```(?:json)?\s*([\s\S]*?)\s*```"
            matches = re.findall(patron, texto, re.IGNORECASE)
            if matches:
                texto = matches[0].strip()

        try:
            return json.loads(texto)
        except json.JSONDecodeError:
            # Intento de extracción de primer objeto { ... }
            llave_inicio = texto.find("{")
            llave_fin = texto.rfind("}")
            if llave_inicio != -1 and llave_fin != -1 and llave_fin > llave_inicio:
                try:
                    return json.loads(texto[llave_inicio:llave_fin + 1])
                except json.JSONDecodeError:
                    pass
        return None

    def _extraer_con_api(self, texto: str) -> FuzzySemanticPreferencesDTO:
        """Utiliza Google Gemini para extraer con precisión semántica las preferencias cualitativas."""
        prompt = f"""
Eres un asistente experto en trekking y ecoturismo en las Lomas de Lima (Perú).
Analiza el siguiente texto de preferencias expresado por un turista y extrae en formato JSON estructurado:

1. "clima_preferido": Debe ser exactamente "Soleado" o "Garúa" (si prefiere vegetación verde, neblina o garúa elige "Garúa"; si prefiere despejado, sol o calor elige "Soleado").
2. "intereses": Lista de strings con los temas de interés del usuario (ejemplos válidos: "Naturaleza", "Senderismo", "Arqueología", "Vistas Panorámicas", "Fotografía", "Aves y Fauna", "Tranquilidad").
3. "sensibilidad_saturacion": Float entre 0.5 y 1.5. Valor 1.0 es estándar; 1.3 a 1.5 si el usuario expresa explícitamente aversión a multitudes, ruido o busca aislamiento/poca gente; 0.7 si no le importa la afluencia.
4. "sensibilidad_seguridad": Float entre 0.5 y 1.5. Valor 1.0 es estándar; 1.3 a 1.5 si el usuario pide rutas muy seguras, vigilancia o tiene preocupación por la seguridad; 0.8 si busca aventura sin restricciones.

Texto del usuario:
\"\"\"{texto}\"\"\"

Responde ÚNICAMENTE con el objeto JSON válido con las 4 llaves requeridas.
"""
        config = types.GenerateContentConfig(
            temperature=0.1,
            response_mime_type="application/json",
        )

        response = self.client.models.generate_content(
            model=self.model_name,
            contents=prompt,
            config=config
        )

        if not response or not response.text:
            return self._extraer_fallback_heuristico(texto)

        data = self._sanitizar_y_cargar_json(response.text)
        if not data or not isinstance(data, dict):
            return self._extraer_fallback_heuristico(texto)

        clima = data.get("clima_preferido", "Soleado")

        if clima not in ["Soleado", "Garúa"]:
            clima = "Garúa" if any(w in str(clima).lower() for w in ["garua", "garúa", "neblina", "verde"]) else "Soleado"

        intereses = data.get("intereses", ["Naturaleza", "Senderismo"])
        if not isinstance(intereses, list) or not intereses:
            intereses = ["Naturaleza", "Senderismo"]

        try:
            sens_sat = float(data.get("sensibilidad_saturacion", 1.0))
            sens_sat = max(0.5, min(2.0, sens_sat))
        except (ValueError, TypeError):
            sens_sat = 1.0

        try:
            sens_seg = float(data.get("sensibilidad_seguridad", 1.0))
            sens_seg = max(0.5, min(2.0, sens_seg))
        except (ValueError, TypeError):
            sens_seg = 1.0

        return FuzzySemanticPreferencesDTO(
            clima_preferido=clima,
            intereses=intereses,
            sensibilidad_saturacion=sens_sat,
            sensibilidad_seguridad=sens_seg
        )

    def _extraer_fallback_heuristico(self, texto: str) -> FuzzySemanticPreferencesDTO:
        """Reglas heurísticas locales de contingencia offline basadas en regex y palabras clave."""
        t = texto.lower()
        clima = "Soleado"
        intereses = ["Naturaleza", "Senderismo"]
        sensibilidad_saturacion = 1.0
        sensibilidad_seguridad = 1.0

        if any(p in t for p in ["garúa", "garua", "neblina", "verde"]):
            clima = "Garúa"
        elif any(p in t for p in ["sol", "soleado", "despejado"]):
            clima = "Soleado"

        if any(p in t for p in ["arqueología", "arqueologia", "ruinas", "cultura", "historia"]):
            intereses.append("Arqueología")
        if any(p in t for p in ["paisaje", "foto", "fotografía", "mirador", "vista"]):
            intereses.append("Vistas Panorámicas")
        if any(p in t for p in ["ave", "aves", "fauna", "animales", "vizcacha"]):
            intereses.append("Aves y Fauna")

        if any(p in t for p in ["tranquilo", "sin gente", "poca gente", "poco concurrido", "aislado"]):
            sensibilidad_saturacion = 1.3

        if any(p in t for p in ["muy seguro", "seguridad", "cuidado", "vigilancia"]):
            sensibilidad_seguridad = 1.3

        return FuzzySemanticPreferencesDTO(
            clima_preferido=clima,
            intereses=list(set(intereses)),
            sensibilidad_saturacion=sensibilidad_saturacion,
            sensibilidad_seguridad=sensibilidad_seguridad
        )

    def generar_itinerario_narrativo(self, resultado_ag: Any, perfil_usuario: Dict[str, Any]) -> str:
        """
        Genera un itinerario narrativo y guía detallada en Markdown para la ruta seleccionada.
        """
        destinos = getattr(resultado_ag, "destinos_ordenados", None) or (resultado_ag.get("destinos_ordenados", []) if isinstance(resultado_ag, dict) else [])
        if not destinos:
            return "No hay destinos seleccionados para generar el itinerario."

        costo_total = getattr(resultado_ag, "costo_total", None) if hasattr(resultado_ag, "costo_total") else (resultado_ag.get("costo_total", 0.0) if isinstance(resultado_ag, dict) else 0.0)
        distancia_total = getattr(resultado_ag, "distancia_total_km", None) if hasattr(resultado_ag, "distancia_total_km") else (resultado_ag.get("distancia_total_km", 0.0) if isinstance(resultado_ag, dict) else 0.0)

        if self.is_gemini_active():
            try:
                narrativa = self._generar_con_api(destinos, float(costo_total), float(distancia_total), perfil_usuario)
                if narrativa and len(narrativa.strip()) > 30:
                    self.ultimo_origen = "gemini"
                    return narrativa
            except Exception as e:
                logger.warning(f"Error al generar narrativa con Gemini: {e}")

        self.ultimo_origen = "fallback"
        return self._generar_fallback_estatico(destinos, float(costo_total), float(distancia_total), perfil_usuario)

    def _generar_con_api(self, destinos: List[Dict[str, Any]], costo: float, distancia: float, perfil: Dict[str, Any]) -> str:
        """Genera el itinerario turístico profesional usando Google Gemini."""
        dias = perfil.get("dias_disponibles", len(destinos))
        condicion = perfil.get("condicion_fisica", "Moderado")
        clima = perfil.get("clima_preferido", "Soleado")
        intereses = perfil.get("intereses", ["Naturaleza", "Senderismo"])
        if isinstance(intereses, list):
            intereses_str = ", ".join(intereses)
        else:
            intereses_str = str(intereses)

        destinos_json = json.dumps([
            {
                "orden": idx + 1,
                "nombre": d.get("nombre"),
                "distrito": d.get("distrito"),
                "dificultad": d.get("dificultad"),
                "costo_estimado": d.get("costo_estimado"),
                "tiempo_estimado_horas": d.get("tiempo_estimado_horas"),
                "transporte_principal": d.get("transporte_principal"),
                "descripcion": d.get("descripcion", ""),
                "patrimonio": d.get("patrimonio", False)
            }
            for idx, d in enumerate(destinos)
        ], ensure_ascii=False, indent=2)

        prompt = f"""
Eres un guía turístico experto de montaña y ecoturismo en la Costa Central del Perú, especializado en el ecosistema de las Lomas de Lima.

Genera un itinerario narrativo y guía de viaje profesional, estructurado en Markdown de alta calidad, basado en la siguiente ruta óptima calculada por nuestro sistema inteligente:

### PERFIL DEL TURISTA:
- **Días disponibles:** {dias} días
- **Presupuesto estimado total de la ruta:** S/ {costo:.2f}
- **Distancia radial acumulada:** {distancia:.1f} km
- **Condición física:** {condicion}
- **Clima preferido:** {clima}
- **Intereses:** {intereses_str}

### DESTINOS DE LA RUTA EN SECUENCIA:
{destinos_json}

### INSTRUCCIONES DE FORMATO:
1. Encabezado principal: `## ITINERARIO RECOMENDADO DE TREKKING EN LAS LOMAS DE LIMA`
2. Barra de resumen: `**Duración:** {dias} días | **Costo Estimado:** S/{costo:.2f} | **Distancia Radial Total:** {distancia:.1f} km | **Condición:** {condicion}`
3. Para cada día (`### Día 1: [Nombre de la Loma] ([Distrito])`, `### Día 2: ...`):
   - Detalle de la excursión: tiempo de caminata, nivel de dificultad, atractivos destacados (flora como Flor de Amancaes, fauna como lechuzas/vizcachas, vistas panorámicas o restos arqueológicos).
   - Logística y transporte: cómo llegar según el transporte indicado.
   - Recomendación personalizada adaptada a la condición física '{condicion}' y clima '{clima}'.
4. Sección final con recomendaciones de sostenibilidad (principios No Deje Rastro / Leave No Trace, hidratación, calzado adecuado para terreno arcilloso/húmedo de lomas y seguridad).

Redacta de manera motivadora, clara y profesional en idioma Español.
"""
        config = types.GenerateContentConfig(
            temperature=0.3,
        )

        response = self.client.models.generate_content(
            model=self.model_name,
            contents=prompt,
            config=config
        )

        if response and response.text:
            return response.text.strip()

        return self._generar_fallback_estatico(destinos, costo, distancia, perfil)

    def _generar_fallback_estatico(self, destinos: List[Dict[str, Any]], costo: float, distancia: float, perfil: Dict[str, Any]) -> str:
        """Generador estático local cuando no hay conexión a la API."""
        dias = perfil.get('dias_disponibles', len(destinos))
        lineas = [
            "## ITINERARIO RECOMENDADO DE TREKKING EN LOMAS",
            f"**Duración:** {dias} días | **Costo Estimado:** S/{costo:.2f} | **Distancia Radial:** {distancia:.1f} km",
            ""
        ]

        for idx, d in enumerate(destinos, start=1):
            lineas.append(f"### Día {idx}: {d['nombre']} ({d['distrito']})")
            lineas.append(f"- **Dificultad:** {d.get('dificultad', 'Moderado')} | **Tiempo estimado:** {d.get('tiempo_estimado_horas', 4.0)}h")
            lineas.append(f"- **Transporte:** {d.get('transporte_principal', 'Transporte público local')}")
            lineas.append(f"- **Descripción:** {d.get('descripcion', '')}")
            lineas.append("")

        lineas.append("### Recomendaciones Generales:")
        lineas.append("- Llevar calzado con buen agarre para senderos de lomas (terreno arcilloso o con neblina).")
        lineas.append("- Llevar mínimo 1.5 a 2 litros de agua por día y snacks energéticos.")
        lineas.append("- Respetar los senderos delimitados para proteger la flora silvestre (Flor de Amancaes).")

        return "\n".join(lineas)

    def extraer_preferencias_usuario(self, texto: Optional[str]) -> Dict[str, Any]:
        """Extrae el perfil completo del usuario (días, presupuesto, condición, clima, intereses)."""
        if not texto or not str(texto).strip():
            return {
                "dias_disponibles": 3,
                "presupuesto_max": 60.0,
                "condicion_fisica": "Moderado",
                "clima_preferido": "Soleado",
                "intereses": ["Naturaleza", "Senderismo"]
            }

        if self.is_gemini_active():
            try:
                perfil_api = self._extraer_perfil_con_api(str(texto))
                if perfil_api:
                    self.ultimo_origen = "gemini"
                    return perfil_api
            except Exception as e:
                logger.warning(f"Error al extraer perfil completo con Gemini: {e}")

        self.ultimo_origen = "fallback"
        return self._extraer_perfil_fallback_heuristico(str(texto))

    def _extraer_perfil_con_api(self, texto: str) -> Dict[str, Any]:
        """Extrae los parámetros completos del usuario en JSON usando Gemini."""
        prompt = f"""
Extrae las preferencias de viaje del siguiente texto en formato JSON para una app de trekking en Lomas de Lima:
- "dias_disponibles": Entero entre 1 y 15 (por defecto 3 si no se menciona).
- "presupuesto_max": Float en Soles peruanos (por defecto 60.0 si no se menciona).
- "condicion_fisica": Exactamente "Fácil", "Moderado" o "Difícil" (por defecto "Moderado").
- "clima_preferido": Exactamente "Soleado" o "Garúa" (por defecto "Soleado").
- "intereses": Lista de strings con los temas clave identificados.

Texto:
\"\"\"{texto}\"\"\"

Responde ÚNICAMENTE con el objeto JSON válido.
"""
        config = types.GenerateContentConfig(
            temperature=0.1,
            response_mime_type="application/json",
        )

        response = self.client.models.generate_content(
            model=self.model_name,
            contents=prompt,
            config=config
        )

        if not response or not response.text:
            return self._extraer_perfil_fallback_heuristico(texto)

        data = self._sanitizar_y_cargar_json(response.text)
        if not data or not isinstance(data, dict):
            return self._extraer_perfil_fallback_heuristico(texto)

        dias = int(data.get("dias_disponibles", 3))

        pres = float(data.get("presupuesto_max", 60.0))
        cond = data.get("condicion_fisica", "Moderado")
        if cond not in ["Fácil", "Moderado", "Difícil"]:
            cond = "Moderado"
        clima = data.get("clima_preferido", "Soleado")
        if clima not in ["Soleado", "Garúa"]:
            clima = "Soleado"
        intereses = data.get("intereses", ["Naturaleza", "Senderismo"])
        if not isinstance(intereses, list):
            intereses = ["Naturaleza", "Senderismo"]

        return {
            "dias_disponibles": max(1, min(15, dias)),
            "presupuesto_max": max(10.0, pres),
            "condicion_fisica": cond,
            "clima_preferido": clima,
            "intereses": intereses
        }

    def _extraer_perfil_fallback_heuristico(self, texto: str) -> Dict[str, Any]:
        t = texto.lower()
        perfil = {
            "dias_disponibles": 3,
            "presupuesto_max": 60.0,
            "condicion_fisica": "Moderado",
            "clima_preferido": "Soleado",
            "intereses": ["Naturaleza", "Senderismo"]
        }
        m_dias = re.search(r'(\d+)\s*(?:días|dias|dia|día)', t)
        if m_dias:
            perfil["dias_disponibles"] = int(m_dias.group(1))
        m_pres = re.search(r'(\d+(?:\.\d+)?)\s*(?:soles|sol|s/\.?)', t)
        if not m_pres:
            m_pres = re.search(r'(?:s/\.?|presupuesto de|hasta)\s*(\d+(?:\.\d+)?)', t)
        if m_pres:
            perfil["presupuesto_max"] = float(m_pres.group(1))
        if any(p in t for p in ["fácil", "facil", "suave", "principiante"]):
            perfil["condicion_fisica"] = "Fácil"
        elif any(p in t for p in ["difícil", "dificil", "fuerte", "experto"]):
            perfil["condicion_fisica"] = "Difícil"
        if any(p in t for p in ["garúa", "garua", "verde", "neblina"]):
            perfil["clima_preferido"] = "Garúa"
        elif any(p in t for p in ["sol", "soleado"]):
            perfil["clima_preferido"] = "Soleado"
        return perfil


# Funciones de compatibilidad funcional
def extraer_preferencias_cualitativas(texto: Optional[str]) -> FuzzySemanticPreferencesDTO:
    return LomasLLMService().extraer_preferencias_cualitativas(texto)


def extraer_preferencias_usuario(texto: Optional[str]) -> Dict[str, Any]:
    return LomasLLMService().extraer_preferencias_usuario(texto)


def generar_itinerario_narrativo(resultado_ag: Any, perfil_usuario: Dict[str, Any]) -> str:
    return LomasLLMService().generar_itinerario_narrativo(resultado_ag, perfil_usuario)
