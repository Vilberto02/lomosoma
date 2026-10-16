import React, { useState, useCallback, useEffect, memo } from "react";
import type { UserPreferencesRequest, Coordenadas, PresetZona } from "../../types";
import { X, Sparkles, Navigation, Calendar, Wallet, Activity, Check, Loader2, ChevronDown } from "lucide-react";
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
}

const RoutePlannerPanelComponent: React.FC<RoutePlannerPanelProps> = ({
  isOpen,
  onClose,
  userCoords,
  onUserCoordsChange,
  presets,
  onOptimize,
  isLoading,
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

  return (
    <div className="absolute top-20 left-4 z-20 w-[92vw] sm:w-[420px] max-w-[420px] h-[calc(100vh-140px)] max-h-[720px] flex flex-col animate-in slide-in-from-left-4 fade-in-50 duration-200">
      <Card className="border border-border shadow-panel bg-card/98 backdrop-blur-md rounded-2xl flex flex-col h-full overflow-hidden bg-white">
        {/* Header Limpio y Minimalista */}
        <CardHeader className="p-4 border-b border-border bg-card flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-foreground">
                  Planificador de rutas
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Optimiza tu itinerario de trekking con IA
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </CardHeader>

        {/* Contenido con Scroll Interno Controlado */}
        <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 space-y-5 custom-scrollbar bg-white">
          <form onSubmit={handleSubmit} id="route-planner-form" className="space-y-5">
            {/* 1. Días disponibles */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  Días disponibles
                </label>
                <Badge variant="default" className="text-xs font-semibold">
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
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 día</span>
                <span>5 días</span>
                <span>10 días</span>
              </div>
            </div>

            {/* 2. Presupuesto Máximo */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-primary" />
                  Presupuesto máximo
                </label>
                <Badge variant="default" className="text-xs font-semibold">
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
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>S/ 15</span>
                <span>S/ 120</span>
                <span>S/ 250</span>
              </div>
            </div>

            {/* 3. Condición física */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-primary" />
                Condición física
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["Fácil", "Moderado", "Difícil"] as const).map((nivel) => (
                  <button
                    key={nivel}
                    type="button"
                    onClick={() => setCondicion(nivel)}
                    className={`py-2 px-3 rounded-lg text-xs font-medium transition-all border ${
                      condicion === nivel
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80"
                    }`}
                  >
                    {nivel}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Punto de Partida */}
            <div className="p-3.5 rounded-xl border border-border bg-secondary/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-destructive" />
                  Punto de partida
                </span>
                <span className="text-xs font-mono text-muted-foreground bg-background px-2 py-0.5 rounded-md border border-border">
                  {userCoords.lat.toFixed(4)}, {userCoords.lon.toFixed(4)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Arrastra el <b>marcador rojo</b> en el mapa o elige una zona rápida:
              </p>
              <Select value={selectedPreset} onValueChange={handleApplyPreset}>
                <SelectTrigger className="w-full h-9 text-xs bg-background">
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
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                ¿Qué tipo de experiencia buscas?
              </label>
              <Textarea
                value={textoUsuario}
                onChange={(e) => setTextoUsuario(e.target.value)}
                placeholder="Ejemplo: 'Senderos con miradores, clima soleado y poco concurrido...'"
                className="w-full min-h-24 text-xs p-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 resize-none"
              />
              <div className="flex flex-wrap gap-1.5">
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
                    className="text-xs bg-secondary hover:bg-primary/10 hover:text-primary text-secondary-foreground px-2.5 py-1 rounded-full transition-colors border border-transparent"
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
          <div className="p-4 border-t border-border bg-card rounded-l-xl rounded-r-xl">
            <Collapsible open={!finished}>
              <CollapsibleTrigger className="flex w-full items-center justify-between text-xs font-semibold text-foreground">
                <span className="flex items-center gap-2">
                  {finished ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                  )}
                  {finished ? "Pipeline completado" : "Procesando tu ruta..."}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${finished ? "-rotate-90" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-1.5">
                {PIPELINE_STAGES.map((stage, i) => {
                  const done = finished || i < stageIndex;
                  const running = !finished && i === stageIndex;
                  return (
                    <div key={stage} className="flex items-center gap-2 text-xs text-foreground/80">
                      {done ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : running ? (
                        <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-border shrink-0" />
                      )}
                      <span className={done ? "text-foreground/60 line-through decoration-emerald-600/40" : ""}>
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
        <div className="p-4 border-t border-border bg-card flex-shrink-0">
          <Button
            type="submit"
            form="route-planner-form"
            disabled={isLoading}
            className="w-full h-11 text-sm font-semibold shadow-sm"
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
