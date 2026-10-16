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
  const { offlinePackIds } = usePro();
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
  const [activeFilter, setActiveFilter] = useState<QuickFilterType>(null);
  const [activeView, setActiveView] = useState<SidebarView>("catalog");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  const [optimizationResult, setOptimizationResult] =
    useState<OptimizationResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastPrefs, setLastPrefs] = useState<UserPreferencesRequest | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsBrowserOnline(true);
      toast.success("Conexion a internet restablecida");
    };
    const handleOffline = () => {
      setIsBrowserOnline(false);
      toast.error("Sin conexion a internet. Modo Zero Signal activado.");
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
    if (activeFilter === "naturales") {
      return lomas.filter((l) => l.es_loma_natural !== false);
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
        toast.error("No se pudo conectar al Backend FastAPI. Modo offline activo.");
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
        toast.success("Ruta optima calculada con exito");

        if (result.ruta_ids.length > 0) {
          const firstLoma = lomasById.get(result.ruta_ids[0]);
          if (firstLoma) {
            setMapCenterTarget(firstLoma.coordenadas);
          }
        }
      } catch (err: unknown) {
        console.error("Error en optimizacion:", err);
        const msg =
          err instanceof Error
            ? err.message
            : "Ocurrio un error al calcular la ruta.";
        toast.error(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [lomasById]
  );

  const handleSelectLoma = useCallback((loma: Loma) => {
    setSelectedLoma(loma);
    setMapCenterTarget(loma.coordenadas);
    setActiveView("detail");
    setIsSidebarCollapsed(false);
  }, []);

  const handleBackToCatalog = useCallback(() => {
    setSelectedLoma(null);
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
    <div className="relative w-screen h-screen overflow-hidden bg-background">
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3500,
          style: {
            background: "#ffffff",
            color: "#0f172a",
            border: "1px solid #e2e8f0",
            boxShadow:
              "0 4px 20px -2px rgba(0, 0, 0, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04)",
            borderRadius: "12px",
            fontSize: "14px",
            fontFamily: "'Rubik Variable', 'Rubik', sans-serif",
            padding: "10px 16px",
          },
        }}
      />

      <GoogleStyleMap
        lomas={displayedLomas}
        selectedLoma={selectedLoma}
        onSelectLoma={handleSelectLoma}
        userCoords={userCoords}
        onUserCoordsChange={setUserCoords}
        optimizationResult={optimizationResult}
        mapCenterTarget={mapCenterTarget}
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
        onFocusMap={(coords) => setMapCenterTarget(coords)}
        onSetAsStartPoint={handleSetAsStartPoint}
        activeView={activeView}
        onChangeView={handleChangeView}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={handleToggleSidebar}
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
