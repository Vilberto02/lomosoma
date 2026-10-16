import React, { useEffect, useRef, useCallback, useState, memo } from "react";
import L from "leaflet";
import type { Loma, Coordenadas, OptimizationResult } from "../../types";
import { Locate, RotateCcw, ZoomIn, ZoomOut, Layers, ShieldCheck } from "lucide-react";
import { MapMarkers } from "./MapMarkers";
import { UserMarker } from "./UserMarker";
import { FogGuardianWidget } from "./FogGuardianWidget";

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
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [activeTileType, setActiveTileType] = useState<"street" | "satellite" | "topo">("street");
  const [isGuardianVisible, setIsGuardianVisible] = useState<boolean>(true);

  const changeTileLayer = useCallback(
    (type: "street" | "satellite" | "topo") => {
      if (!mapInstance) return;
      if (tileLayerRef.current) {
        mapInstance.removeLayer(tileLayerRef.current);
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
      newLayer.addTo(mapInstance);
      tileLayerRef.current = newLayer;
      setActiveTileType(type);
    },
    [mapInstance]
  );

  useEffect(() => {
    if (!mapContainerRef.current || mapInstance) return;

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
    setMapInstance(map);

    return () => {
      map.remove();
      setMapInstance(null);
      tileLayerRef.current = null;
    };
  }, [userCoords.lat, userCoords.lon, mapInstance]);

  useEffect(() => {
    if (!mapInstance || !mapCenterTarget) return;
    mapInstance.flyTo([mapCenterTarget.lat, mapCenterTarget.lon], 13, {
      duration: 1.2,
      easeLinearity: 0.25,
    });
  }, [mapInstance, mapCenterTarget]);

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      alert("La geolocalizacion no esta soportada por tu navegador.");
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
          mapInstance.flyTo([newCoords.lat, newCoords.lon], 14, {
            duration: 1.2,
          });
        }
      },
      (error) => {
        alert("No se pudo obtener tu ubicacion actual: " + error.message);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, [mapInstance, onUserCoordsChange]);

  const handleResetView = useCallback(() => {
    if (mapInstance) {
      mapInstance.flyTo([-12.0464, -77.0428], 11);
    }
  }, [mapInstance]);

  const handleZoomIn = useCallback(() => {
    mapInstance?.zoomIn();
  }, [mapInstance]);

  const handleZoomOut = useCallback(() => {
    mapInstance?.zoomOut();
  }, [mapInstance]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

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

      {selectedLoma && isGuardianVisible && (
        <FogGuardianWidget
          selectedLoma={selectedLoma}
          userCoords={userCoords}
          onUserCoordsChange={onUserCoordsChange}
          onClose={() => setIsGuardianVisible(false)}
        />
      )}

      <div className="absolute bottom-6 right-6 z-20 flex gap-2 items-end">
        {selectedLoma && !isGuardianVisible && (
          <button
            onClick={() => setIsGuardianVisible(true)}
            title="Abrir Fog Guardian GPS"
            className="w-10 h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-control flex items-center justify-center transition-all active:scale-95"
          >
            <ShieldCheck className="w-5 h-5" />
          </button>
        )}

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

        <button
          onClick={handleLocateMe}
          title="Usar mi ubicacion GPS actual"
          className="w-10 h-10 bg-background hover:bg-secondary text-primary rounded-xl shadow-control flex items-center justify-center border border-border transition-all active:scale-95"
        >
          <Locate className="w-4 h-4" />
        </button>

        <button
          onClick={handleResetView}
          title="Centrar vista en Lima Metropolitana"
          className="w-10 h-10 bg-background hover:bg-secondary text-foreground rounded-xl shadow-control flex items-center justify-center border border-border transition-all active:scale-95"
        >
          <RotateCcw className="w-4 h-4 text-muted-foreground hover:text-foreground" />
        </button>

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