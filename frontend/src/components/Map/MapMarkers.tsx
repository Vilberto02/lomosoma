import { useEffect, useRef, memo } from "react";
import L from "leaflet";
import type { Loma, Coordenadas, OptimizationResult } from "../../types";

interface MapMarkersProps {
  map: L.Map | null;
  lomas: Loma[];
  selectedLoma: Loma | null;
  optimizationResult: OptimizationResult | null;
  userCoords: Coordenadas;
  onSelectLoma: (loma: Loma) => void;
}

export const MapMarkers = memo(function MapMarkers({
  map,
  lomas,
  selectedLoma,
  optimizationResult,
  userCoords,
  onSelectLoma,
}: MapMarkersProps) {
  const lomaMarkersRef = useRef<Record<string, L.Marker>>({});
  const polylineLayerRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!map) return;

    const routeOrderMap = new Map<string, number>();
    if (optimizationResult?.ruta_ids) {
      optimizationResult.ruta_ids.forEach((id, idx) => {
        routeOrderMap.set(id, idx + 1);
      });
    }

    lomas.forEach((loma) => {
      const isSelected = selectedLoma?.id === loma.id;
      const routeOrder = routeOrderMap.get(loma.id);
      const isInRoute = routeOrder !== undefined;

      let iconHtml = "";

      if (isInRoute) {
        iconHtml = `
          <div class="relative flex items-center justify-center w-10 h-10 cursor-pointer transition-transform hover:scale-110 ${isSelected ? 'scale-125' : ''}">
            <div class="w-9 h-9 bg-primary text-primary-foreground rounded-full border-2 border-white shadow-control flex items-center justify-center font-bold text-sm ring-4 ring-primary/25">
              ${routeOrder}
            </div>
          </div>
        `;
      } else {
        iconHtml = `
          <div class="relative flex items-center justify-center w-10 h-10 cursor-pointer transition-transform hover:scale-110 ${isSelected ? "scale-125" : ""}">
            <div class="w-9 h-9 ${isSelected ? "bg-amber-500 ring-4 ring-amber-300/80" : "bg-primary"} rounded-full border-2 border-white shadow-control flex items-center justify-center text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>
            </div>
          </div>
        `;
      }

      const lomaIcon = L.divIcon({
        html: iconHtml,
        className: "custom-loma-marker",
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -22],
      });

      if (!lomaMarkersRef.current[loma.id] || !map.hasLayer(lomaMarkersRef.current[loma.id])) {
        const marker = L.marker([loma.coordenadas.lat, loma.coordenadas.lon], {
          icon: lomaIcon,
          title: loma.nombre,
          zIndexOffset: isSelected ? 500 : (isInRoute ? 300 : 100),
        });

        marker.on("click", () => {
          onSelectLoma(loma);
        });

        marker.bindTooltip(`<b>${loma.nombre}</b><br/><span style="color:#059669; font-weight:500;">${loma.distrito}</span>`, {
          direction: "top",
          offset: [0, -20],
          opacity: 0.95,
        });

        marker.addTo(map);
        lomaMarkersRef.current[loma.id] = marker;
      } else {
        lomaMarkersRef.current[loma.id].setIcon(lomaIcon);
        lomaMarkersRef.current[loma.id].setZIndexOffset(isSelected ? 500 : (isInRoute ? 300 : 100));
      }
    });

    if (polylineLayerRef.current) {
      map.removeLayer(polylineLayerRef.current);
      polylineLayerRef.current = null;
    }

    if (optimizationResult?.ruta_ids && optimizationResult.ruta_ids.length > 0) {
      const lineSegments: [number, number][][] = [];
      const userPoint: [number, number] = [userCoords.lat, userCoords.lon];

      optimizationResult.ruta_ids.forEach((lomaId) => {
        const targetLoma = lomas.find((l) => l.id === lomaId);
        if (targetLoma) {
          lineSegments.push([userPoint, [targetLoma.coordenadas.lat, targetLoma.coordenadas.lon]]);
        }
      });

      const polyline = L.polyline(lineSegments, {
        color: "#1447e6",
        weight: 3.5,
        opacity: 0.85,
        dashArray: "6, 8",
        lineCap: "round",
      }).addTo(map);

      polylineLayerRef.current = polyline;
    }

    return () => {
      Object.values(lomaMarkersRef.current).forEach((marker) => {
        if (map.hasLayer(marker)) {
          map.removeLayer(marker);
        }
      });
      lomaMarkersRef.current = {};

      if (polylineLayerRef.current && map.hasLayer(polylineLayerRef.current)) {
        map.removeLayer(polylineLayerRef.current);
        polylineLayerRef.current = null;
      }
    };
  }, [map, lomas, selectedLoma, optimizationResult, userCoords, onSelectLoma]);

  return null;
});