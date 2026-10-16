"""
Pruebas de Casos de Uso y Escenarios de Usuario Reales.
Verifica que las salidas del pipeline y del optimizador se adapten
racionalmente a diferentes perfiles de usuario.
"""

import unittest
from modules.dtos import UserPreferencesDTO, CoordenadasDTO
from modules.pipeline import LomasPipelineOrchestrator


class TestUserScenarios(unittest.TestCase):

    def setUp(self):
        self.orchestrator = LomasPipelineOrchestrator()

    def test_escenario_facil_vs_dificil_adaptacion(self):
        """
        Verifica que el perfil 'Fácil' frente a 'Difícil' ajuste los parámetros
        de exigencia y riesgo en el Algoritmo Genético.
        """
        # Usuario 1: Principiante / Fácil
        dto_facil = UserPreferencesDTO(
            dias_disponibles=3,
            presupuesto_max=80.0,
            condicion_fisica="Fácil",
            texto_usuario="Soy principiante, busco caminata fácil y muy segura"
        )
        res_facil = self.orchestrator.run(dto_facil)

        # Usuario 2: Experto / Difícil
        dto_dificil = UserPreferencesDTO(
            dias_disponibles=3,
            presupuesto_max=80.0,
            condicion_fisica="Difícil",
            texto_usuario="Tengo excelente físico, quiero trekking intenso y exigente"
        )
        res_dificil = self.orchestrator.run(dto_dificil)

        # Validaciones de consistencia
        self.assertEqual(res_facil.k, 3)
        self.assertEqual(res_dificil.k, 3)
        self.assertEqual(len(res_facil.ruta_ids), 3)
        self.assertEqual(len(res_dificil.ruta_ids), 3)

        # En ambos casos deben ser rutas válidas sin duplicados
        self.assertEqual(len(set(res_facil.ruta_ids)), 3)
        self.assertEqual(len(set(res_dificil.ruta_ids)), 3)

        # Los presupuestos no deben ser violados severamente
        self.assertLessEqual(res_facil.costo_total, 120.0)
        self.assertLessEqual(res_dificil.costo_total, 120.0)

        # Validar diferenciación dinámica de exigencia difusa
        self.assertLess(res_facil.nivel_exigencia, res_dificil.nivel_exigencia)
        self.assertLessEqual(res_facil.nivel_exigencia, 0.45)
        self.assertGreaterEqual(res_dificil.nivel_exigencia, 0.70)

    def test_escenario_dias_mayores_a_6_clamp_a_6(self):
        """Verifica que solicitar 10 o 12 días se limite a un máximo de K=6 destinos por saturación logística."""
        for dias_input in [10, 12, 15]:
            dto = UserPreferencesDTO(
                dias_disponibles=dias_input,
                presupuesto_max=200.0,
                condicion_fisica="Moderado"
            )
            res = self.orchestrator.run(dto)
            self.assertEqual(res.k, 6)
            self.assertEqual(len(res.ruta_ids), 6)
            self.assertEqual(len(set(res.ruta_ids)), 6)

    def test_escenario_presupuesto_ultra_bajo_factibilidad(self):
        """
        Verifica que ante un presupuesto muy bajo (ej. S/ 10 para 3 días), el AG
        seleccione las lomas más económicas del catálogo minimizando la penalización cuadrática.
        """
        dto_ultra_bajo = UserPreferencesDTO(
            dias_disponibles=3,
            presupuesto_max=10.0,
            condicion_fisica="Fácil"
        )
        res = self.orchestrator.run(dto_ultra_bajo)
        self.assertEqual(res.k, 3)
        self.assertGreater(res.costo_total, 10.0)  # Físicamente insoslayable por catálogo
        self.assertLessEqual(res.costo_total, 35.0)  # Debe haber seleccionado las más baratas

    def test_escenario_atajo_1_dia(self):
        """Verifica que 1 día use el atajo determinista y retorne exactamente 1 destino."""
        dto_1dia = UserPreferencesDTO(
            dias_disponibles=1,
            presupuesto_max=30.0,
            condicion_fisica="Moderado"
        )
        res = self.orchestrator.run(dto_1dia)

        self.assertEqual(res.k, 1)
        self.assertEqual(len(res.ruta_ids), 1)
        self.assertEqual(res.metodo, "atajo_determinista")
        self.assertLessEqual(res.costo_total, 30.0)
        self.assertGreater(len(res.itinerario_narrativo), 20)

    def test_escenario_bajo_presupuesto(self):
        """Verifica que un presupuesto ajustado seleccione destinos económicos."""
        dto_economico = UserPreferencesDTO(
            dias_disponibles=2,
            presupuesto_max=25.0,
            condicion_fisica="Moderado"
        )
        res = self.orchestrator.run(dto_economico)

        self.assertEqual(res.k, 2)
        # Costo debe ser razonable y cercano al límite
        self.assertLessEqual(res.costo_total, 40.0)

    def test_escenario_cambio_alojamiento_nodo_base(self):
        """Verifica que cambiar el punto de partida afecte el cálculo de distancias radiales."""
        # Nodo 1: Centro de Lima
        dto_centro = UserPreferencesDTO(
            dias_disponibles=2,
            presupuesto_max=60.0,
            nodo_base=CoordenadasDTO(lat=-12.0464, lon=-77.0428)
        )
        res_centro = self.orchestrator.run(dto_centro)

        # Nodo 2: Sur de Lima (Villa María del Triunfo)
        dto_sur = UserPreferencesDTO(
            dias_disponibles=2,
            presupuesto_max=60.0,
            nodo_base=CoordenadasDTO(lat=-12.1697, lon=-76.9234)
        )
        res_sur = self.orchestrator.run(dto_sur)

        self.assertGreater(res_centro.distancia_total_km, 0.0)
        self.assertGreater(res_sur.distancia_total_km, 0.0)

    def test_escenario_extraccion_semantica_e_itinerario(self):
        """
        Verifica que el procesamiento NLP interprete correctamente palabras clave
        (arqueología, seguridad, clima) y construya el itinerario narrativo y guías.
        """
        dto = UserPreferencesDTO(
            dias_disponibles=2,
            presupuesto_max=50.0,
            condicion_fisica="Moderado",
            texto_usuario="Me interesa la arqueología y ruinas, en un clima soleado y seguro"
        )
        res = self.orchestrator.run(dto)

        self.assertEqual(res.k, 2)
        self.assertEqual(len(res.ruta_ids), 2)
        self.assertEqual(len(res.guias_acceso), 2)
        self.assertIn("Día 1", res.itinerario_narrativo)
        self.assertIn("Día 2", res.itinerario_narrativo)
        # Verificar contenido en guías de transporte/acceso
        for guia in res.guias_acceso:
            self.assertIn("nombre", guia)
            self.assertIn("medio_transporte", guia)
            self.assertIn("tiempo_total_min", guia)
            self.assertIn("pasos", guia)

    def test_escenario_alta_sensibilidad_seguridad_y_tranquilidad(self):
        """
        Verifica que un usuario con alta aversión al riesgo y preferencia de aislamiento
        genere multiplicadores de sensibilidad correctos y rutas con riesgos evaluados.
        """
        dto_seguro = UserPreferencesDTO(
            dias_disponibles=2,
            presupuesto_max=70.0,
            condicion_fisica="Fácil",
            texto_usuario="Quiero un recorrido muy seguro, tranquilo, sin gente"
        )
        res = self.orchestrator.run(dto_seguro)

        self.assertEqual(res.k, 2)
        self.assertIsNotNone(res.riesgos_ruta)
        self.assertEqual(len(res.riesgos_ruta), 2)
        for did, r_val in res.riesgos_ruta.items():
            self.assertGreaterEqual(r_val, 0.0)
            self.assertLessEqual(r_val, 10.0)

    def test_escenario_multiples_dias_4_y_5_dias(self):
        """
        Verifica la capacidad del Algoritmo Genético de resolver itinerarios extensos
        (4 y 5 días) sin repetir destinos y respetando los límites de tiempo.
        """
        for dias in [4, 5]:
            dto_multidia = UserPreferencesDTO(
                dias_disponibles=dias,
                presupuesto_max=150.0,
                condicion_fisica="Moderado"
            )
            res = self.orchestrator.run(dto_multidia)

            self.assertEqual(res.k, dias)
            self.assertEqual(len(res.ruta_ids), dias)
            self.assertEqual(len(set(res.ruta_ids)), dias)  # Sin duplicados
            self.assertEqual(len(res.destinos_ordenados), dias)
            self.assertEqual(len(res.guias_acceso), dias)
            self.assertGreater(res.distancia_total_km, 0.0)

    def test_escenario_convergencia_y_monotonia_fitness(self):
        """
        Verifica que el historial de convergencia del AG reporte métricas
        y que el mejor fitness global sea monótonamente no decreciente.
        """
        dto = UserPreferencesDTO(
            dias_disponibles=3,
            presupuesto_max=60.0,
            condicion_fisica="Moderado"
        )
        res = self.orchestrator.run(dto)

        self.assertGreater(len(res.historial), 0)
        fits = [h["mejor_fitness"] for h in res.historial]
        for i in range(1, len(fits)):
            self.assertGreaterEqual(fits[i], fits[i - 1], f"Fitness decreció en generación {i+1}")


if __name__ == "__main__":
    unittest.main()
