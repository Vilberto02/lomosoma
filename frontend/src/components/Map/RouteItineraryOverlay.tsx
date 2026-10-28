import React, { memo, useMemo, useState } from "react";
import type { Loma, OptimizationResult } from "../../types";
import { Bus, ChevronRight, Clock3, Footprints, Wallet } from "lucide-react";

/**
 * Itinerario por días flotando sobre el mapa.
 * Referencia Pencil: "Itinerario · cuatro días" (336 px, padding 20, radio 16).
 * Vive en la esquina superior izquierda del mapa, justo a la derecha del panel lateral
 * (x = 416 px) y debajo de la chip de ubicación (y = 88 px) para no pisar ningún control.
 */

type OverlayTab = "itinerario" | "transporte" | "tramos" | "algoritmo";

const TABS: { id: OverlayTab; label: string; title: string }[] = [
  { id: "itinerario", label: "Itinerario", title: "Itinerario por días" },
  { id: "transporte", label: "Transporte", title: "Cómo llegar a la parada" },
  { id: "tramos", label: "Tramos", title: "Distancias entre paradas" },
  { id: "algoritmo", label: "AG", title: "Algoritmo genético" },
];

interface RouteItineraryOverlayProps {
  result: OptimizationResult;
  lomas: Loma[];
  selectedLoma: Loma | null;
  onSelectLoma: (loma: Loma) => void;
}

const pad = (n: number) => String(n).padStart(2, "0");

const formatHours = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(1)} h`;

const RouteItineraryOverlayComponent: React.FC<RouteItineraryOverlayProps> = ({
  result,
  lomas,
  selectedLoma,
  onSelectLoma,
}) => {
  const [tab, setTab] = useState<OverlayTab>("itinerario");

  const stops = useMemo(() => {
    const byId = new Map<string, Loma>();
    lomas.forEach((l) => byId.set(l.id, l));
    result.destinos_ordenados.forEach((l) => {
      if (!byId.has(l.id)) byId.set(l.id, l);
    });
    return result.ruta_ids
      .map((id) => byId.get(id))
      .filter((l): l is Loma => Boolean(l));
  }, [lomas, result]);

  if (stops.length === 0) return null;

  const foundIndex = selectedLoma ? stops.findIndex((s) => s.id === selectedLoma.id) : -1;
  const activeIndex = foundIndex >= 0 ? foundIndex : 0;
  const active = stops[activeIndex];
  const guia =
    result.guias_acceso.find((g) => g.nombre === active.nombre) ?? active.guia_acceso ?? null;

  return (
    <section
      aria-label="Itinerario de la ruta"
      className="absolute top-[88px] left-[480px] z-20 hidden lg:flex flex-col w-[388px] max-h-[calc(100vh-104px)] bg-lomo-surface border border-lomo-border rounded-2xl shadow-lomo-panel animate-in fade-in slide-in-from-left"
    >
      {/* Pestañas: una sola fila, subrayado = estado activo */}
      <div role="tablist" className="flex items-center gap-4 px-5 pt-4 border-b border-lomo-border flex-shrink-0">
        {TABS.map((t) => {
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              title={t.title}
              onClick={() => setTab(t.id)}
              className={`h-10 -mb-px border-b-2 text-sm tracking-tight transition-colors ${
                isActive
                  ? "border-lomo-accent font-extrabold text-lomo-ink-primary"
                  : "border-transparent font-semibold text-lomo-ink-muted hover:text-lomo-ink-primary"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-4">
        {tab === "itinerario" && (
          <>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <span className="text-xs font-bold tracking-[0.05em] uppercase text-lomo-ink-muted">
                Día {pad(activeIndex + 1)} · {active.dificultad}
              </span>
              <h3 className="text-[22px] leading-tight font-extrabold tracking-[-0.03em] text-lomo-ink-primary text-balance">
                {active.nombre}
              </h3>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-lomo-ink-secondary">
                <span className="flex items-center gap-1">
                  <Clock3 className="w-4 h-4 text-lomo-ink-muted" />
                  <span className="tabular-nums">{formatHours(active.tiempo_estimado_horas)}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Footprints className="w-4 h-4 text-lomo-ink-muted" />
                  <span>{active.dificultad}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Wallet className="w-4 h-4 text-lomo-ink-muted" />
                  <span className="tabular-nums">S/ {active.costo_estimado}</span>
                </span>
              </div>

              <p className="text-[15px] font-medium leading-[1.6] text-lomo-ink-secondary text-pretty line-clamp-4">
                {active.descripcion}
              </p>
            </div>

            <div className="flex flex-col gap-1.5 pt-3 border-t border-lomo-border flex-shrink-0">
              <div className="flex items-start gap-2 text-[15px] font-bold text-lomo-ink-secondary">
                <Bus className="w-4 h-4 mt-0.5 text-lomo-ink-muted flex-shrink-0" />
                <span className="min-w-0">{active.transporte_principal}</span>
              </div>
              {guia?.punto_partida_recomendado && (
                <p className="text-sm font-medium leading-[1.45] text-lomo-ink-muted pl-6">
                  Sal desde {guia.punto_partida_recomendado}
                  {guia.tiempo_total_min ? ` · ${guia.tiempo_total_min} min` : ""}
                </p>
              )}
            </div>

            {stops.length > 1 && (
              <ul className="flex flex-col flex-shrink-0">
                {stops.map((stop, idx) =>
                  idx === activeIndex ? null : (
                    <li key={stop.id} className="border-t border-lomo-border first:border-t-0">
                      <button
                        type="button"
                        onClick={() => onSelectLoma(stop)}
                        className="w-full min-h-12 py-2.5 flex items-center gap-2 text-left group"
                      >
                        <span className="min-w-0 flex-1 flex flex-col gap-0.5">
                          <span className="text-[15px] font-bold text-lomo-ink-secondary group-hover:text-lomo-ink-primary truncate transition-colors">
                            Día {pad(idx + 1)} · {stop.nombre}
                          </span>
                          <span className="text-sm font-medium text-lomo-ink-secondary tabular-nums">
                            {formatHours(stop.tiempo_estimado_horas)} · S/ {stop.costo_estimado} · {stop.dificultad}
                          </span>
                        </span>
                        <ChevronRight className="w-4 h-4 text-lomo-ink-muted flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </li>
                  )
                )}
              </ul>
            )}
          </>
        )}

        {tab === "transporte" && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold tracking-[0.05em] uppercase text-lomo-ink-muted">
                Día {pad(activeIndex + 1)} · {active.nombre}
              </span>
              <p className="text-[15px] font-bold text-lomo-ink-secondary">
                {guia?.medio_transporte ?? active.transporte_principal}
              </p>
            </div>
            {guia ? (
              <>
                <div className="flex items-center gap-4 text-sm font-bold text-lomo-ink-secondary tabular-nums">
                  <span className="flex items-center gap-1">
                    <Clock3 className="w-4 h-4 text-lomo-ink-muted" />
                    {guia.tiempo_total_min} min
                  </span>
                  <span className="flex items-center gap-1">
                    <Wallet className="w-4 h-4 text-lomo-ink-muted" />
                    S/ {guia.costo_total_soles}
                  </span>
                </div>
                <ol className="flex flex-col gap-2">
                  {guia.pasos.map((paso, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[15px] font-medium leading-[1.55] text-lomo-ink-secondary">
                      <span className="w-6 h-6 rounded-full bg-lomo-surface-inset text-xs font-extrabold text-lomo-ink-secondary flex items-center justify-center flex-shrink-0 tabular-nums">
                        {i + 1}
                      </span>
                      <span className="min-w-0 pt-px">{paso}</span>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="text-sm font-medium text-lomo-ink-muted">
                Aún no hay una guía de acceso para esta parada.
              </p>
            )}
          </div>
        )}

        {tab === "tramos" && (
          <ul className="flex flex-col">
            {result.tramos.length === 0 && (
              <li className="text-sm font-medium text-lomo-ink-muted">Sin tramos calculados.</li>
            )}
            {result.tramos.map((t, i) => (
              <li
                key={`${t.de}-${t.hacia}-${i}`}
                className="py-3 flex items-center gap-3 border-t border-lomo-border first:border-t-0"
              >
                <span className="min-w-0 flex-1 flex flex-col gap-0.5">
                  <span className="text-[15px] font-bold text-lomo-ink-primary truncate">{t.hacia}</span>
                  <span className="text-sm font-medium text-lomo-ink-secondary truncate">desde {t.de}</span>
                </span>
                <span className="text-[15px] font-extrabold text-lomo-ink-primary tabular-nums flex-shrink-0">
                  {t.distancia_km.toFixed(1)} km
                </span>
              </li>
            ))}
          </ul>
        )}

        {tab === "algoritmo" && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[15px]">
            {[
              ["Método", result.metodo || "Algoritmo genético"],
              ["Aptitud", result.fitness.toFixed(3)],
              ["Generaciones", String(result.historial?.length ?? 0)],
              ["Exigencia", `${result.nivel_exigencia}/10`],
              ["Tiempo total", formatHours(result.tiempo_estimado_horas)],
              ["Narrativa", result.llm_provider === "gemini" ? "Gemini" : "Plantilla local"],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5 min-w-0">
                <dt className="text-xs font-bold tracking-[0.05em] uppercase text-lomo-ink-muted">{label}</dt>
                <dd className="font-bold text-lomo-ink-primary tabular-nums truncate" title={value}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
};

export const RouteItineraryOverlay = memo(RouteItineraryOverlayComponent);
