"""
Modelos Pydantic para la API REST del Sistema Inteligente de Lomas de Lima.
"""

from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field, ConfigDict


class CoordenadasModel(BaseModel):
    lat: float = Field(..., ge=-90, le=90, allow_inf_nan=False, description="Latitud en grados decimales")
    lon: float = Field(..., ge=-180, le=180, allow_inf_nan=False, description="Longitud en grados decimales")


class PuntoSenal4GModel(BaseModel):
    nombre: str
    lat: float
    lon: float


class GaritaControlModel(BaseModel):
    nombre: str
    lat: float
    lon: float
    horario_ingreso: str
    hora_limite_bajada: str
    ultimo_transporte_retorno: str
    ultimo_punto_senal_4g: Optional[PuntoSenal4GModel] = None


class TarifarioOficialModel(BaseModel):
    entrada_adulto_pen: float
    entrada_escolar_pen: float = 0.0
    guiado_grupal_pen: float = 40.0
    max_personas_guia: int = 8
    mototaxi_justo_pen: float = 4.0
    asociacion: str
    whatsapp_contacto: str = ""


class ComposicionTerrenoModel(BaseModel):
    tierra_compacta_pct: int = 50
    roca_granito_pct: int = 30
    barro_arcilloso_pct: int = 20


class ModoTransporteModel(BaseModel):
    modo: str
    etiqueta: str
    tiempo_estimado_min: int
    costo_por_persona_pen: float
    costo_grupal_4_pen: float
    resumen_ruta: str
    pasos: List[str]


class LomaCastDayModel(BaseModel):
    fecha: str
    dia_nombre: str
    temp_min_c: float
    temp_max_c: float
    humedad_pct: int
    probabilidad_colchon_nubes_pct: int
    ventana_colchon_nubes: str
    golden_hour_am: str
    golden_hour_pm: str
    nivel_barro: str
    epic_score: float


class LomaCastReportModel(BaseModel):
    loma_id: str
    nombre_loma: str
    actualizado_en: str
    fuente_datos: str
    temp_actual_c: float
    humedad_actual_pct: int
    indice_uv: float
    viento_kmh: float
    fase_floracion_index: int
    fase_floracion_nombre: str
    indice_verdor_actual: float
    probabilidad_colchon_hoy_pct: int
    ventana_optima_hoy: str
    golden_hour_hoy: str
    estado_sendero_barro: str
    mejor_dia_semana: str
    pronostico_7_dias: List[LomaCastDayModel] = Field(default_factory=list)


class WaypointSenderoModel(BaseModel):
    nombre: str
    tipo: str
    lat: float
    lon: float
    altitud_msnm: float


class PuntoElevacionModel(BaseModel):
    distancia_km: float
    altitud_msnm: float
    pendiente_pct: float
    superficie: str


class SenderoProfileModel(BaseModel):
    loma_id: str
    nombre_circuito: str
    distancia_km: float
    desnivel_positivo_m: float
    altitud_min_msnm: float
    altitud_max_msnm: float
    coordenadas_3d: List[List[float]]
    waypoints: List[WaypointSenderoModel]
    perfil_elevacion: List[PuntoElevacionModel]
    composicion_terreno: ComposicionTerrenoModel


class ReporteCiudadanoCreateRequest(BaseModel):
    autor: str = Field(default="Excursionista Anónimo", max_length=120)
    estado_barro: str = Field(default="Húmedo con buen agarre", max_length=80)
    flor_amancaes_vista: bool = Field(default=False)
    colchon_nubes_visto: bool = Field(default=True)
    comentario: str = Field(min_length=1, max_length=2000)


class ReporteCiudadanoModel(BaseModel):
    id: str
    loma_id: str
    autor: str
    fecha_iso: str
    estado_barro: str
    flor_amancaes_vista: bool
    colchon_nubes_visto: bool
    comentario: str


class UserPreferencesRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    dias_disponibles: int = Field(default=3, ge=1, le=15, description="Cantidad de dias disponibles para trekking")
    presupuesto_max: float = Field(default=60.0, ge=10.0, le=100000, allow_inf_nan=False, description="Presupuesto maximo total en Soles PEN")
    condicion_fisica: Literal["Fácil", "Facil", "Moderado", "Difícil", "Dificil"] = "Moderado"
    nodo_base: CoordenadasModel = Field(
        default_factory=lambda: CoordenadasModel(lat=-12.0464, lon=-77.0428),
        description="Coordenadas del punto de partida o alojamiento"
    )
    texto_usuario: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="Descripcion cualitativa libre de preferencias"
    )


class GuiaAccesoModel(BaseModel):
    id: str
    nombre: str
    punto_partida_recomendado: str
    medio_transporte: str
    tiempo_total_min: int
    costo_total_soles: float
    pasos: List[str]
    coordenadas_destino: CoordenadasModel
    modos_transporte: List[ModoTransporteModel] = Field(default_factory=list)
    geometria_vial: List[List[float]] = Field(default_factory=list)
    tarifa_justa_mototaxi_pen: float = 4.0
    ultimo_transporte_retorno: str = "17:30"
    garita_nombre: str = ""
    recomendaciones: str = ""
    fuente_geometria: str = ""
    distancia_haversine_km: float = 0.0
    estacion_troncal: str = ""


class LomaSummaryModel(BaseModel):
    id: str
    nombre: str
    distrito: str
    tipo: str
    dificultad: str
    coordenadas: CoordenadasModel
    saturacion_base: float
    seguridad_base: float
    clima_verdor_base: float
    accesibilidad_base: float
    costo_estimado: float
    tiempo_estimado_horas: float
    distancia_centro_min: float
    transporte_principal: str
    descripcion: str
    temporada_optima: str
    score_difuso: float = Field(default=0.0, description="Score de riesgo calculado por el sistema difuso Mamdani")
    es_loma_natural: bool = True
    pro_demo_gratis: bool = False
    altitud_max_msnm: Optional[float] = None
    desnivel_positivo_m: Optional[float] = None
    distancia_sendero_km: Optional[float] = None
    pendiente_max_pct: Optional[float] = None
    atractivos_principales: List[str] = Field(default_factory=list)
    composicion_terreno: Optional[ComposicionTerrenoModel] = None
    garita_control: Optional[GaritaControlModel] = None
    tarifario_oficial: Optional[TarifarioOficialModel] = None
    lomacast_resumen: Optional[Dict[str, Any]] = None


class LomaDetailModel(LomaSummaryModel):
    guia_acceso: Optional[GuiaAccesoModel] = None
    lomacast: Optional[LomaCastReportModel] = None
    sendero: Optional[SenderoProfileModel] = None
    reportes_recientes: List[ReporteCiudadanoModel] = Field(default_factory=list)


class OfflinePackResponseModel(BaseModel):
    loma_id: str
    version_pack: str
    generado_en: str
    loma: LomaDetailModel
    lomacast: LomaCastReportModel
    sendero: SenderoProfileModel
    guia_acceso: GuiaAccesoModel
    gpx_xml: str
    checksum_sha256: str


class PresetZonaModel(BaseModel):
    nombre: str
    lat: float
    lon: float


class OptimizationResponse(BaseModel):
    k: int
    ruta_ids: List[str]
    destinos_ordenados: List[Dict[str, Any]]
    fitness: float
    costo_total: float
    distancia_total_km: float
    tiempo_estimado_horas: float
    nivel_exigencia: float
    riesgos_ruta: Dict[str, float]
    tramos: List[Dict[str, Any]]
    genes_reales: Dict[str, float]
    itinerario_narrativo: str
    guias_acceso: List[Dict[str, Any]]
    metodo: str
    grafica_ascii: str
    historial: List[Dict[str, Any]] = []
    llm_provider: str = Field(default="fallback", description="Proveedor del itinerario narrativo gemini o fallback")
    checklist_equipamiento: List[str] = Field(default_factory=list)
    afinidad_destinos: Dict[str, float] = Field(default_factory=dict)
