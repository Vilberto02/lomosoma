import React, { useEffect, useRef, useCallback, memo } from "react";
import L from "leaflet";
import type { Loma, Coordenadas, OptimizationResult } from "../../types";
import { Locate, RotateCcw, ZoomIn, ZoomOut, Layers } from "lucide-react";
import { MapMarkers } from "./MapMarkers";
import { UserMarker } from "./UserMarker";

interface GoogleStyleMapProps {
  lomas: Loma[];
  selectedLoma: Loma | null;
  onSelectLoma: (loma: Loma) => void;
  userCoords: Coordenadas;
  onUserCoordsChange: (coords: Coordenadas) => void;
  optimizationResult: OptimizationResult | null;
  mapCenterTarget: Coordenadas | null;
}

const GoogleStyleMapComponent: React.FC<GoogleStyleMapProps> = ({
  lomas,
  selectedLoma,
  onSelectLoma,
  userCoords,
  onUserCoordsChange,
  optimizationResult,
  mapCenterTarget,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [activeTileType, setActiveTileType] = React.useState<"street" | "satellite" | "topo">("street");

  const changeTileLayer = useCallback((type: "street" | "satellite" | "topo") => {
    if (!mapInstanceRef.current) return;
    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }

    let url = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    let attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    if (type === "satellite") {
      url = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
      attribution = "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community";
    } else if (type === "topo") {
      url = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}";
      attribution = "Tiles &copy; Esri &mdash; Source: Esri, USGS, FAO, NPS, NRCAN, GeoBase";
    }

    const newLayer = L.tileLayer(url, { attribution, maxZoom: 19 });
    newLayer.addTo(mapInstanceRef.current);
    tileLayerRef.current = newLayer;
    setActiveTileType(type);
  }, []);

  // Inicialización del Mapa Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [userCoords.lat, userCoords.lon],
      zoom: 11,
      zoomControl: false,
    });

    const baseTiles = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }
    );
    baseTiles.addTo(map);
    tileLayerRef.current = baseTiles;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
    };
  }, []);

  // Mover mapa cuando mapCenterTarget cambie (FlyTo suave)
  useEffect(() => {
    if (!mapInstanceRef.current || !mapCenterTarget) return;
    mapInstanceRef.current.flyTo([mapCenterTarget.lat, mapCenterTarget.lon], 13, {
      duration: 1.2,
      easeLinearity: 0.25,
    });
  }, [mapCenterTarget]);

  // Manejador de geolocalización actual del usuario
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
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([newCoords.lat, newCoords.lon], 14, {
            duration: 1.2,
          });
        }
      },
      (error) => {
        alert("No se pudo obtener tu ubicación actual: " + error.message);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, [onUserCoordsChange]);

  const handleResetView = useCallback(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([-12.0464, -77.0428], 11);
    }
  }, []);

  const handleZoomIn = useCallback(() => {
    mapInstanceRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    mapInstanceRef.current?.zoomOut();
  }, []);

  return (
    <div className="relative w-full h-full">
      {/* Contenedor DOM de Leaflet */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Marcadores de Lomas y Rutas (memoized) */}
      <MapMarkers
        map={mapInstanceRef.current}
        lomas={lomas}
        selectedLoma={selectedLoma}
        optimizationResult={optimizationResult}
        userCoords={userCoords}
        onSelectLoma={onSelectLoma}
      />

      {/* Marcador de Usuario (memoized) */}
      <UserMarker
        map={mapInstanceRef.current}
        userCoords={userCoords}
        onUserCoordsChange={onUserCoordsChange}
        draggable={!optimizationResult}
      />

      {/* Controles Flotantes del Mapa (Bottom Right) */}
      <div className="absolute bottom-6 right-6 z-20 flex gap-2 items-end">
        {/* Selector de Capas */}
        <div className="relative group">
          <button
            title="Cambiar tipo de mapa"
            className="w-10 h-10 bg-background hover:bg-secondary text-foreground rounded-xl shadow-control flex items-center justify-center border border-border transition-all active:scale-95"
          >
            <Layers className="w-4 h-4 text-foreground/80" />
          </button>
          <div className="absolute right-12 bottom-0 hidden group-hover:flex bg-popover rounded-xl shadow-panel border border-border p-1.5 flex-col gap-1 min-w-[130px] animate-in fade-in-50 duration-150">
            <button
              onClick={() => changeTileLayer("street")}
              className={`text-xs px-2.5 py-1.5 rounded-lg text-left font-medium transition-colors ${
                activeTileType === "street"
                  ? "bg-primary/10 text-primary font-semibold"
                  : "hover:bg-secondary text-foreground"
              }`}
            >
              Calles (OSM)
            </button>
            <button
              onClick={() => changeTileLayer("satellite")}
              className={`text-xs px-2.5 py-1.5 rounded-lg text-left font-medium transition-colors ${
                activeTileType === "satellite"
                  ? "bg-primary/10 text-primary font-semibold"
                  : "hover:bg-secondary text-foreground"
              }`}
            >
              Satelital
            </button>
            <button
              onClick={() => changeTileLayer("topo")}
              className={`text-xs px-2.5 py-1.5 rounded-lg text-left font-medium transition-colors ${
                activeTileType === "topo"
                  ? "bg-primary/10 text-primary font-semibold"
                  : "hover:bg-secondary text-foreground"
              }`}
            >
              Relieve
            </button>
          </div>
        </div>

        {/* Botón Mi Ubicación */}
        <button
          onClick={handleLocateMe}
          title="Usar mi ubicación GPS actual"
          className="w-10 h-10 bg-background hover:bg-secondary text-primary rounded-xl shadow-control flex items-center justify-center border border-border transition-all active:scale-95"
        >
          <Locate className="w-4 h-4" />
        </button>

        {/* Botón Centrar en Lima */}
        <button
          onClick={handleResetView}
          title="Centrar vista en Lima Metropolitana"
          className="w-10 h-10 bg-background hover:bg-secondary text-foreground rounded-xl shadow-control flex items-center justify-center border border-border transition-all active:scale-95"
        >
          <RotateCcw className="w-4 h-4 text-muted-foreground hover:text-foreground" />
        </button>

        {/* Controles de Zoom */}
        <div className="bg-background rounded-xl shadow-control border border-border flex overflow-hidden">
          <button
            onClick={handleZoomOut}
            title="Alejar mapa"
            className="w-10 h-10 hover:bg-secondary text-foreground flex items-center justify-center transition-colors active:scale-95"
          >
            <ZoomOut className="w-4 h-4 text-foreground/80" />
          </button>
          <button
            onClick={handleZoomIn}
            title="Acercar mapa"
            className="w-10 h-10 hover:bg-secondary text-foreground flex items-center justify-center border-b border-border transition-colors active:scale-95"
          >
            <ZoomIn className="w-4 h-4 text-foreground/80" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const GoogleStyleMap = memo(GoogleStyleMapComponent);