import React, { useState, useRef, useEffect, useMemo, memo } from "react";
import {
  Search,
  X,
  SlidersHorizontal,
  MapPin,
  Compass,
  Sparkles,
  Mountain,
  Download,
  Calendar,
} from "lucide-react";
import type { Loma } from "../../types";
import { Badge } from "../ui/badge";
import { usePro } from "../../context/ProContext";

export type QuickFilterType =
  | "temporada"
  | "demo_pro"
  | "offline"
  | "naturales"
  | null;

interface FloatingSearchBarProps {
  lomas: Loma[];
  onSelectLoma: (loma: Loma) => void;
  isPlannerOpen: boolean;
  onTogglePlanner: () => void;
  hasActiveRoute: boolean;
  onOpenResults: () => void;
  activeFilter?: QuickFilterType;
  onFilterChange?: (filter: QuickFilterType) => void;
}

const FloatingSearchBarComponent: React.FC<FloatingSearchBarProps> = ({
  lomas,
  onSelectLoma,
  isPlannerOpen,
  onTogglePlanner,
  hasActiveRoute,
  onOpenResults,
  activeFilter: controlledFilter,
  onFilterChange,
}) => {
  const { openUpgradeModal, offlinePackIds, summitStamps } = usePro();
  const [searchTerm, setSearchTerm] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [localFilter, setLocalFilter] = useState<QuickFilterType>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeFilter = controlledFilter !== undefined ? controlledFilter : localFilter;

  const toggleFilter = (filter: QuickFilterType) => {
    const next = activeFilter === filter ? null : filter;
    if (onFilterChange) {
      onFilterChange(next);
    } else {
      setLocalFilter(next);
    }
  };

  const filteredLomas = useMemo(() => {
    let result = lomas;

    if (activeFilter === "temporada") {
      result = result.filter(
        (l) =>
          l.temporada_optima?.toLowerCase().includes("jun") ||
          l.temporada_optima?.toLowerCase().includes("jul") ||
          l.temporada_optima?.toLowerCase().includes("ago") ||
          l.temporada_optima?.toLowerCase().includes("sep") ||
          l.temporada_optima?.toLowerCase().includes("oct")
      );
    } else if (activeFilter === "demo_pro") {
      result = result.filter((l) => l.id === "L0" || l.pro_demo_gratis);
    } else if (activeFilter === "offline") {
      result = result.filter((l) => offlinePackIds.includes(l.id));
    } else if (activeFilter === "naturales") {
      result = result.filter((l) => l.es_loma_natural !== false);
    }

    if (!searchTerm.trim()) {
      return activeFilter ? result : [];
    }

    const term = searchTerm.toLowerCase();
    return result.filter(
      (l) =>
        l.nombre.toLowerCase().includes(term) ||
        l.distrito.toLowerCase().includes(term) ||
        l.dificultad.toLowerCase().includes(term)
    );
  }, [lomas, searchTerm, activeFilter, offlinePackIds]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (loma: Loma) => {
    onSelectLoma(loma);
    setSearchTerm("");
    setIsFocused(false);
  };

  return (
    <div
      ref={containerRef}
      className="absolute top-4 left-4 z-40 w-[92vw] sm:w-[460px] max-w-[460px] space-y-2"
    >
      <div className="flex items-center bg-card rounded-full shadow-panel px-3.5 py-2 border border-border transition-all focus-within:ring-2 focus-within:ring-ring focus-within:border-primary/50">
        <button
          onClick={onTogglePlanner}
          title={isPlannerOpen ? "Ocultar Planificador" : "Abrir Planificador de Rutas"}
          className={`p-2 rounded-full transition-colors active:scale-95 ${
            isPlannerOpen
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>

        <div className="flex-1 flex items-center px-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsFocused(true)}
            placeholder="Buscar lomas o distritos de Lima..."
            className="w-full text-sm text-foreground placeholder:text-muted-foreground bg-transparent focus:outline-none"
          />
        </div>

        {searchTerm ? (
          <button
            onClick={() => setSearchTerm("")}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <div className="p-1.5 text-muted-foreground">
            <Search className="w-4 h-4" />
          </div>
        )}

        {hasActiveRoute && (
          <>
            <div className="h-5 w-[1px] bg-border mx-1" />
            <button
              onClick={onOpenResults}
              title="Ver itinerario de ruta calculada"
              className="px-2.5 py-1 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-full transition-colors flex items-center gap-1 active:scale-95"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Ruta</span>
            </button>
          </>
        )}

        <div className="h-5 w-[1px] bg-border mx-1" />

        <button
          onClick={() => openUpgradeModal()}
          title="Ver Planes PRO y Pasaporte de Cumbres"
          className="px-3 py-1 text-xs font-bold text-amber-900 bg-amber-400 hover:bg-amber-300 rounded-full transition-all flex items-center gap-1 shadow-sm active:scale-95 shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>PRO</span>
          {summitStamps.length > 0 && (
            <span className="ml-0.5 px-1 rounded-full bg-slate-900 text-white text-[10px]">
              {summitStamps.length}
            </span>
          )}
        </button>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 px-1">
        <button
          onClick={() => toggleFilter("temporada")}
          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all flex items-center gap-1 whitespace-nowrap active:scale-95 ${
            activeFilter === "temporada"
              ? "bg-primary text-primary-foreground border-primary shadow-sm"
              : "bg-card/90 backdrop-blur-sm text-foreground border-border hover:bg-secondary"
          }`}
        >
          <Calendar className="w-3 h-3" />
          <span>En Temporada</span>
        </button>

        <button
          onClick={() => toggleFilter("demo_pro")}
          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all flex items-center gap-1 whitespace-nowrap active:scale-95 ${
            activeFilter === "demo_pro"
              ? "bg-primary text-primary-foreground border-primary shadow-sm"
              : "bg-card/90 backdrop-blur-sm text-foreground border-border hover:bg-secondary"
          }`}
        >
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>Demo Pro Gratis (Paraiso)</span>
        </button>

        <button
          onClick={() => toggleFilter("offline")}
          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all flex items-center gap-1 whitespace-nowrap active:scale-95 ${
            activeFilter === "offline"
              ? "bg-primary text-primary-foreground border-primary shadow-sm"
              : "bg-card/90 backdrop-blur-sm text-foreground border-border hover:bg-secondary"
          }`}
        >
          <Download className="w-3 h-3" />
          <span>Descargadas Offline ({offlinePackIds.length})</span>
        </button>

        <button
          onClick={() => toggleFilter("naturales")}
          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all flex items-center gap-1 whitespace-nowrap active:scale-95 ${
            activeFilter === "naturales"
              ? "bg-primary text-primary-foreground border-primary shadow-sm"
              : "bg-card/90 backdrop-blur-sm text-foreground border-border hover:bg-secondary"
          }`}
        >
          <Mountain className="w-3 h-3 text-emerald-600" />
          <span>Solo Lomas Naturales</span>
        </button>
      </div>

      {(isFocused || activeFilter !== null) && (filteredLomas.length > 0 || searchTerm.trim()) && (
        <div className="mt-1 bg-card rounded-2xl shadow-panel border border-border overflow-hidden max-h-80 overflow-y-auto custom-scrollbar animate-in fade-in-50 duration-150">
          {filteredLomas.length > 0 ? (
            <div className="py-2">
              <div className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Lomas Encontradas ({filteredLomas.length})</span>
                {activeFilter && (
                  <button
                    onClick={() => toggleFilter(null)}
                    className="text-[10px] text-primary hover:underline lowercase font-normal"
                  >
                    limpiar filtro
                  </button>
                )}
              </div>
              {filteredLomas.map((loma) => (
                <button
                  key={loma.id}
                  onClick={() => handleSelect(loma)}
                  className="w-full text-left px-4 py-2.5 hover:bg-secondary/70 flex items-center justify-between transition-colors border-b border-border/40 last:border-none group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 transition-transform group-hover:scale-105">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 truncate">
                      <div className="text-sm font-semibold text-foreground leading-tight truncate">
                        {loma.nombre}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {loma.distrito} · {loma.temporada_optima || "Jun - Oct"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {loma.id === "L0" && (
                      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                        Demo PRO
                      </Badge>
                    )}
                    {offlinePackIds.includes(loma.id) && (
                      <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">
                        Offline
                      </Badge>
                    )}
                    <Badge
                      variant={
                        loma.dificultad === "Facil" || loma.dificultad === "Fácil"
                          ? "success"
                          : loma.dificultad === "Moderado"
                          ? "warning"
                          : "destructive"
                      }
                      className="text-xs"
                    >
                      {loma.dificultad}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No se encontraron lomas para la seleccion actual.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const FloatingSearchBar = memo(FloatingSearchBarComponent);
