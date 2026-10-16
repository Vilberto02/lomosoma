export interface Coordenadas {
  lat: number;
  lon: number;
}

export interface PuntoSenal4G {
  nombre: string;
  lat: number;
  lon: number;
}

export interface GaritaControl {
  nombre: string;
  lat: number;
  lon: number;
  horario_ingreso: string;
  hora_limite_bajada: string;
  ultimo_transporte_retorno: string;
  ultimo_punto_senal_4g?: PuntoSenal4G;
}

export interface TarifarioOficial {
  entrada_adulto_pen: number;
  entrada_escolar_pen: number;
  guiado_grupal_pen: number;
  max_personas_guia: number;
  mototaxi_justo_pen: number;
  asociacion: string;
  whatsapp_contacto: string;
}

export interface ComposicionTerreno {
  tierra_compacta_pct: number;
  roca_granito_pct: number;
  barro_arcilloso_pct: number;
}

export interface ModoTransporte {
  modo: string;
  etiqueta: string;
  tiempo_estimado_min: number;
  costo_por_persona_pen: number;
  costo_grupal_4_pen: number;
  resumen_ruta: string;
  pasos: string[];
}

export interface LomaCastDay {
  fecha: string;
  dia_nombre: string;
  temp_min_c: number;
  temp_max_c: number;
  humedad_pct: number;
  probabilidad_colchon_nubes_pct: number;
  ventana_colchon_nubes: string;
  golden_hour_am: string;
  golden_hour_pm: string;
  nivel_barro: string;
  epic_score: number;
}

export interface LomaCastReport {
  loma_id: string;
  nombre_loma: string;
  actualizado_en: string;
  fuente_datos: string;
  temp_actual_c: number;
  humedad_actual_pct: number;
  indice_uv: number;
  viento_kmh: number;
  fase_floracion_index: number;
  fase_floracion_nombre: string;
  indice_verdor_actual: number;
  probabilidad_colchon_hoy_pct: number;
  ventana_optima_hoy: string;
  golden_hour_hoy: string;
  estado_sendero_barro: string;
  mejor_dia_semana: string;
  pronostico_7_dias: LomaCastDay[];
}

export interface WaypointSendero {
  nombre: string;
  tipo: "garita" | "senal_4g" | "flora" | "bifurcacion" | "cumbre" | string;
  lat: number;
  lon: number;
  altitud_msnm: number;
}

export interface PuntoElevacion {
  distancia_km: number;
  altitud_msnm: number;
  pendiente_pct: number;
  superficie: string;
}

export interface SenderoProfile {
  loma_id: string;
  nombre_circuito: string;
  distancia_km: number;
  desnivel_positivo_m: number;
  altitud_min_msnm: number;
  altitud_max_msnm: number;
  coordenadas_3d: number[][];
  waypoints: WaypointSendero[];
  perfil_elevacion: PuntoElevacion[];
  composicion_terreno: ComposicionTerreno;
}

export interface ReporteCiudadano {
  id: string;
  loma_id: string;
  autor: string;
  fecha_iso: string;
  estado_barro: string;
  flor_amancaes_vista: boolean;
  colchon_nubes_visto: boolean;
  comentario: string;
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
  modos_transporte?: ModoTransporte[];
  geometria_vial?: number[][];
  tarifa_justa_mototaxi_pen?: number;
  ultimo_transporte_retorno?: string;
  garita_nombre?: string;
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
  es_loma_natural?: boolean;
  pro_demo_gratis?: boolean;
  altitud_max_msnm?: number;
  desnivel_positivo_m?: number;
  distancia_sendero_km?: number;
  pendiente_max_pct?: number;
  atractivos_principales?: string[];
  composicion_terreno?: ComposicionTerreno;
  garita_control?: GaritaControl;
  tarifario_oficial?: TarifarioOficial;
  lomacast_resumen?: {
    temp_actual_c?: number;
    probabilidad_colchon_hoy_pct?: number;
    fase_floracion_nombre?: string;
    estado_sendero_barro?: string;
    epic_score?: number;
  };
  guia_acceso?: GuiaAcceso;
  lomacast?: LomaCastReport;
  sendero?: SenderoProfile;
  reportes_recientes?: ReporteCiudadano[];
}

export interface OfflineLomaPack {
  loma_id: string;
  version_pack: string;
  generado_en: string;
  loma: Loma;
  lomacast: LomaCastReport;
  sendero: SenderoProfile;
  guia_acceso: GuiaAcceso;
  gpx_xml: string;
  checksum_sha256: string;
}

export interface SummitStamp {
  loma_id: string;
  nombre_loma: string;
  altitud_msnm: number;
  fecha_iso: string;
  lat_verificada: number;
  lon_verificada: number;
  distancia_cumbre_m: number;
  hash_firma_sha256: string;
  sincronizado_servidor: boolean;
}

export interface BillingPlan {
  plan_id: string;
  nombre: string;
  tipo_pago: string;
  precio_pen: number;
  precio_usd: number;
  descripcion: string;
  beneficios: string[];
}

export interface CheckoutRequest {
  plan_id: "pack_lima_pro" | "loma_individual" | string;
  loma_id?: string;
  metodo_pago: "yape_plin" | "tarjeta";
  email_cliente?: string;
}

export interface CheckoutResponse {
  orden_id: string;
  estado: string;
  plan_id: string;
  lomas_desbloqueadas: string[];
  acceso_total_lima: boolean;
  monto_pagado_pen: number;
  metodo_pago: string;
  token_licencia: string;
  emitido_en: string;
  mensaje: string;
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
  checklist_equipamiento?: string[];
  afinidad_destinos?: Record<string, number>;
  historial: Array<{
    generacion: number;
    mejor_fitness: number;
    fitness_promedio?: number;
    promedio_fitness?: number;
  }>;
}
