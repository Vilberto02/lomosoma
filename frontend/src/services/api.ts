import type { Loma, PresetZona, UserPreferencesRequest, OptimizationResult, Coordenadas,
  LomaCastReport, SenderoProfile, OfflineLomaPack, ReporteCiudadano, BillingPlan } from "../types";
import { getOfflinePack, saveOfflinePack } from "./offlineStorage";
import { apiFetch, jsonApi } from "./http";

export async function fetchLomas(q?: string, distrito?: string, dificultad?: string, solo_naturales?: boolean): Promise<Loma[]> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (distrito) params.set("distrito", distrito);
  if (dificultad) params.set("dificultad", dificultad);
  if (solo_naturales !== undefined) params.set("solo_naturales", String(solo_naturales));
  return jsonApi(`/lomas?${params}`);
}

function coordsQuery(coords?: Coordenadas) {
  return coords ? `?${new URLSearchParams({ user_lat: String(coords.lat), user_lon: String(coords.lon) })}` : "";
}

function mayUseOffline(error: unknown) {
  // HTTP denials must not silently turn into successful premium responses.
  return !navigator.onLine && !(error as { status?: number })?.status;
}

export async function fetchLomaDetail(id: string, coords?: Coordenadas): Promise<Loma> {
  try {
    return await jsonApi(`/lomas/${encodeURIComponent(id)}${coordsQuery(coords)}`);
  } catch (error) {
    if (mayUseOffline(error)) {
      const cached = await getOfflinePack(id);
      if (cached) return cached.loma;
    }
    throw error;
  }
}

export async function fetchLomaCast(id: string): Promise<LomaCastReport> {
  try { return await jsonApi(`/lomas/${encodeURIComponent(id)}/lomacast`); }
  catch (error) {
    if (mayUseOffline(error)) {
      const cached = await getOfflinePack(id);
      if (cached) return cached.lomacast;
    }
    throw error;
  }
}

export async function fetchSenderoProfile(id: string): Promise<SenderoProfile> {
  try { return await jsonApi(`/lomas/${encodeURIComponent(id)}/sendero`); }
  catch (error) {
    if (mayUseOffline(error)) {
      const cached = await getOfflinePack(id);
      if (cached) return cached.sendero;
    }
    throw error;
  }
}

export async function downloadOfflinePack(id: string): Promise<OfflineLomaPack> {
  const pack = await jsonApi<OfflineLomaPack>(`/lomas/${encodeURIComponent(id)}/offline-pack`);
  await saveOfflinePack(pack);
  return pack;
}

export function downloadGpxUrl(id: string): string {
  return `/api/lomas/${encodeURIComponent(id)}/gpx`;
}

export async function postReporteCiudadano(id: string, data: Partial<ReporteCiudadano>): Promise<ReporteCiudadano> {
  return jsonApi(`/lomas/${encodeURIComponent(id)}/reportes`, data);
}

export function fetchBillingPlans(): Promise<BillingPlan[]> { return jsonApi("/billing/plans"); }
export function fetchPresets(): Promise<PresetZona[]> { return jsonApi("/presets"); }
export function optimizeRoute(prefs: UserPreferencesRequest): Promise<OptimizationResult> { return jsonApi("/optimize", prefs); }
export async function checkBackendHealth(): Promise<boolean> {
  try { await apiFetch("/health"); return true; } catch { return false; }
}
