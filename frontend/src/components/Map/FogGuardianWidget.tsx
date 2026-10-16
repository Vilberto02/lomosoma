import React, { useState, useEffect, useMemo, useCallback } from "react";
import type { Loma, Coordenadas, SenderoProfile } from "../../types";
import {
  evaluateTrailPosition,
  verifyAndCreateSummitStamp,
  playRescueWhistle3000Hz,
  buildEmergencySmsHref,
  findSummitCoordinates,
} from "../../services/offlineGeoEngine";
import { fetchSenderoProfile } from "../../services/api";
import { usePro } from "../../context/ProContext";
import {
  ShieldAlert,
  ShieldCheck,
  Volume2,
  VolumeX,
  PhoneCall,
  Play,
  RotateCcw,
  Compass,
  Mountain,
  ChevronDown,
  ChevronUp,
  X,
  Award,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";

interface FogGuardianWidgetProps {
  selectedLoma: Loma | null;
  userCoords: Coordenadas;
  onUserCoordsChange: (coords: Coordenadas) => void;
  onClose?: () => void;
}

export const FogGuardianWidget: React.FC<FogGuardianWidgetProps> = ({
  selectedLoma,
  userCoords,
  onUserCoordsChange,
  onClose,
}) => {
  const { offlinePackIds, addSummitStamp, summitStamps } = usePro();
  const [sendero, setSendero] = useState<SenderoProfile | null>(
    selectedLoma?.sendero ?? null
  );
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isWhistling, setIsWhistling] = useState<boolean>(false);
  const [whistleController, setWhistleController] = useState<{ stop: () => void } | null>(
    null
  );
  const [simIndex, setSimIndex] = useState<number>(0);

  useEffect(() => {
    if (selectedLoma?.sendero) {
      setSendero(selectedLoma.sendero);
    } else if (selectedLoma?.id) {
      fetchSenderoProfile(selectedLoma.id)
        .then((s) => setSendero(s))
        .catch(() => setSendero(null));
    } else {
      setSendero(null);
    }
  }, [selectedLoma]);

  const trailEval = useMemo(() => {
    if (!sendero) return null;
    return evaluateTrailPosition(userCoords, sendero);
  }, [userCoords, sendero]);

  const isPackOffline = useMemo(() => {
    if (!selectedLoma) return false;
    return offlinePackIds.includes(selectedLoma.id);
  }, [offlinePackIds, selectedLoma]);

  const hasSummitStamp = useMemo(() => {
    if (!selectedLoma) return false;
    return summitStamps.some((s) => s.loma_id === selectedLoma.id);
  }, [summitStamps, selectedLoma]);

  const handleToggleWhistle = useCallback(() => {
    if (isWhistling && whistleController) {
      whistleController.stop();
      setIsWhistling(false);
      setWhistleController(null);
      toast("Silbato de rescate detenido");
    } else {
      const controller = playRescueWhistle3000Hz(3500);
      setWhistleController(controller);
      setIsWhistling(true);
      toast.success("Silbato acustico 3000Hz activado");
      setTimeout(() => {
        setIsWhistling(false);
        setWhistleController(null);
      }, 3500);
    }
  }, [isWhistling, whistleController]);

  const handleSimulateAdvance = useCallback(() => {
    if (!sendero || !sendero.coordenadas_3d || sendero.coordenadas_3d.length === 0) {
      toast.error("No hay coordenadas de sendero disponibles para simular");
      return;
    }
    const coordsList = sendero.coordenadas_3d;
    const nextIdx = (simIndex + 1) % coordsList.length;
    setSimIndex(nextIdx);

    const pt = coordsList[nextIdx];
    const lat = Math.abs(pt[0]) > Math.abs(pt[1]) ? pt[1] : pt[0];
    const lon = Math.abs(pt[0]) > Math.abs(pt[1]) ? pt[0] : pt[1];

    onUserCoordsChange({ lat, lon });
    toast.success(`Avanzando sendero: punto ${nextIdx + 1} de ${coordsList.length}`);
  }, [sendero, simIndex, onUserCoordsChange]);

  const handleSimulateDeviation = useCallback(() => {
    if (!sendero) return;
    const offset = 0.00065;
    const deviatedCoords: Coordenadas = {
      lat: userCoords.lat + offset,
      lon: userCoords.lon + offset,
    };
    onUserCoordsChange(deviatedCoords);
    toast.error("Simulando desvio en neblina (>45m fuera del sendero)");
  }, [sendero, userCoords, onUserCoordsChange]);

  const handleSimulateSummit = useCallback(() => {
    if (!selectedLoma) return;
    const summit = findSummitCoordinates(selectedLoma, sendero ?? undefined);
    onUserCoordsChange({ lat: summit.lat, lon: summit.lon });
    toast.success("Posicion establecida en la Cumbre (distancia 0m)");
  }, [selectedLoma, sendero, onUserCoordsChange]);

  const handleStampSummit = useCallback(() => {
    if (!selectedLoma) return;
    try {
      const stamp = verifyAndCreateSummitStamp(userCoords, selectedLoma, sendero ?? undefined);
      addSummitStamp(stamp);
      toast.success("Cumbre conquistada. Pasaporte digital sellado con hash SHA256.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "No puedes sellar el pasaporte aqui";
      toast.error(msg);
    }
  }, [selectedLoma, userCoords, sendero, addSummitStamp]);

  if (!selectedLoma) return null;

  const isOffTrail = trailEval ? trailEval.isOffTrail : false;
  const deviation = trailEval ? trailEval.crossTrackDistanceMeters : 0;
  const progress = trailEval ? trailEval.progressPct : 0;
  const altitud = trailEval ? trailEval.estimatedAltitudeMsnm : selectedLoma.altitud_max_msnm || 0;

  const emergencySmsUrl = buildEmergencySmsHref(userCoords, selectedLoma.nombre, altitud);

  return (
    <div className="absolute top-20 left-4 sm:left-6 z-30 w-[92vw] sm:w-[360px] max-w-[360px] animate-in slide-in-from-top-4 fade-in-50 duration-200">
      <div
        className={`rounded-2xl border shadow-panel backdrop-blur-md transition-all overflow-hidden ${
          isOffTrail
            ? "bg-amber-500/10 border-amber-500 shadow-amber-500/20"
            : "bg-card/95 border-border"
        }`}
      >
        <div
          className={`p-3.5 flex items-center justify-between border-b ${
            isOffTrail
              ? "bg-amber-500/20 border-amber-500/40 text-amber-900"
              : "bg-slate-900 text-white border-border"
          }`}
        >
          <div className="flex items-center gap-2">
            {isOffTrail ? (
              <ShieldAlert className="w-5 h-5 text-amber-600 animate-bounce" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            )}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span>Fog Guardian GPS</span>
                {isPackOffline && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-300 font-mono">
                    Offline
                  </span>
                )}
              </div>
              <div className="text-[11px] opacity-90 truncate max-w-[200px]">
                {selectedLoma.nombre}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 rounded-lg hover:bg-white/20 transition-colors"
              title={isMinimized ? "Expandir" : "Minimizar"}
            >
              {isMinimized ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-white/20 transition-colors"
                title="Cerrar Guardian"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {isOffTrail && (
          <div className="px-3.5 py-2 bg-amber-500 text-slate-950 text-xs font-bold flex items-center gap-2 animate-pulse">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Alerta: Desvio del sendero mayor a 35m ({deviation}m)</span>
          </div>
        )}

        {!isMinimized && (
          <div className="p-3.5 space-y-3 bg-card text-foreground">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-secondary/30 border border-border">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                  Desviacion
                </div>
                <div
                  className={`text-sm font-black mt-0.5 ${
                    isOffTrail ? "text-amber-600" : "text-emerald-600"
                  }`}
                >
                  {deviation}m
                </div>
              </div>
              <div className="p-2 rounded-xl bg-secondary/30 border border-border">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                  Avance
                </div>
                <div className="text-sm font-black text-foreground mt-0.5">{progress}%</div>
              </div>
              <div className="p-2 rounded-xl bg-secondary/30 border border-border">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                  Altitud
                </div>
                <div className="text-sm font-black text-foreground mt-0.5">{altitud} m</div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground flex items-center justify-between border-t border-border/60 pt-2">
              <span className="flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-primary" />
                Rumbo al sendero: {trailEval ? `${trailEval.bearingToTrailDeg} deg` : "0 deg"}
              </span>
              <span className="text-[11px] font-mono text-emerald-600 font-medium">
                {isPackOffline ? "Maletin Offline Activo" : "Modo Local GPS"}
              </span>
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Simulador de Campo en Vivo
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={handleSimulateAdvance}
                  className="px-2 py-1.5 text-[11px] font-semibold rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition-all flex items-center justify-center gap-1"
                  title="Mover usuario al siguiente punto del sendero"
                >
                  <Play className="w-3 h-3 text-emerald-600" />
                  <span>Avanzar</span>
                </button>
                <button
                  onClick={handleSimulateDeviation}
                  className="px-2 py-1.5 text-[11px] font-semibold rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 transition-all flex items-center justify-center gap-1"
                  title="Desplazar al usuario 50m fuera de la ruta"
                >
                  <RotateCcw className="w-3 h-3 text-amber-600" />
                  <span>Desvio</span>
                </button>
                <button
                  onClick={handleSimulateSummit}
                  className="px-2 py-1.5 text-[11px] font-semibold rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-all flex items-center justify-center gap-1"
                  title="Mover al usuario a la cumbre exacta"
                >
                  <Mountain className="w-3 h-3" />
                  <span>Cumbre</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/60">
              <button
                onClick={handleToggleWhistle}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  isWhistling
                    ? "bg-red-600 text-white animate-pulse"
                    : "bg-secondary text-foreground hover:bg-secondary/80"
                }`}
              >
                {isWhistling ? (
                  <>
                    <VolumeX className="w-4 h-4" />
                    <span>Detener SOS</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4 text-primary" />
                    <span>Silbato 3kHz</span>
                  </>
                )}
              </button>

              <a
                href={emergencySmsUrl}
                className="py-2 px-3 rounded-xl text-xs font-bold bg-secondary text-foreground hover:bg-secondary/80 transition-all flex items-center justify-center gap-1.5 text-center"
              >
                <PhoneCall className="w-4 h-4 text-emerald-600" />
                <span>SMS Lifeline</span>
              </a>
            </div>

            <button
              onClick={handleStampSummit}
              className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                hasSummitStamp
                  ? "bg-emerald-600/15 text-emerald-700 border border-emerald-600/30"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              <Award className="w-4 h-4" />
              <span>
                {hasSummitStamp
                  ? "Cumbre Ya Sellada en Pasaporte"
                  : "Sellar Pasaporte en Cumbre (<60m)"}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
