"""
Módulo de Optimización Heurística: Algoritmo Genético Híbrido (POO).
Encapsula el solver evolutivo con inyección del motor difuso LomasFuzzyEngine.
"""

import sys
import math
import random
from typing import List, Dict, Any, Tuple, Optional

# Compatibilidad UTF-8 en Windows
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from modules.fuzzy_module import LomasFuzzyEngine


def distancia_haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calcula la distancia ortodrómica en kilómetros mediante la fórmula de Haversine."""
    if lat1 == lat2 and lon1 == lon2:
        return 0.0

    r = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))
    return r * c


class LomasGeneticOptimizer:
    """
    Motor de optimización heurística basado en Algoritmo Genético Híbrido
    con cromosoma de 18 genes y motor difuso inyectado.
    """

    def __init__(
        self,
        destinos: List[Dict[str, Any]],
        beneficios_base: Optional[Dict[str, float]] = None,
        scores_difusos: Optional[Dict[str, float]] = None,
        k: int = 3,
        presupuesto: float = 60.0,
        dias_disponibles: int = 3,
        generaciones: int = 50,
        tam_poblacion: int = 40,
        prob_cruce: float = 0.85,
        prob_mutacion: float = 0.30,
        elitismo: int = 2,
        torneo_k: int = 3,
        beta_distancia: float = 1.0,
        lambda_presupuesto: float = 25.0,
        lambda_tiempo: float = 25.0,
        gamma_riesgo: float = 1.5,
        delta_exigencia: float = 2.0,
        exigencia_target: float = 0.50,
        semilla: Optional[int] = None,
        nodo_base: Optional[Dict[str, float]] = None,
        fuzzy_engine: Optional[LomasFuzzyEngine] = None
    ):
        self.semilla = semilla
        if semilla is not None:
            random.seed(semilla)

        self.destinos = destinos
        self.destinos_dict = {d["id"]: d for d in destinos}
        self.todos_ids = [d["id"] for d in destinos]
        self.n_total = len(self.todos_ids)

        # Inyección del Motor Difuso
        self.fuzzy_engine = fuzzy_engine or LomasFuzzyEngine()

        if beneficios_base is not None:
            self.beneficios_base = dict(beneficios_base)
        elif scores_difusos is not None:
            self.beneficios_base = dict(scores_difusos)
        else:
            self.beneficios_base = {d["id"]: 7.0 for d in destinos}

        self.nodo_base = nodo_base or {"lat": -12.0464, "lon": -77.0428}
        self.k = max(1, min(int(k), self.n_total))
        self.presupuesto = float(presupuesto)
        self.dias = max(1, int(dias_disponibles))

        self.generaciones = max(1, int(generaciones))
        self.tam_poblacion = max(4, int(tam_poblacion))
        self.prob_cruce = float(prob_cruce)
        self.prob_mutacion = float(prob_mutacion)
        self.elitismo = min(elitismo, self.tam_poblacion // 2)
        self.torneo_k = max(2, min(torneo_k, self.tam_poblacion))

        self.beta_distancia = float(beta_distancia)
        self.lambda_presupuesto = float(lambda_presupuesto)
        self.lambda_tiempo = float(lambda_tiempo)
        self.gamma_riesgo = float(gamma_riesgo)
        self.delta_exigencia = float(delta_exigencia)
        self.exigencia_target = float(exigencia_target)

        # Precalculo en caché de riesgos mediante la clase inyectada
        self.riesgos_lomas = self.fuzzy_engine.calcular_riesgos_catalogo(self.destinos)

    def fitness(self, individuo: list) -> float:
        """Función fitness multiobjetivo con ambos subsistemas difusos."""
        ruta = self.obtener_ruta_activa(individuo)
        beneficio_base = sum(self.beneficios_base.get(did, 5.0) for did in ruta)

        # Componente 1: Nivel de Exigencia Difusa (penalización por desvío del perfil objetivo)
        if len(individuo) >= self.n_total + 3:
            horas = float(individuo[self.n_total])
            cobertura = float(individuo[self.n_total + 1])
            extension = float(individuo[self.n_total + 2])
        else:
            horas, cobertura, extension = 3.5, 0.50, 5.0

        nivel_exigencia = self.fuzzy_engine.evaluar_exigencia(horas, cobertura, extension)
        penalizacion_exigencia = self.delta_exigencia * ((nivel_exigencia - self.exigencia_target) ** 2)

        # Componente 2: Penalización de Riesgo Difuso modulada por exigencia
        riesgo_acumulado = sum(self.riesgos_lomas.get(did, 5.0) for did in ruta)
        factor_tolerancia = 1.0 - (nivel_exigencia * 0.2)
        penalizacion_riesgo = self.gamma_riesgo * (riesgo_acumulado / 10.0) * factor_tolerancia

        # Desplazamiento Radial desde nodo base
        distancia_km = self.calcular_distancia_ruta(ruta)
        costo_desplazamiento = self.beta_distancia * (distancia_km / 100.0)

        # Penalizaciones Cuadráticas de Barrera
        costo_total = sum(self.destinos_dict[did].get("costo_estimado", 15.0) for did in ruta)
        exceso_pres = max(0.0, costo_total - self.presupuesto)
        omega_presupuesto = self.lambda_presupuesto * ((exceso_pres / max(1.0, self.presupuesto)) ** 2)

        horas_totales = sum(self.destinos_dict[did].get("tiempo_estimado_horas", 4.0) for did in ruta)
        horas_disp = max(1.0, self.dias * 8.0)
        exceso_tiempo = max(0.0, horas_totales - horas_disp)
        omega_tiempo = self.lambda_tiempo * ((exceso_tiempo / horas_disp) ** 2)

        omega_unicidad = 1000.0 * (len(ruta) - len(set(ruta)))

        return beneficio_base - penalizacion_exigencia - penalizacion_riesgo - costo_desplazamiento - omega_presupuesto - omega_tiempo - omega_unicidad

    def obtener_ruta_activa(self, individuo: list) -> List[str]:
        return individuo[:self.k]

    def calcular_distancia_ruta(self, ruta: List[str]) -> float:
        if not ruta:
            return 0.0
        lat0, lon0 = self.nodo_base["lat"], self.nodo_base["lon"]
        return sum(
            distancia_haversine(lat0, lon0, self.destinos_dict[did]["coordenadas"]["lat"], self.destinos_dict[did]["coordenadas"]["lon"])
            for did in ruta
        )

    def _generar_individuo(self) -> list:
        return random.sample(self.todos_ids, self.n_total) + [
            random.uniform(1.0, 6.0),
            random.uniform(0.0, 1.0),
            random.uniform(1.0, 10.0)
        ]

    def _seleccion_torneo(self, poblacion: List[list]) -> list:
        aspirantes = random.sample(poblacion, self.torneo_k)
        return list(max(aspirantes, key=self.fitness))

    def _crossover_hibrido(self, padre1: list, padre2: list) -> Tuple[list, list]:
        n = self.n_total
        i1, i2 = sorted(random.sample(range(n), 2))

        def cruzar_ox(p1: list, p2: list) -> list:
            hijo = [None] * n
            hijo[i1:i2 + 1] = p1[i1:i2 + 1]
            genes_en_hijo = set(p1[i1:i2 + 1])
            candidatos_p2 = p2[i2 + 1:] + p2[:i2 + 1]
            posiciones_libres = [idx for idx in range(n) if hijo[idx] is None]
            pos_idx = 0
            for gen in candidatos_p2:
                if gen not in genes_en_hijo:
                    hijo[posiciones_libres[pos_idx]] = gen
                    genes_en_hijo.add(gen)
                    pos_idx += 1
            return hijo

        h1_perm = cruzar_ox(padre1[:n], padre2[:n])
        h2_perm = cruzar_ox(padre2[:n], padre1[:n])

        alpha = 0.3
        r1 = padre1[n:] if len(padre1) >= n + 3 else [3.5, 0.5, 5.0]
        r2 = padre2[n:] if len(padre2) >= n + 3 else [3.5, 0.5, 5.0]
        limites = [(1.0, 6.0), (0.0, 1.0), (1.0, 10.0)]

        h1_reales, h2_reales = [], []
        for j in range(3):
            v1, v2 = float(r1[j]), float(r2[j])
            d = abs(v1 - v2)
            c_min, c_max = min(v1, v2) - alpha * d, max(v1, v2) + alpha * d
            lo, hi = limites[j]
            h1_reales.append(float(random.uniform(max(lo, c_min), min(hi, c_max))))
            h2_reales.append(float(random.uniform(max(lo, c_min), min(hi, c_max))))

        return h1_perm + h1_reales, h2_perm + h2_reales

    def _crossover_ox(self, padre1: list, padre2: list) -> Tuple[list, list]:
        """Alias compatible."""
        return self._crossover_hibrido(padre1, padre2)

    def _mutar(self, individuo: list) -> list:
        if random.random() > self.prob_mutacion:
            return list(individuo)
        hijo = list(individuo)
        if len(hijo) < self.n_total + 3:
            hijo = hijo[:self.n_total] + [3.5, 0.5, 5.0]
        r = random.random()

        if r < 0.30 and self.k < self.n_total:
            i_act, i_res = random.randrange(self.k), random.randrange(self.k, self.n_total)
            hijo[i_act], hijo[i_res] = hijo[i_res], hijo[i_act]
        elif r < 0.60 and self.k >= 2:
            i1, i2 = random.sample(range(self.k), 2)
            hijo[i1], hijo[i2] = hijo[i2], hijo[i1]
        elif r < 0.75 and self.k >= 3:
            i1, i2 = sorted(random.sample(range(self.k), 2))
            hijo[i1:i2 + 1] = list(reversed(hijo[i1:i2 + 1]))
        else:
            sigmas, limites = [0.5, 0.1, 0.9], [(1.0, 6.0), (0.0, 1.0), (1.0, 10.0)]
            for j in range(3):
                idx = self.n_total + j
                ruido = random.gauss(0, sigmas[j])
                hijo[idx] = max(limites[j][0], min(limites[j][1], float(hijo[idx]) + ruido))
        return hijo

    def _atajo_determinista_k1(self) -> Dict[str, Any]:
        candidatos = [d for d in self.destinos if d.get("costo_estimado", 15.0) <= self.presupuesto] or self.destinos
        mejor_destino = max(candidatos, key=lambda d: self.beneficios_base.get(d["id"], 5.0) - (0.15 * self.riesgos_lomas.get(d["id"], 5.0)))
        mejor_id = mejor_destino["id"]
        if self.exigencia_target <= 0.35:
            genes_reales_default = [1.5, 0.20, 2.0]
        elif self.exigencia_target >= 0.70:
            genes_reales_default = [5.5, 0.90, 8.5]
        else:
            genes_reales_default = [3.5, 0.50, 5.0]

        cromosoma = [mejor_id] + [did for did in self.todos_ids if did != mejor_id] + genes_reales_default
        fit_final = self.fitness(cromosoma)
        nivel_exig = self.fuzzy_engine.evaluar_exigencia(*genes_reales_default)

        distancia_total = self.calcular_distancia_ruta([mejor_id])
        historial_data = [{
            "generacion": 1,
            "mejor_fitness": round(fit_final, 3),
            "promedio_fitness": round(fit_final, 3),
            "costo_mejor": round(mejor_destino.get("costo_estimado", 15.0), 2),
            "distancia_mejor": round(distancia_total, 2)
        }]
        tramos = [
            {
                "de": "Punto de partida",
                "hacia": mejor_destino["nombre"],
                "distancia_km": round(distancia_total * 2, 1)
            }
        ]

        return {
            "ruta_ids": [mejor_id],
            "destinos_ordenados": [mejor_destino],
            "cromosoma_completo": cromosoma,
            "genes_reales": {
                "horas_recorrido": genes_reales_default[0],
                "cobertura_zona": genes_reales_default[1],
                "extension_circuito": genes_reales_default[2]
            },
            "nivel_exigencia": nivel_exig,
            "fitness": round(fit_final, 3),
            "costo_total": round(mejor_destino.get("costo_estimado", 15.0), 2),
            "distancia_total_km": round(distancia_total, 2),
            "tiempo_estimado_horas": round(mejor_destino.get("tiempo_estimado_horas", 4.0), 2),
            "riesgos_ruta": {mejor_id: self.riesgos_lomas.get(mejor_id, 5.0)},
            "tramos": tramos,
            "metodo": "atajo_determinista",
            "grafica_ascii": "  [Atajo Determinista K=1: Seleccion Directa]",
            "historial": historial_data,
            "historial_convergencia": historial_data
        }

    def optimizar(self) -> Dict[str, Any]:
        if self.k == 1:
            return self._atajo_determinista_k1()

        poblacion = [self._generar_individuo() for _ in range(self.tam_poblacion)]
        mejor_global = max(poblacion, key=self.fitness)
        mejor_fit_global = self.fitness(mejor_global)
        historial = []

        for gen in range(self.generaciones):
            poblacion_ordenada = sorted(poblacion, key=self.fitness, reverse=True)
            nueva_poblacion = [list(ind) for ind in poblacion_ordenada[:self.elitismo]]

            while len(nueva_poblacion) < self.tam_poblacion:
                p1 = self._seleccion_torneo(poblacion)
                p2 = self._seleccion_torneo(poblacion)
                if random.random() < self.prob_cruce:
                    h1, h2 = self._crossover_hibrido(p1, p2)
                else:
                    h1, h2 = list(p1), list(p2)
                nueva_poblacion.append(self._mutar(h1))
                if len(nueva_poblacion) < self.tam_poblacion:
                    nueva_poblacion.append(self._mutar(h2))

            poblacion = nueva_poblacion
            mejor_gen = max(poblacion, key=self.fitness)
            fit_gen = self.fitness(mejor_gen)
            if fit_gen > mejor_fit_global:
                mejor_fit_global = fit_gen
                mejor_global = list(mejor_gen)

            promedio_fit = sum(self.fitness(ind) for ind in poblacion) / len(poblacion)
            ruta_gen = self.obtener_ruta_activa(mejor_global)
            costo_gen = sum(self.destinos_dict[did].get("costo_estimado", 15.0) for did in ruta_gen)
            dist_gen = self.calcular_distancia_ruta(ruta_gen)

            historial.append({
                "generacion": gen + 1,
                "mejor_fitness": round(mejor_fit_global, 3),
                "promedio_fitness": round(promedio_fit, 3),
                "costo_mejor": round(costo_gen, 2),
                "distancia_mejor": round(dist_gen, 2)
            })

        ruta_optima = mejor_global[:self.k]
        destinos_optimos = [self.destinos_dict[did] for did in ruta_optima]
        h, c, e = mejor_global[self.n_total], mejor_global[self.n_total + 1], mejor_global[self.n_total + 2]
        nivel_exig = self.fuzzy_engine.evaluar_exigencia(h, c, e)

        # Generar gráfica ASCII de convergencia
        lineas_grafica = ["  Curva de Convergencia del Fitness (Generaciones):"]
        f_max = max(h["mejor_fitness"] for h in historial)
        f_min = min(h["promedio_fitness"] for h in historial)
        rango = max(0.001, f_max - f_min)
        for h_step in historial[::max(1, len(historial) // 10)]:
            pct = int(30 * (h_step["mejor_fitness"] - f_min) / rango)
            barra = "*" * max(1, pct)
            lineas_grafica.append(f"  Gen {h_step['generacion']:2d} | Fit: {h_step['mejor_fitness']:6.2f} | {barra}")

        tramos = [
            {
                "de": "Punto de partida",
                "hacia": self.destinos_dict[did]["nombre"],
                "distancia_km": round(
                    distancia_haversine(
                        self.nodo_base["lat"], self.nodo_base["lon"],
                        self.destinos_dict[did]["coordenadas"]["lat"],
                        self.destinos_dict[did]["coordenadas"]["lon"]
                    ) * 2, 1
                )
            }
            for did in ruta_optima
        ]

        return {
            "ruta_ids": ruta_optima,
            "destinos_ordenados": destinos_optimos,
            "cromosoma_completo": mejor_global,
            "genes_reales": {"horas_recorrido": round(h, 2), "cobertura_zona": round(c, 2), "extension_circuito": round(e, 2)},
            "nivel_exigencia": round(nivel_exig, 4),
            "fitness": round(mejor_fit_global, 3),
            "costo_total": round(sum(d.get("costo_estimado", 15.0) for d in destinos_optimos), 2),
            "distancia_total_km": round(self.calcular_distancia_ruta(ruta_optima), 2),
            "tiempo_estimado_horas": round(sum(d.get("tiempo_estimado_horas", 4.0) for d in destinos_optimos), 2),
            "riesgos_ruta": {did: self.riesgos_lomas.get(did, 5.0) for did in ruta_optima},
            "tramos": tramos,
            "metodo": "algoritmo_genetico",
            "grafica_ascii": "\n".join(lineas_grafica),
            "historial": historial,
            "historial_convergencia": historial
        }


def optimizar_ruta_lomas(**kwargs) -> Dict[str, Any]:
    return LomasGeneticOptimizer(**kwargs).optimizar()
