"""
Pruebas Unitarias para el Modulo de Logica Difusa.
"""

import os
import json
import math
import unittest
from modules.fuzzy_module import (
    evaluar_riesgo_loma,
    evaluar_exigencia,
    calcular_riesgos_todos_destinos
)


class TestRiesgoFuzzySystem(unittest.TestCase):

    def test_riesgo_rango_valido(self):
        """Valida que el nivel de riesgo difuso este en el rango [0.0, 10.0]."""
        riesgo = evaluar_riesgo_loma(saturacion=0.50, seguridad=6.0, accesibilidad=7.0)
        self.assertTrue(0.0 <= riesgo <= 10.0)
        self.assertFalse(math.isnan(riesgo))

    def test_riesgo_alto_condiciones_desfavorables(self):
        """Alta saturacion, baja seguridad y baja accesibilidad arrojan un riesgo alto."""
        riesgo = evaluar_riesgo_loma(saturacion=0.90, seguridad=1.5, accesibilidad=2.0)
        self.assertGreaterEqual(riesgo, 6.0)

    def test_riesgo_bajo_condiciones_favorables(self):
        """Baja saturacion, alta seguridad y alta accesibilidad arrojan un riesgo bajo."""
        riesgo = evaluar_riesgo_loma(saturacion=0.10, seguridad=9.0, accesibilidad=9.0)
        self.assertLessEqual(riesgo, 4.0)

    def test_calcular_riesgos_todos_destinos(self):
        """El catalogo de 15 destinos se procesa integro sin errores."""
        ruta_json = os.path.join(os.path.dirname(__file__), "..", "data", "destinos.json")
        with open(ruta_json, "r", encoding="utf-8") as f:
            destinos = json.load(f)

        riesgos = calcular_riesgos_todos_destinos(destinos)
        self.assertEqual(len(riesgos), 15)
        for d in destinos:
            did = d['id']
            self.assertIn(did, riesgos)
            self.assertTrue(0.0 <= riesgos[did] <= 10.0)


class TestExigenciaFuzzySystem(unittest.TestCase):

    def test_exigencia_rango_valido(self):
        """Valida que el nivel de exigencia este en el rango [0.0, 1.0]."""
        exigencia = evaluar_exigencia(horas=3.5, cobertura=0.50, extension=5.0)
        self.assertTrue(0.0 <= exigencia <= 1.0)
        self.assertFalse(math.isnan(exigencia))

    def test_exigencia_alta_condiciones_intensas(self):
        """Horas extensas, cobertura completa y extension larga arrojan exigencia alta."""
        exigencia = evaluar_exigencia(horas=5.5, cobertura=0.90, extension=9.0)
        self.assertGreaterEqual(exigencia, 0.6)

    def test_exigencia_baja_condiciones_relajadas(self):
        """Pocas horas, cobertura parcial y extension corta arrojan exigencia relajada."""
        exigencia = evaluar_exigencia(horas=1.2, cobertura=0.10, extension=1.5)
        self.assertLessEqual(exigencia, 0.4)

    def test_exigencia_moderada(self):
        """Parametros intermedios producen exigencia en rango moderado."""
        exigencia = evaluar_exigencia(horas=3.5, cobertura=0.50, extension=5.5)
        self.assertTrue(0.3 <= exigencia <= 0.7)


if __name__ == "__main__":
    unittest.main()
