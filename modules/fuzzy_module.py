"""
Módulo de Razonamiento bajo Incertidumbre: Lógica Difusa Mamdani (POO).
Contiene:
  1. RiesgoFuzzySystem    - Evalúa riesgo de una loma (Componente 2).
  2. ExigenciaFuzzySystem - Evalúa exigencia de exploración (Componente 1).
  3. LomasFuzzyEngine     - Fachada unificada para ambos sistemas.
"""

from typing import List, Dict, Any
import numpy as np
import skfuzzy as fuzz
from skfuzzy import control as ctrl


class RiesgoFuzzySystem:
    """Sistema difuso Mamdani para evaluar el nivel de riesgo de una loma."""

    def __init__(self):
        self.saturacion = ctrl.Antecedent(np.linspace(0.0, 1.0, 101), 'saturacion')
        self.seguridad = ctrl.Antecedent(np.linspace(0.0, 10.0, 101), 'seguridad')
        self.accesibilidad = ctrl.Antecedent(np.linspace(0.0, 10.0, 101), 'accesibilidad')

        self.nivel_riesgo = ctrl.Consequent(np.linspace(0.0, 10.0, 101), 'nivel_riesgo')
        self.nivel_riesgo.defuzzify_method = 'centroid'

        self.saturacion['Baja'] = fuzz.trapmf(self.saturacion.universe, [0.0, 0.0, 0.20, 0.40])
        self.saturacion['Media'] = fuzz.trimf(self.saturacion.universe, [0.25, 0.50, 0.75])
        self.saturacion['Alta'] = fuzz.trapmf(self.saturacion.universe, [0.60, 0.80, 1.0, 1.0])

        self.seguridad['Riesgoso'] = fuzz.trapmf(self.seguridad.universe, [0.0, 0.0, 2.5, 4.5])
        self.seguridad['Moderado'] = fuzz.trimf(self.seguridad.universe, [3.5, 6.0, 8.0])
        self.seguridad['Seguro'] = fuzz.trapmf(self.seguridad.universe, [7.0, 8.5, 10.0, 10.0])

        self.accesibilidad['Dificil'] = fuzz.trapmf(self.accesibilidad.universe, [0.0, 0.0, 2.5, 4.5])
        self.accesibilidad['Media'] = fuzz.trimf(self.accesibilidad.universe, [3.5, 6.0, 8.0])
        self.accesibilidad['Facil'] = fuzz.trapmf(self.accesibilidad.universe, [7.0, 8.5, 10.0, 10.0])

        self.nivel_riesgo['Muy_Bajo'] = fuzz.trimf(self.nivel_riesgo.universe, [0.0, 0.0, 2.5])
        self.nivel_riesgo['Bajo'] = fuzz.trimf(self.nivel_riesgo.universe, [1.5, 3.5, 5.0])
        self.nivel_riesgo['Medio'] = fuzz.trimf(self.nivel_riesgo.universe, [4.0, 5.5, 7.0])
        self.nivel_riesgo['Alto'] = fuzz.trimf(self.nivel_riesgo.universe, [6.0, 7.5, 9.0])
        self.nivel_riesgo['Muy_Alto'] = fuzz.trapmf(self.nivel_riesgo.universe, [7.5, 9.0, 10.0, 10.0])

        reglas = [
            ctrl.Rule(self.seguridad['Riesgoso'] & self.accesibilidad['Dificil'], self.nivel_riesgo['Muy_Alto']),
            ctrl.Rule(self.saturacion['Alta'] & self.seguridad['Riesgoso'], self.nivel_riesgo['Muy_Alto']),
            ctrl.Rule(self.saturacion['Alta'] & self.seguridad['Moderado'] & self.accesibilidad['Dificil'], self.nivel_riesgo['Muy_Alto']),
            ctrl.Rule(self.saturacion['Media'] & self.seguridad['Riesgoso'] & self.accesibilidad['Dificil'], self.nivel_riesgo['Muy_Alto']),
            ctrl.Rule(self.saturacion['Alta'] & self.seguridad['Moderado'] & self.accesibilidad['Media'], self.nivel_riesgo['Alto']),
            ctrl.Rule(self.saturacion['Media'] & self.seguridad['Riesgoso'] & self.accesibilidad['Media'], self.nivel_riesgo['Alto']),
            ctrl.Rule(self.saturacion['Baja'] & self.seguridad['Riesgoso'] & self.accesibilidad['Dificil'], self.nivel_riesgo['Alto']),
            ctrl.Rule(self.saturacion['Media'] & self.seguridad['Moderado'] & self.accesibilidad['Dificil'], self.nivel_riesgo['Alto']),
            ctrl.Rule(self.saturacion['Media'] & self.seguridad['Moderado'] & self.accesibilidad['Media'], self.nivel_riesgo['Medio']),
            ctrl.Rule(self.saturacion['Alta'] & self.seguridad['Seguro'] & self.accesibilidad['Facil'], self.nivel_riesgo['Medio']),
            ctrl.Rule(self.saturacion['Alta'] & self.seguridad['Seguro'] & self.accesibilidad['Media'], self.nivel_riesgo['Medio']),
            ctrl.Rule(self.saturacion['Baja'] & self.seguridad['Moderado'] & self.accesibilidad['Media'], self.nivel_riesgo['Medio']),
            ctrl.Rule(self.saturacion['Baja'] & self.seguridad['Moderado'] & self.accesibilidad['Facil'], self.nivel_riesgo['Bajo']),
            ctrl.Rule(self.saturacion['Baja'] & self.seguridad['Seguro'] & self.accesibilidad['Media'], self.nivel_riesgo['Bajo']),
            ctrl.Rule(self.saturacion['Media'] & self.seguridad['Seguro'] & self.accesibilidad['Facil'], self.nivel_riesgo['Bajo']),
            ctrl.Rule(self.saturacion['Baja'] & self.seguridad['Seguro'] & self.accesibilidad['Facil'], self.nivel_riesgo['Muy_Bajo']),
        ]

        sistema_control = ctrl.ControlSystem(reglas)
        self.simulador = ctrl.ControlSystemSimulation(sistema_control)

    def evaluar(self, saturacion: float, seguridad: float, accesibilidad: float) -> float:
        try:
            self.simulador.reset()
            self.simulador.input['saturacion'] = float(np.clip(saturacion, 0.0, 1.0))
            self.simulador.input['seguridad'] = float(np.clip(seguridad, 0.0, 10.0))
            self.simulador.input['accesibilidad'] = float(np.clip(accesibilidad, 0.0, 10.0))
            self.simulador.compute()
            return round(float(np.clip(self.simulador.output['nivel_riesgo'], 0.0, 10.0)), 2)
        except Exception:
            riesgo_fallback = (saturacion * 10.0 * 0.30) + ((10.0 - seguridad) * 0.40) + ((10.0 - accesibilidad) * 0.30)
            return round(float(np.clip(riesgo_fallback, 0.0, 10.0)), 2)


class ExigenciaFuzzySystem:
    """Sistema difuso Mamdani para modelar el nivel de exigencia de exploración."""

    def __init__(self):
        self.horas = ctrl.Antecedent(np.linspace(1.0, 6.0, 101), 'horas')
        self.cobertura = ctrl.Antecedent(np.linspace(0.0, 1.0, 101), 'cobertura')
        self.extension = ctrl.Antecedent(np.linspace(1.0, 10.0, 101), 'extension')

        self.nivel_exigencia = ctrl.Consequent(np.linspace(0.0, 1.0, 101), 'nivel_exigencia')
        self.nivel_exigencia.defuzzify_method = 'centroid'

        self.horas['Corto'] = fuzz.trapmf(self.horas.universe, [1.0, 1.0, 1.5, 3.0])
        self.horas['Moderado'] = fuzz.trimf(self.horas.universe, [2.0, 3.5, 5.0])
        self.horas['Extenso'] = fuzz.trapmf(self.horas.universe, [4.0, 5.0, 6.0, 6.0])

        self.cobertura['Parcial'] = fuzz.trapmf(self.cobertura.universe, [0.0, 0.0, 0.15, 0.35])
        self.cobertura['Intermedia'] = fuzz.trimf(self.cobertura.universe, [0.25, 0.50, 0.75])
        self.cobertura['Completa'] = fuzz.trapmf(self.cobertura.universe, [0.60, 0.80, 1.0, 1.0])

        self.extension['Corto'] = fuzz.trapmf(self.extension.universe, [1.0, 1.0, 2.0, 4.5])
        self.extension['Medio'] = fuzz.trimf(self.extension.universe, [3.0, 5.5, 8.0])
        self.extension['Largo'] = fuzz.trapmf(self.extension.universe, [6.5, 8.5, 10.0, 10.0])

        self.nivel_exigencia['Relajado'] = fuzz.trapmf(self.nivel_exigencia.universe, [0.0, 0.0, 0.15, 0.35])
        self.nivel_exigencia['Moderado'] = fuzz.trimf(self.nivel_exigencia.universe, [0.25, 0.50, 0.75])
        self.nivel_exigencia['Intenso'] = fuzz.trapmf(self.nivel_exigencia.universe, [0.65, 0.85, 1.0, 1.0])

        reglas = [
            ctrl.Rule(self.horas['Extenso'] & self.cobertura['Completa'] & self.extension['Largo'], self.nivel_exigencia['Intenso']),
            ctrl.Rule(self.horas['Extenso'] & self.cobertura['Completa'] & self.extension['Medio'], self.nivel_exigencia['Intenso']),
            ctrl.Rule(self.horas['Extenso'] & self.cobertura['Intermedia'] & self.extension['Largo'], self.nivel_exigencia['Intenso']),
            ctrl.Rule(self.horas['Moderado'] & self.cobertura['Completa'] & self.extension['Largo'], self.nivel_exigencia['Intenso']),
            ctrl.Rule(self.horas['Moderado'] & self.cobertura['Intermedia'] & self.extension['Medio'], self.nivel_exigencia['Moderado']),
            ctrl.Rule(self.horas['Extenso'] & self.cobertura['Parcial'] & self.extension['Medio'], self.nivel_exigencia['Moderado']),
            ctrl.Rule(self.horas['Corto'] & self.cobertura['Completa'] & self.extension['Medio'], self.nivel_exigencia['Moderado']),
            ctrl.Rule(self.horas['Moderado'] & self.cobertura['Completa'] & self.extension['Corto'], self.nivel_exigencia['Moderado']),
            ctrl.Rule(self.horas['Corto'] & self.cobertura['Parcial'] & self.extension['Corto'], self.nivel_exigencia['Relajado']),
            ctrl.Rule(self.horas['Corto'] & self.cobertura['Parcial'] & self.extension['Medio'], self.nivel_exigencia['Relajado']),
            ctrl.Rule(self.horas['Corto'] & self.cobertura['Intermedia'] & self.extension['Corto'], self.nivel_exigencia['Relajado']),
            ctrl.Rule(self.horas['Moderado'] & self.cobertura['Parcial'] & self.extension['Corto'], self.nivel_exigencia['Relajado']),
        ]

        sistema_control = ctrl.ControlSystem(reglas)
        self.simulador = ctrl.ControlSystemSimulation(sistema_control)
        self._cache = {}

    def evaluar(self, horas: float, cobertura: float, extension: float) -> float:
        clave = (round(float(horas), 1), round(float(cobertura), 2), round(float(extension), 1))
        if clave in self._cache:
            return self._cache[clave]

        try:
            self.simulador.reset()
            self.simulador.input['horas'] = float(np.clip(horas, 1.0, 6.0))
            self.simulador.input['cobertura'] = float(np.clip(cobertura, 0.0, 1.0))
            self.simulador.input['extension'] = float(np.clip(extension, 1.0, 10.0))
            self.simulador.compute()
            res = round(float(np.clip(self.simulador.output['nivel_exigencia'], 0.0, 1.0)), 4)
        except Exception:
            h_norm = (horas - 1.0) / 5.0
            c_norm = cobertura
            e_norm = (extension - 1.0) / 9.0
            res = round(float(np.clip(0.4 * h_norm + 0.3 * c_norm + 0.3 * e_norm, 0.0, 1.0)), 4)

        self._cache[clave] = res
        return res


class LomasFuzzyEngine:
    """Motor unificado de Lógica Difusa que compone ambos sistemas Mamdani."""

    def __init__(self):
        self.riesgo_system = RiesgoFuzzySystem()
        self.exigencia_system = ExigenciaFuzzySystem()

    def evaluar_riesgo(self, saturacion: float, seguridad: float, accesibilidad: float) -> float:
        return self.riesgo_system.evaluar(saturacion, seguridad, accesibilidad)

    def evaluar_exigencia(self, horas: float, cobertura: float, extension: float) -> float:
        return self.exigencia_system.evaluar(horas, cobertura, extension)

    def calcular_riesgos_catalogo(self, destinos: List[Dict[str, Any]]) -> Dict[str, float]:
        riesgos = {}
        for d in destinos:
            did = d['id']
            riesgos[did] = self.evaluar_riesgo(
                saturacion=d.get('saturacion_base', 0.5),
                seguridad=d.get('seguridad_base', 5.0),
                accesibilidad=d.get('accesibilidad_base', 5.0)
            )
        return riesgos


# Funciones de compatibilidad
def evaluar_riesgo_loma(saturacion: float, seguridad: float, accesibilidad: float) -> float:
    return LomasFuzzyEngine().evaluar_riesgo(saturacion, seguridad, accesibilidad)


def evaluar_exigencia(horas: float, cobertura: float, extension: float) -> float:
    return LomasFuzzyEngine().evaluar_exigencia(horas, cobertura, extension)


def calcular_riesgos_todos_destinos(destinos: List[Dict[str, Any]]) -> Dict[str, float]:
    return LomasFuzzyEngine().calcular_riesgos_catalogo(destinos)
