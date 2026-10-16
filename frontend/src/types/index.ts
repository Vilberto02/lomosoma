export interface Coordenadas {
  lat: number;
  lon: number;
}

export interface GuiaAcceso {
  id: string;
  nombre: string;
  punto_partida_recomendado: string;
  medio_transporte: string;
  tiempo_total_min: number;
  costo_total_soles: number;
  pasos: string[];
  coordenadas_destino: Coordenadas;
}

export interface Loma {
  id: string;
  nombre: string;
  distrito: string;
  tipo: string;
  dificultad: "Fácil" | "Moderado" | "Difícil" | string;
  coordenadas: Coordenadas;
  saturacion_base: number;
  seguridad_base: number;
  clima_verdor_base: number;
  accesibilidad_base: number;
  costo_estimado: number;
  tiempo_estimado_horas: number;
  distancia_centro_min: number;
  transporte_principal: string;
  descripcion: string;
  temporada_optima: string;
  score_difuso?: number;
  guia_acceso?: GuiaAcceso;
}

export interface PresetZona {
  nombre: string;
  lat: number;
  lon: number;
}

export interface UserPreferencesRequest {
  dias_disponibles: number;
  presupuesto_max: number;
  condicion_fisica: "Fácil" | "Moderado" | "Difícil";
  nodo_base: Coordenadas;
  texto_usuario?: string | null;
}

export interface Tramo {
  de: string;
  hacia: string;
  distancia_km: number;
}

export interface OptimizationResult {
  k: number;
  ruta_ids: string[];
  destinos_ordenados: Loma[];
  fitness: number;
  costo_total: number;
  distancia_total_km: number;
  tiempo_estimado_horas: number;
  nivel_exigencia: number;
  riesgos_ruta: Record<string, number>;
  tramos: Tramo[];
  genes_reales: {
    horas_recorrido?: number;
    cobertura_zona?: number;
    extension_circuito?: number;
    [key: string]: number | undefined;
  };
  itinerario_narrativo: string;
  guias_acceso: GuiaAcceso[];
  metodo: string;
  grafica_ascii: string;
  llm_provider?: "gemini" | "fallback" | string;
  historial: Array<{
    generacion: number;
    mejor_fitness: number;
    fitness_promedio: number;
  }>;
}
