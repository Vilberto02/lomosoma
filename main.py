"""
Orquestador CLI del Sistema Inteligente de Lomas de Lima.
"""

import os
import sys
import json
import argparse
from typing import Dict, Any

# Compatibilidad UTF-8 en consola de Windows
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from modules.dtos import UserPreferencesDTO, CoordenadasDTO
from modules.pipeline import LomasPipelineOrchestrator
from modules.llm_module import extraer_preferencias_usuario


def ejecutar_pipeline(texto_usuario: str, verbose: bool = True) -> Dict[str, Any]:
    """
    Ejecuta el pipeline completo utilizando el orquestador central LomasPipelineOrchestrator.
    """
    if verbose:
        print("\nSISTEMA INTELIGENTE DE RUTAS: LOMAS DE LIMA")

    # 1. Extracción de perfil del usuario (compatibilidad heurística / LLM)
    perfil_raw = extraer_preferencias_usuario(texto_usuario)
    user_dto = UserPreferencesDTO(
        dias_disponibles=perfil_raw.get("dias_disponibles", 3),
        presupuesto_max=perfil_raw.get("presupuesto_max", 60.0),
        condicion_fisica=perfil_raw.get("condicion_fisica", "Moderado"),
        nodo_base=CoordenadasDTO(lat=-12.0464, lon=-77.0428),
        texto_usuario=texto_usuario
    )

    # 2. Ejecución a través del Orquestador POO
    orquestador = LomasPipelineOrchestrator()
    resultado = orquestador.run(user_dto)
    scores_difusos_catalogo = orquestador.fuzzy_engine.calcular_riesgos_catalogo(orquestador.destinos)

    if verbose:
        print(f"\n[1] Preferencias extraídas: {user_dto.dias_disponibles} días | Presupuesto: S/{user_dto.presupuesto_max:.2f} | Condición: {user_dto.condicion_fisica}")
        print(f"[2] Mapeo: {user_dto.dias_disponibles} días -> K = {resultado.k} destinos")
        desc_metodo = "Atajo Determinista K=1" if resultado.metodo == "atajo_determinista" else "Algoritmo Genético Híbrido"
        print(f"[4] Ruta Óptima ({desc_metodo}): {' -> '.join(resultado.ruta_ids)} | Fitness: {resultado.fitness:.3f}")
        print(f"    Costo total: S/{resultado.costo_total:.2f} | Distancia: {resultado.distancia_total_km:.1f} km")

        print(f"\n[Componentes Difusos Integrados]")
        print(f"- Componente 1 (Exigencia en Cromosoma): {resultado.nivel_exigencia:.2f}")
        print(f"  (Horas: {resultado.genes_reales.get('horas_recorrido', 0)}h, Cobertura: {resultado.genes_reales.get('cobertura_zona', 0)}, Extensión: {resultado.genes_reales.get('extension_circuito', 0)} km)")
        print(f"- Componente 2 (Riesgo en Fitness por Loma):")
        for did in resultado.ruta_ids:
            r = resultado.riesgos_ruta.get(did, 5.0)
            print(f"  * [{did}]: Riesgo Difuso = {r:.2f} / 10.0")

        print(f"\n{resultado.itinerario_narrativo}")
        print("\nGUÍA BÁSICA DE TRANSPORTE")
        for guia in resultado.guias_acceso:
            print(f"- {guia['nombre']}: {guia['medio_transporte']} (~{guia['tiempo_total_min']} min)")
        print("\n[OK] Pipeline finalizado con éxito.\n")

    return {
        "perfil": user_dto.to_dict(),
        "k": resultado.k,
        "scores_difusos": scores_difusos_catalogo,
        "resultado_ag": resultado.to_dict(),
        "itinerario": resultado.itinerario_narrativo,
        "guias_transporte": {g["nombre"]: g for g in resultado.guias_acceso}
    }


def main():
    parser = argparse.ArgumentParser(description="Pipeline CLI de Rutas en Lomas de Lima")
    parser.add_argument("--texto", type=str, default=None, help="Texto con preferencias del usuario")
    parser.add_argument("--demo", action="store_true", help="Ejecuta demostración de prueba")
    args = parser.parse_args()

    texto = args.texto or "Quiero viajar 3 dias con 60 soles por senderos verdes de dificultad moderada."
    ejecutar_pipeline(texto, verbose=True)


if __name__ == "__main__":
    main()
