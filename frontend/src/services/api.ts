import type { Loma, PresetZona, UserPreferencesRequest, OptimizationResult } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL;

export async function fetchLomas(q?: string, distrito?: string, dificultad?: string): Promise<Loma[]> {
  const params = new URLSearchParams();
  if (q) params.append("q", q);
  if (distrito) params.append("distrito", distrito);
  if (dificultad) params.append("dificultad", dificultad);

  const url = `${API_BASE_URL}/lomas${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Error al obtener lomas: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchLomaDetail(id: string): Promise<Loma> {
  const res = await fetch(`${API_BASE_URL}/lomas/${id}`);
  if (!res.ok) {
    throw new Error(`Error al obtener detalle de la loma ${id}: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchPresets(): Promise<PresetZona[]> {
  const res = await fetch(`${API_BASE_URL}/presets`);
  if (!res.ok) {
    throw new Error(`Error al obtener zonas predeterminadas: ${res.statusText}`);
  }
  return res.json();
}

export async function optimizeRoute(prefs: UserPreferencesRequest): Promise<OptimizationResult> {
  const res = await fetch(`${API_BASE_URL}/optimize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(prefs),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Error en la optimización: ${res.statusText}`);
  }
  return res.json();
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
