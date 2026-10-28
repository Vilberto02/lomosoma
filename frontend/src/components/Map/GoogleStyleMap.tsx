import React, { useEffect, useRef, useCallback, useState, memo } from "react";
import mapboxgl from "mapbox-gl";
import type { Loma, Coordenadas, OptimizationResult } from "../../types";
import {
  Locate,
  Plus,
  Minus,
  Layers,
  CloudSun,
  Car,
  ArrowUpRight,
  KeyRound,
  X,
} from "lucide-react";
import { MapMarkers } from "./MapMarkers";
import { UserMarker } from "./UserMarker";
import { FogGuardianWidget } from "./FogGuardianWidget";
import { RouteItineraryOverlay } from "./RouteItineraryOverlay";

interface GoogleStyleMapProps {
  lomas: Loma[];
  selectedLoma: Loma | null;
  onSelectLoma: (loma: Loma) => void;
  onOpenLomaDetail?: (loma: Loma) => void;
  onClearSelectedLoma?: () => void;
  userCoords: Coordenadas;
  onUserCoordsChange: (coords: Coordenadas) => void;
  optimizationResult: OptimizationResult | null;
  mapCenterTarget: Coordenadas | null;
  mapCenterSeq?: number;
  /** Muestra el itinerario por días flotando sobre el mapa (vista de resultados). */
  showRouteOverlay?: boolean;
  /** Oculta la tarjeta flotante inferior cuando la ficha detallada o el planificador ya están abiertos. */
  hidePreviewCard?: boolean;
  isGuardianVisible?: boolean;
  onGuardianVisibleChange?: (visible: boolean) => void;
}

const MAPBOX_STYLES: Record<"street" | "satellite" | "topo", string> = {
  street: "mapbox://styles/mapbox/light-v11",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  topo: "mapbox://styles/mapbox/outdoors-v12",
};

const ENV_MAPBOX_TOKEN = (
  import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ||
  import.meta.env.VITE_MAPBOX_TOKEN ||
  ""
).trim();

// Proyección simple del área metropolitana de Lima para el lienzo vectorial de respaldo cuando aún no se ha configurado un token pk.* de Mapbox
function projectLimaToPercent(lat: number, lon: number): { x: number; y: number } {
  const minLon = -77.22;
  const maxLon = -76.78;
  const minLat = -12.32;
  const maxLat = -11.78;
  const x = ((lon - minLon) / (maxLon - minLon)) * 100;
  const y = ((maxLat - lat) / (maxLat - minLat)) * 100;
  return {
    x: Math.max(8, Math.min(94, x)),
    y: Math.max(8, Math.min(92, y)),
  };
}

const GoogleStyleMapComponent: React.FC<GoogleStyleMapProps> = ({
  lomas,
  selectedLoma,
  onSelectLoma,
  onOpenLomaDetail,
  onClearSelectedLoma,
  userCoords,
  onUserCoordsChange,
  optimizationResult,
  mapCenterTarget,
  mapCenterSeq = 0,
  showRouteOverlay = false,
  hidePreviewCard = false,
  isGuardianVisible,
  onGuardianVisibleChange,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const [activeTileType, setActiveTileType] = useState<"street" | "satellite" | "topo">("street");
  const [internalGuardianVisible, setInternalGuardianVisible] = useState<boolean>(false);
  const effectiveGuardianVisible = isGuardianVisible ?? internalGuardianVisible;
  const setGuardianVisible = useCallback(
    (visible: boolean) => {
      setInternalGuardianVisible(visible);
      onGuardianVisibleChange?.(visible);
    },
    [onGuardianVisibleChange]
  );
  const [showLayerMenu, setShowLayerMenu] = useState<boolean>(false);
  const showRouteOverlayRef = useRef<boolean>(showRouteOverlay);
  useEffect(() => {
    showRouteOverlayRef.current = showRouteOverlay;
  }, [showRouteOverlay]);

  const [storedToken, setStoredToken] = useState<string>(() => {
    if (ENV_MAPBOX_TOKEN) return ENV_MAPBOX_TOKEN;
    try {
      return localStorage.getItem("lomosoma_mapbox_token") || "";
    } catch {
      return "";
    }
  });
  const [tokenInput, setTokenInput] = useState<string>("");
  const [showTokenPrompt, setShowTokenPrompt] = useState<boolean>(false);
  const [mapboxAuthError, setMapboxAuthError] = useState<boolean>(false);

  const activeToken = ENV_MAPBOX_TOKEN || storedToken;
  const hasValidTokenFormat = activeToken.startsWith("pk.");

  const changeTileLayer = useCallback(
    (type: "street" | "satellite" | "topo") => {
      setActiveTileType(type);
      setShowLayerMenu(false);
      if (mapInstance) {
        mapInstance.setStyle(MAPBOX_STYLES[type]);
      }
    },
    [mapInstance]
  );

  // Inicializar Mapbox GL JS cuando hay un token pk.* disponible
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || !hasValidTokenFormat) {
      setMapInstance(null);
      return;
    }

    setMapboxAuthError(false);
    mapboxgl.accessToken = activeToken;

    let map: mapboxgl.Map | null = null;
    let resizeObserver: ResizeObserver | null = null;
    try {
      map = new mapboxgl.Map({
        container,
        style: MAPBOX_STYLES[activeTileType],
        center: [userCoords.lon, userCoords.lat],
        zoom: 11,
        attributionControl: true,
        preserveDrawingBuffer: true,
      });

      map.on("load", () => {
        map?.resize();
      });

      map.on("error", (e) => {
        const status = (e as { error?: { status?: number; message?: string } })?.error?.status;
        const msg = (e as { error?: { message?: string } })?.error?.message || "";
        if (status === 401 || msg.toLowerCase().includes("access token")) {
          setMapboxAuthError(true);
        }
      });

      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => {
          map?.resize();
        });
        resizeObserver.observe(container);
      }

      setMapInstance(map);
    } catch {
      setMapboxAuthError(true);
      setMapInstance(null);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (map) {
        map.remove();
      }
      setMapInstance(null);
    };
  }, [activeToken, hasValidTokenFormat]);

  // Navegación suave hacia la coordenada objetivo
  useEffect(() => {
    if (!mapInstance || !mapCenterTarget) return;
    // Reserva el espacio ocupado por el panel lateral (448 px + 16 px) y, en resultados, por el
    // itinerario flotante (388 px + 16 px), para que la parada enfocada quede a la vista.
    const viewportWidth = window.innerWidth;
    const leftInset =
      viewportWidth >= 1024 && showRouteOverlayRef.current ? 884 : viewportWidth >= 768 ? 480 : 0;
    mapInstance.flyTo({
      center: [mapCenterTarget.lon, mapCenterTarget.lat],
      padding: { top: 0, bottom: 0, right: 0, left: leftInset },
      zoom: 13,
      duration: 1200,
      essential: true,
    });
  }, [mapInstance, mapCenterTarget, mapCenterSeq]);

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      alert("La geolocalización no está soportada por tu navegador.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newCoords: Coordenadas = {
          lat: Number(position.coords.latitude.toFixed(4)),
          lon: Number(position.coords.longitude.toFixed(4)),
        };
        onUserCoordsChange(newCoords);
        if (mapInstance) {
          mapInstance.flyTo({
            center: [newCoords.lon, newCoords.lat],
            zoom: 14,
            duration: 1200,
            essential: true,
          });
        }
      },
      (error) => {
        alert("No se pudo obtener tu ubicación actual: " + error.message);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, [mapInstance, onUserCoordsChange]);

  const handleResetNorth = useCallback(() => {
    if (mapInstance) {
      mapInstance.flyTo({
        center: [-77.0428, -12.0464],
        zoom: 11,
        bearing: 0,
        pitch: 0,
        duration: 1000,
        essential: true,
      });
    }
  }, [mapInstance]);

  const handleZoomIn = useCallback(() => {
    mapInstance?.zoomIn({ duration: 300 });
  }, [mapInstance]);

  const handleZoomOut = useCallback(() => {
    mapInstance?.zoomOut({ duration: 300 });
  }, [mapInstance]);

  const handleSaveToken = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = tokenInput.trim();
    if (!clean.startsWith("pk.")) {
      return;
    }
    try {
      localStorage.setItem("lomosoma_mapbox_token", clean);
    } catch {
      // ignore
    }
    setStoredToken(clean);
    setShowTokenPrompt(false);
    setTokenInput("");
  };

  const displayLoma = selectedLoma;
  const canUseMapbox = hasValidTokenFormat && !mapboxAuthError;
  const isMapboxActive = Boolean(mapInstance && canUseMapbox);

  const routeOrderMap = new Map<string, number>();
  if (optimizationResult?.ruta_ids) {
    optimizationResult.ruta_ids.forEach((id, idx) => {
      routeOrderMap.set(id, idx + 1);
    });
  }

  return (
    <div className="relative w-full h-full bg-[#E8EDE9] overflow-hidden">
      {/* Contenedor WebGL de Mapbox GL JS */}
      <div
        ref={mapContainerRef}
        className={`w-full h-full z-0 ${canUseMapbox ? "block" : "hidden"}`}
      />

      {/* Lienzo cartográfico vectorial de Lima (estilo Pencil) cuando aún no se ha definido VITE_MAPBOX_ACCESS_TOKEN */}
      {!canUseMapbox && (
        <div className="relative w-full h-full bg-[#E8EDE9] select-none overflow-hidden">
          <svg
            viewBox="0 0 1180 820"
            preserveAspectRatio="xMidYMid slice"
            className="w-full h-full"
          >
            {/* Océano Pacífico */}
            <path
              d="M 0,0 L 360,0 C 375,140 395,280 380,410 C 370,480 430,540 495,640 C 540,710 590,775 630,820 L 0,820 Z"
              fill="#DCE6E5"
            />
            {/* Contorno costero */}
            <path
              d="M 360,0 C 375,140 395,280 380,410 C 370,480 430,540 495,640 C 540,710 590,775 630,820"
              fill="none"
              stroke="#B8C9C7"
              strokeWidth="2.5"
            />
            {/* Zonas ecológicas de Lomas */}
            <ellipse cx="640" cy="145" rx="95" ry="55" fill="#DCE5D5" opacity="0.7" />
            <ellipse cx="770" cy="310" rx="110" ry="70" fill="#DCE5D5" opacity="0.7" />
            <ellipse cx="835" cy="585" rx="125" ry="85" fill="#DCE5D5" opacity="0.75" />
            <ellipse cx="920" cy="690" rx="95" ry="60" fill="#DCE5D5" opacity="0.7" />

            {/* Vías principales estilizadas */}
            <path
              d="M 480,0 Q 530,260 560,420 T 720,820"
              fill="none"
              stroke="#D5DDD2"
              strokeWidth="3"
            />
            <path
              d="M 390,410 Q 590,400 840,340 T 1180,240"
              fill="none"
              stroke="#D5DDD2"
              strokeWidth="2.5"
            />

            {/* Toponimia de Lima Metropolitana (según Pencil) */}
            <text x="610" y="120" fill="#8C9983" fontSize="11" fontWeight="800" letterSpacing="2">
              CARABAYLLO
            </text>
            <text x="520" y="220" fill="#8C9983" fontSize="10" fontWeight="800" letterSpacing="2">
              LOS OLIVOS
            </text>
            <text x="740" y="265" fill="#8C9983" fontSize="10" fontWeight="800" letterSpacing="2">
              SAN JUAN DE LURIGANCHO
            </text>
            <text x="535" y="395" fill="#76856D" fontSize="12" fontWeight="800" letterSpacing="2.5">
              LIMA
            </text>
            <text x="515" y="520" fill="#8C9983" fontSize="10" fontWeight="800" letterSpacing="2">
              MIRAFLORES
            </text>
            <text x="545" y="610" fill="#8C9983" fontSize="10" fontWeight="800" letterSpacing="2">
              CHORRILLOS
            </text>
            <text x="860" y="695" fill="#8C9983" fontSize="11" fontWeight="800" letterSpacing="2">
              PACHACÁMAC
            </text>
            <text
              x="185"
              y="520"
              fill="#7A9396"
              fontSize="11"
              fontWeight="700"
              letterSpacing="5"
              transform="rotate(-62 185 520)"
            >
              OCÉANO PACÍFICO
            </text>
          </svg>

          {/* Polilínea SVG cuando hay ruta o loma seleccionada en modo vectorial */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {optimizationResult?.destinos_ordenados &&
              optimizationResult.destinos_ordenados.length > 0 && (
                <polyline
                  fill="none"
                  stroke="#2E6540"
                  strokeWidth="3.5"
                  strokeDasharray="6,6"
                  points={[
                    userCoords,
                    ...optimizationResult.destinos_ordenados.map((d) => d.coordenadas),
                  ]
                    .map((c) => {
                      const p = projectLimaToPercent(c.lat, c.lon);
                      return `${(p.x * window.innerWidth) / 100},${
                        (p.y * window.innerHeight) / 100
                      }`;
                    })
                    .join(" ")}
                />
              )}
          </svg>

          {/* Marcador de punto de partida en el lienzo vectorial */}
          {(() => {
            const pos = projectLimaToPercent(userCoords.lat, userCoords.lon);
            return (
              <div
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
                title="Tu punto de partida"
              >
                <div className="relative flex items-center justify-center w-9 h-9">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-35 animate-ping" />
                  <div className="relative w-7 h-7 bg-red-600 rounded-full shadow-md border-2 border-white flex items-center justify-center text-white">
                    <span className="w-2 h-2 rounded-full bg-white" />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Marcadores interactivos tipo píldora en el lienzo vectorial */}
          {lomas.map((loma) => {
            const pos = projectLimaToPercent(loma.coordenadas.lat, loma.coordenadas.lon);
            const isSelected = selectedLoma?.id === loma.id;
            const routeOrder = routeOrderMap.get(loma.id);
            const isInRoute = routeOrder !== undefined;
            const shortName = loma.nombre
              .replace(/^Lomas de /, "")
              .replace(/^Lomas del /, "")
              .replace(/^Loma /, "");

            return (
              <button
                key={loma.id}
                type="button"
                onClick={() => onSelectLoma(loma)}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 transition-all ${
                  isSelected ? "z-[25] scale-105" : isInRoute ? "z-20" : "z-10"
                }`}
              >
                {isInRoute ? (
                  <div className="cursor-pointer flex items-center gap-2 px-3.5 py-1.5 bg-[#243C2D] text-white border-2 border-white shadow-md rounded-full whitespace-nowrap ring-2 ring-[#2E6540]/30">
                    <span className="w-5 h-5 rounded-full bg-[#D8E7C9] text-[#203B2E] text-xs font-black flex items-center justify-center">
                      {routeOrder}
                    </span>
                    <span className="text-[13px] font-bold tracking-tight">{shortName}</span>
                  </div>
                ) : isSelected ? (
                  <div className="cursor-pointer flex items-center gap-2 px-4 py-1.5 bg-[#2E6540] text-white border-[3px] border-white shadow-lg rounded-full whitespace-nowrap">
                    <MountainIcon className="w-4 h-4 text-white" />
                    <span className="text-[13px] font-bold tracking-tight">{shortName}</span>
                  </div>
                ) : (
                  <div className="cursor-pointer flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-[#203B2E] border border-[#E4E9DE] shadow-sm rounded-full whitespace-nowrap hover:border-[#CAD9BE] hover:bg-[#F3F5F0] transition-all">
                    <MountainIcon className="w-4 h-4 text-[#546349]" />
                    <span className="text-[13px] font-bold tracking-tight">{shortName}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Marcadores y capas nativas de Mapbox GL JS cuando el motor WebGL está activo */}
      {isMapboxActive && (
        <>
          <MapMarkers
            map={mapInstance}
            lomas={lomas}
            selectedLoma={selectedLoma}
            optimizationResult={optimizationResult}
            userCoords={userCoords}
            onSelectLoma={onSelectLoma}
          />

          <UserMarker
            map={mapInstance}
            userCoords={userCoords}
            onUserCoordsChange={onUserCoordsChange}
            draggable={!optimizationResult}
          />
        </>
      )}

      {/* Widget Fog Guardian (si está activo) */}
      {selectedLoma && effectiveGuardianVisible && (
        <FogGuardianWidget
          selectedLoma={selectedLoma}
          userCoords={userCoords}
          onUserCoordsChange={onUserCoordsChange}
          onClose={() => setGuardianVisible(false)}
        />
      )}

      {/* Botón discreto para configurar Token de Mapbox si no está en .env */}
      {!ENV_MAPBOX_TOKEN && (
        <div className="absolute top-4 left-[480px] z-20 hidden xl:flex items-center">
          {showTokenPrompt ? (
            <form
              onSubmit={handleSaveToken}
              className="flex items-center gap-2 h-11 px-3.5 bg-white border border-[#CAD9BE] rounded-xl shadow-lomo-control"
            >
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Pegar token pk.eyJ1..."
                className="text-sm px-2.5 py-1 bg-[#F3F5F0] border border-[#E4E9DE] rounded-lg text-[#203B2E] w-52 focus:outline-none focus:border-[#2E6540]"
              />
              <button
                type="submit"
                className="h-8 px-3 bg-[#243C2D] text-white text-sm font-bold rounded-lg"
              >
                Activar Mapbox
              </button>
              <button
                type="button"
                onClick={() => setShowTokenPrompt(false)}
                className="text-sm text-[#546349] px-1.5"
              >
                ✕
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowTokenPrompt(true)}
              className="h-11 px-4 bg-white/95 hover:bg-white border border-[#E4E9DE] rounded-xl shadow-lomo-control flex items-center gap-2 text-sm font-bold text-[#3E5238] transition-all"
              title="Configurar VITE_MAPBOX_ACCESS_TOKEN"
            >
              <KeyRound className="w-4 h-4 text-[#2E6540]" />
              <span>{isMapboxActive ? "Mapbox GL activo" : "Conectar Token Mapbox"}</span>
            </button>
          )}
        </div>
      )}

      {/* OVERLAY: Tiempo actual (L4bY47: Map / Weather en x996, y24) */}
      <div className="absolute top-4 right-4 z-20 hidden sm:flex items-center gap-2.5 h-11 px-4 bg-white border border-[#E4E9DE] rounded-xl shadow-lomo-control">
        <CloudSun className="w-5 h-5 text-[#546349] flex-shrink-0" />
        <div className="flex items-baseline gap-1.5">
          <span className="text-[18px] font-black text-[#203B2E]">18°</span>
          <span className="text-sm font-bold text-[#3E5238]">Garúa ligera</span>
        </div>
      </div>

      {/* OVERLAY: Brújula (Cs8ci en x1112, y92) */}
      <button
        onClick={handleResetNorth}
        className="absolute top-[72px] right-4 z-20 w-11 h-11 bg-white border border-[#E4E9DE] rounded-full shadow-lomo-control flex flex-col items-center justify-center hover:bg-[#F3F5F0] transition-all active:scale-95 group"
        title="Restablecer norte y centrar Lima"
      >
        <span className="text-sm font-black text-[#203B2E] group-hover:text-[#2E6540] leading-none">
          N
        </span>
        <div className="w-1.5 h-1.5 bg-[#2E6540] rounded-full mt-0.5" />
      </button>

      {/* OVERLAY: Controles del mapa (gvXj8: Map / Controls en x1112, y584) */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-2">
        <button
          onClick={handleLocateMe}
          title="Mi ubicación actual"
          className="w-11 h-11 bg-white hover:bg-[#F3F5F0] text-[#546349] hover:text-[#203B2E] rounded-xl shadow-lomo-control flex items-center justify-center border border-[#E4E9DE] transition-all active:scale-95"
        >
          <Locate className="w-5 h-5" />
        </button>

        <button
          onClick={handleZoomIn}
          title="Acercar mapa"
          className="w-11 h-11 bg-white hover:bg-[#F3F5F0] text-[#546349] hover:text-[#203B2E] rounded-xl shadow-lomo-control flex items-center justify-center border border-[#E4E9DE] transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" />
        </button>

        <button
          onClick={handleZoomOut}
          title="Alejar mapa"
          className="w-11 h-11 bg-white hover:bg-[#F3F5F0] text-[#546349] hover:text-[#203B2E] rounded-xl shadow-lomo-control flex items-center justify-center border border-[#E4E9DE] transition-all active:scale-95"
        >
          <Minus className="w-5 h-5" />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowLayerMenu((prev) => !prev)}
            title="Estilos de Mapbox"
            className="w-11 h-11 bg-white hover:bg-[#F3F5F0] text-[#546349] hover:text-[#203B2E] rounded-xl shadow-lomo-control flex items-center justify-center border border-[#E4E9DE] transition-all active:scale-95"
          >
            <Layers className="w-5 h-5" />
          </button>

          {showLayerMenu && (
            <div className="absolute right-[52px] bottom-0 bg-white border border-[#E4E9DE] rounded-xl shadow-lomo-panel p-1.5 flex flex-col gap-1 min-w-[180px] z-30">
              <button
                onClick={() => changeTileLayer("street")}
                className={`text-sm px-3 py-2 rounded-lg text-left font-semibold transition-colors ${
                  activeTileType === "street"
                    ? "bg-[#F0F5ED] text-[#2E6540] font-bold"
                    : "hover:bg-[#F3F5F0] text-[#3E5238]"
                }`}
              >
                Mapbox Light (Claro)
              </button>
              <button
                onClick={() => changeTileLayer("satellite")}
                className={`text-sm px-3 py-2 rounded-lg text-left font-semibold transition-colors ${
                  activeTileType === "satellite"
                    ? "bg-[#F0F5ED] text-[#2E6540] font-bold"
                    : "hover:bg-[#F3F5F0] text-[#3E5238]"
                }`}
              >
                Mapbox Satellite
              </button>
              <button
                onClick={() => changeTileLayer("topo")}
                className={`text-sm px-3 py-2 rounded-lg text-left font-semibold transition-colors ${
                  activeTileType === "topo"
                    ? "bg-[#F0F5ED] text-[#2E6540] font-bold"
                    : "hover:bg-[#F3F5F0] text-[#3E5238]"
                }`}
              >
                Mapbox Outdoors (Topo)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* OVERLAY: Resumen de acceso al destino (LdIKa: 336x128px en x432, y676) */}
      {showRouteOverlay && optimizationResult && (
        <RouteItineraryOverlay
          result={optimizationResult}
          lomas={lomas}
          selectedLoma={selectedLoma}
          onSelectLoma={onSelectLoma}
        />
      )}

      {/* La tarjeta de acceso se oculta en resultados, ficha detallada o cuando no hay loma seleccionada */}
      {displayLoma && !showRouteOverlay && !hidePreviewCard && !effectiveGuardianVisible && (
        <div className="absolute bottom-4 left-[480px] z-20 hidden lg:flex flex-col justify-between w-[372px] min-h-[140px] bg-white border border-[#E4E9DE] rounded-2xl shadow-lomo-panel p-5 animate-in fade-in slide-in-from-bottom duration-200">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-extrabold tracking-[0.05em] text-[#546349] uppercase">
                TU ESCAPADA EMPIEZA AQUÍ
              </span>
              <h4 className="text-[19px] font-black text-[#203B2E] tracking-tight truncate max-w-[248px]">
                {displayLoma.nombre}
              </h4>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() =>
                  onOpenLomaDetail ? onOpenLomaDetail(displayLoma) : onSelectLoma(displayLoma)
                }
                className="p-1.5 rounded-lg text-[#546349] hover:text-[#203B2E] hover:bg-[#F3F5F0] transition-colors"
                title="Abrir ficha detallada"
              >
                <ArrowUpRight className="w-4 h-4" />
              </button>
              {onClearSelectedLoma && (
                <button
                  type="button"
                  onClick={onClearSelectedLoma}
                  className="p-1.5 rounded-lg text-[#546349] hover:text-[#203B2E] hover:bg-[#F3F5F0] transition-colors"
                  title="Cerrar vista previa"
                  aria-label="Cerrar vista previa"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[#E4E9DE]/60">
            <div className="flex items-center gap-1.5 text-[15px] text-[#3E5238]">
              <Car className="w-4 h-4 text-[#546349]" />
              <span className="font-extrabold text-[#203B2E] tabular-nums">
                {displayLoma.distancia_centro_min ?? 42} min
              </span>
              <span className="text-[#546349] font-semibold text-sm">
                {displayLoma.id === "L0" ? "desde Miraflores" : "desde Lima centro"}
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                onOpenLomaDetail ? onOpenLomaDetail(displayLoma) : onSelectLoma(displayLoma)
              }
              className="h-10 px-4 bg-[#F0F5ED] hover:bg-[#E4E9DE] text-[#2E6540] text-sm font-bold rounded-lg border border-[#CAD9BE] transition-all active:scale-95"
            >
              Ver ficha
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

function MountainIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
    </svg>
  );
}

export const GoogleStyleMap = memo(GoogleStyleMapComponent);
