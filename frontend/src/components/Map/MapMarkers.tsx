import { useEffect, useRef, useCallback, memo } from "react";
import mapboxgl from "mapbox-gl";
import type { Loma, Coordenadas, OptimizationResult } from "../../types";

interface MapMarkersProps {
  map: mapboxgl.Map | null;
  lomas: Loma[];
  selectedLoma: Loma | null;
  optimizationResult: OptimizationResult | null;
  userCoords: Coordenadas;
  onSelectLoma: (loma: Loma) => void;
}

function parsePointToLngLat(pt: number[]): [number, number] {
  if (Math.abs(pt[0]) > Math.abs(pt[1])) {
    return [pt[0], pt[1]];
  }
  return [pt[1], pt[0]];
}

function buildLomaMarkerHtml(
  shortName: string,
  isSelected: boolean,
  isInRoute: boolean,
  routeOrder?: number
): string {
  if (isInRoute) {
    return `
      <div class="cursor-pointer flex items-center gap-2 px-3.5 py-1.5 bg-[#243C2D] text-white border-2 border-white shadow-md rounded-full whitespace-nowrap ring-2 ring-[#2E6540]/30">
        <span class="w-5 h-5 rounded-full bg-[#D8E7C9] text-[#203B2E] text-xs font-black flex items-center justify-center">${routeOrder}</span>
        <span class="text-[13px] font-bold tracking-tight">${shortName}</span>
      </div>
    `;
  }
  if (isSelected) {
    return `
      <div class="cursor-pointer flex items-center gap-2 px-4 py-1.5 bg-[#2E6540] text-white border-[3px] border-white shadow-lg rounded-full whitespace-nowrap animate-in zoom-in-95">
        <svg class="text-white" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>
        <span class="text-[13px] font-bold tracking-tight">${shortName}</span>
      </div>
    `;
  }
  return `
    <div class="cursor-pointer flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-[#203B2E] border border-[#E4E9DE] shadow-sm rounded-full whitespace-nowrap hover:border-[#CAD9BE] hover:bg-[#F3F5F0] transition-all group">
      <svg class="text-[#546349] group-hover:text-[#2E6540] transition-colors" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>
      <span class="text-[13px] font-bold tracking-tight">${shortName}</span>
    </div>
  `;
}

function upsertLineLayer(
  map: mapboxgl.Map,
  sourceId: string,
  layerId: string,
  coordinates: [number, number][],
  paint: mapboxgl.LinePaint
) {
  const geojson: Parameters<mapboxgl.GeoJSONSource["setData"]>[0] = {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates,
    },
  };

  const existingSource = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
  if (existingSource) {
    existingSource.setData(geojson);
  } else {
    map.addSource(sourceId, {
      type: "geojson",
      data: geojson,
    });
  }

  if (!map.getLayer(layerId)) {
    map.addLayer({
      id: layerId,
      type: "line",
      source: sourceId,
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint,
    });
  }
}

function removeLineLayer(map: mapboxgl.Map, sourceId: string, layerId: string) {
  try {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }
  } catch {
    // Map may be disposing or style reloading
  }
}

export const MapMarkers = memo(function MapMarkers({
  map,
  lomas,
  selectedLoma,
  optimizationResult,
  userCoords,
  onSelectLoma,
}: MapMarkersProps) {
  const lomaMarkersRef = useRef<
    Record<string, { marker: mapboxgl.Marker; element: HTMLDivElement; popup: mapboxgl.Popup }>
  >({});
  const waypointMarkersRef = useRef<mapboxgl.Marker[]>([]);

  // 1. Marcadores tipo píldora de las lomas
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

      const shortName = loma.nombre
        .replace(/^Lomas de /, "")
        .replace(/^Lomas del /, "")
        .replace(/^Loma /, "");

      const html = buildLomaMarkerHtml(shortName, isSelected, isInRoute, routeOrder);
      const zIndex = isSelected ? "25" : isInRoute ? "20" : "10";

      const existing = lomaMarkersRef.current[loma.id];
      if (!existing) {
        const el = document.createElement("div");
        el.className = "custom-loma-marker";
        el.style.zIndex = zIndex;
        el.title = loma.nombre;
        el.innerHTML = html;

        const popup = new mapboxgl.Popup({
          offset: 16,
          closeButton: false,
          closeOnClick: false,
        }).setHTML(
          `<b>${loma.nombre}</b><br/><span style="color:#2E6540; font-weight:600;">${loma.distrito} · ${
            loma.altitud_max_msnm ?? 0
          } msnm</span>`
        );

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectLoma(loma);
        });
        el.addEventListener("mouseenter", () => {
          popup.setLngLat([loma.coordenadas.lon, loma.coordenadas.lat]).addTo(map);
        });
        el.addEventListener("mouseleave", () => {
          popup.remove();
        });

        const marker = new mapboxgl.Marker({
          element: el,
          anchor: "center",
        })
          .setLngLat([loma.coordenadas.lon, loma.coordenadas.lat])
          .addTo(map);

        lomaMarkersRef.current[loma.id] = { marker, element: el, popup };
      } else {
        existing.element.innerHTML = html;
        existing.element.style.zIndex = zIndex;
        existing.marker.setLngLat([loma.coordenadas.lon, loma.coordenadas.lat]);
      }
    });

    Object.keys(lomaMarkersRef.current).forEach((id) => {
      if (!lomas.some((l) => l.id === id)) {
        lomaMarkersRef.current[id].popup.remove();
        lomaMarkersRef.current[id].marker.remove();
        delete lomaMarkersRef.current[id];
      }
    });
  }, [map, lomas, selectedLoma, optimizationResult, onSelectLoma]);

  // Limpiar todos los marcadores al desmontar o cambiar instancia de mapa
  useEffect(() => {
    return () => {
      Object.values(lomaMarkersRef.current).forEach(({ marker, popup }) => {
        popup.remove();
        marker.remove();
      });
      lomaMarkersRef.current = {};
      waypointMarkersRef.current.forEach((m) => m.remove());
      waypointMarkersRef.current = [];
    };
  }, [map]);

  // 2. Sincronizar polilíneas GeoJSON (ruta optimizada, acceso vial y sendero)
  const syncPolylines = useCallback(() => {
    if (!map || !map.isStyleLoaded()) return;

    // A) Polilínea de ruta optimizada
    if (
      optimizationResult?.destinos_ordenados &&
      optimizationResult.destinos_ordenados.length > 0
    ) {
      const coords: [number, number][] = [
        [userCoords.lon, userCoords.lat],
        ...optimizationResult.destinos_ordenados.map(
          (d) => [d.coordenadas.lon, d.coordenadas.lat] as [number, number]
        ),
      ];
      upsertLineLayer(map, "lomosoma-route-source", "lomosoma-route-layer", coords, {
        "line-color": "#2E6540",
        "line-width": 3.5,
        "line-opacity": 0.85,
        "line-dasharray": [2, 2],
      });
    } else {
      removeLineLayer(map, "lomosoma-route-source", "lomosoma-route-layer");
    }

    // B) Limpiar capa vial de origen→loma (no trazar rutas desde el origen al seleccionar una loma)
    removeLineLayer(map, "lomosoma-vial-source", "lomosoma-vial-layer");

    // C) Polilínea de sendero 3D
    const senderoCoords = selectedLoma?.sendero?.coordenadas_3d;
    if (senderoCoords && senderoCoords.length > 1) {
      const pts = senderoCoords.map(parsePointToLngLat);
      upsertLineLayer(map, "lomosoma-sendero-source", "lomosoma-sendero-layer", pts, {
        "line-color": "#2E6540",
        "line-width": 4,
        "line-opacity": 0.9,
      });
    } else {
      removeLineLayer(map, "lomosoma-sendero-source", "lomosoma-sendero-layer");
    }
  }, [map, optimizationResult, userCoords, selectedLoma]);

  useEffect(() => {
    if (!map) return;

    if (map.isStyleLoaded()) {
      syncPolylines();
    }
    const handleStyleLoad = () => {
      syncPolylines();
    };
    map.on("style.load", handleStyleLoad);
    return () => {
      map.off("style.load", handleStyleLoad);
    };
  }, [map, syncPolylines]);

  // 3. Marcadores de waypoints del sendero
  useEffect(() => {
    waypointMarkersRef.current.forEach((m) => m.remove());
    waypointMarkersRef.current = [];

    if (!map || !selectedLoma?.sendero?.waypoints) return;

    selectedLoma.sendero.waypoints.forEach((wp) => {
      const el = document.createElement("div");
      el.className =
        "w-2.5 h-2.5 rounded-full bg-[#203B2E] border-2 border-white shadow-xs cursor-pointer";
      el.title = `${wp.nombre} (${wp.tipo})`;

      const popup = new mapboxgl.Popup({
        offset: 10,
        closeButton: false,
        closeOnClick: false,
      }).setHTML(`<b>${wp.nombre}</b><br/>${wp.tipo}`);

      el.addEventListener("mouseenter", () => {
        popup.setLngLat([wp.lon, wp.lat]).addTo(map);
      });
      el.addEventListener("mouseleave", () => {
        popup.remove();
      });

      const wpMarker = new mapboxgl.Marker({
        element: el,
        anchor: "center",
      })
        .setLngLat([wp.lon, wp.lat])
        .addTo(map);

      waypointMarkersRef.current.push(wpMarker);
    });

    return () => {
      waypointMarkersRef.current.forEach((m) => m.remove());
      waypointMarkersRef.current = [];
    };
  }, [map, selectedLoma]);

  return null;
});
