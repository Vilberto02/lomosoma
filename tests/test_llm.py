"""
Pruebas unitarias e integración para el servicio LLM con Google Gemini y sus fallbacks locales.
"""

import json
from unittest.mock import MagicMock, patch
from modules.dtos import FuzzySemanticPreferencesDTO
from modules.llm_module import (
    LomasLLMService,
    extraer_preferencias_cualitativas,
    extraer_preferencias_usuario,
    generar_itinerario_narrativo
)


def test_llm_service_initialization_no_key():
    """Verifica que el servicio se inicialice correctamente sin API Key en modo offline."""
    service = LomasLLMService(api_key="")
    assert not service.is_gemini_active()
    assert service.client is None


def test_llm_service_fallback_cualitativo_empty():
    """Verifica que un texto vacío devuelva los valores por defecto del DTO."""
    service = LomasLLMService(api_key="")
    res = service.extraer_preferencias_cualitativas("")
    assert isinstance(res, FuzzySemanticPreferencesDTO)
    assert res.clima_preferido == "Soleado"
    assert "Naturaleza" in res.intereses
    assert res.sensibilidad_saturacion == 1.0


def test_llm_service_fallback_cualitativo_heuristic():
    """Verifica la lógica heurística local basada en palabras clave."""
    service = LomasLLMService(api_key="")
    texto = "Quiero caminar con neblina y garúa, viendo ruinas arqueológicas y fotos de miradores, en un lugar tranquilo sin gente y muy seguro."
    res = service.extraer_preferencias_cualitativas(texto)

    assert res.clima_preferido == "Garúa"
    assert "Arqueología" in res.intereses
    assert "Vistas Panorámicas" in res.intereses
    assert res.sensibilidad_saturacion == 1.3
    assert res.sensibilidad_seguridad == 1.3


def test_llm_service_fallback_itinerario_estatico():
    """Verifica la generación del itinerario narrativo estático."""
    service = LomasLLMService(api_key="")
    destinos = [
        {
            "id": "L01",
            "nombre": "Lomas de Lúcumo",
            "distrito": "Pachacámac",
            "dificultad": "Moderado",
            "tiempo_estimado_horas": 4.0,
            "transporte_principal": "Bus / Colectivo",
            "descripcion": "Hermoso valle verde."
        }
    ]
    perfil = {"dias_disponibles": 1, "condicion_fisica": "Moderado"}
    resultado_mock = {
        "destinos_ordenados": destinos,
        "costo_total": 45.0,
        "distancia_total_km": 32.5
    }

    itinerario = service.generar_itinerario_narrativo(resultado_mock, perfil)
    assert "Lomas de Lúcumo" in itinerario
    assert "Pachacámac" in itinerario
    assert "S/45.00" in itinerario


def test_llm_service_gemini_extraer_cualitativas_mock():
    """Prueba la extracción semántica con respuesta simulada de Google Gemini."""
    service = LomasLLMService(api_key="dummy_api_key")
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "clima_preferido": "Garúa",
        "intereses": ["Arqueología", "Aves y Fauna", "Senderismo"],
        "sensibilidad_saturacion": 1.4,
        "sensibilidad_seguridad": 1.2
    })
    mock_client.models.generate_content.return_value = mock_response
    service.client = mock_client

    res = service.extraer_preferencias_cualitativas("Quiero buscar lechuzas y petroglifos en clima húmedo y sin aglomeraciones.")

    assert res.clima_preferido == "Garúa"
    assert "Arqueología" in res.intereses
    assert "Aves y Fauna" in res.intereses
    assert res.sensibilidad_saturacion == 1.4
    assert res.sensibilidad_seguridad == 1.2


def test_llm_service_gemini_generar_itinerario_mock():
    """Prueba la generación de narrativa personalizada con respuesta de Gemini."""
    service = LomasLLMService(api_key="dummy_api_key")
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = "## ITINERARIO RECOMENDADO DE TREKKING EN LAS LOMAS DE LIMA\n\n### Día 1: Lomas de Lúcumo\nUna experiencia mágica entre formaciones rocosas."
    mock_client.models.generate_content.return_value = mock_response
    service.client = mock_client

    destinos = [{"nombre": "Lomas de Lúcumo", "distrito": "Pachacámac"}]
    resultado_mock = {"destinos_ordenados": destinos, "costo_total": 50.0, "distancia_total_km": 30.0}
    perfil = {"dias_disponibles": 1}

    itinerario = service.generar_itinerario_narrativo(resultado_mock, perfil)
    assert "ITINERARIO RECOMENDADO" in itinerario
    assert "Lomas de Lúcumo" in itinerario


def test_llm_service_gemini_api_error_fallback():
    """Verifica que si la API de Gemini lanza una excepción, el servicio use el fallback sin romper el flujo."""
    service = LomasLLMService(api_key="dummy_api_key")
    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = Exception("Quota Exceeded / Connection Timeout")
    service.client = mock_client

    # Debe caer en el fallback heurístico sin lanzar excepción
    res_cualitativo = service.extraer_preferencias_cualitativas("Quiero un día con garúa y ruinas.")
    assert res_cualitativo.clima_preferido == "Garúa"
    assert "Arqueología" in res_cualitativo.intereses

    # Debe caer en el fallback estático sin lanzar excepción
    destinos = [{"nombre": "Lomas de Lachay", "distrito": "Huacho", "costo_estimado": 35}]
    res_itinerario = service.generar_itinerario_narrativo({"destinos_ordenados": destinos, "costo_total": 35, "distancia_total_km": 80}, {"dias_disponibles": 1})
    assert "Lomas de Lachay" in res_itinerario


def test_llm_compatibility_functions():
    """Prueba las funciones de nivel superior para compatibilidad con código existente."""
    res_pref = extraer_preferencias_cualitativas("caminata con sol")
    assert res_pref.clima_preferido == "Soleado"

    res_user = extraer_preferencias_usuario("2 días con 50 soles dificultad fácil")
    assert res_user["dias_disponibles"] == 2
    assert res_user["presupuesto_max"] == 50.0
    assert res_user["condicion_fisica"] == "Fácil"

    res_itin = generar_itinerario_narrativo(
        {"destinos_ordenados": [{"nombre": "Lomas de Amancaes", "distrito": "Rímac"}], "costo_total": 20, "distancia_total_km": 15},
        {"dias_disponibles": 1}
    )
    assert "Lomas de Amancaes" in res_itin
