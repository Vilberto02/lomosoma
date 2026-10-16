import { useState, useMemo, memo } from "react";
import type {
  Loma,
  Coordenadas,
  PresetZona,
  UserPreferencesRequest,
  OptimizationResult,
} from "../../types";
import {
  Mountain,
  Search,
  X,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Download,
  MapPin,
  Route,
  Cloud,
  Flower2,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { usePro } from "../../context/ProContext";
import { LomaDetailSheet } from "../Panels/LomaDetailSheet";
import { RoutePlannerPanel } from "../Panels/RoutePlannerPanel";
import { RouteResultsPanel } from "../Panels/RouteResultsPanel";

export type QuickFilterType =
  | "temporada"
  | "demo_pro"
  | "offline"
  | "naturales"
  | null;

export type SidebarView = "catalog" | "detail" | "planner" | "results";

interface AppSidebarProps {
  lomas: Loma[];
  selectedLoma: Loma | null;
  onSelectLoma: (loma: Loma) => void;
  onBackToCatalog: () => void;
  userCoords: Coordenadas;
  onUserCoordsChange: (coords: Coordenadas) => void;
  presets: PresetZona[];
  onOptimize: (prefs: UserPreferencesRequest) => Promise<void>;
  optimizationResult: OptimizationResult | null;
  isLoading: boolean;
  lastPrefs: UserPreferencesRequest | null;
  onNewSearch: () => void;
  backendOnline: boolean;
  isBrowserOnline: boolean;
  activeFilter: QuickFilterType;
  onFilterChange: (filter: QuickFilterType) => void;
  onFocusMap: (coords: Coordenadas) => void;
  onSetAsStartPoint: (coords: Coordenadas) => void;
  activeView: SidebarView;
  onChangeView: (view: SidebarView) => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export const AppSidebar = memo(function AppSidebar({
  lomas,
  selectedLoma,
  onSelectLoma,
  onBackToCatalog,
  userCoords,
  onUserCoordsChange,
  presets,
  onOptimize,
  optimizationResult,
  isLoading,
  lastPrefs,
  onNewSearch,
  backendOnline,
  isBrowserOnline,
  activeFilter,
  onFilterChange,
  onFocusMap,
  onSetAsStartPoint,
  activeView,
  onChangeView,
  isSidebarCollapsed,
  onToggleSidebar,
}: AppSidebarProps) {
  const { openUpgradeModal, offlinePackIds } = usePro();
  const [searchTerm, setSearchTerm] = useState("");

  const toggleFilter = (filter: QuickFilterType) => {
    const next = activeFilter === filter ? null : filter;
    onFilterChange(next);
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

    if (!searchTerm.trim()) return result;

    const term = searchTerm.toLowerCase();
    return result.filter(
      (l) =>
        l.nombre.toLowerCase().includes(term) ||
        l.distrito.toLowerCase().includes(term) ||
        l.dificultad.toLowerCase().includes(term)
    );
  }, [lomas, searchTerm, activeFilter, offlinePackIds]);

  if (isSidebarCollapsed) {
    return (
      <div className="absolute top-4 left-4 z-30 flex items-center gap-2 pointer-events-auto">
        <button
          onClick={onToggleSidebar}
          className="h-11 px-3.5 bg-card/95 backdrop-blur-xl border border-border shadow-panel rounded-2xl flex items-center gap-2 text-foreground hover:bg-secondary transition-all active:scale-95 group"
          title="Abrir explorador de lomas"
        >
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            <Mountain className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold tracking-tight">Lomosoma</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    );
  }

  return (
    <aside className="absolute top-3 left-3 bottom-3 z-30 w-[94vw] sm:w-[420px] md:w-[440px] max-w-[440px] flex flex-col bg-card/98 backdrop-blur-2xl border border-border/80 rounded-2xl shadow-panel overflow-hidden transition-all duration-200 pointer-events-auto">
      {/* Barra de Marca y Estado Superior */}
      <header className="px-4 py-3 border-b border-border/70 flex items-center justify-between bg-card/50 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
            <Mountain className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tracking-tight text-foreground">
                Lomosoma
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-primary/15 text-primary">
                2.0
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  backendOnline && isBrowserOnline
                    ? "bg-primary animate-pulse"
                    : "bg-destructive"
                }`}
              />
              <span>
                {!isBrowserOnline
                  ? "Modo Sin Senal"
                  : backendOnline
                  ? "Servidor Conectado"
                  : "Modo Local"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => openUpgradeModal()}
            className="px-2.5 py-1 text-xs font-bold text-amber-900 bg-amber-400 hover:bg-amber-300 rounded-full transition-all flex items-center gap-1 shadow-sm active:scale-95"
            title="Ver Planes PRO y Pasaporte de Cumbres"
          >
            <Sparkles className="w-3 h-3" />
            <span>PRO</span>
          </button>
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Colapsar panel lateral"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Contenido Dinamico Segun Vista Activa */}
      {activeView === "detail" && selectedLoma ? (
        <LomaDetailSheet
          isEmbedded={true}
          loma={selectedLoma}
          onClose={onBackToCatalog}
          onSetAsStartPoint={onSetAsStartPoint}
          onFocusMap={onFocusMap}
        />
      ) : activeView === "planner" ? (
        <RoutePlannerPanel
          isEmbedded={true}
          isOpen={true}
          onClose={onBackToCatalog}
          userCoords={userCoords}
          onUserCoordsChange={onUserCoordsChange}
          presets={presets}
          onOptimize={onOptimize}
          isLoading={isLoading}
        />
      ) : activeView === "results" && optimizationResult ? (
        <RouteResultsPanel
          isEmbedded={true}
          isOpen={true}
          onClose={onBackToCatalog}
          result={optimizationResult}
          lomas={lomas}
          prefs={lastPrefs}
          onFocusLoma={onSelectLoma}
          onNewSearch={onNewSearch}
        />
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Cabecera de Busqueda y Accion */}
          <div className="p-3.5 space-y-2.5 border-b border-border/60 bg-card/40 flex-shrink-0">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 absolute left-3 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por loma o distrito..."
                className="w-full pl-9 pr-8 py-2 text-xs bg-secondary/50 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 p-0.5 text-muted-foreground hover:text-foreground"
                  title="Limpiar busqueda"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Botones de Accion Rapida */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => onChangeView("planner")}
                className="flex-1 h-8 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl gap-1.5 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Planificar Ruta con IA</span>
              </Button>

              {optimizationResult && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onChangeView("results")}
                  className="h-8 text-xs font-semibold border-primary/40 text-primary hover:bg-primary/10 rounded-xl gap-1.5"
                  title="Ver ultima ruta calculada"
                >
                  <Route className="w-3.5 h-3.5" />
                  <span>Ruta Activa</span>
                </Button>
              )}
            </div>

            {/* Chips de Filtro Rapido */}
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 text-[11px]">
              <button
                onClick={() => toggleFilter("temporada")}
                className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 transition-all whitespace-nowrap active:scale-95 ${
                  activeFilter === "temporada"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/40 text-muted-foreground border-border/70 hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Calendar className="w-3 h-3" />
                <span>En Temporada</span>
              </button>
              <button
                onClick={() => toggleFilter("demo_pro")}
                className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 transition-all whitespace-nowrap active:scale-95 ${
                  activeFilter === "demo_pro"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/40 text-muted-foreground border-border/70 hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Demo Gratis</span>
              </button>
              <button
                onClick={() => toggleFilter("offline")}
                className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 transition-all whitespace-nowrap active:scale-95 ${
                  activeFilter === "offline"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/40 text-muted-foreground border-border/70 hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Download className="w-3 h-3" />
                <span>Offline ({offlinePackIds.length})</span>
              </button>
              <button
                onClick={() => toggleFilter("naturales")}
                className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 transition-all whitespace-nowrap active:scale-95 ${
                  activeFilter === "naturales"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/40 text-muted-foreground border-border/70 hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Mountain className="w-3 h-3" />
                <span>Naturales</span>
              </button>
            </div>
          </div>

          {/* Contador de Resultados */}
          <div className="px-4 py-2 flex items-center justify-between text-[11px] text-muted-foreground bg-secondary/20 flex-shrink-0">
            <span>
              Mostrando {filteredLomas.length} de {lomas.length} lomas
            </span>
            {activeFilter && (
              <button
                onClick={() => onFilterChange(null)}
                className="text-primary hover:underline font-medium"
              >
                Limpiar filtro
              </button>
            )}
          </div>

          {/* Lista de Tarjetas de Lomas */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 space-y-2">
            {filteredLomas.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground space-y-2">
                <Mountain className="w-8 h-8 mx-auto opacity-30" />
                <p className="text-xs">No se encontraron lomas con este filtro.</p>
                <button
                  onClick={() => {
                    setSearchTerm("");
                    onFilterChange(null);
                  }}
                  className="text-xs text-primary font-semibold hover:underline"
                >
                  Restablecer filtros
                </button>
              </div>
            ) : (
              filteredLomas.map((loma) => {
                const isSelected = selectedLoma?.id === loma.id;
                const isOffline = offlinePackIds.includes(loma.id);
                const colchon = loma.lomacast_resumen?.probabilidad_colchon_hoy_pct;
                const floracion = loma.lomacast_resumen?.fase_floracion_nombre;

                return (
                  <div
                    key={loma.id}
                    onClick={() => onSelectLoma(loma)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer group ${
                      isSelected
                        ? "bg-primary/10 border-primary ring-2 ring-primary/20 shadow-sm"
                        : "bg-card border-border/70 hover:bg-secondary/40 hover:border-primary/40 shadow-sm"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                            {loma.nombre}
                          </h4>
                          {loma.id === "L0" && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-800 border border-amber-500/30">
                              Demo Gratis
                            </span>
                          )}
                          {isOffline && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-800 border border-emerald-500/30">
                              Offline
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                          <MapPin className="w-3 h-3 text-primary shrink-0" />
                          <span className="truncate">{loma.distrito}</span>
                          <span>·</span>
                          <span className="font-mono">{loma.altitud_max_msnm} msnm</span>
                        </div>
                      </div>

                      <Badge
                        variant={
                          loma.dificultad === "Facil" || loma.dificultad === "Fácil"
                            ? "success"
                            : loma.dificultad === "Moderado"
                            ? "warning"
                            : "destructive"
                        }
                        className="text-[10px] px-1.5 py-0.2 shrink-0 font-semibold"
                      >
                        {loma.dificultad}
                      </Badge>
                    </div>

                    {/* Chips de Condiciones en Vivo */}
                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/40 text-[10px] text-muted-foreground flex-wrap">
                      {colchon !== undefined && (
                        <span className="flex items-center gap-1 font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          <Cloud className="w-2.5 h-2.5" />
                          <span>{colchon}% nubes</span>
                        </span>
                      )}
                      {floracion && (
                        <span className="flex items-center gap-1 text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 truncate max-w-[170px]">
                          <Flower2 className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                          <span className="truncate">{floracion}</span>
                        </span>
                      )}
                      <span className="ml-auto text-[10px] text-primary group-hover:translate-x-0.5 transition-transform flex items-center font-semibold">
                        Ver ficha
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </aside>
  );
});
