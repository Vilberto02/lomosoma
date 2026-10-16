"""
Pruebas de Integración para los Endpoints REST de FastAPI.
"""

import unittest
from fastapi.testclient import TestClient
from backend.app.main import app


class TestBackendAPI(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)

    def test_health_check(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "online")
        self.assertIn("docs", data)

    def test_get_lomas_catalogo_completo(self):
        response = self.client.get("/api/lomas")
        self.assertEqual(response.status_code, 200)
        lomas = response.json()
        self.assertEqual(len(lomas), 15)
        for loma in lomas:
            self.assertIn("id", loma)
            self.assertIn("nombre", loma)
            self.assertIn("coordenadas", loma)
            self.assertIn("distrito", loma)

    def test_get_lomas_filtro_busqueda(self):
        # Filtrar por texto "Carabayllo"
        response = self.client.get("/api/lomas?q=Carabayllo")
        self.assertEqual(response.status_code, 200)
        lomas = response.json()
        self.assertGreaterEqual(len(lomas), 1)
        for loma in lomas:
            self.assertTrue("carabayllo" in loma["distrito"].lower() or "carabayllo" in loma["nombre"].lower())

    def test_get_loma_detail_individual(self):
        response = self.client.get("/api/lomas/L0")
        self.assertEqual(response.status_code, 200)
        loma = response.json()
        self.assertEqual(loma["id"], "L0")
        self.assertIn("guia_acceso", loma)
        guia = loma["guia_acceso"]
        self.assertIn("medio_transporte", guia)
        self.assertIn("pasos", guia)

    def test_get_loma_not_found(self):
        response = self.client.get("/api/lomas/INVALID_ID")
        self.assertEqual(response.status_code, 404)

    def test_get_presets(self):
        response = self.client.get("/api/presets")
        self.assertEqual(response.status_code, 200)
        presets = response.json()
        self.assertGreaterEqual(len(presets), 10)
        self.assertIn("nombre", presets[0])
        self.assertIn("lat", presets[0])
        self.assertIn("lon", presets[0])

    def test_post_optimize_exitoso(self):
        payload = {
            "dias_disponibles": 1,
            "presupuesto_max": 40.0,
            "condicion_fisica": "Moderado",
            "nodo_base": {
                "lat": -12.0464,
                "lon": -77.0428
            },
            "texto_usuario": "Quiero una ruta panorámica segura"
        }
        response = self.client.post("/api/optimize", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["k"], 1)
        self.assertEqual(len(data["ruta_ids"]), 1)
        self.assertIn("itinerario_narrativo", data)
        self.assertIn("guias_acceso", data)
        self.assertIn("tramos", data)


if __name__ == "__main__":
    unittest.main()
