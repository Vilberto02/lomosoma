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
  ChevronRight,
  SlidersHorizontal,
  Cloud,
  ChevronDown,
  Bookmark,
  Route,
  ArrowRight,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { usePro } from "../../context/ProContext";
import { LomaDetailSheet } from "../Panels/LomaDetailSheet";
import { RoutePlannerPanel } from "../Panels/RoutePlannerPanel";
import { RouteResultsPanel } from "../Panels/RouteResultsPanel";

export type QuickFilterType =
  | "temporada"
  | "demo_pro"
  | "offline"
  | "dificultad"
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
  isGuardianVisible?: boolean;
  onToggleGuardian?: () => void;
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
  backendOnline: _backendOnline,
  isBrowserOnline: _isBrowserOnline,
  activeFilter,
  onFilterChange,
  onFocusMap,
  onSetAsStartPoint,
  activeView,
  onChangeView,
  isSidebarCollapsed,
  onToggleSidebar,
  isGuardianVisible = false,
  onToggleGuardian,
}: AppSidebarProps) {
  const { openUpgradeModal } = usePro();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"explorar" | "guardados" | "rutas">("explorar");
  const [savedLomaIds, setSavedLomaIds] = useState<string[]>(["L0"]);
  const [sortOrder, setSortOrder] = useState<"recomendadas" | "altitud" | "nombre">("recomendadas");
  const [showDificultadMenu, setShowDificultadMenu] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);

  const toggleSaveById = (id: string) => {
    setSavedLomaIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSaveLoma = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleSaveById(id);
  };

  const filteredLomas = useMemo(() => {
    let result = lomas;

    if (activeTab === "guardados") {
      result = result.filter(l => savedLomaIds.includes(l.id));
    }

    if (activeFilter === "temporada") {
      result = result.filter(
        (l) =>
          l.temporada_optima?.toLowerCase().includes("jun") ||
          l.temporada_optima?.toLowerCase().includes("jul") ||
          l.temporada_optima?.toLowerCase().includes("ago") ||
          l.temporada_optima?.toLowerCase().includes("sep") ||
          l.temporada_optima?.toLowerCase().includes("oct")
      );
    }

    if (selectedDifficulty) {
      result = result.filter(
        (l) => l.dificultad.toLowerCase().includes(selectedDifficulty.toLowerCase())
      );
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (l) =>
          l.nombre.toLowerCase().includes(term) ||
          l.distrito.toLowerCase().includes(term) ||
          l.dificultad.toLowerCase().includes(term)
      );
    }

    if (sortOrder === "altitud") {
      result = [...result].sort((a, b) => (b.altitud_max_msnm ?? 0) - (a.altitud_max_msnm ?? 0));
    } else if (sortOrder === "nombre") {
      result = [...result].sort((a, b) => a.nombre.localeCompare(b.nombre));
    }

    return result;
  }, [lomas, searchTerm, activeFilter, selectedDifficulty, activeTab, savedLomaIds, sortOrder]);

  // Solo se muestra como seleccionada cuando el usuario elige explícitamente una loma
  const effectiveSelectedLoma = selectedLoma;

  if (isSidebarCollapsed) {
    return (
      <div className="absolute top-4 left-4 z-30 pointer-events-auto">
        <button
          onClick={onToggleSidebar}
          className="h-12 px-4 bg-white border border-[#E4E9DE] shadow-lomo-panel rounded-2xl flex items-center gap-2.5 text-[#203B2E] hover:bg-[#F3F5F0] transition-all active:scale-95 group"
          title="Abrir explorador de lomas"
        >
          <div className="w-8 h-8 rounded-lg bg-[#2E6540] flex items-center justify-center text-white">
            <Mountain className="w-4 h-4" />
          </div>
          <span className="text-base font-extrabold tracking-tight text-[#203B2E]">lomosoma</span>
          <PanelLeft className="w-4 h-4 text-[#546349] group-hover:text-[#203B2E] transition-colors ml-1" />
        </button>
      </div>
    );
  }

  return (
    <aside className="absolute top-4 bottom-4 left-4 z-30 w-[94vw] sm:w-[448px] max-w-[448px] flex flex-col bg-white border border-[#E4E9DE] rounded-[20px] shadow-lomo-panel overflow-hidden transition-all duration-200 pointer-events-auto">
      
      {/* 01 · Cabecera / App (ChnVo: 392x64 px) */}
      <header className="h-16 px-6 border-b border-[#E4E9DE] flex items-center justify-between bg-white flex-shrink-0">
        <div className="flex items-center gap-2.5">
          {/* Símbolo Lomosoma (wYYgT: 32x32 px, radius 8) */}
          <div className="w-8 h-8 rounded-lg bg-[#2E6540] flex items-center justify-center shadow-sm text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
            </svg>
          </div>
          {/* Marca (jQnN6: text-20 weight-800) */}
          <span className="text-[22px] font-black tracking-tight text-[#203B2E] lowercase select-none">
            lomosoma
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Acceso PRO (jyTG4: fill $lomo-surface-inset, radius 8) */}
          <button
            onClick={() => openUpgradeModal()}
            className="px-3 py-1.5 text-sm font-bold tracking-wider text-[#3E5238] bg-[#F3F5F0] hover:bg-[#E4E9DE] rounded-lg transition-all flex items-center gap-1.5 active:scale-95 border border-[#E4E9DE]"
            title="Suscripción y Acceso Pro"
          >
            <Sparkles className="w-4 h-4 text-[#2E6540]" />
            <span>PRO</span>
          </button>
          
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg text-[#546349] hover:text-[#203B2E] hover:bg-[#F3F5F0] transition-colors"
            title="Minimizar panel"
          >
            <PanelLeftClose className="w-4 h-4" />
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
          isSaved={savedLomaIds.includes(selectedLoma.id)}
          onToggleSave={() => toggleSaveById(selectedLoma.id)}
          isGuardianActive={isGuardianVisible}
          onToggleGuardian={onToggleGuardian}
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
        /* VISTA 1: Lomosoma · Explorar / navegación */
        <div className="flex-1 min-h-0 flex flex-col bg-white">
          
          {/* Navegación principal (LHsTS: 392x44 px, tabs con border-b) */}
          <nav className="h-12 px-6 border-b border-[#E4E9DE] flex items-center flex-shrink-0 bg-white">
            <button
              onClick={() => setActiveTab("explorar")}
              className={`flex-1 h-full flex items-center justify-center text-[15px] tracking-tight transition-colors border-b-2 ${
                activeTab === "explorar"
                  ? "border-[#2E6540] text-[#2E6540] font-extrabold"
                  : "border-transparent text-[#546349] font-semibold hover:text-[#203B2E]"
              }`}
            >
              Explorar
            </button>
            <button
              onClick={() => setActiveTab("guardados")}
              className={`flex-1 h-full flex items-center justify-center text-[15px] tracking-tight transition-colors border-b-2 ${
                activeTab === "guardados"
                  ? "border-[#2E6540] text-[#2E6540] font-extrabold"
                  : "border-transparent text-[#546349] font-semibold hover:text-[#203B2E]"
              }`}
            >
              Guardados
            </button>
            <button
              onClick={() => {
                if (optimizationResult) {
                  onChangeView("results");
                } else {
                  onChangeView("planner");
                }
              }}
              className="flex-1 h-full flex items-center justify-center text-[15px] font-semibold tracking-tight text-[#546349] hover:text-[#203B2E] transition-colors border-b-2 border-transparent"
            >
              Mis rutas
            </button>
          </nav>

          {/* Buscar una escapada (XObx7: padding [16, 24, 12, 24]) */}
          <div className="px-6 pt-4 pb-3 flex flex-col gap-3 flex-shrink-0 bg-white">
            
            {/* Título y contexto (n1jvM) */}
            <div className="flex flex-col gap-0.5">
              <h2 className="text-[26px] font-extrabold tracking-[-0.025em] text-[#203B2E] leading-tight">
                Tu próxima escapada.
              </h2>
              <p className="text-[15px] text-[#3E5238] font-semibold">
                Descubre las lomas de Lima.
              </p>
            </div>

            {/* Input Buscar lomas o distritos (MEwxM: h-46, fill $lomo-surface-inset, radius 12) */}
            <div className="h-12 px-4 bg-[#F3F5F0] border border-[#E4E9DE] rounded-xl flex items-center gap-2.5 focus-within:border-[#2E6540] focus-within:ring-2 focus-within:ring-[#2E6540]/15 transition-all">
              <Search className="w-5 h-5 text-[#546349] flex-shrink-0" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Busca una loma o distrito"
                className="w-full bg-transparent border-none text-base font-medium text-[#203B2E] placeholder:text-[#546349] focus:outline-none"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="p-1 text-[#546349] hover:text-[#203B2E]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filtros visibles (h-40 px chips) */}
            <div className="flex items-center gap-2 relative">
              {/* En temporada */}
              <button
                onClick={() => onFilterChange(activeFilter === "temporada" ? null : "temporada")}
                className={`h-10 px-3.5 rounded-lg border text-sm font-bold flex items-center gap-2 transition-all active:scale-95 ${
                  activeFilter === "temporada"
                    ? "bg-[#F0F5ED] text-[#2E6540] border-[#CAD9BE]"
                    : "bg-[#F3F5F0] text-[#3E5238] border-transparent hover:border-[#E4E9DE]"
                }`}
              >
                <Sparkles className="w-4 h-4 text-[#546349]" />
                <span>En temporada</span>
              </button>

              {/* Dificultad Dropdown Chip */}
              <div className="relative">
                <button
                  onClick={() => setShowDificultadMenu(prev => !prev)}
                  className={`h-10 px-3.5 rounded-lg border text-sm font-bold flex items-center gap-2 transition-all active:scale-95 ${
                    selectedDifficulty
                      ? "bg-[#F0F5ED] text-[#2E6540] border-[#CAD9BE]"
                      : "bg-white text-[#3E5238] border-[#E4E9DE] hover:bg-[#F3F5F0]"
                  }`}
                >
                  <Mountain className="w-4 h-4 text-[#546349]" />
                  <span>{selectedDifficulty || "Dificultad"}</span>
                </button>

                {showDificultadMenu && (
                  <div className="absolute left-0 top-12 z-50 bg-white border border-[#E4E9DE] rounded-xl shadow-lomo-panel p-1.5 min-w-[150px] flex flex-col gap-1">
                    <button
                      onClick={() => { setSelectedDifficulty(null); setShowDificultadMenu(false); }}
                      className="text-left text-sm px-3 py-2 rounded-lg hover:bg-[#F3F5F0] text-[#203B2E] font-semibold"
                    >
                      Todas
                    </button>
                    <button
                      onClick={() => { setSelectedDifficulty("Fácil"); setShowDificultadMenu(false); }}
                      className="text-left text-sm px-3 py-2 rounded-lg hover:bg-[#F3F5F0] text-[#2E6540] font-bold"
                    >
                      Fácil
                    </button>
                    <button
                      onClick={() => { setSelectedDifficulty("Moderado"); setShowDificultadMenu(false); }}
                      className="text-left text-sm px-3 py-2 rounded-lg hover:bg-[#F3F5F0] text-[#82642F] font-bold"
                    >
                      Moderado
                    </button>
                    <button
                      onClick={() => { setSelectedDifficulty("Difícil"); setShowDificultadMenu(false); }}
                      className="text-left text-sm px-3 py-2 rounded-lg hover:bg-[#F3F5F0] text-rose-700 font-bold"
                    >
                      Difícil
                    </button>
                  </div>
                )}
              </div>

              {/* Más filtros */}
              <button
                onClick={() => {
                  setSortOrder(prev => prev === "recomendadas" ? "altitud" : prev === "altitud" ? "nombre" : "recomendadas");
                }}
                className="w-10 h-10 rounded-lg border border-[#E4E9DE] bg-white flex items-center justify-center text-[#546349] hover:text-[#203B2E] hover:bg-[#F3F5F0] transition-colors ml-auto"
                title={`Ordenar por: ${sortOrder}`}
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Resultados de lomas (S0SZT) */}
          <div className="flex-1 min-h-0 flex flex-col px-4">
            
            {/* Conteo y orden (ur3sI) */}
            <div className="px-2 py-2 flex items-center justify-between text-sm text-[#3E5238] font-semibold flex-shrink-0">
              <span>{filteredLomas.length} lomas para explorar</span>
              <button
                type="button"
                onClick={() =>
                  setSortOrder((prev) =>
                    prev === "recomendadas"
                      ? "altitud"
                      : prev === "altitud"
                      ? "nombre"
                      : "recomendadas"
                  )
                }
                className="flex items-center gap-1 text-[#3E5238] hover:text-[#203B2E] font-bold"
              >
                <span>
                  {sortOrder === "recomendadas"
                    ? "Recomendadas"
                    : sortOrder === "altitud"
                    ? "Por altitud"
                    : "Alfabético"}
                </span>
                <ChevronDown className="w-4 h-4 text-[#546349]" />
              </button>
            </div>

            {/* Listado con scrollbar */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2.5 pb-3 pr-0.5">
              {filteredLomas.length === 0 ? (
                <div className="py-12 text-center text-[#546349] space-y-2">
                  <Mountain className="w-8 h-8 mx-auto opacity-30 text-[#203B2E]" />
                  <p className="text-[15px] font-semibold">No se encontraron lomas con estos filtros.</p>
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setSelectedDifficulty(null);
                      onFilterChange(null);
                    }}
                    className="text-[15px] text-[#2E6540] font-bold underline"
                  >
                    Restablecer búsqueda
                  </button>
                </div>
              ) : (
                filteredLomas.map((loma, idx) => {
                  const isSelected = effectiveSelectedLoma?.id === loma.id;
                  const isSaved = savedLomaIds.includes(loma.id);
                  const colchon = loma.lomacast_resumen?.probabilidad_colchon_hoy_pct ?? 67;

                  if (isSelected) {
                    /* CARD SELECCIONADA (Seleccionada · Lomas del Paraíso) */
                    return (
                      <div
                        key={loma.id}
                        className="p-4 bg-[#F0F5ED] border border-[#CAD9BE] rounded-2xl flex flex-col gap-2.5 transition-all shadow-sm"
                      >
                        {/* Selección y guardar */}
                        <div className="flex items-center justify-between text-xs font-extrabold tracking-wider text-[#3E5238]">
                          <span className="tabular-nums">
                            {String(idx + 1).padStart(2, "0")} &nbsp;/&nbsp; SELECCIONADA
                          </span>
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={(e) => toggleSaveLoma(loma.id, e)}
                              className="p-1 rounded-md text-[#546349] hover:text-[#203B2E] hover:bg-white/60 transition-colors"
                              title={isSaved ? "Quitar de guardados" : "Guardar loma"}
                              aria-label={isSaved ? "Quitar de guardados" : "Guardar loma"}
                            >
                              <Bookmark
                                className={`w-4 h-4 ${
                                  isSaved ? "fill-[#2E6540] text-[#2E6540]" : ""
                                }`}
                              />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onBackToCatalog();
                              }}
                              className="p-1 rounded-md text-[#546349] hover:text-[#203B2E] hover:bg-white/60 transition-colors"
                              title="Cerrar selección"
                              aria-label="Cerrar selección"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Nombre y Distrito */}
                        <div>
                          <h3 className="text-[19px] font-extrabold text-[#203B2E] leading-tight">
                            {loma.nombre}
                          </h3>
                          <p className="text-[15px] text-[#3E5238] font-semibold mt-0.5">
                            {loma.distrito} {loma.id === "L0" ? "· Apu Siqay" : ""}
                          </p>
                        </div>

                        {/* Altitud y Dificultad */}
                        <div className="flex items-center gap-3 text-sm font-semibold text-[#3E5238] mt-1 tabular-nums">
                          <div className="flex items-center gap-1">
                            <Mountain className="w-4 h-4 text-[#546349]" />
                            <span>{(loma.altitud_max_msnm ?? 0).toLocaleString()} msnm</span>
                          </div>

                          <div className="flex items-center gap-1 font-bold text-[#82642F] bg-[#F8F3E7] px-2.5 py-0.5 rounded-md border border-[#E4D8BB]">
                            <span>{loma.dificultad}</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <Cloud className="w-4 h-4 text-[#546349]" />
                            <span>{colchon}% nubes</span>
                          </div>
                        </div>

                        {/* Acciones de loma */}
                        <div className="flex items-center gap-2 mt-2 pt-2.5 border-t border-[#CAD9BE]/60">
                          <button
                            onClick={() => {
                              onSelectLoma(loma);
                              onChangeView("detail");
                            }}
                            className="flex-1 h-11 bg-[#243C2D] hover:bg-[#192b20] text-white text-[15px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] shadow-sm"
                          >
                            <span>Ver ficha</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onFocusMap(loma.coordenadas)}
                            className="h-11 px-4 bg-white border border-[#CAD9BE] hover:bg-[#F3F5F0] text-[#3E5238] text-[15px] font-bold rounded-lg transition-all"
                          >
                            Centrar
                          </button>
                        </div>
                      </div>
                    );
                  }

                  /* CARD NORMAL */
                  return (
                    <div
                      key={loma.id}
                      onClick={() => onSelectLoma(loma)}
                      className="p-4 bg-white border border-[#E4E9DE] hover:border-[#CAD9BE] hover:bg-[#F3F5F0]/60 rounded-xl transition-all cursor-pointer group flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[17px] font-extrabold text-[#203B2E] group-hover:text-[#2E6540] transition-colors truncate">
                          {loma.nombre}
                        </span>
                        <ChevronRight className="w-4 h-4 text-[#546349] group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
                      </div>

                      <div className="text-sm font-semibold text-[#3E5238] tabular-nums">
                        {loma.distrito} · {loma.altitud_max_msnm} msnm
                      </div>

                      <div className="flex items-center justify-between text-sm pt-1 tabular-nums">
                        <span className={`font-bold ${
                          loma.dificultad === "Fácil" || loma.dificultad === "Facil"
                            ? "text-[#2E6540]"
                            : loma.dificultad === "Moderado"
                            ? "text-[#82642F]"
                            : "text-rose-700"
                        }`}>
                          {loma.dificultad}
                        </span>

                        <div className="flex items-center gap-1 font-semibold text-[#3E5238]">
                          <Cloud className="w-4 h-4 text-[#546349]" />
                          <span>{colchon}% nubes</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Pie de panel · Planificar mi ruta (vXJpX: ref F58bX) */}
          <footer className="px-6 py-4 border-t border-[#E4E9DE] bg-white flex flex-col gap-1.5 flex-shrink-0">
            <button
              onClick={() => onChangeView("planner")}
              className="h-12 w-full bg-[#243C2D] hover:bg-[#192b20] active:scale-[0.99] text-white text-[15px] font-bold rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <Route className="w-4 h-4 text-[#D8E7C9]" />
              <span>Planificar mi ruta</span>
            </button>
            <p className="text-sm text-center text-[#3E5238] font-semibold">
              Una ruta a tu ritmo, con ayuda de IA.
            </p>
          </footer>

        </div>
      )}
    </aside>
  );
});
