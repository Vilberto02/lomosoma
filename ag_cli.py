"""
CLI independiente del Algoritmo Genético para Rutas en Lomas de Lima.

Ejecuta el módulo genético de forma aislada (sin pipeline, sin LLM) con
parámetros configurables y semilla fija para reproducir resultados.
"""

import argparse
import json
import os
import sys

if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from modules.genetic_algorithm import LomasGeneticOptimizer

DATA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "destinos.json")


def _cargar_destinos():
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _preguntar(texto, default, tipo):
    entrada = input(f"{texto} [{default}]: ").strip()
    if not entrada:
        return default
    try:
        return tipo(entrada)
    except ValueError:
        print(f"Valor inválido, se usará el valor por defecto: {default}")
        return default


def main():
    parser = argparse.ArgumentParser(description="CLI del Algoritmo Genético de Lomas de Lima")
    parser.add_argument("--k", type=int, default=None, help="Cantidad de lomas a visitar (1 a 6)")
    parser.add_argument("--presupuesto", type=float, default=None, help="Presupuesto máximo en Soles")
    parser.add_argument("--dias", type=int, default=None, help="Días disponibles (1 a 15)")
    parser.add_argument("--generaciones", type=int, default=None, help="Número de generaciones")
    parser.add_argument("--poblacion", type=int, default=None, help="Tamaño de la población")
    parser.add_argument("--semilla", type=int, default=None, help="Semilla aleatoria fija para reproducir resultados")
    parser.add_argument("--prob-cruce", type=float, default=None, help="Probabilidad de cruce (0 a 1)")
    parser.add_argument("--prob-mutacion", type=float, default=None, help="Probabilidad de mutación (0 a 1)")
    parser.add_argument("--nodo-lat", type=float, default=None, help="Latitud del punto de partida")
    parser.add_argument("--nodo-lon", type=float, default=None, help="Longitud del punto de partida")
    args = parser.parse_args()

    interactivo = all(
        v is None
        for v in [args.k, args.presupuesto, args.dias, args.generaciones, args.poblacion]
    )

    if interactivo:
        print("=== CLI del Algoritmo Genético, Rutas en Lomas de Lima ===")
        dias = _preguntar("Días disponibles", 3, int)
        presupuesto = _preguntar("Presupuesto máximo en S/", 60.0, float)
        k = _preguntar("Cantidad de lomas K", 3, int)
        generaciones = _preguntar("Generaciones", 50, int)
        poblacion = _preguntar("Tamaño de población", 40, int)
        semilla = _preguntar("Semilla (vacío para aleatorio)", "", str)
        semilla = int(semilla) if semilla else None
        prob_cruce = _preguntar("Probabilidad de cruce", 0.85, float)
        prob_mutacion = _preguntar("Probabilidad de mutación", 0.30, float)
        nodo_lat = _preguntar("Latitud del punto de partida", -12.0464, float)
        nodo_lon = _preguntar("Longitud del punto de partida", -77.0428, float)
    else:
        dias = args.dias if args.dias is not None else 3
        presupuesto = args.presupuesto if args.presupuesto is not None else 60.0
        k = args.k if args.k is not None else 3
        generaciones = args.generaciones if args.generaciones is not None else 50
        poblacion = args.poblacion if args.poblacion is not None else 40
        semilla = args.semilla
        prob_cruce = args.prob_cruce if args.prob_cruce is not None else 0.85
        prob_mutacion = args.prob_mutacion if args.prob_mutacion is not None else 0.30
        nodo_lat = args.nodo_lat if args.nodo_lat is not None else -12.0464
        nodo_lon = args.nodo_lon if args.nodo_lon is not None else -77.0428

    destinos = _cargar_destinos()

    optimizador = LomasGeneticOptimizer(
        destinos=destinos,
        k=k,
        presupuesto=presupuesto,
        dias_disponibles=dias,
        generaciones=generaciones,
        tam_poblacion=poblacion,
        prob_cruce=prob_cruce,
        prob_mutacion=prob_mutacion,
        semilla=semilla,
        nodo_base={"lat": nodo_lat, "lon": nodo_lon},
    )

    print("\nEjecutando algoritmo genético...")
    resultado = optimizador.optimizar()

    metodo = "Atajo determinista (K=1)" if resultado.get("metodo") == "atajo_determinista" else "Algoritmo Genético Híbrido"
    print(f"\nRuta óptima ({metodo})")
    print(" -> ".join(resultado["ruta_ids"]))
    print(f"Fitness: {resultado['fitness']:.3f}")
    print(f"Costo total: S/ {resultado['costo_total']:.2f}")
    print(f"Distancia total: {resultado['distancia_total_km']:.1f} km")
    print(f"Tiempo estimado: {resultado['tiempo_estimado_horas']:.1f} h")

    genes = resultado.get("genes_reales", {})
    print(f"\nGenes reales del cromosoma")
    print(f"Horas de recorrido: {genes.get('horas_recorrido', 0):.1f} h")
    print(f"Cobertura de zona: {genes.get('cobertura_zona', 0):.2f}")
    print(f"Extensión de circuito: {genes.get('extension_circuito', 0):.1f} km")
    print(f"Nivel de exigencia difusa: {resultado.get('nivel_exigencia', 0.0):.3f}")

    print("\nRiesgo difuso por loma")
    for did in resultado["ruta_ids"]:
        print(f"  {did}: {resultado['riesgos_ruta'].get(did, 5.0):.2f} / 10.0")

    print("\nCurva de convergencia evolutiva")
    print(resultado.get("grafica_ascii", "Sin datos de convergencia."))
    print("\nFinalizado con éxito.")


if __name__ == "__main__":
    main()
