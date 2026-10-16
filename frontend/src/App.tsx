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
  FloatingSearchBar,
  type QuickFilterType,
} from "./components/Search/FloatingSearchBar";
import { RoutePlannerPanel } from "./components/Panels/RoutePlannerPanel";
import { RouteResultsPanel } from "./components/Panels/RouteResultsPanel";
import { LomaDetailSheet } from "./components/Panels/LomaDetailSheet";
import { ProUpgradeModal } from "./components/Panels/ProUpgradeModal";
import { Mountain, WifiOff } from "lucide-react";
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

  const [isPlannerOpen, setIsPlannerOpen] = useState<boolean>(false);
  const [isResultsOpen, setIsResultsOpen] = useState<boolean>(false);
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
        setIsPlannerOpen(false);
        setIsResultsOpen(true);
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
  }, []);

  const handleSetAsStartPoint = useCallback((coords: Coordenadas) => {
    setUserCoords(coords);
    setSelectedLoma(null);
  }, []);

  const handleNewSearch = useCallback(() => {
    setOptimizationResult(null);
    setIsResultsOpen(false);
    setIsPlannerOpen(true);
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

      <FloatingSearchBar
        lomas={lomas}
        onSelectLoma={handleSelectLoma}
        isPlannerOpen={isPlannerOpen}
        onTogglePlanner={() => {
          setIsPlannerOpen(!isPlannerOpen);
          if (!isPlannerOpen) setIsResultsOpen(false);
        }}
        hasActiveRoute={Boolean(optimizationResult)}
        onOpenResults={() => {
          setIsResultsOpen(true);
          setIsPlannerOpen(false);
        }}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      {isPlannerOpen && (
        <RoutePlannerPanel
          isOpen={isPlannerOpen}
          onClose={() => setIsPlannerOpen(false)}
          userCoords={userCoords}
          onUserCoordsChange={setUserCoords}
          presets={presets}
          onOptimize={handleOptimize}
          isLoading={isLoading}
        />
      )}

      <RouteResultsPanel
        isOpen={isResultsOpen}
        onClose={() => setIsResultsOpen(false)}
        result={optimizationResult}
        lomas={lomas}
        prefs={lastPrefs}
        onFocusLoma={handleSelectLoma}
        onNewSearch={handleNewSearch}
      />

      <LomaDetailSheet
        loma={selectedLoma}
        onClose={() => setSelectedLoma(null)}
        onSetAsStartPoint={handleSetAsStartPoint}
        onFocusMap={(coords) => setMapCenterTarget(coords)}
      />

      <ProUpgradeModal lomas={lomas} />

      <div className="absolute bottom-4 left-4 z-10 hidden sm:flex items-center gap-2 bg-card/95 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-control border border-border text-xs text-foreground/80">
        <span className="flex items-center gap-1.5 font-semibold text-primary">
          <Mountain className="w-3.5 h-3.5" />
          Lomas de Lima
        </span>
        <span className="text-border">|</span>
        <span className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              backendOnline && isBrowserOnline
                ? "bg-primary animate-pulse"
                : "bg-destructive"
            }`}
          />
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            {!isBrowserOnline ? (
              <>
                <WifiOff className="w-3 h-3 text-destructive" />
                <span>Modo Sin Senal</span>
              </>
            ) : backendOnline ? (
              "FastAPI Conectado"
            ) : (
              "FastAPI Desconectado"
            )}
          </span>
        </span>
        <span className="text-border">|</span>
        <span className="text-muted-foreground">
          {displayedLomas.length} de {lomas.length} lomas
        </span>
      </div>
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
