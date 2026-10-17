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
  const [isMinimized, setIsMinimized] = useState<boolean>(true);
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
      toast.success("Silbato acústico 3000Hz activado");
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
    toast.error("Simulando desvío en neblina (>45m fuera del sendero)");
  }, [sendero, userCoords, onUserCoordsChange]);

  const handleSimulateSummit = useCallback(() => {
    if (!selectedLoma) return;
    const summit = findSummitCoordinates(selectedLoma, sendero ?? undefined);
    onUserCoordsChange({ lat: summit.lat, lon: summit.lon });
    toast.success("Posición establecida en la Cumbre (distancia 0m)");
  }, [selectedLoma, sendero, onUserCoordsChange]);

  const handleStampSummit = useCallback(() => {
    if (!selectedLoma) return;
    try {
      const stamp = verifyAndCreateSummitStamp(userCoords, selectedLoma, sendero ?? undefined);
      addSummitStamp(stamp);
      toast.success("Cumbre conquistada. Pasaporte digital sellado con hash SHA256.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "No puedes sellar el pasaporte aquí";
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
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 sm:left-[456px] sm:translate-x-0 z-20 w-[94vw] sm:w-[420px] max-w-[430px] transition-all duration-200 pointer-events-auto">
      <div
        className={`rounded-2xl border shadow-2xl transition-all overflow-hidden ${
          isOffTrail
            ? "bg-amber-950 border-2 border-amber-500 shadow-amber-500/20 text-white"
            : "bg-slate-900 border border-slate-700/80 text-white shadow-2xl"
        }`}
      >
        <div className="p-3.5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            {isOffTrail ? (
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 animate-bounce" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-white">
                <span>Fog Guardian GPS</span>
                {isPackOffline && (
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/25 text-emerald-300 font-mono font-semibold">
                    Offline
                  </span>
                )}
              </div>
              <div className="text-xs sm:text-sm text-slate-300 truncate mt-0.5">
                {isOffTrail ? (
                  <span className="text-amber-300 font-bold">Desvío: {deviation}m</span>
                ) : (
                  <span className="font-medium">En sendero ({deviation}m) · {altitud} msnm</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleToggleWhistle}
              className={`p-2 rounded-lg text-xs font-bold transition-all ${
                isWhistling
                  ? "bg-red-600 text-white animate-pulse"
                  : "bg-white/10 hover:bg-white/20 text-white"
              }`}
              title="Silbato de rescate 3000Hz"
            >
              {isWhistling ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title={isMinimized ? "Abrir HUD Táctico completo" : "Minimizar"}
            >
              {isMinimized ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                title="Cerrar Guardián"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {isOffTrail && (
          <div className="px-4 py-2 bg-amber-500 text-slate-950 text-xs sm:text-sm font-bold flex items-center gap-2 animate-pulse">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Alerta: Desvío del sendero mayor a 35m ({deviation}m)</span>
          </div>
        )}

        {!isMinimized && (
          <div className="p-4 space-y-3.5 bg-slate-900 text-white">
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700">
                <div className="text-xs uppercase font-semibold text-slate-400">
                  Desviación
                </div>
                <div
                  className={`text-base font-black font-mono mt-0.5 ${
                    isOffTrail ? "text-amber-400" : "text-emerald-400"
                  }`}
                >
                  {deviation}m
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700">
                <div className="text-xs uppercase font-semibold text-slate-400">
                  Avance
                </div>
                <div className="text-base font-black font-mono text-white mt-0.5">{progress}%</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700">
                <div className="text-xs uppercase font-semibold text-slate-400">
                  Altitud
                </div>
                <div className="text-base font-black font-mono text-white mt-0.5">{altitud} m</div>
              </div>
            </div>

            <div className="text-xs sm:text-sm text-slate-300 flex items-center justify-between border-t border-slate-800 pt-2.5">
              <span className="flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-emerald-400" />
                Rumbo al sendero: {trailEval ? `${trailEval.bearingToTrailDeg} deg` : "0 deg"}
              </span>
              <span className="text-xs font-mono text-emerald-400 font-semibold">
                {isPackOffline ? "Maletín Offline Activo" : "Modo Local GPS"}
              </span>
            </div>

            <div className="space-y-2 pt-1">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Simulador de Campo en Vivo
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={handleSimulateAdvance}
                  className="px-2.5 py-2 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all flex items-center justify-center gap-1.5"
                  title="Mover usuario al siguiente punto del sendero"
                >
                  <Play className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Avanzar</span>
                </button>
                <button
                  onClick={handleSimulateDeviation}
                  className="px-2.5 py-2 text-xs font-bold rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all flex items-center justify-center gap-1.5"
                  title="Desplazar al usuario 50m fuera de la ruta"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Desvío</span>
                </button>
                <button
                  onClick={handleSimulateSummit}
                  className="px-2.5 py-2 text-xs font-bold rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-all flex items-center justify-center gap-1.5"
                  title="Mover al usuario a la cumbre exacta"
                >
                  <Mountain className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Cumbre</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1.5 border-t border-slate-800">
              <button
                onClick={handleToggleWhistle}
                className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  isWhistling
                    ? "bg-red-600 text-white animate-pulse"
                    : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                }`}
              >
                {isWhistling ? (
                  <>
                    <VolumeX className="w-4 h-4" />
                    <span>Detener SOS</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                    <span>Silbato 3kHz</span>
                  </>
                )}
              </button>

              <a
                href={emergencySmsUrl}
                className="py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all flex items-center justify-center gap-2 text-center"
              >
                <PhoneCall className="w-4 h-4 text-emerald-400" />
                <span>SMS Lifeline</span>
              </a>
            </div>

            <button
              onClick={handleStampSummit}
              className={`w-full py-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm ${
                hasSummitStamp
                  ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
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
