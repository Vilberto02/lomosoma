import React, { useState, useCallback, useEffect, memo } from "react";
import type { UserPreferencesRequest, Coordenadas, PresetZona } from "../../types";
import { X, Sparkles, Navigation, Calendar, Wallet, Activity, Check, Loader2, ChevronDown, ArrowLeft } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Slider } from "../ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";

const PIPELINE_STAGES = [
  "Extrayendo preferencias con LLM",
  "Evaluando lomas con lógica difusa",
  "Optimizando ruta con algoritmo genético",
  "Generando itinerario con LLM",
];

interface RoutePlannerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userCoords: Coordenadas;
  onUserCoordsChange: (coords: Coordenadas) => void;
  presets: PresetZona[];
  onOptimize: (prefs: UserPreferencesRequest) => Promise<void>;
  isLoading: boolean;
  isEmbedded?: boolean;
}

const RoutePlannerPanelComponent: React.FC<RoutePlannerPanelProps> = ({
  isOpen,
  onClose,
  userCoords,
  onUserCoordsChange,
  presets,
  onOptimize,
  isLoading,
  isEmbedded = false,
}) => {
  const [dias, setDias] = useState<number>(3);
  const [presupuesto, setPresupuesto] = useState<number>(60);
  const [condicion, setCondicion] = useState<"Fácil" | "Moderado" | "Difícil">("Moderado");
  const [textoUsuario, setTextoUsuario] = useState<string>("");
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [stageIndex, setStageIndex] = useState<number>(-1);

  useEffect(() => {
    if (isLoading) {
      setStageIndex(0);
      const interval = setInterval(() => {
        setStageIndex((prev) => (prev < PIPELINE_STAGES.length - 1 ? prev + 1 : prev));
      }, 1100);
      return () => clearInterval(interval);
    }
  }, [isLoading]);

  useEffect(() => {
    if (!isOpen) setStageIndex(-1);
  }, [isOpen]);

  const finished = !isLoading && stageIndex >= 0;
  const showStages = isLoading || finished;

  const handleApplyPreset = useCallback((val: string) => {
    setSelectedPreset(val);
    const found = presets.find((p) => p.nombre === val);
    if (found) {
      onUserCoordsChange({ lat: found.lat, lon: found.lon });
    }
  }, [presets, onUserCoordsChange]);

  const handleApplyPromptSuggestion = useCallback((suggestion: string) => {
    setTextoUsuario((prev) => (prev ? `${prev}, ${suggestion}` : suggestion));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    await onOptimize({
      dias_disponibles: dias,
      presupuesto_max: presupuesto,
      condicion_fisica: condicion,
      nodo_base: userCoords,
      texto_usuario: textoUsuario.trim() || null,
    });
  }, [dias, presupuesto, condicion, userCoords, textoUsuario, onOptimize]);

  if (!isOpen) return null;

  const containerClass = isEmbedded
    ? "flex flex-col h-full w-full overflow-hidden bg-white"
    : "absolute top-20 left-4 z-20 w-[92vw] sm:w-[420px] max-w-[420px] h-[calc(100vh-140px)] max-h-[720px] flex flex-col animate-in slide-in-from-left-4 fade-in-50 duration-200";

  const cardClass = isEmbedded
    ? "border-0 shadow-none bg-transparent rounded-none flex flex-col h-full overflow-hidden bg-white"
    : "border border-slate-200 shadow-panel bg-white rounded-2xl flex flex-col h-full overflow-hidden";

  return (
    <div className={containerClass}>
      <Card className={cardClass}>
        {/* Header Limpio y Minimalista */}
        <CardHeader className="p-4 border-b border-slate-200 bg-white flex-shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-primary hover:text-primary/80 transition-colors py-1 px-2 rounded-lg hover:bg-primary/10"
              title="Volver al catálogo de lomas"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver al catálogo</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-bold text-slate-900">
                Planificador de rutas
              </CardTitle>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Optimiza tu itinerario de trekking con IA
              </p>
            </div>
          </div>
        </CardHeader>

        {/* Contenido con Scroll Interno Controlado */}
        <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 space-y-5 custom-scrollbar bg-white">
          <form onSubmit={handleSubmit} id="route-planner-form" className="space-y-5">
            {/* 1. Días disponibles */}
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Días disponibles
                </label>
                <Badge variant="default" className="text-xs sm:text-sm font-bold font-mono px-2.5 py-0.5">
                  {dias} {dias === 1 ? "día" : "días"}
                </Badge>
              </div>
              <Slider
                value={[dias]}
                onValueChange={([val]) => setDias(val)}
                min={1}
                max={10}
                step={1}
              />
              <div className="flex justify-between text-xs font-medium text-slate-400">
                <span>1 día</span>
                <span>5 días</span>
                <span>10 días</span>
              </div>
            </div>

            {/* 2. Presupuesto Máximo */}
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-primary" />
                  Presupuesto máximo
                </label>
                <Badge variant="default" className="text-xs sm:text-sm font-bold font-mono px-2.5 py-0.5">
                  S/ {presupuesto}.00
                </Badge>
              </div>
              <Slider
                value={[presupuesto]}
                onValueChange={([val]) => setPresupuesto(val)}
                min={15}
                max={250}
                step={5}
              />
              <div className="flex justify-between text-xs font-medium text-slate-400">
                <span>S/ 15</span>
                <span>S/ 120</span>
                <span>S/ 250</span>
              </div>
            </div>

            {/* 3. Condición física */}
            <div className="space-y-2.5">
              <label className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Condición física
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["Fácil", "Moderado", "Difícil"] as const).map((nivel) => (
                  <button
                    key={nivel}
                    type="button"
                    onClick={() => setCondicion(nivel)}
                    className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all border ${
                      condicion === nivel
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                    }`}
                  >
                    {nivel}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Punto de Partida */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-destructive" />
                  Punto de partida
                </span>
                <span className="text-xs font-mono font-medium text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  {userCoords.lat.toFixed(4)}, {userCoords.lon.toFixed(4)}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Arrastra el <b>marcador rojo</b> en el mapa o elige una zona rápida:
              </p>
              <Select value={selectedPreset} onValueChange={handleApplyPreset}>
                <SelectTrigger className="w-full h-10 text-xs sm:text-sm bg-white border border-slate-200">
                  <SelectValue placeholder="Seleccionar zona de Lima" />
                </SelectTrigger>
                <SelectContent>
                  {presets.map((p) => (
                    <SelectItem key={p.nombre} value={p.nombre}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 5. Preferencias de experiencia */}
            <div className="space-y-2.5">
              <label className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                ¿Qué tipo de experiencia buscas?
              </label>
              <Textarea
                value={textoUsuario}
                onChange={(e) => setTextoUsuario(e.target.value)}
                placeholder="Ejemplo: 'Senderos con miradores, clima soleado y poco concurrido...'"
                className="w-full min-h-24 text-xs sm:text-sm p-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              />
              <div className="flex flex-wrap gap-2">
                {[
                  "Soleado y verde",
                  "Arqueología y miradores",
                  "Muy seguro",
                  "Poco concurrido",
                ].map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => handleApplyPromptSuggestion(sug)}
                    className="text-xs sm:text-sm font-medium bg-slate-100 hover:bg-primary/10 hover:text-primary text-slate-700 px-3 py-1.5 rounded-full transition-colors border border-slate-200/60"
                  >
                    + {sug}
                  </button>
                ))}
              </div>
            </div>
          </form>
        </CardContent>

        {/* Indicador de etapas del pipeline */}
        {showStages && (
          <div className="p-4 border-t border-slate-200 bg-white">
            <Collapsible open={!finished}>
              <CollapsibleTrigger className="flex w-full items-center justify-between text-xs sm:text-sm font-semibold text-slate-900">
                <span className="flex items-center gap-2">
                  {finished ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  )}
                  {finished ? "Pipeline completado" : "Procesando tu ruta..."}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${finished ? "-rotate-90" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2.5 space-y-2">
                {PIPELINE_STAGES.map((stage, i) => {
                  const done = finished || i < stageIndex;
                  const running = !finished && i === stageIndex;
                  return (
                    <div key={stage} className="flex items-center gap-2 text-xs sm:text-sm text-slate-700">
                      {done ? (
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : running ? (
                        <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                      ) : (
                        <span className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
                      )}
                      <span className={done ? "text-slate-400 line-through decoration-emerald-600/40" : ""}>
                        {stage}
                      </span>
                    </div>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Footer Fijo con Botón de Acción Principal */}
        <div className="p-4 border-t border-slate-200 bg-white flex-shrink-0">
          <Button
            type="submit"
            form="route-planner-form"
            disabled={isLoading}
            className="w-full h-11 text-sm sm:text-base font-bold shadow-sm"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Optimizando rutas...</span>
              </span>
            ) : (
              <span>Generar ruta óptima</span>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export const RoutePlannerPanel = memo(RoutePlannerPanelComponent);
