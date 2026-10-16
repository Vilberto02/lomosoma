import os
import json
import streamlit as st

# Módulos del sistema inteligente (POO y DTOs)
from modules.dtos import UserPreferencesDTO, CoordenadasDTO
from modules.pipeline import LomasPipelineOrchestrator
from modules.llm_module import LomasLLMService
from modules.access_module import obtener_guia_acceso


# Verificación de librerías de mapas
try:
    import folium
    from branca.element import MacroElement
    from jinja2 import Template
    from streamlit_folium import st_folium
    MAPAS_DISPONIBLES = True
except ImportError:
    MAPAS_DISPONIBLES = False


# Plugin Leaflet para emitir evento de fin de arrastre hacia streamlit-folium
if MAPAS_DISPONIBLES:
    class DraggableMarkerPlugin(MacroElement):
        def __init__(self, marker):
            super().__init__()
            self._name = "DraggableMarkerPlugin"
            self.marker = marker
            self._template = Template("""
                {% macro script(this, kwargs) %}
                    {{ this.marker.get_name() }}.on('dragend', function(e) {
                        var latlng = e.target.getLatLng();
                        map_div.fire('draw:edited', {
                            layer: {
                                toGeoJSON: function() {
                                    return {
                                        type: 'Feature',
                                        geometry: {
                                            type: 'Point',
                                            coordinates: [latlng.lng, latlng.lat]
                                        },
                                        properties: {}
                                    };
                                }
                            }
                        });
                    });
                {% endmacro %}
            """)


# Configuración inicial de Streamlit
st.set_page_config(
    page_title="Rutas de Trekking - Lomas de Lima",
    layout="wide",
    initial_sidebar_state="expanded"
)


PRESETS_ZONAS = {
    "Centro de Lima (Plaza Mayor / Centro Histórico)": (-12.0464, -77.0428),
    "Miraflores / Barranco (Zona Turística Costa)": (-12.1215, -77.0298),
    "San Isidro / Lince (Zona Financiera y Hotelera)": (-12.0967, -77.0345),
    "Aeropuerto Internacional Jorge Chávez / Callao": (-12.0219, -77.1143),
    "Lima Norte: Los Olivos / MegaPlaza / Comas": (-11.9722, -77.0708),
    "Lima Norte: Carabayllo / Trapiche (Acceso Lomas Norte)": (-11.8580, -77.0340),
    "Lima Este: San Juan de Lurigancho (Estación Bayóvar)": (-11.9750, -76.9980),
    "Lima Este: Ate / La Molina / Santa Anita": (-12.0560, -76.9380),
    "Lima Sur: Santiago de Surco / SJM": (-12.1485, -76.9744),
    "Lima Sur: Villa María del Triunfo (VMT)": (-12.1620, -76.9400),
    "Lima Sur: Lurín / Pachacámac (Acceso Lomas Sur)": (-12.2750, -76.8700),
    "Chosica / Chaclacayo (Entrada Carretera Central)": (-11.9390, -76.7020)
}


@st.cache_data
def cargar_destinos():
    ruta_json = os.path.join(os.path.dirname(__file__), "data", "destinos.json")
    with open(ruta_json, "r", encoding="utf-8") as f:
        return json.load(f)


def crear_mapa_lomas(destinos, ruta_ids=None, nodo_base=None):
    """Genera el mapa interactivo en Folium con los marcadores de lomas y el nodo base arrastrable."""
    centro_lima = [-12.0464, -77.0428]
    lat_mapa = nodo_base["lat"] if nodo_base else centro_lima[0]
    lon_mapa = nodo_base["lon"] if nodo_base else centro_lima[1]
    
    mapa = folium.Map(location=[lat_mapa, lon_mapa], zoom_start=10, tiles="OpenStreetMap")

    # Marcador de Alojamiento / Nodo Base (d0) Arrastrable con puente de eventos
    if nodo_base:
        base_marker = folium.Marker(
            location=[nodo_base["lat"], nodo_base["lon"]],
            popup=folium.Popup("<div style='font-family: sans-serif;'><b>Tu Alojamiento (Nodo Base $d_0$)</b><br/>¡Arrastra este pin para mover tu punto de hospedaje!</div>", max_width=220),
            tooltip="Tu Alojamiento (Arrastra para mover)",
            icon=folium.Icon(color="red", icon="home", prefix="fa"),
            draggable=True
        )
        base_marker.add_to(mapa)
        mapa.add_child(DraggableMarkerPlugin(base_marker))

    orden_map = {}
    if ruta_ids:
        orden_map = {did: idx + 1 for idx, did in enumerate(ruta_ids)}

    for d in destinos:
        did = d['id']
        coords = [d['coordenadas']['lat'], d['coordenadas']['lon']]

        if did in orden_map:
            # Marcador de ruta con badge de orden
            orden = orden_map[did]
            icono = folium.Icon(color="green", icon="flag", prefix="fa")
            popup_html = f"""
            <div style="font-family: sans-serif; min-width: 180px;">
                <h4 style="margin: 0; color: #1e7e34;">#{orden} {d['nombre']}</h4>
                <p style="margin: 4px 0;"><b>Distrito:</b> {d['distrito']}</p>
                <p style="margin: 4px 0;"><b>Dificultad:</b> {d['dificultad']}</p>
                <p style="margin: 4px 0;"><b>Costo Est.:</b> S/ {d['costo_estimado']}</p>
                <p style="margin: 4px 0; font-size: 12px;">{d.get('transporte_principal', '')}</p>
            </div>
            """
        else:
            # Marcador general inactivo
            icono = folium.Icon(color="gray", icon="mountain", prefix="fa")
            popup_html = f"""
            <div style="font-family: sans-serif; min-width: 160px;">
                <h4 style="margin: 0;">{d['nombre']}</h4>
                <p style="margin: 4px 0;"><b>Distrito:</b> {d['distrito']}</p>
                <p style="margin: 4px 0;"><b>Dificultad:</b> {d['dificultad']}</p>
            </div>
            """

        folium.Marker(
            location=coords,
            popup=folium.Popup(popup_html, max_width=250),
            tooltip=f"{d['id']}: {d['nombre']}",
            icon=icono
        ).add_to(mapa)

    return mapa


def aplicar_preset_zona():
    sel = st.session_state.get("selector_zona_alojamiento")
    if sel in PRESETS_ZONAS:
        plat, plon = PRESETS_ZONAS[sel]
        st.session_state.nodo_base = {"lat": plat, "lon": plon}


def main():
    destinos = cargar_destinos()
    destinos_dict = {d['id']: d for d in destinos}

    # Inicializar estado de sesión para persistencia entre renders
    if 'resultado_optimizacion' not in st.session_state:
        st.session_state.resultado_optimizacion = None
    if 'perfil_usuario' not in st.session_state:
        st.session_state.perfil_usuario = None
    if 'nodo_base' not in st.session_state:
        st.session_state.nodo_base = {"lat": -12.0464, "lon": -77.0428}  # Centro de Lima por defecto

    # Título Principal
    st.title("Sistema Inteligente de Rutas de Trekking en las Lomas de Lima")

    # Barra lateral unificada (Diseño Híbrido UX)
    with st.sidebar:
        st.header("Perfil del Turista")

        st.subheader("1. Parámetros de ruta (AG)")
        dias_input = st.slider("Días disponibles para viajar:", min_value=1, max_value=15, value=3, help="Determina cuántas lomas (K) se seleccionarán (máximo 6 destinos activos para evitar saturación de traslados interurbanos).")
        presupuesto_input = st.slider("Presupuesto máximo total (S/):", min_value=15, max_value=300, value=60, step=5, help="Límite monetario para la penalización del AG.")
        condicion_input = st.selectbox("Condición física del viajero:", ["Fácil", "Moderado", "Difícil"], index=1)

        st.subheader("2. Preferencias cualitativas y clima (NLP/IA)")
        st.caption("El motor NLP calibrará las reglas difusas y el AG a partir de tus palabras clave:")
        with st.expander("Ver características reconocibles", expanded=False):
            st.markdown("""
            - ☀️ **Clima/Ambiente:** *soleado, despejado, garúa, neblina, verde.*
            - 🏛️ **Intereses:** *arqueología, ruinas, miradores, fotografía, paisajes.*
            - 🛡️ **Seguridad:** *muy seguro, vigilancia, zona tranquila.*
            - 🌿 **Afluencia:** *tranquilo, sin gente, poco concurrido, aislado.*
            """)

        texto_usuario = st.text_area(
            "Describe tu experiencia ideal (Opcional):",
            placeholder="Ejemplo: 'Quiero un trekking en un día soleado, con ruinas arqueológicas y miradores, en senderos muy seguros y poco concurridos.'",
            height=100,
            help="Si se deja vacío, el sistema asumirá condiciones estándar favorables (soleado, senderismo general en naturaleza y tolerancia estándar)."
        )

        st.markdown("---")
        st.subheader("3. Configuración de IA Generativa (Gemini)")
        api_key_env = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
        with st.expander("Opciones de Gemini AI", expanded=not bool(api_key_env)):
            gemini_key_input = st.text_input(
                "Gemini API Key:",
                value=api_key_env,
                type="password",
                placeholder="AIzaSy...",
                help="Ingresa tu clave de Google Gemini o configúrala en el archivo .env como GEMINI_API_KEY."
            )
            gemini_model_input = st.selectbox(
                "Modelo Gemini:",
                ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-flash"],
                index=0,
                help="Selecciona el modelo de lenguaje de Google para extracción semántica e itinerario narrativo."
            )

        active_api_key = gemini_key_input.strip() if gemini_key_input.strip() else None
        llm_service_preview = LomasLLMService(api_key=active_api_key, model=gemini_model_input)
        if llm_service_preview.is_gemini_active():
            st.success(f"🟢 **Gemini Activo** (`{gemini_model_input}`)")
        else:
            st.info("**Fallback Heurístico Local** (Sin API Key / Modo offline)")

        st.markdown("---")
        st.subheader("4. Punto de Partida (Alojamiento $d_0$)")
        st.caption("Arrastra el pin rojo en el mapa para ubicar tu hospedaje, o elige una zona rápida:")

        st.selectbox(
            "Zona de referencia rápida:",
            ["(Mantener ubicación del mapa)", *PRESETS_ZONAS.keys()],
            key="selector_zona_alojamiento",
            on_change=aplicar_preset_zona
        )

        st.caption(f"**Coordenadas activas:** `({st.session_state.nodo_base['lat']:.4f}, {st.session_state.nodo_base['lon']:.4f})`")

        btn_optimizar = st.button("Generar ruta óptima", type="primary", use_container_width=True)

        if btn_optimizar:
            with st.spinner("Procesando: LLM -> Mapeo -> Lógica Difusa -> Algoritmo Genético..."):
                # 1. Construir DTO fuertemente tipado
                user_dto = UserPreferencesDTO(
                    dias_disponibles=dias_input,
                    presupuesto_max=float(presupuesto_input),
                    condicion_fisica=condicion_input,
                    nodo_base=CoordenadasDTO(
                        lat=st.session_state.nodo_base["lat"],
                        lon=st.session_state.nodo_base["lon"]
                    ),
                    texto_usuario=texto_usuario.strip() if texto_usuario.strip() else None
                )

                # 2. Instanciar servicio LLM e Inyectar en el Orquestador Centralizado
                llm_service = LomasLLMService(api_key=active_api_key, model=gemini_model_input)
                orquestador = LomasPipelineOrchestrator(destinos, llm_service=llm_service)
                resultado_dto = orquestador.run(user_dto)


                # 3. Guardar en sesión de Streamlit
                st.session_state.resultado_optimizacion = {
                    'ag': {
                        'ruta_ids': resultado_dto.ruta_ids,
                        'destinos_ordenados': resultado_dto.destinos_ordenados,
                        'costo_total': resultado_dto.costo_total,
                        'distancia_total_km': resultado_dto.distancia_total_km,
                        'riesgos_ruta': resultado_dto.riesgos_ruta,
                        'nivel_exigencia': resultado_dto.nivel_exigencia,
                        'tramos': resultado_dto.tramos,
                        'genes_reales': resultado_dto.genes_reales,
                        'metodo': resultado_dto.metodo,
                        'fitness': resultado_dto.fitness,
                        'grafica_ascii': resultado_dto.grafica_ascii
                    },
                    'beneficios_base': {d['id']: 7.0 for d in destinos},
                    'itinerario': resultado_dto.itinerario_narrativo,
                    'k': resultado_dto.k,
                    'guias_acceso': resultado_dto.guias_acceso
                }
                st.session_state.perfil_usuario = user_dto.to_dict()
                st.success("¡Ruta óptima calculada exitosamente!")

    # ÁREA PRINCIPAL: Layout Jerárquico Reorganizado
    st.subheader("Mapa de las Lomas de Lima")
    st.caption("**Alojamiento (Pin Rojo):** Arrastra el marcador rojo en el mapa para ubicar tu hospedaje/nodo base ($d_0$).")

    resultado = st.session_state.resultado_optimizacion
    ruta_ids = resultado['ag']['ruta_ids'] if resultado else None

    if MAPAS_DISPONIBLES:
        mapa = crear_mapa_lomas(destinos, ruta_ids, st.session_state.nodo_base)
        mapa_output = st_folium(
            mapa,
            width="100%",
            height=480,
            key="mapa_folium_lomas",
            returned_objects=["last_active_drawing"]
        )

        # Capturar exclusivamente el evento de fin de arrastre (dragend)
        if mapa_output and mapa_output.get("last_active_drawing"):
            drawing = mapa_output["last_active_drawing"]
            geometry = drawing.get("geometry", {})
            coords = geometry.get("coordinates")
            if coords and len(coords) == 2:
                nueva_lon = round(float(coords[0]), 4)
                nueva_lat = round(float(coords[1]), 4)
                if -13.0 <= nueva_lat <= -11.0 and -78.0 <= nueva_lon <= -76.0:
                    if nueva_lat != round(st.session_state.nodo_base["lat"], 4) or nueva_lon != round(st.session_state.nodo_base["lon"], 4):
                        st.session_state.nodo_base = {"lat": nueva_lat, "lon": nueva_lon}
                        st.toast(f"Alojamiento movido a ({nueva_lat}, {nueva_lon})")
                        st.rerun()
    else:
        st.info("Para visualizar el mapa interactivo en Folium, instala `pip install folium streamlit-folium`.")

    st.markdown("---")

    # SECCIÓN DE RESULTADOS DETALLADOS
    if resultado:
        ag = resultado['ag']
        col_tit, col_reset = st.columns([4, 1])
        with col_tit:
            st.subheader("Resumen de la ruta óptima")
        with col_reset:
            if st.button("Nueva búsqueda", help="Limpia la ruta actual y restablece el punto de partida al Centro de Lima."):
                st.session_state.resultado_optimizacion = None
                st.session_state.perfil_usuario = None
                st.session_state.nodo_base = {"lat": -12.0464, "lon": -77.0428}  # Centro de Lima
                st.rerun()

        # 1. Tarjetas de Métricas Principales (5 Columnas)
        pres_usuario = st.session_state.perfil_usuario.get("presupuesto_max", 0.0) if st.session_state.perfil_usuario else 0.0
        if pres_usuario > 0 and ag['costo_total'] > pres_usuario:
            st.warning(f"⚠️ **Aviso de Presupuesto:** El costo estimado (S/ {ag['costo_total']:.2f}) supera el presupuesto asignado (S/ {pres_usuario:.2f}). Se seleccionaron las lomas más económicas del catálogo para minimizar la penalización.")

        m1, m2, m3, m4, m5 = st.columns(5)
        m1.metric("Destinos (K)", f"{resultado['k']}")
        m2.metric("Costo total", f"S/ {ag['costo_total']:.2f}")
        m3.metric("Distancia radial", f"{ag['distancia_total_km']:.1f} km")
        riesgos_ruta = ag.get('riesgos_ruta', {})
        riesgo_promedio = sum(riesgos_ruta.get(did, 5.0) for did in ag['ruta_ids']) / max(1, len(ag['ruta_ids']))
        m4.metric("Riesgo prom.", f"{riesgo_promedio:.2f} / 10")
        nivel_exig = ag.get('nivel_exigencia', 0.0)
        m5.metric("Nivel exigencia", f"{nivel_exig:.2f} / 1.0")

        # 2. Secuencia de Visita con Badges Visuales
        st.write("**Secuencia recomendada de excursiones:**")
        cols_badges = st.columns(min(6, len(ag['ruta_ids'])))
        for idx, did in enumerate(ag['ruta_ids']):
            with cols_badges[idx % len(cols_badges)]:
                st.success(f"**Día {idx+1}**\n\n{destinos_dict[did]['nombre']}")

        nb = st.session_state.nodo_base
        st.caption(f"**Alojamiento (Nodo Base $d_0$):** Latitud {nb['lat']}, Longitud {nb['lon']}")

        st.markdown("<br/>", unsafe_allow_html=True)

        # 3. Pestañas de Detalles e Investigación Académica
        tabs = st.tabs(["Itinerario", "Guía de accesos", "Desplazamiento radial", "Riesgo y Exigencia Difusa", "Métricas del AG"])

        with tabs[0]:
            st.markdown(resultado['itinerario'])

        with tabs[1]:
            st.write("### Instrucciones de Transporte Público")
            for did in ag['ruta_ids']:
                guia = obtener_guia_acceso(did)
                with st.expander(f"{guia['nombre']} (~{guia['tiempo_total_min']} min, S/{guia['costo_total_soles']})"):
                    st.write(f"**Punto de inicio:** {guia['punto_partida_recomendado']}")
                    st.write(f"**Transporte:** {guia['medio_transporte']}")
                    for paso in guia['pasos']:
                        st.write(f"• {paso}")

        with tabs[2]:
            st.write("### Desglose de Desplazamientos Radiales (Ida / Vuelta Diaria)")
            if ag.get("tramos"):
                tramos_df = [
                    {"Origen": t["de"], "Destino": t["hacia"], "Distancia (km)": f"{t['distancia_km']} km"}
                    for t in ag["tramos"]
                ]
                st.dataframe(tramos_df, use_container_width=True)
            else:
                st.write("Excursión radial desde el nodo base hacia cada loma activa.")

        with tabs[3]:
            st.write("### Componente 2: Nivel de Riesgo Difuso por Loma [0-10]")
            st.caption("Evaluado mediante inferencia Mamdani (Saturación, Seguridad, Accesibilidad). Menor riesgo = mejor.")
            riesgos_df = [
                {
                    "ID": did,
                    "Loma": destinos_dict[did]["nombre"],
                    "Distrito": destinos_dict[did]["distrito"],
                    "Riesgo Difuso": round(riesgos_ruta.get(did, 5.0), 2),
                    "Nivel": "Bajo" if riesgos_ruta.get(did, 5.0) <= 3.5 else ("Medio" if riesgos_ruta.get(did, 5.0) <= 6.5 else "Alto")
                }
                for did in ag['ruta_ids']
            ]
            st.dataframe(riesgos_df, use_container_width=True)

            st.write("### Componente 1: Nivel de Exigencia de Exploración (Cadena Genética)")
            st.caption("Variables reales optimizadas evolutivamente dentro del cromosoma híbrido de 18 genes.")
            genes = ag.get("genes_reales", {})
            c_g1, c_g2, c_g3, c_g4 = st.columns(4)
            c_g1.metric("Horas Recorrido", f"{genes.get('horas_recorrido', 0):.1f} h")
            c_g2.metric("Cobertura Zona", f"{genes.get('cobertura_zona', 0)*100:.0f}%")
            c_g3.metric("Extensión Circuito", f"{genes.get('extension_circuito', 0):.1f} km")
            c_g4.metric("Nivel Exigencia", f"{ag.get('nivel_exigencia', 0):.4f}")

        with tabs[4]:
            st.write("### Diagnóstico Heurístico y Convergencia Evolutiva")
            st.write(f"**Método de Resolución:** `{ag.get('metodo', 'algoritmo_genetico')}`")
            st.write(f"**Fitness Máximo Alcanzado:** `{ag.get('fitness', 0):.3f}`")
            if "grafica_ascii" in ag:
                st.code(ag["grafica_ascii"], language="text")

    else:
        st.info("Configura tus preferencias en la barra lateral y presiona **Generar ruta óptima** para calcular tu itinerario.")
        st.write("### Catálogo de las 15 Lomas de Lima:")
        destinos_tabla = [
            {"ID": d['id'], "Nombre": d['nombre'], "Distrito": d['distrito'], "Dificultad": d['dificultad'], "Costo": f"S/{d['costo_estimado']}"}
            for d in destinos
        ]
        st.dataframe(destinos_tabla, height=350, use_container_width=True)


if __name__ == "__main__":
    main()
