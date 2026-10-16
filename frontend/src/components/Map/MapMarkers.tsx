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

function parsePointToLatLng(pt: number[]): [number, number] {
  if (Math.abs(pt[0]) > Math.abs(pt[1])) {
    return [pt[1], pt[0]];
  }
  return [pt[0], pt[1]];
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
  const vialPolylineRef = useRef<L.Polyline | null>(null);
  const senderoPolylineRef = useRef<L.Polyline | null>(null);
  const waypointMarkersRef = useRef<L.Marker[]>([]);

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
          <div class="relative flex items-center justify-center w-10 h-10 cursor-pointer transition-transform hover:scale-110 ${
            isSelected ? "scale-125" : ""
          }">
            <div class="w-9 h-9 bg-primary text-primary-foreground rounded-full border-2 border-white shadow-control flex items-center justify-center font-bold text-sm ring-4 ring-primary/25">
              ${routeOrder}
            </div>
          </div>
        `;
      } else {
        iconHtml = `
          <div class="relative flex items-center justify-center w-10 h-10 cursor-pointer transition-transform hover:scale-110 ${
            isSelected ? "scale-125" : ""
          }">
            <div class="w-9 h-9 ${
              isSelected ? "bg-amber-500 ring-4 ring-amber-300/80" : "bg-primary"
            } rounded-full border-2 border-white shadow-control flex items-center justify-center text-white">
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
          zIndexOffset: isSelected ? 500 : isInRoute ? 300 : 100,
        });

        marker.on("click", () => {
          onSelectLoma(loma);
        });

        marker.bindTooltip(
          `<b>${loma.nombre}</b><br/><span style="color:#059669; font-weight:500;">${loma.distrito}</span>`,
          {
            direction: "top",
            offset: [0, -20],
            opacity: 0.95,
          }
        );

        marker.addTo(map);
        lomaMarkersRef.current[loma.id] = marker;
      } else {
        lomaMarkersRef.current[loma.id].setIcon(lomaIcon);
        lomaMarkersRef.current[loma.id].setZIndexOffset(
          isSelected ? 500 : isInRoute ? 300 : 100
        );
      }
    });

    if (polylineLayerRef.current && map.hasLayer(polylineLayerRef.current)) {
      map.removeLayer(polylineLayerRef.current);
      polylineLayerRef.current = null;
    }

    if (optimizationResult?.ruta_ids && optimizationResult.ruta_ids.length > 0) {
      const lineSegments: [number, number][][] = [];
      const userPoint: [number, number] = [userCoords.lat, userCoords.lon];

      optimizationResult.ruta_ids.forEach((lomaId) => {
        const targetLoma = lomas.find((l) => l.id === lomaId);
        if (targetLoma) {
          lineSegments.push([
            userPoint,
            [targetLoma.coordenadas.lat, targetLoma.coordenadas.lon],
          ]);
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

    if (vialPolylineRef.current && map.hasLayer(vialPolylineRef.current)) {
      map.removeLayer(vialPolylineRef.current);
      vialPolylineRef.current = null;
    }

    const geometriaVial = selectedLoma?.guia_acceso?.geometria_vial;
    if (geometriaVial && geometriaVial.length > 1) {
      const vialLatLngs: [number, number][] = geometriaVial.map((pt) =>
        parsePointToLatLng(pt)
      );
      const vialLine = L.polyline(vialLatLngs, {
        color: "#2563eb",
        weight: 4,
        opacity: 0.85,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
      vialPolylineRef.current = vialLine;
    }

    if (senderoPolylineRef.current && map.hasLayer(senderoPolylineRef.current)) {
      map.removeLayer(senderoPolylineRef.current);
      senderoPolylineRef.current = null;
    }

    waypointMarkersRef.current.forEach((m) => {
      if (map.hasLayer(m)) {
        map.removeLayer(m);
      }
    });
    waypointMarkersRef.current = [];

    const senderoCoords = selectedLoma?.sendero?.coordenadas_3d;
    if (senderoCoords && senderoCoords.length > 1) {
      const senderoLatLngs: [number, number][] = senderoCoords.map((pt) =>
        parsePointToLatLng(pt)
      );
      const senderoLine = L.polyline(senderoLatLngs, {
        color: "#10b981",
        weight: 4.5,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
      senderoPolylineRef.current = senderoLine;
    }

    const waypoints = selectedLoma?.sendero?.waypoints;
    if (waypoints && waypoints.length > 0) {
      waypoints.forEach((wp) => {
        let badgeColor = "#059669";
        let label = "W";
        if (wp.tipo === "garita") {
          badgeColor = "#ea580c";
          label = "G";
        } else if (wp.tipo === "senal_4g") {
          badgeColor = "#0284c7";
          label = "4G";
        } else if (wp.tipo === "cumbre") {
          badgeColor = "#16a34a";
          label = "C";
        }

        const wpIconHtml = `
          <div class="flex items-center justify-center w-7 h-7 cursor-pointer hover:scale-110 transition-transform">
            <div style="background-color: ${badgeColor};" class="w-6 h-6 text-white rounded-full border-2 border-white shadow-md flex items-center justify-center font-bold text-[10px]">
              ${label}
            </div>
          </div>
        `;

        const wpIcon = L.divIcon({
          html: wpIconHtml,
          className: "custom-wp-marker",
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const wpMarker = L.marker([wp.lat, wp.lon], {
          icon: wpIcon,
          zIndexOffset: 450,
        });

        wpMarker.bindTooltip(
          `<b>${wp.nombre}</b><br/><span style="color:#475569;">${wp.altitud_msnm} msnm · ${wp.tipo}</span>`,
          {
            direction: "top",
            offset: [0, -14],
            opacity: 0.95,
          }
        );

        wpMarker.addTo(map);
        waypointMarkersRef.current.push(wpMarker);
      });
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
      if (vialPolylineRef.current && map.hasLayer(vialPolylineRef.current)) {
        map.removeLayer(vialPolylineRef.current);
        vialPolylineRef.current = null;
      }
      if (senderoPolylineRef.current && map.hasLayer(senderoPolylineRef.current)) {
        map.removeLayer(senderoPolylineRef.current);
        senderoPolylineRef.current = null;
      }
      waypointMarkersRef.current.forEach((m) => {
        if (map.hasLayer(m)) {
          map.removeLayer(m);
        }
      });
      waypointMarkersRef.current = [];
    };
  }, [map, lomas, selectedLoma, optimizationResult, userCoords, onSelectLoma]);

  return null;
});