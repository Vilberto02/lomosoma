import { useState, useEffect, useCallback, useMemo } from "react";
import type {
  Loma,
  Coordenadas,
  PresetZona,
  UserPreferencesRequest,
  OptimizationResult,
} from "./types";
import {
  fetchLomas,
  fetchPresets,
  optimizeRoute,
  checkBackendHealth,
  fetchLomaDetail,
} from "./services/api";
import { ProProvider, usePro } from "./context/ProContext";
import { GoogleStyleMap } from "./components/Map/GoogleStyleMap";
import {
  AppSidebar,
  type QuickFilterType,
  type SidebarView,
} from "./components/Navigation/AppSidebar";
import { ProUpgradeModal } from "./components/Panels/ProUpgradeModal";
import toast, { Toaster } from "react-hot-toast";

function AppContent() {
  const { offlinePackIds, isLomaProUnlocked } = usePro();
  const [lomas, setLomas] = useState<Loma[]>([]);
  const [presets, setPresets] = useState<PresetZona[]>([]);
  const [backendOnline, setBackendOnline] = useState<boolean>(true);
  const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [userCoords, setUserCoords] = useState<Coordenadas>({
    lat: -12.0464,
    lon: -77.0428,
  });
  const [selectedLoma, setSelectedLoma] = useState<Loma | null>(null);
  const [mapCenterTarget, setMapCenterTarget] = useState<Coordenadas | null>(null);
  const [mapCenterSeq, setMapCenterSeq] = useState<number>(0);
  const [activeFilter, setActiveFilter] = useState<QuickFilterType>(null);
  const [activeView, setActiveView] = useState<SidebarView>("catalog");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isGuardianVisible, setIsGuardianVisible] = useState<boolean>(false);

  const [optimizationResult, setOptimizationResult] =
    useState<OptimizationResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastPrefs, setLastPrefs] = useState<UserPreferencesRequest | null>(null);

  const selectedId = selectedLoma?.id;
  useEffect(() => {
    if (!selectedId || activeView !== "detail") return;
    let cancelled = false;
    void fetchLomaDetail(selectedId)
      .then((detail) => {
        if (!cancelled) {
          setSelectedLoma((current) =>
            current?.id === selectedId ? detail : current
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedId, activeView, isLomaProUnlocked]);

  useEffect(() => {
    const handleOnline = () => {
      setIsBrowserOnline(true);
      toast.success("Conexión restablecida");
    };
    const handleOffline = () => {
      setIsBrowserOnline(false);
      toast.error("Sin conexión. Modo Offline activado.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const lomasById = useMemo(() => {
    const map = new Map<string, Loma>();
    lomas.forEach((l) => map.set(l.id, l));
    return map;
  }, [lomas]);

  const displayedLomas = useMemo(() => {
    if (!activeFilter) return lomas;
    if (activeFilter === "temporada") {
      return lomas.filter(
        (l) =>
          l.temporada_optima?.toLowerCase().includes("jun") ||
          l.temporada_optima?.toLowerCase().includes("jul") ||
          l.temporada_optima?.toLowerCase().includes("ago") ||
          l.temporada_optima?.toLowerCase().includes("sep") ||
          l.temporada_optima?.toLowerCase().includes("oct")
      );
    }
    if (activeFilter === "demo_pro") {
      return lomas.filter((l) => l.id === "L0" || l.pro_demo_gratis);
    }
    if (activeFilter === "offline") {
      return lomas.filter((l) => offlinePackIds.includes(l.id));
    }
    return lomas;
  }, [lomas, activeFilter, offlinePackIds]);

  useEffect(() => {
    async function loadData() {
      try {
        const isHealthy = await checkBackendHealth();
        setBackendOnline(isHealthy);

        const [lomasData, presetsData] = await Promise.all([
          fetchLomas(),
          fetchPresets().catch(() => []),
        ]);
        setLomas(lomasData);
        setPresets(presetsData);
      } catch (err: unknown) {
        console.error("Error al conectar con la API:", err);
        setBackendOnline(false);
      }
    }
    loadData();
  }, []);

  const handleOptimize = useCallback(
    async (prefs: UserPreferencesRequest) => {
      setIsLoading(true);
      setLastPrefs(prefs);
      try {
        const result = await optimizeRoute(prefs);
        setOptimizationResult(result);
        setActiveView("results");
        setIsSidebarCollapsed(false);
        toast.success("Ruta calculada con éxito");

        if (result.ruta_ids.length > 0) {
          const firstLoma = lomasById.get(result.ruta_ids[0]);
          if (firstLoma) {
            setMapCenterTarget(firstLoma.coordenadas);
          }
        }
      } catch (err: unknown) {
        console.error("Error en optimización:", err);
        const msg =
          err instanceof Error
            ? err.message
            : "Ocurrió un error al calcular la ruta.";
        toast.error(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [lomasById]
  );

  const handleFocusMap = useCallback((coords: Coordenadas) => {
    setMapCenterTarget({ lat: coords.lat, lon: coords.lon });
    setMapCenterSeq((prev) => prev + 1);
  }, []);

  const handleSelectLoma = useCallback(
    (loma: Loma) => {
      setSelectedLoma(loma);
      handleFocusMap(loma.coordenadas);
    },
    [handleFocusMap]
  );

  const handleOpenLomaDetail = useCallback(
    (loma: Loma) => {
      setSelectedLoma(loma);
      setActiveView("detail");
      setIsSidebarCollapsed(false);
      handleFocusMap(loma.coordenadas);
    },
    [handleFocusMap]
  );

  const handleBackToCatalog = useCallback(() => {
    setSelectedLoma(null);
    setIsGuardianVisible(false);
    setActiveView("catalog");
  }, []);

  const handleSetAsStartPoint = useCallback((coords: Coordenadas) => {
    setUserCoords(coords);
    setSelectedLoma(null);
    setActiveView("planner");
    setIsSidebarCollapsed(false);
    toast.success("Punto de inicio establecido para la ruta");
  }, []);

  const handleNewSearch = useCallback(() => {
    setOptimizationResult(null);
    setActiveView("planner");
  }, []);

  const handleChangeView = useCallback(
    (view: SidebarView) => {
      setActiveView(view);
      if (view === "catalog") {
        setSelectedLoma(null);
      }
    },
    []
  );

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#E8EDE9]">
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3500,
          style: {
            background: "#ffffff",
            color: "#203B2E",
            border: "1px solid #E4E9DE",
            boxShadow: "0 12px 32px -4px rgba(32, 59, 46, 0.12)",
            borderRadius: "12px",
            fontSize: "15px",
            fontWeight: "600",
            fontFamily: "'Manrope', 'Rubik Variable', sans-serif",
            padding: "12px 18px",
          },
        }}
      />

      <GoogleStyleMap
        lomas={displayedLomas}
        selectedLoma={selectedLoma}
        onSelectLoma={handleSelectLoma}
        onOpenLomaDetail={handleOpenLomaDetail}
        onClearSelectedLoma={handleBackToCatalog}
        userCoords={userCoords}
        onUserCoordsChange={setUserCoords}
        optimizationResult={activeView === "results" ? optimizationResult : null}
        mapCenterTarget={mapCenterTarget}
        mapCenterSeq={mapCenterSeq}
        showRouteOverlay={activeView === "results" && !!optimizationResult}
        hidePreviewCard={activeView === "detail" || activeView === "planner"}
        isGuardianVisible={isGuardianVisible}
        onGuardianVisibleChange={setIsGuardianVisible}
      />

      <AppSidebar
        lomas={lomas}
        selectedLoma={selectedLoma}
        onSelectLoma={handleSelectLoma}
        onBackToCatalog={handleBackToCatalog}
        userCoords={userCoords}
        onUserCoordsChange={setUserCoords}
        presets={presets}
        onOptimize={handleOptimize}
        optimizationResult={optimizationResult}
        isLoading={isLoading}
        lastPrefs={lastPrefs}
        onNewSearch={handleNewSearch}
        backendOnline={backendOnline}
        isBrowserOnline={isBrowserOnline}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        onFocusMap={handleFocusMap}
        onSetAsStartPoint={handleSetAsStartPoint}
        activeView={activeView}
        onChangeView={handleChangeView}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={handleToggleSidebar}
        isGuardianVisible={isGuardianVisible}
        onToggleGuardian={() => setIsGuardianVisible((prev) => !prev)}
      />

      <ProUpgradeModal lomas={lomas} />
    </div>
  );
}

export function App() {
  return (
    <ProProvider>
      <AppContent />
    </ProProvider>
  );
}

export default App;
