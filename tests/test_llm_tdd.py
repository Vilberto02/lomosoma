"""
TDD Test Suite for LomasLLMService and Gemini Integration.
"""

import json
from unittest.mock import MagicMock
import pytest

from modules.dtos import (
    UserPreferencesDTO,
    CoordenadasDTO,
    FuzzySemanticPreferencesDTO
)
from modules.llm_module import (
    LomasLLMService,
    extraer_preferencias_cualitativas,
    extraer_preferencias_usuario,
    generar_itinerario_narrativo
)
from modules.pipeline import LomasPipelineOrchestrator


class TestLLMServiceTDD:
    """TDD Cycle tests for Gemini LLM service."""

    def test_gemini_handles_markdown_json_code_blocks(self):
        """
        RED-GREEN: Gemini often returns JSON wrapped in markdown code blocks:
        ```json
        {
          "clima_preferido": "Garúa",
          ...
        }
        ```
        The parser must strip code fences safely and parse valid JSON.
        """
        service = LomasLLMService(api_key="fake_key_123")
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.text = """```json
{
  "clima_preferido": "Garúa",
  "intereses": ["Arqueología", "Vistas Panorámicas"],
  "sensibilidad_saturacion": 1.5,
  "sensibilidad_seguridad": 1.4
}
```"""
        mock_client.models.generate_content.return_value = mock_response
        service.client = mock_client

        res = service.extraer_preferencias_cualitativas("Quiero lomas con garúa y ruinas")
        assert res.clima_preferido == "Garúa"
        assert "Arqueología" in res.intereses
        assert res.sensibilidad_saturacion == 1.5
        assert res.sensibilidad_seguridad == 1.4

    def test_gemini_handles_malformed_json_gracefully(self):
        """
        RED-GREEN: When Gemini returns malformed or non-JSON output,
        it should fall back to heuristic extraction without raising an unhandled exception.
        """
        service = LomasLLMService(api_key="fake_key_123")
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.text = "¡Claro! Aquí tienes tu respuesta: {clima: Soleado ... invalid json"
        mock_client.models.generate_content.return_value = mock_response
        service.client = mock_client

        res = service.extraer_preferencias_cualitativas("Quiero un día soleado con senderismo y fotos")
        assert isinstance(res, FuzzySemanticPreferencesDTO)
        assert res.clima_preferido == "Soleado"
        assert "Vistas Panorámicas" in res.intereses

    def test_gemini_clamps_sensibilidad_ranges(self):
        """
        RED-GREEN: Sensitivities out of normal range (e.g. 99.0 or -5.0)
        should be clamped within [0.5, 2.0].
        """
        service = LomasLLMService(api_key="fake_key_123")
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "clima_preferido": "Soleado",
            "intereses": ["Naturaleza"],
            "sensibilidad_saturacion": 100.0,
            "sensibilidad_seguridad": -10.0
        })
        mock_client.models.generate_content.return_value = mock_response
        service.client = mock_client

        res = service.extraer_preferencias_cualitativas("algo de prueba")
        assert res.sensibilidad_saturacion <= 2.0
        assert res.sensibilidad_seguridad >= 0.5

    def test_gemini_extraer_perfil_markdown_json_blocks(self):
        """
        RED-GREEN: extraer_preferencias_usuario must also handle markdown json fences from Gemini.
        """
        service = LomasLLMService(api_key="fake_key_123")
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.text = """```json
{
  "dias_disponibles": 4,
  "presupuesto_max": 120.0,
  "condicion_fisica": "Difícil",
  "clima_preferido": "Garúa",
  "intereses": ["Flora", "Aves"]
}
```"""
        mock_client.models.generate_content.return_value = mock_response
        service.client = mock_client

        perfil = service.extraer_preferencias_usuario("4 días con 120 soles para rutas difíciles con garúa")
        assert perfil["dias_disponibles"] == 4
        assert perfil["presupuesto_max"] == 120.0
        assert perfil["condicion_fisica"] == "Difícil"
        assert perfil["clima_preferido"] == "Garúa"
        assert "Flora" in perfil["intereses"]

    def test_pipeline_orchestrator_uses_custom_llm_service(self):
        """
        RED-GREEN: Ensure LomasPipelineOrchestrator uses the injected LLM service
        and the final narrative itinerary originates from it.
        """
        mock_llm = MagicMock(spec=LomasLLMService)
        mock_llm.extraer_preferencias_cualitativas.return_value = FuzzySemanticPreferencesDTO(
            clima_preferido="Garúa",
            intereses=["Arqueología"],
            sensibilidad_saturacion=1.2,
            sensibilidad_seguridad=1.2
        )
        mock_llm.generar_itinerario_narrativo.return_value = "## ITINERARIO GEMINI CUSTOM TEST"

        catalogo_mock = [
            {
                "id": "L01",
                "nombre": "Loma Test",
                "distrito": "Lima",
                "dificultad": "Fácil",
                "costo_estimado": 10.0,
                "tiempo_estimado_horas": 2.0,
                "coordenadas": {"lat": -12.0, "lon": -77.0},
                "patrimonio": True,
                "saturacion_promedio": 3.0,
                "seguridad_promedio": 8.0,
                "accesibilidad": 8.0,
                "transporte_principal": "Bus",
                "descripcion": "Loma de prueba"
            }
        ]

        orchestrator = LomasPipelineOrchestrator(
            catalogo=catalogo_mock,
            llm_service=mock_llm
        )

        user_prefs = UserPreferencesDTO(
            dias_disponibles=1,
            presupuesto_max=50.0,
            condicion_fisica="Fácil",
            texto_usuario="Quiero conocer lomas con garúa y ruinas"
        )

        result = orchestrator.run(user_prefs)

        mock_llm.extraer_preferencias_cualitativas.assert_called_once_with("Quiero conocer lomas con garúa y ruinas")
        assert result.itinerario_narrativo == "## ITINERARIO GEMINI CUSTOM TEST"
