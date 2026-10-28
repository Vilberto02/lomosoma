import React, { useState, useCallback, useEffect, memo } from "react";
import type { UserPreferencesRequest, Coordenadas, PresetZona } from "../../types";
import {
  Sparkles,
  Check,
  ArrowLeft,
  Compass,
  Plus,
} from "lucide-react";
import { Slider } from "../ui/slider";

const PIPELINE_STAGES = [
  "Extrayendo preferencias con LLM",
  "Evaluando lomas con lógica difusa",
  "Optimizando ruta con algoritmo genético",
  "Generando itinerario narrativo",
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
  isEmbedded: _isEmbedded = false,
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
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isLoading]);

  useEffect(() => {
    if (!isOpen) setStageIndex(-1);
  }, [isOpen]);

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
    <div className="flex flex-col h-full w-full overflow-hidden bg-white">
      {/* 1. CABECERA: Introducción del planificador (kEcBf en Pencil) */}
      <div className="p-5 border-b border-[#E4E9DE] bg-white flex-shrink-0 flex flex-col gap-2">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-[15px] font-bold text-[#3E5238] hover:text-[#203B2E] transition-colors py-1 px-2 rounded-lg hover:bg-[#F3F5F0] -ml-2 self-start"
        >
          <ArrowLeft className="w-4 h-4 text-[#546349]" />
          <span>Todas las lomas</span>
        </button>

        <div>
          <h2 className="text-[26px] font-black text-[#203B2E] tracking-tight">
            Una ruta a tu medida.
          </h2>
          <p className="text-[15px] text-[#3E5238] font-semibold mt-0.5">
            Tú eliges el ritmo. La IA conecta el camino.
          </p>
        </div>
      </div>

      {/* 2. SI ESTÁ PROCESANDO: VISTA DE CARGA SEGÚN FRAME 08 (hmhyb en Pencil) */}
      {isLoading ? (
        <div className="flex-1 p-6 flex flex-col items-center justify-center gap-5 bg-white text-center animate-in fade-in duration-200">
          <div className="relative flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-[#F0F5ED] border-2 border-[#CAD9BE] animate-ping opacity-40 absolute" />
            <div className="w-16 h-16 rounded-full bg-[#F0F5ED] border-2 border-[#2E6540] flex items-center justify-center text-[#2E6540] shadow-sm">
              <Sparkles className="w-7 h-7 animate-pulse text-[#2E6540]" />
            </div>
          </div>

          <div className="max-w-[320px]">
            <h3 className="text-[20px] font-black text-[#203B2E]">
              Optimizando tu itinerario
            </h3>
            <p className="text-sm text-[#3E5238] font-medium mt-1 leading-relaxed">
              Algoritmo genético multiobjetivo evaluando accesibilidad, clima y floración en tiempo real.
            </p>
          </div>

          {/* Etapas del pipeline animadas */}
          <div className="w-full max-w-[340px] bg-[#F3F5F0] border border-[#E4E9DE] rounded-xl p-4 flex flex-col gap-3 text-left">
            {PIPELINE_STAGES.map((stg, idx) => {
              const isPast = idx < stageIndex;
              const isCurrent = idx === stageIndex;
              return (
                <div key={idx} className="flex items-center gap-2.5 text-[15px]">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-black transition-all ${
                      isPast
                        ? "bg-[#2E6540] text-white"
                        : isCurrent
                        ? "bg-[#243C2D] text-white animate-pulse"
                        : "bg-[#E4E9DE] text-[#546349]"
                    }`}
                  >
                    {isPast ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                  </div>
                  <span
                    className={`font-semibold ${
                      isCurrent
                        ? "text-[#203B2E] font-bold"
                        : isPast
                        ? "text-[#3E5238]"
                        : "text-[#546349]"
                    }`}
                  >
                    {stg}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* 3. FORMULARIO DE PREFERENCIAS (Frames 06 y 07 en Pencil) */
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between overflow-hidden">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-5">
            
            {/* Duración (j5smYC en Pencil) */}
            <div className="p-4 bg-white border border-[#E4E9DE] rounded-xl flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-[15px]">
                <span className="font-extrabold text-[#203B2E]">Días disponibles</span>
                <span className="font-black text-[16px] text-[#2E6540] bg-[#F0F5ED] px-2.5 py-0.5 rounded-lg border border-[#CAD9BE]">
                  {dias} {dias === 1 ? "día" : "días"}
                </span>
              </div>

              <Slider
                min={1}
                max={10}
                step={1}
                value={[dias]}
                onValueChange={(val) => setDias(val[0])}
                className="py-1"
              />

              <div className="flex items-center justify-between text-sm text-[#3E5238] font-semibold">
                <span>1 día</span>
                <span>5 días</span>
                <span>10 días</span>
              </div>
            </div>

            {/* Presupuesto (EjcZJ en Pencil) */}
            <div className="p-4 bg-white border border-[#E4E9DE] rounded-xl flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-[15px]">
                <span className="font-extrabold text-[#203B2E]">Presupuesto máximo</span>
                <span className="font-black text-[16px] text-[#203B2E] bg-[#F3F5F0] px-2.5 py-0.5 rounded-lg border border-[#E4E9DE]">
                  S/ {presupuesto.toFixed(2)}
                </span>
              </div>

              <Slider
                min={15}
                max={250}
                step={5}
                value={[presupuesto]}
                onValueChange={(val) => setPresupuesto(val[0])}
                className="py-1"
              />

              <div className="flex items-center justify-between text-sm text-[#3E5238] font-semibold">
                <span>S/ 15</span>
                <span>S/ 120</span>
                <span>S/ 250</span>
              </div>
            </div>

            {/* Condición física (e0uHq en Pencil) */}
            <div className="flex flex-col gap-2">
              <label className="text-[15px] font-extrabold text-[#203B2E]">Tu condición física</label>
              <div className="grid grid-cols-3 gap-2">
                {(["Fácil", "Moderado", "Difícil"] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setCondicion(lvl)}
                    className={`h-11 rounded-xl text-[15px] font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                      condicion === lvl
                        ? "bg-[#243C2D] text-white shadow-sm"
                        : "bg-[#F3F5F0] text-[#3E5238] hover:bg-[#E4E9DE] border border-[#E4E9DE]"
                    }`}
                  >
                    <span>{lvl}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Punto de partida (czzA2 en Pencil) */}
            <div className="p-4 bg-white border border-[#E4E9DE] rounded-xl flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-[15px]">
                <span className="font-extrabold text-[#203B2E]">¿Desde dónde sales?</span>
                <span className="text-[13px] font-mono font-semibold text-[#546349]">
                  {userCoords.lat.toFixed(4)}, {userCoords.lon.toFixed(4)}
                </span>
              </div>

              <select
                value={selectedPreset}
                onChange={(e) => handleApplyPreset(e.target.value)}
                className="w-full h-11 px-3 bg-[#F3F5F0] border border-[#E4E9DE] rounded-lg text-[15px] font-semibold text-[#203B2E] focus:outline-none focus:border-[#2E6540]"
              >
                <option value="">Seleccionar zona de Lima...</option>
                {presets.map((p) => (
                  <option key={p.nombre} value={p.nombre}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Tipo de experiencia y preferencias naturales (d5ozo en Pencil) */}
            <div className="flex flex-col gap-2">
              <label className="text-[15px] font-extrabold text-[#203B2E]">
                ¿Qué te gustaría descubrir?
              </label>
              <textarea
                rows={2}
                value={textoUsuario}
                onChange={(e) => setTextoUsuario(e.target.value)}
                placeholder="Miradores, paisajes verdes, poco concurrido…"
                className="w-full p-3 bg-[#F3F5F0] border border-[#E4E9DE] rounded-xl text-[15px] font-medium text-[#203B2E] placeholder-[#546349] focus:outline-none focus:border-[#2E6540] resize-none"
              />

              {/* Sugerencias Rápidas */}
              <div className="flex flex-wrap gap-1.5 pt-1">
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
                    className="h-9 px-3.5 bg-white border border-[#CAD9BE] hover:bg-[#F0F5ED] text-[#2E6540] text-sm font-bold rounded-lg flex items-center gap-1 transition-all"
                  >
                    <Plus className="w-4 h-4 text-[#2E6540]" />
                    <span>{sug}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4. PIE DE PANEL · GENERAR MI RUTA (u3rLd1 en Pencil) */}
          <div className="p-4 border-t border-[#E4E9DE] bg-white flex flex-col gap-2 flex-shrink-0">
            <button
              type="submit"
              disabled={isLoading}
              className="h-12 w-full bg-[#243C2D] hover:bg-[#192b20] active:scale-[0.99] text-white text-[15px] font-bold rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <Compass className="w-4 h-4" />
              <span>Generar mi ruta</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export const RoutePlannerPanel = memo(RoutePlannerPanelComponent);
