import { useEffect, useRef, memo } from "react";
import mapboxgl from "mapbox-gl";
import type { Coordenadas } from "../../types";

interface UserMarkerProps {
  map: mapboxgl.Map | null;
  userCoords: Coordenadas;
  onUserCoordsChange: (coords: Coordenadas) => void;
  draggable?: boolean;
}

function buildUserMarkerHtml(draggable: boolean): string {
  return `
    <div class="relative flex items-center justify-center w-11 h-11 ${
      draggable ? "cursor-grab active:cursor-grabbing" : "cursor-default"
    } select-none group">
      ${
        draggable
          ? '<span class="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-40 animate-ping"></span>'
          : ""
      }
      <span class="absolute inline-flex h-9 w-9 rounded-full transition-all duration-300 ${
        draggable
          ? "bg-red-500/20 border border-red-500"
          : "bg-red-500/10 border border-red-500/40 scale-90 opacity-60"
      }"></span>
      <div class="relative w-8 h-8 ${
        draggable ? "bg-red-600" : "bg-red-400"
      } rounded-full shadow-md border-2 border-white flex items-center justify-center text-white transition-all duration-300 ${
        draggable ? "group-hover:scale-110" : "scale-90 opacity-70"
      }">
        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
        </svg>
      </div>
    </div>
  `;
}

export const UserMarker = memo(function UserMarker({
  map,
  userCoords,
  onUserCoordsChange,
  draggable = true,
}: UserMarkerProps) {
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const elementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!map) return;

    const el = document.createElement("div");
    el.className = "custom-user-marker z-30";
    el.innerHTML = buildUserMarkerHtml(draggable);
    el.title = draggable
      ? "Tu punto de partida (Arrastra para reubicar)"
      : "Tu punto de partida (bloqueado mientras haya una ruta activa)";
    elementRef.current = el;

    const popup = new mapboxgl.Popup({
      offset: 24,
      closeButton: false,
    }).setHTML(`
      <div style="font-family: inherit; min-width: 190px; padding: 2px;">
        <h4 style="margin: 0; color: #dc2626; font-weight: 700; font-size: 13px;">Tu punto de partida</h4>
        <p style="margin: 4px 0 0; font-size: 12px; color: #53664B; line-height: 1.4;">
          ${
            draggable
              ? "Arrastra este marcador para recalcular las rutas desde tu ubicación exacta."
              : "El punto de partida está bloqueado mientras una ruta esté activa. Reconfigura los parámetros para poder moverlo."
          }
        </p>
      </div>
    `);

    const marker = new mapboxgl.Marker({
      element: el,
      draggable,
      anchor: "center",
    })
      .setLngLat([userCoords.lon, userCoords.lat])
      .setPopup(popup)
      .addTo(map);

    marker.on("dragend", () => {
      const lngLat = marker.getLngLat();
      onUserCoordsChange({
        lat: Number(lngLat.lat.toFixed(4)),
        lon: Number(lngLat.lng.toFixed(4)),
      });
    });

    userMarkerRef.current = marker;

    return () => {
      marker.remove();
      userMarkerRef.current = null;
      elementRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const marker = userMarkerRef.current;
    if (!marker) return;
    marker.setLngLat([userCoords.lon, userCoords.lat]);
  }, [userCoords.lat, userCoords.lon]);

  useEffect(() => {
    const marker = userMarkerRef.current;
    const el = elementRef.current;
    if (!marker || !el) return;
    marker.setDraggable(draggable);
    el.innerHTML = buildUserMarkerHtml(draggable);
    el.title = draggable
      ? "Tu punto de partida (Arrastra para reubicar)"
      : "Tu punto de partida (bloqueado mientras haya una ruta activa)";
  }, [draggable]);

  return null;
});
