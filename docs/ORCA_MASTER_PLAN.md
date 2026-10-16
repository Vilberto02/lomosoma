# Plan Maestro de Ejecucion Multi Agente para Lomosoma 2.0

## Reglas Globales Inquebrantables para Todos los Agentes

1. **PROHIBIDO EL USO DE EMOJIS**: Ningun archivo creado o modificado (Python, TypeScript, TSX, JSON, Markdown o tests) puede contener emojis. En componentes React utiliza exclusivamente iconos de `lucide-react`.
2. **PROHIBIDO USAR `=` O `-` EN COMENTARIOS**: En ningun comentario de codigo (`# ...` en Python, `// ...` o `/* ... */` en TypeScript/TSX o docstrings) se permite incluir el caracter `=` ni el caracter `-`. No escribas separadores como `# ====` ni `# ----`, ni uses guiones o signos igual dentro del texto de un comentario.
3. **AISLAMIENTO DE PROPIEDAD (OWNERSHIP)**:
   * **Worker 1 (Codex CLI en `feat-backend-core-codex`)**: Solo puede crear o modificar archivos en `modules/`, `backend/` y `tests/`. Tiene prohibido tocar `frontend/`.
   * **Worker 2 (Antigravity CLI en `feat-frontend-offline-pro-agy`)**: Solo puede crear o modificar archivos en `frontend/src/`. Tiene prohibido tocar `modules/`, `backend/`, `data/` o `tests/`.

## Especificacion para Worker 1: Codex CLI (Backend, IA, Clima, Ruteo y Billing)

### Archivos a Crear o Modificar por Worker 1
1. `modules/weather_service.py` (NUEVO):
   * Implementar `LomaCastService` que carga `data/destinos.json` y calcula el reporte `LomaCastReportModel` (como `dict` compatible con el esquema en `backend/app/schemas/api_models.py`).
   * Incluir consulta opcional a Open Meteo con timeout corto (`1.8s`) y cache en memoria, mas un motor determinista biofisico local de alta precision (para que funcione siempre sin red y en tests) que calcule:
     * `temp_actual_c`, `humedad_actual_pct`, `indice_uv`, `viento_kmh`.
     * `fase_floracion_index` (1 a 5) y `fase_floracion_nombre` (`"Fase 1: Reposo Estival"`, `"Fase 2: Primeros Brotes de Niebla"`, `"Fase 3: Alfombra Verde Activa"`, `"Fase 4: Floracion Plena de Amancaes"`, `"Fase 5: Semillado y Transicion"`).
     * `probabilidad_colchon_hoy_pct` (0 a 100), `ventana_optima_hoy` (ej. `"06:00 a 08:30"`), `golden_hour_hoy` (ej. `"06:15 AM / 17:35 PM"`), `estado_sendero_barro` y `pronostico_7_dias` (lista de 7 objetos con `fecha`, `dia_nombre`, `temp_min_c`, `temp_max_c`, `humedad_pct`, `probabilidad_colchon_nubes_pct`, `ventana_colchon_nubes`, `golden_hour_am`, `golden_hour_pm`, `nivel_barro`, `epic_score`).
2. `modules/routing_service.py` (NUEVO):
   * Implementar `LastMileRoutingService` que carga `data/destinos.json` y `data/senderos_lomas.geojson`.
   * Metodo `calcular_ruta_ultima_milla(id_destino: str, origen_lat: float = -12.0464, origen_lon: float = -77.0428) -> dict`:
     * Calcula la distancia Haversine real desde `(origen_lat, origen_lon)` hasta la garita de control de la loma (`garita_control.lat`, `garita_control.lon`).
     * Encuentra la estacion troncal mas cercana al usuario y construye `modos_transporte` con 3 opciones estilo Citymapper:
       1. `modo: "mochilero"`, `etiqueta: "100% Transporte Publico"`: menor costo, combina troncal + combi/alimentador + mototaxi a tarifa justa.
       2. `modo: "smart"`, `etiqueta: "Hibrido Smart (Tren/Metropolitano + Colectivo/Taxi Final)"`: balance ideal de tiempo y costo.
       3. `modo: "directo"`, `etiqueta: "Auto Propio o Taxi Directo a Garita"`: menor tiempo, ideal para dividir entre 4 amigos.
     * Genera `geometria_vial` (lista de pares `[lat, lon]` interpolando puntos viales intermedios realistas entre el origen del usuario, el nodo troncal y la garita de la loma).
   * Metodo `obtener_perfil_sendero(id_destino: str) -> dict`:
     * Lee el feature correspondiente en `data/senderos_lomas.geojson`, calcula `perfil_elevacion` (distancia acumulada en km, altitud en msnm, pendiente en porcentaje y tipo de superficie segun la altitud) y devuelve el diccionario compatible con `SenderoProfileModel`.
   * Metodo `generar_gpx_xml(id_destino: str) -> str`:
     * Genera un string XML `.gpx` version 1.1 estandar con `<wpt>` para cada waypoint y `<trk><trkseg><trkpt>` con `<ele>` para cada punto 3D del sendero.
   * Metodo `generar_offline_pack(id_destino: str, loma_detail: dict, lomacast: dict) -> dict`:
     * Empaqueta toda la informacion de la loma, sendero, guia de acceso, lomacast y GPX junto con un `checksum_sha256` real en hexadecimal.
3. `modules/access_module.py` (MODIFICAR):
   * Actualizar `obtener_guia_acceso(self, id_destino: str, origen_lat: Optional[float] = None, origen_lon: Optional[float] = None) -> Dict[str, Any]` integrando `LastMileRoutingService` y manteniendo todas las llaves originales (`nombre`, `punto_partida_recomendado`, `medio_transporte`, `tiempo_total_min`, `costo_total_soles`, `pasos`, `recomendaciones`) mas las nuevas (`modos_transporte`, `geometria_vial`, `tarifa_justa_mototaxi_pen`, `ultimo_transporte_retorno`, `garita_nombre`).
4. `modules/mapping.py` y `modules/pipeline.py` (MODIFICAR):
   * En `LomasMappingService`, agregar `calcular_beneficios_personalizados(cls, destinos, fuzzy_prefs)` y `generar_checklist_equipamiento(cls, destinos_ordenados, fuzzy_prefs, condicion_fisica)`.
   * En `LomasPipelineOrchestrator.run(self, user_prefs)`, usar `calcular_beneficios_personalizados` para alimentar `beneficios_base` del optimizador genetico, pasar las coordenadas de `user_prefs.nodo_base` a `obtener_guia_acceso`, y poblar `checklist_equipamiento` y `afinidad_Destinos` en `OptimizationResultDTO`.
5. `backend/app/api/routes_lomas.py`, `backend/app/api/routes_billing.py` (NUEVO) y `backend/app/main.py` (MODIFICAR):
   * En `routes_lomas.py`:
     * `GET /api/lomas`: Soportar filtro opcional `solo_naturales: Optional[bool] = Query(None)` y adjuntar `lomacast_resumen` a cada loma. (Importante: cuando `solo_naturales` es `None`, debe seguir devolviendo las 15 lomas para pasar `test_backend_api.py`).
     * `GET /api/lomas/{id_loma}`: Aceptar query params opcionales `user_lat: Optional[float] = Query(None)` y `user_lon: Optional[float] = Query(None)`, e incluir `guia_acceso` enriquecida, `lomacast`, `sendero` y `reportes_recientes`.
     * `GET /api/lomas/{id_loma}/lomacast`: Devuelve `LomaCastReportModel`.
     * `GET /api/lomas/{id_loma}/sendero`: Devuelve `SenderoProfileModel`.
     * `GET /api/lomas/{id_loma}/gpx`: Devuelve `Response(content=gpx_xml, media_type="application/gpx+xml")`.
     * `GET /api/lomas/{id_loma}/offline-pack`: Devuelve `OfflinePackResponseModel`.
     * `POST /api/lomas/{id_loma}/reportes`: Registra en memoria un nuevo reporte ciudadano y devuelve `ReporteCiudadanoModel`.
   * En `routes_billing.py`:
     * `GET /api/billing/plans`: Devuelve los 2 planes de pago unico (`pack_lima_pro` a `S/ 19.90` y `loma_individual` a `S/ 4.90`).
     * `POST /api/billing/checkout`: Procesa `CheckoutRequestModel` y devuelve `CheckoutResponseModel` con token firmado SHA256.
   * Registrar `billing_router` en `backend/app/main.py` bajo `/api`.
6. `tests/test_lomosoma_v2.py` (NUEVO):
   * Pruebas automatizadas verificando LomaCast 7D, enrutamiento dinamico Citymapper, exportacion GPX, Offline Pack, Checkout de Pago Unico y afinidad semantica en el pipeline.

## Especificacion para Worker 2: Antigravity CLI (Frontend React, Motor Zero Signal Offline, Guardian GPS y Suite Pro)

### Archivos a Crear o Modificar por Worker 2
1. `frontend/src/services/offlineStorage.ts` (NUEVO):
   * Wrapper limpio sobre `IndexedDB` (con fallback automatico a `localStorage` si `IndexedDB` no esta disponible en el entorno) para:
     * Guardar y recuperar `OfflineLomaPack` por `loma_id` (`saveOfflinePack`, `getOfflinePack`, `listOfflinePackIds`, `removeOfflinePack`).
     * Guardar y recuperar los sellos verificados del **Pasaporte Digital de Cumbres** (`saveSummitStamp`, `getSummitStamps`).
2. `frontend/src/services/offlineGeoEngine.ts` (NUEVO):
   * Motor matematico 100% local que funciona con 0% de internet:
     * `evaluateTrailPosition(userCoords: Coordenadas, sendero: SenderoProfile)`: Calcula distancia perpendicular en metros al segmento mas cercano del sendero (`crossTrackDistanceMeters`), porcentaje de avance del circuito (`progressPct`), altitud estimada (`estimatedAltitudeMsnm`), rumbo en grados hacia el sendero (`bearingToTrailDeg`) y booleano `isOffTrail` (`crossTrackDistanceMeters > 35`).
     * `verifyAndCreateSummitStamp(userCoords: Coordenadas, loma: Loma, sendero?: SenderoProfile)`: Verifica si el excursionista esta a menos de 60 metros de la cumbre, calcula el hash criptografico local y genera el objeto `SummitStamp`.
     * `playRescueWhistle3000Hz(durationMs?: number)`: Usa `window.AudioContext` para emitir una onda modulada de rescate en neblina a 3,000 Hz sin requerir internet ni archivos externos.
     * `buildEmergencySmsHref(userCoords: Coordenadas, lomaNombre: string)`: Construye un URI `sms:?body=...` para red celular 2G/GSM con coordenadas GPS, altitud y enlace de ubicacion.
3. `frontend/src/context/ProContext.tsx` y `frontend/src/components/Panels/ProUpgradeModal.tsx` (NUEVOS):
   * `ProContext`: Gestiona el modelo de Pago Unico estilo Komoot:
     * `isLomaProUnlocked(lomaId: string)`: Retorna `true` siempre para `"L0"` (Lomas del Paraiso Demo Pro Gratis), o si `hasFullLimaPack` es `true`, o si `lomaId` esta en `unlockedLomaIds`.
     * Gestiona tambien `offlinePackIds`, `summitStamps`, `downloadOfflinePackForLoma(lomaId)` y `openUpgradeModal(targetLomaId?)`.
   * `ProUpgradeModal`: Modal de Checkout de Pago Unico (sin suscripciones) que permite elegir entre **Pack Vitalicio Todo Lima PRO (S/ 19.90)** o **Desbloqueo de Loma Individual (S/ 4.90)**, seleccionar metodo de pago (**Yape / Plin QR** o **Tarjeta**), llamar a `checkoutPlan` y desbloquear al instante, ademas de mostrar el **Pasaporte Digital de Cumbres** del usuario.
4. `frontend/src/components/Map/FogGuardianWidget.tsx` (NUEVO):
   * Widget flotante para navegacion sin senal en la loma seleccionada:
     * Muestra en tiempo real la desviacion respecto al sendero (`metros`), avance del circuito (`%`), altitud (`msnm`), estado de cobertura (`Modo Sin Senal Activo desde Maletin Offline`) y alerta visual/acustica si `isOffTrail` supera los `35m`.
     * Incluye controles de **Simulador en Vivo**: `"Simular Avance en Sendero"`, `"Simular Desvio en Neblina (>45m)"`, `"Simular Llegada a Cumbre (Sellar Pasaporte)"`, boton de **Silbato Acustico SOS 3000 Hz** y boton de **SMS 2G / Lifeline**.
5. Actualizar `frontend/src/services/api.ts`, `frontend/src/components/Map/GoogleStyleMap.tsx`, `frontend/src/components/Map/MapMarkers.tsx`, `frontend/src/components/Panels/LomaDetailSheet.tsx`, `frontend/src/components/Panels/RouteResultsPanel.tsx`, `frontend/src/components/Search/FloatingSearchBar.tsx` y `frontend/src/App.tsx`:
   * En `api.ts`: Agregar `fetchLomaDetail(id, userCoords?)`, `fetchLomaCast(id)`, `fetchSenderoProfile(id)`, `downloadOfflinePack(id)`, `downloadGpxUrl(id)`, `postReporteCiudadano(id, data)`, `fetchBillingPlans()` y `checkoutPlan(req)` con fallback automatico a `offlineStorage` cuando el navegador este sin conexion.
   * En `MapMarkers.tsx` y `GoogleStyleMap.tsx`: Dibujar el trazado vial real (`geometria_vial`) y, cuando hay una loma seleccionada con `sendero`, dibujar en color verde esmeralda el circuito interno de senderismo y sus waypoints (`Garita`, `Ultimo Punto 4G`, `Cumbre`). Integrar `FogGuardianWidget`.
   * En `LomaDetailSheet.tsx`: Organizar en 4 pestañas de alto valor:
     1. **LomaCast 7D**: Medidor de Flor de Amancaes en 5 fases, ventana de Colchon de Nubes, Golden Hour y tabla de 7 dias (abierta en `L0` o usuarios Pro, con boton de desbloqueo Pago Unico en el resto).
     2. **Sendero y Sin Senal**: Boton **"Descargar Maletin Offline (Sin Senal)"**, grafico SVG de Perfil de Elevacion, composicion de superficie estilo Komoot (% tierra, % roca, % barro), boton **"Activar Guardian Anti Neblina"** y **"Descargar GPX"**.
     3. **Ultima Milla (3 Modos)**: Comparador estilo Citymapper (*Mochilero*, *Smart Hibrido*, *Directo*), tarifario anti estafa de mototaxi/colectivo, hora del ultimo transporte de retorno y enlace a WhatsApp de la asociacion.
     4. **Grupo y Pasaporte**: Calculadora interactiva de **Chancha Grupal (1 a 10 personas)** que divide guia comunitario + transporte + entradas para copiar a WhatsApp/Yape, sellado de cumbre y muro de reportes ciudadanos.
   * En `FloatingSearchBar.tsx`: Agregar chips de filtro rapido (`En Temporada`, `Demo Pro Gratis (Paraiso)`, `Descargadas Offline`, `Solo Lomas Naturales`) y boton para abrir el Modal **Lomosoma PRO / Pasaporte**.
   * En `RouteResultsPanel.tsx`: Mostrar el `checklist_equipamiento` inteligente y resumen de costos grupales.
