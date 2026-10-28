import React, { memo, useMemo } from "react";
import type { Loma } from "../../types";
import { X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog";

/**
 * Modal de scores difusos.
 * Referencia Pencil: "Lomosoma · Modal / Scores difusos" (960 px, radio 20, tabla 896 px).
 * Columnas: destino 240 · distrito 184 · riesgo 128 · saturación 112 · seguridad 112 · accesibilidad 120.
 */

interface FuzzyScoresModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lomas: Loma[];
  /** Ids de las paradas de la ruta calculada; se resaltan dentro del catálogo. */
  routeIds?: string[];
}

type RiskTone = "low" | "mid" | "high";

const riskTone = (score: number): RiskTone => (score <= 3.5 ? "low" : score <= 6 ? "mid" : "high");

const RISK_CHIP: Record<RiskTone, string> = {
  low: "bg-lomo-surface-selected text-lomo-accent border-lomo-border-selected",
  mid: "bg-lomo-warning-surface text-lomo-warning-ink border-lomo-warning-border",
  high: "bg-rose-50 text-rose-700 border-rose-200",
};

const TH =
  "h-11 px-3 text-xs font-bold tracking-[0.05em] uppercase text-lomo-ink-secondary whitespace-pre-line leading-[1.25] bg-lomo-surface-inset";

const FuzzyScoresModalComponent: React.FC<FuzzyScoresModalProps> = ({
  open,
  onOpenChange,
  lomas,
  routeIds = [],
}) => {
  const sorted = useMemo(
    () => [...lomas].sort((a, b) => (a.score_difuso ?? 10) - (b.score_difuso ?? 10)),
    [lomas]
  );
  const routeSet = useMemo(() => new Set(routeIds), [routeIds]);
  const stopsInCatalog = sorted.filter((l) => routeSet.has(l.id)).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="flex flex-col gap-0 p-0 w-[calc(100vw-32px)] max-w-[1000px] max-h-[calc(100dvh-32px)] overflow-hidden bg-lomo-surface border border-lomo-border rounded-[20px] shadow-lomo-panel sm:rounded-[20px]"
      >
        {/* Cabecera del modal: título y cierre comparten fila, nada flota encima */}
        <header className="flex flex-col gap-2 px-6 sm:px-8 pt-6 pb-4 flex-shrink-0">
          <div className="flex items-center gap-6">
            <DialogTitle className="flex-1 min-w-0 text-[26px] leading-[1.2] font-extrabold tracking-[-0.025em] text-lomo-ink-primary text-balance">
              Scores difusos del catálogo
            </DialogTitle>
            <DialogClose
              aria-label="Cerrar modal"
              className="w-10 h-10 rounded-lg bg-lomo-surface-inset text-lomo-ink-secondary flex items-center justify-center flex-shrink-0 transition-[background-color,transform] duration-150 hover:bg-lomo-surface-selected active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lomo-accent/30"
            >
              <X className="w-4 h-4" />
            </DialogClose>
          </div>
          <DialogDescription className="text-[15px] font-medium leading-[1.5] text-lomo-ink-secondary">
            Riesgo estimado (0–10) por lógica difusa Mamdani según clima, saturación y accesibilidad.
          </DialogDescription>
        </header>

        {/* Contexto de comparación */}
        <div className="flex items-center justify-between gap-4 min-h-10 px-6 sm:px-8 flex-shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <span className="text-[15px] font-bold text-lomo-ink-primary tabular-nums whitespace-nowrap">
              {sorted.length} destinos
            </span>
            {stopsInCatalog > 0 && (
              <span className="flex items-center gap-2 text-sm font-semibold text-lomo-ink-secondary whitespace-nowrap">
                <span aria-hidden className="w-2 h-2 rounded-full bg-lomo-accent" />
                {stopsInCatalog} {stopsInCatalog === 1 ? "parada" : "paradas"} de tu ruta
              </span>
            )}
          </div>
          <span className="hidden sm:inline text-sm font-semibold text-lomo-ink-secondary whitespace-nowrap">
            Ordenado por menor riesgo
          </span>
        </div>

        {/* Tabla: el scroll vive aquí, la cabecera se queda pegada arriba */}
        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar px-6 sm:px-8 pb-4">
          <table className="w-full min-w-[740px] border-separate border-spacing-0 text-left">
            <thead>
              <tr>
                <th scope="col" className={`${TH} w-[240px] rounded-tl-lg border-y border-l border-lomo-border sticky top-0 z-10`}>
                  Destino
                </th>
                <th scope="col" className={`${TH} w-[184px] border-y border-lomo-border sticky top-0 z-10`}>
                  Distrito
                </th>
                <th scope="col" className={`${TH} w-[128px] text-right border-y border-lomo-border sticky top-0 z-10`}>
                  {"Riesgo\n(0–10)"}
                </th>
                <th scope="col" className={`${TH} w-[112px] text-right border-y border-lomo-border sticky top-0 z-10`}>
                  {"Saturación\n(%)"}
                </th>
                <th scope="col" className={`${TH} w-[112px] text-right border-y border-lomo-border sticky top-0 z-10`}>
                  {"Seguridad\n(0–10)"}
                </th>
                <th scope="col" className={`${TH} w-[120px] text-right rounded-tr-lg border-y border-r border-lomo-border sticky top-0 z-10`}>
                  {"Accesibilidad\n(0–10)"}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((loma) => {
                const score = loma.score_difuso ?? 4.2;
                const inRoute = routeSet.has(loma.id);
                const cell = `h-11 px-3 border-b border-lomo-border/70 text-[15px] font-semibold ${
                  inRoute ? "bg-lomo-surface-selected" : "bg-lomo-surface"
                }`;
                return (
                  <tr key={loma.id} className="group">
                    <th scope="row" className={`${cell} font-bold text-lomo-ink-primary max-w-[240px]`}>
                      <span className="flex items-center gap-2 min-w-0">
                        {inRoute && (
                          <span
                            aria-label="Parada de tu ruta"
                            className="w-2 h-2 rounded-full bg-lomo-accent flex-shrink-0"
                          />
                        )}
                        <span className="truncate">{loma.nombre}</span>
                      </span>
                    </th>
                    <td className={`${cell} text-lomo-ink-secondary max-w-[184px] truncate`}>{loma.distrito}</td>
                    <td className={`${cell} text-right`}>
                      <span
                        className={`inline-flex items-center h-7 px-3 rounded-md border text-sm font-extrabold tabular-nums ${RISK_CHIP[riskTone(score)]}`}
                      >
                        {score.toFixed(1)} / 10
                      </span>
                    </td>
                    <td className={`${cell} text-right text-lomo-ink-secondary tabular-nums`}>
                      {((loma.saturacion_base ?? 0.2) * 100).toFixed(0)}%
                    </td>
                    <td className={`${cell} text-right text-lomo-ink-secondary tabular-nums`}>
                      {loma.seguridad_base?.toFixed(1) ?? "7.0"}
                    </td>
                    <td className={`${cell} text-right text-lomo-ink-secondary tabular-nums`}>
                      {loma.accesibilidad_base?.toFixed(1) ?? "6.5"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Interpretación y acción */}
        <footer className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 px-6 sm:px-8 pt-4 pb-6 border-t border-lomo-border flex-shrink-0">
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <p className="text-[15px] font-semibold text-lomo-ink-primary">
              Menor riesgo es mejor. Mayor seguridad y accesibilidad es mejor.
            </p>
            <p className="text-sm font-medium text-lomo-ink-secondary">
              Valores orientativos · verifica las condiciones antes de salir.
            </p>
          </div>
          <DialogClose className="h-12 w-full sm:w-52 rounded-lg bg-lomo-action-primary text-lomo-on-action text-[15px] font-bold transition-[background-color,transform] duration-150 hover:bg-lomo-action-hover active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lomo-accent/40 focus-visible:ring-offset-2">
            Volver a mi ruta
          </DialogClose>
        </footer>
      </DialogContent>
    </Dialog>
  );
};

export const FuzzyScoresModal = memo(FuzzyScoresModalComponent);
