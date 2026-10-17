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
          className="h-11 px-4 bg-white border border-slate-200 shadow-md rounded-2xl flex items-center gap-2.5 text-slate-900 hover:bg-slate-50 transition-all active:scale-95 group"
          title="Abrir explorador de lomas"
        >
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            <Mountain className="w-4 h-4" />
          </div>
          <span className="text-sm font-bold tracking-tight text-slate-900">Lomosoma</span>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    );
  }

  return (
    <aside className="absolute top-3 left-3 bottom-3 z-30 w-[94vw] sm:w-[420px] md:w-[440px] max-w-[440px] flex flex-col bg-white border border-slate-200/90 rounded-2xl shadow-panel overflow-hidden transition-all duration-200 pointer-events-auto">
      {/* Barra de Marca y Estado Superior */}
      <header className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between bg-white flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
            <Mountain className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight text-slate-900">
                Lomosoma
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-primary/10 text-primary">
                2.0
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span
                className={`w-2 h-2 rounded-full ${
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
            className="px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-400 hover:bg-amber-300 rounded-full transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            title="Ver Planes PRO y Pasaporte de Cumbres"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>PRO</span>
          </button>
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Colapsar panel lateral"
          >
            <ChevronLeft className="w-5 h-5" />
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
        <div className="flex-1 min-h-0 flex flex-col bg-white">
          {/* Cabecera de Busqueda y Accion */}
          <div className="p-3.5 space-y-3 border-b border-slate-200 bg-white flex-shrink-0">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por loma o distrito..."
                className="w-full pl-10 pr-9 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 placeholder:text-slate-400 transition-all font-medium"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 p-1 text-slate-400 hover:text-slate-700"
                  title="Limpiar busqueda"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Botones de Accion Rapida */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => onChangeView("planner")}
                className="flex-1 h-9 text-xs sm:text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl gap-2 shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                <span>Planificar Ruta con IA</span>
              </Button>

              {optimizationResult && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onChangeView("results")}
                  className="h-9 text-xs sm:text-sm font-semibold border-primary/40 text-primary hover:bg-primary/10 rounded-xl gap-1.5"
                  title="Ver ultima ruta calculada"
                >
                  <Route className="w-4 h-4" />
                  <span>Ruta Activa</span>
                </Button>
              )}
            </div>

            {/* Chips de Filtro Rapido */}
            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 text-xs">
              <button
                onClick={() => toggleFilter("temporada")}
                className={`px-3 py-1.5 rounded-xl border font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap active:scale-95 ${
                  activeFilter === "temporada"
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>En Temporada</span>
              </button>
              <button
                onClick={() => toggleFilter("demo_pro")}
                className={`px-3 py-1.5 rounded-xl border font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap active:scale-95 ${
                  activeFilter === "demo_pro"
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Demo Gratis</span>
              </button>
              <button
                onClick={() => toggleFilter("offline")}
                className={`px-3 py-1.5 rounded-xl border font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap active:scale-95 ${
                  activeFilter === "offline"
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Offline ({offlinePackIds.length})</span>
              </button>
              <button
                onClick={() => toggleFilter("naturales")}
                className={`px-3 py-1.5 rounded-xl border font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap active:scale-95 ${
                  activeFilter === "naturales"
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Mountain className="w-3.5 h-3.5" />
                <span>Naturales</span>
              </button>
            </div>
          </div>

          {/* Contador de Resultados */}
          <div className="px-4 py-2.5 flex items-center justify-between text-xs font-medium text-slate-500 bg-slate-50 border-b border-slate-200/80 flex-shrink-0">
            <span>
              Mostrando {filteredLomas.length} de {lomas.length} lomas
            </span>
            {activeFilter && (
              <button
                onClick={() => onFilterChange(null)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Limpiar filtro
              </button>
            )}
          </div>

          {/* Lista de Tarjetas de Lomas */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 space-y-2.5 bg-slate-50/40">
            {filteredLomas.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2.5">
                <Mountain className="w-10 h-10 mx-auto opacity-30" />
                <p className="text-sm font-medium">No se encontraron lomas con este filtro.</p>
                <button
                  onClick={() => {
                    setSearchTerm("");
                    onFilterChange(null);
                  }}
                  className="text-xs sm:text-sm text-primary font-bold hover:underline"
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
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer group ${
                      isSelected
                        ? "bg-emerald-50/70 border-2 border-primary shadow-sm"
                        : "bg-white border-slate-200 hover:border-primary/50 hover:bg-slate-50/60 shadow-sm"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-primary transition-colors truncate">
                            {loma.nombre}
                          </h4>
                          {loma.id === "L0" && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-800 border border-amber-500/30">
                              Demo Gratis
                            </span>
                          )}
                          {isOffline && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-800 border border-emerald-500/30">
                              Offline
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-500 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="truncate">{loma.distrito}</span>
                          <span>·</span>
                          <span className="font-mono font-medium">{loma.altitud_max_msnm} msnm</span>
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
                        className="text-xs px-2.5 py-0.5 shrink-0 font-semibold"
                      >
                        {loma.dificultad}
                      </Badge>
                    </div>

                    {/* Chips de Condiciones en Vivo */}
                    <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-slate-100 text-xs text-slate-600 flex-wrap">
                      {colchon !== undefined && (
                        <span className="flex items-center gap-1.5 font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                          <Cloud className="w-3 h-3 text-emerald-600" />
                          <span>{colchon}% nubes</span>
                        </span>
                      )}
                      {floracion && (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 truncate max-w-[200px]">
                          <Flower2 className="w-3 h-3 text-amber-600 shrink-0" />
                          <span className="truncate">{floracion}</span>
                        </span>
                      )}
                      <span className="ml-auto text-xs sm:text-sm text-primary group-hover:translate-x-0.5 transition-transform flex items-center font-bold">
                        Ver ficha
                        <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
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
