import React, { useState, useMemo, memo } from "react";
import type { OptimizationResult, Loma, UserPreferencesRequest } from "../../types";
import {
  ArrowLeft,
  RotateCcw,
  Compass,
  ChevronDown,
  Activity,
  Backpack,
  Wallet,
  ScrollText,
  CircleCheck,
} from "lucide-react";
import { FuzzyScoresModal } from "./FuzzyScoresModal";
import { useCountUp } from "../../hooks/useCountUp";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface RouteResultsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  result: OptimizationResult | null;
  lomas: Loma[];
  prefs?: UserPreferencesRequest | null;
  onFocusLoma: (loma: Loma) => void;
  onNewSearch: () => void;
  isEmbedded?: boolean;
}

const DEFAULT_CHECKLIST = [
  "Calzado de trekking con buen agarre (suela vibram o labrada)",
  "Casaca cortaviento impermeable o poncho para garúa",
  "1.5 a 2 litros de agua por persona",
  "Bastones de trekking con puntas de goma",
  "Snacks energéticos (frutos secos, plátano, barras de cereal)",
  "Protector solar y lentes con filtro UV",
  "Bolsa para recoger todos los residuos (Cero Huella)",
];

const NUMBER_WORDS = ["Cero", "Un", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete"];

/** "Cuatro días para descubrir Lima." (referencia Pencil: Ruta / cuatro días) */
const buildTitle = (k: number) => {
  const amount = NUMBER_WORDS[k] ?? String(k);
  return `${amount} ${k === 1 ? "día" : "días"} para descubrir Lima.`;
};

interface DisclosureRowProps {
  icon: React.ReactNode;
  label: string;
  meta?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

/** Fila plegable: barra inset de 44 px + contenido propio. */
const DisclosureRow: React.FC<DisclosureRowProps> = ({ icon, label, meta, open, onToggle, children }) => (
  <div className="flex flex-col gap-2 flex-shrink-0">
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="h-11 w-full px-3.5 flex items-center gap-2.5 rounded-lg bg-lomo-surface-inset text-left transition-colors hover:bg-lomo-surface-selected focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lomo-accent/30"
    >
      <span className="text-lomo-ink-secondary flex-shrink-0">{icon}</span>
      <span className="flex-1 min-w-0 truncate text-[15px] font-bold text-lomo-ink-primary">{label}</span>
      {meta && <span className="text-sm font-semibold text-lomo-ink-secondary flex-shrink-0 tabular-nums">{meta}</span>}
      <ChevronDown
        className={`w-4 h-4 text-lomo-ink-secondary flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      />
    </button>
    {open && <div className="px-1 animate-in fade-in">{children}</div>}
  </div>
);

const RouteResultsPanelComponent: React.FC<RouteResultsPanelProps> = ({
  isOpen,
  onClose,
  result,
  lomas,
  prefs: _prefs,
  onFocusLoma,
  onNewSearch,
  isEmbedded: _isEmbedded = false,
}) => {
  const [scoresModalOpen, setScoresModalOpen] = useState<boolean>(false);
  const [showChecklist, setShowChecklist] = useState<boolean>(false);
  const [showCostesGrupal, setShowCostesGrupal] = useState<boolean>(false);
  const [showNarrativa, setShowNarrativa] = useState<boolean>(false);
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({
    0: true,
    1: true,
    2: true,
  });

  const lomasDict = useMemo(() => {
    const map = new Map<string, Loma>();
    lomas.forEach((l) => map.set(l.id, l));
    result?.destinos_ordenados?.forEach((l) => {
      if (!map.has(l.id)) map.set(l.id, l);
    });
    return map;
  }, [lomas, result]);

  const riesgoPromedio = useMemo(() => {
    if (!result) return 0;
    const avg =
      result.ruta_ids.reduce((acc, id) => acc + (result.riesgos_ruta[id] || 4.0), 0) /
      Math.max(1, result.ruta_ids.length);
    return Math.round(avg * 10) / 10;
  }, [result]);

  const kpiCosto = useCountUp(result?.costo_total ?? 0);
  const kpiDistancia = useCountUp(result?.distancia_total_km ?? 0);

  if (!isOpen || !result) return null;

  const toggleCheck = (idx: number) => {
    setCheckedItems((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const checklist =
    result.checklist_equipamiento && result.checklist_equipamiento.length > 0
      ? result.checklist_equipamiento
      : DEFAULT_CHECKLIST;

  const totalGrupo4 = Math.round(result.costo_total * 4 * 0.72);
  const cuotaGrupo4 = Math.round((totalGrupo4 / 4) * 10) / 10;

  const stops = result.ruta_ids
    .map((id) => lomasDict.get(id))
    .filter((l): l is Loma => Boolean(l));

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full overflow-hidden bg-lomo-surface">
      {/* Cabecera · Tu itinerario está listo */}
      <div className="px-6 pb-4 flex flex-col gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="self-start h-9 -ml-2 px-2 rounded-lg flex items-center gap-2 text-[15px] font-bold text-lomo-ink-secondary transition-colors hover:text-lomo-ink-primary hover:bg-lomo-surface-inset"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Todas las lomas</span>
        </button>

        <h2 className="text-[26px] leading-[1.2] font-extrabold tracking-[-0.025em] text-lomo-ink-primary text-balance">
          {buildTitle(result.k)}
        </h2>
        <p className="text-[15px] font-semibold text-lomo-ink-secondary">
          Ruta óptima · algoritmo genético multiobjetivo
        </p>
      </div>

      {/* Contenido desplazable · Resumen de la ruta */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-6 pb-4 flex flex-col gap-3.5">
        {/* Métricas: tres columnas sin cajas, separadas por un filete inferior */}
        <dl className="grid grid-cols-3 gap-3 pb-4 border-b border-lomo-border flex-shrink-0">
          <div className="flex flex-col gap-1 min-w-0">
            <dt className="text-xs font-bold tracking-[0.05em] uppercase text-lomo-ink-secondary">Costo</dt>
            <dd className="text-[25px] leading-none font-extrabold tracking-[-0.03em] text-lomo-ink-primary tabular-nums truncate">
              S/ {kpiCosto}
            </dd>
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <dt className="text-xs font-bold tracking-[0.05em] uppercase text-lomo-ink-secondary">Distancia</dt>
            <dd className="text-[25px] leading-none font-extrabold tracking-[-0.03em] text-lomo-ink-primary tabular-nums truncate">
              {kpiDistancia} <span className="text-sm font-bold tracking-normal text-lomo-ink-muted">km</span>
            </dd>
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <dt className="text-xs font-bold tracking-[0.05em] uppercase text-lomo-ink-secondary">Riesgo difuso</dt>
            <dd className="text-[25px] leading-none font-extrabold tracking-[-0.03em] text-lomo-warning-ink tabular-nums truncate">
              {riesgoPromedio}
              <span className="text-sm font-bold tracking-normal text-lomo-ink-muted">/10</span>
            </dd>
          </div>
        </dl>

        {/* Validación de requisitos */}
        <div className="flex items-center gap-2 flex-shrink-0 text-sm font-bold text-lomo-ink-secondary">
          <CircleCheck className="w-4 h-4 text-lomo-accent flex-shrink-0" />
          <span>Cumple tu presupuesto y tiempo disponible</span>
        </div>

        {/* Equipamiento y presupuesto */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          <DisclosureRow
            icon={<Backpack className="w-4 h-4" />}
            label="Checklist de equipamiento"
            meta={`${checklist.length} ítems`}
            open={showChecklist}
            onToggle={() => setShowChecklist((prev) => !prev)}
          >
            <ul className="flex flex-col gap-1.5 pt-1">
              {checklist.map((item, idx) => {
                const isChecked = !!checkedItems[idx];
                return (
                  <li key={idx}>
                    <label className="min-h-9 py-1 flex items-start gap-2.5 cursor-pointer text-[15px] font-medium text-lomo-ink-primary select-none">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCheck(idx)}
                        className="w-4 h-4 mt-1 flex-shrink-0 accent-[#2E6540] rounded"
                      />
                      <span className={`min-w-0 leading-[1.45] ${isChecked ? "line-through text-lomo-ink-muted" : ""}`}>
                        {item}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </DisclosureRow>

          <DisclosureRow
            icon={<Wallet className="w-4 h-4" />}
            label="Costes y chancha grupal"
            open={showCostesGrupal}
            onToggle={() => setShowCostesGrupal((prev) => !prev)}
          >
            <div className="flex flex-col gap-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold tracking-[0.05em] uppercase text-lomo-ink-muted">Viajando solo</span>
                  <span className="text-[20px] font-extrabold text-lomo-ink-primary tabular-nums">S/ {result.costo_total}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold tracking-[0.05em] uppercase text-lomo-accent">Grupo de 4</span>
                  <span className="text-[20px] font-extrabold text-lomo-accent tabular-nums">S/ {cuotaGrupo4} c/u</span>
                </div>
              </div>
              <p className="text-sm font-medium leading-[1.5] text-lomo-ink-secondary text-pretty">
                Total estimado: S/ {totalGrupo4} para 4 personas (incluye entradas comunitarias, guía oficial y transporte compartido).
              </p>
            </div>
          </DisclosureRow>

          {result.itinerario_narrativo && (
            <DisclosureRow
              icon={<ScrollText className="w-4 h-4" />}
              label="Itinerario narrativo"
              open={showNarrativa}
              onToggle={() => setShowNarrativa((prev) => !prev)}
            >
              <div className="pt-1 text-[15px] font-medium text-lomo-ink-secondary leading-[1.65] prose prose-sm max-w-none break-words">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.itinerario_narrativo}</ReactMarkdown>
              </div>
            </DisclosureRow>
          )}
        </div>

        {/* Secuencia de excursiones */}
        <section className="flex flex-col gap-1 flex-shrink-0" aria-label="Excursiones de la ruta">
          <div className="flex items-center justify-between gap-3 pt-2">
            <h3 className="text-xs font-bold tracking-[0.05em] uppercase text-lomo-ink-secondary">
              Tus {stops.length} {stops.length === 1 ? "excursión" : "excursiones"}
            </h3>
            <button
              type="button"
              onClick={() => setScoresModalOpen(true)}
              className="h-9 -mr-2 px-2.5 rounded-lg flex items-center gap-1.5 text-sm font-bold text-lomo-accent transition-colors hover:bg-lomo-surface-selected"
            >
              <Activity className="w-4 h-4" />
              <span>Ver scores difusos</span>
            </button>
          </div>

          <ol className="flex flex-col">
            {stops.map((loma, index) => {
              const riesgo = result.riesgos_ruta[loma.id] || 4.0;
              return (
                <li key={loma.id} className="border-b border-lomo-border last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onFocusLoma(loma)}
                    className="w-full py-3.5 flex items-center gap-3 text-left group transition-colors focus-visible:outline-none focus-visible:bg-lomo-surface-inset"
                  >
                    <span className="w-8 h-8 rounded-2xl bg-lomo-surface-inset flex items-center justify-center flex-shrink-0 text-sm font-extrabold text-lomo-ink-secondary tabular-nums transition-colors group-hover:bg-lomo-action-primary group-hover:text-lomo-on-action">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1 flex flex-col gap-0.5">
                      <span className="text-[16px] leading-tight font-extrabold text-lomo-ink-primary truncate">
                        {loma.nombre}
                      </span>
                      <span className="text-sm font-medium leading-tight text-lomo-ink-secondary truncate">
                        {loma.distrito} · S/ {loma.costo_estimado} · {loma.dificultad}
                      </span>
                    </span>
                    <span className="text-sm font-bold text-lomo-warning-ink flex-shrink-0 tabular-nums">
                      R {riesgo.toFixed(1)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      {/* Pie de panel · Reconfigurar mi ruta */}
      <div className="px-6 py-4 border-t border-lomo-border bg-lomo-surface flex flex-col gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onNewSearch}
          className="h-12 w-full bg-lomo-action-primary hover:bg-lomo-action-hover active:scale-[0.98] text-lomo-on-action text-[15px] font-bold rounded-lg flex items-center justify-center gap-2 transition-[background-color,transform] duration-150"
        >
          <RotateCcw className="w-4 h-4 text-lomo-on-action-muted" />
          <span>Reconfigurar mi ruta</span>
        </button>

        {stops.length > 0 && (
          <button
            type="button"
            onClick={() => onFocusLoma(stops[0])}
            className="h-11 w-full rounded-lg flex items-center justify-center gap-1.5 text-[15px] font-semibold text-lomo-ink-secondary transition-colors hover:bg-lomo-surface-inset"
          >
            <Compass className="w-4 h-4 text-lomo-ink-muted" />
            <span>Centrar en la primera parada</span>
          </button>
        )}
      </div>

      <FuzzyScoresModal
        open={scoresModalOpen}
        onOpenChange={setScoresModalOpen}
        lomas={lomas}
        routeIds={result.ruta_ids}
      />
    </div>
  );
};

export const RouteResultsPanel = memo(RouteResultsPanelComponent);
