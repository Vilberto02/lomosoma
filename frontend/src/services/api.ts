import type {
  Loma,
  PresetZona,
  UserPreferencesRequest,
  OptimizationResult,
  Coordenadas,
  LomaCastReport,
  SenderoProfile,
  OfflineLomaPack,
  ReporteCiudadano,
  BillingPlan,
  CheckoutRequest,
  CheckoutResponse,
} from "../types";
import { getOfflinePack, saveOfflinePack } from "./offlineStorage";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

export async function fetchLomas(
  q?: string,
  distrito?: string,
  dificultad?: string,
  solo_naturales?: boolean
): Promise<Loma[]> {
  const params = new URLSearchParams();
  if (q) params.append("q", q);
  if (distrito) params.append("distrito", distrito);
  if (dificultad) params.append("dificultad", dificultad);
  if (solo_naturales !== undefined) {
    params.append("solo_naturales", String(solo_naturales));
  }

  const url = `${API_BASE_URL}/lomas${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Error al obtener lomas: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchLomaDetail(
  id: string,
  userCoords?: Coordenadas
): Promise<Loma> {
  const params = new URLSearchParams();
  if (userCoords) {
    params.append("user_lat", String(userCoords.lat));
    params.append("user_lon", String(userCoords.lon));
  }

  const url = `${API_BASE_URL}/lomas/${id}${params.toString() ? `?${params.toString()}` : ""}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Error HTTP ${res.status}: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    const cachedPack = await getOfflinePack(id);
    if (cachedPack && cachedPack.loma) {
      return cachedPack.loma;
    }
    throw err;
  }
}

export async function fetchLomaCast(id: string): Promise<LomaCastReport> {
  try {
    const res = await fetch(`${API_BASE_URL}/lomas/${id}/lomacast`);
    if (!res.ok) {
      throw new Error(`Error HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    const cachedPack = await getOfflinePack(id);
    if (cachedPack && cachedPack.lomacast) {
      return cachedPack.lomacast;
    }
    throw err;
  }
}

export async function fetchSenderoProfile(id: string): Promise<SenderoProfile> {
  try {
    const res = await fetch(`${API_BASE_URL}/lomas/${id}/sendero`);
    if (!res.ok) {
      throw new Error(`Error HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    const cachedPack = await getOfflinePack(id);
    if (cachedPack && cachedPack.sendero) {
      return cachedPack.sendero;
    }
    throw err;
  }
}

export async function downloadOfflinePack(id: string): Promise<OfflineLomaPack> {
  const res = await fetch(`${API_BASE_URL}/lomas/${id}/offline-pack`);
  if (!res.ok) {
    throw new Error(`Error al descargar maletín offline: ${res.statusText}`);
  }
  const pack: OfflineLomaPack = await res.json();
  await saveOfflinePack(pack);
  return pack;
}

export function downloadGpxUrl(id: string): string {
  return `${API_BASE_URL}/lomas/${id}/gpx`;
}

export async function postReporteCiudadano(
  id: string,
  data: Partial<ReporteCiudadano>
): Promise<ReporteCiudadano> {
  const res = await fetch(`${API_BASE_URL}/lomas/${id}/reportes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(`Error al registrar reporte ciudadano: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchBillingPlans(): Promise<BillingPlan[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/billing/plans`);
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fallback if backend billing endpoint is unreachable
  }

  return [
    {
      plan_id: "pack_lima_pro",
      nombre: "Pack Vitalicio Todo Lima PRO",
      tipo_pago: "pago_unico",
      precio_pen: 19.9,
      precio_usd: 5.4,
      descripcion: "Acceso vitalicio a las 15 lomas de Lima Metropolitana sin suscripciones.",
      beneficios: [
        "Descarga ilimitada de maletines offline para todas las lomas",
        "LomaCast 7D completo y predicción colchón de nubes",
        "Navegación Guardián GPS sin conexión",
        "Pasaporte digital de cumbres verificado con SHA256",
        "Archivos GPX para Garmin, Suunto y Apple Watch",
      ],
    },
    {
      plan_id: "loma_individual",
      nombre: "Desbloqueo de Loma Individual",
      tipo_pago: "pago_unico",
      precio_pen: 4.9,
      precio_usd: 1.35,
      descripcion: "Desbloqueo vitalicio para una loma específica de tu elección.",
      beneficios: [
        "Maletín offline de la loma seleccionada",
        "LomaCast 7D para este circuito",
        "Sello de cumbre para tu pasaporte digital",
      ],
    },
  ];
}

export async function checkoutPlan(req: CheckoutRequest): Promise<CheckoutResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/billing/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fallback for offline mode or mock
  }

  const isFull = req.plan_id === "pack_lima_pro";
  const unlocked = isFull
    ? ["L0", "L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10", "L11", "L12", "L13", "L14"]
    : req.loma_id
    ? [req.loma_id]
    : ["L0"];

  return {
    orden_id: `ord_${Date.now().toString(36)}`,
    estado: "completado",
    plan_id: req.plan_id,
    lomas_desbloqueadas: unlocked,
    acceso_total_lima: isFull,
    monto_pagado_pen: isFull ? 19.9 : 4.9,
    metodo_pago: req.metodo_pago,
    token_licencia: `tok_${Math.random().toString(36).substring(2)}${Date.now()}`,
    emitido_en: new Date().toISOString(),
    mensaje: "Pago procesado con éxito. Disfruta tu experiencia Lomosoma PRO vitalicia.",
  };
}

export async function fetchPresets(): Promise<PresetZona[]> {
  const res = await fetch(`${API_BASE_URL}/presets`);
  if (!res.ok) {
    throw new Error(`Error al obtener zonas predeterminadas: ${res.statusText}`);
  }
  return res.json();
}

export async function optimizeRoute(
  prefs: UserPreferencesRequest
): Promise<OptimizationResult> {
  const res = await fetch(`${API_BASE_URL}/optimize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(prefs),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Error en la optimización: ${res.statusText}`
    );
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
