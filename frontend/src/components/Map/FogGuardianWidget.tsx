import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
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
  ChevronDown,
  ChevronUp,
  X,
  Award,
} from "lucide-react";
import toast from "react-hot-toast";

interface FogGuardianWidgetProps {
  selectedLoma: Loma | null;
  userCoords: Coordenadas;
  onUserCoordsChange: (coords: Coordenadas) => void;
  onClose?: () => void;
}

const FogGuardianWidgetComponent: React.FC<FogGuardianWidgetProps> = ({
  selectedLoma,
  userCoords,
  onUserCoordsChange,
  onClose,
}) => {
  const { offlinePackIds, addSummitStamp, summitStamps, isLomaProUnlocked } = usePro();
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
    } else if (selectedLoma?.id && isLomaProUnlocked(selectedLoma.id)) {
      fetchSenderoProfile(selectedLoma.id)
        .then((s) => setSendero(s))
        .catch(() => setSendero(null));
    } else {
      setSendero(null);
    }
  }, [selectedLoma, isLomaProUnlocked]);

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
      toast.success("¡Cumbre conquistada! Pasaporte digital sellado con SHA-256.");
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
    <div className="absolute bottom-4 left-[480px] z-30 transition-all duration-200 pointer-events-auto">
      {/* 1. MODO COMPACTO: GPS / Compact (fY6o9 en Pencil) */}
      {isMinimized ? (
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lomo-control transition-all ${
            isOffTrail
              ? "bg-[#F8F3E7] border-[#E4D8BB] text-[#82642F] animate-pulse"
              : "bg-white border-[#E4E9DE] text-[#203B2E]"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isOffTrail
                  ? "bg-[#82642F] text-white"
                  : "bg-[#F0F5ED] text-[#2E6540]"
              }`}
            >
              {isOffTrail ? (
                <ShieldAlert className="w-4 h-4" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-[15px] font-black leading-tight">
                  {isOffTrail ? "Fog Guardian · Aviso de desvío" : "Fog Guardian"}
                </span>
                <span className="text-sm font-semibold text-[#546349]">
                  · {altitud} msnm
                </span>
                {isPackOffline && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-[#F0F5ED] text-[#2E6540] font-bold">
                    Offline
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-sm font-bold">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    isOffTrail ? "bg-[#82642F]" : "bg-[#2E6540] animate-ping"
                  }`}
                />
                <span className={isOffTrail ? "text-[#82642F]" : "text-[#3E5238]"}>
                  {isOffTrail
                    ? `Fuera del sendero (${deviation} m · límite 35 m)`
                    : `En el sendero · desvío de ${deviation} m`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 ml-2 border-l border-[#E4E9DE] pl-2">
            <button
              onClick={handleToggleWhistle}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                isWhistling
                  ? "bg-rose-600 text-white animate-pulse"
                  : "hover:bg-[#F3F5F0] text-[#546349]"
              }`}
              title="Silbato acústico 3000Hz"
            >
              {isWhistling ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setIsMinimized(false)}
              className="p-1.5 rounded-lg text-[#546349] hover:text-[#203B2E] hover:bg-[#F3F5F0] transition-colors"
              title="Expandir panel táctico"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* 2. MODO EXPANDIDO: HUD Táctico Completo */
        <div className="w-[384px] bg-white border border-[#CAD9BE] rounded-2xl shadow-lomo-panel p-4 flex flex-col gap-3.5 animate-in zoom-in-95">
          {/* Cabecera */}
          <div className="flex items-center justify-between pb-2.5 border-b border-[#E4E9DE]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[#F0F5ED] text-[#2E6540] flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-[16px] font-black text-[#203B2E]">Fog Guardian · GPS Táctico</h4>
                <p className="text-sm font-semibold text-[#546349]">{selectedLoma.nombre}</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(true)}
                className="p-1.5 text-[#546349] hover:text-[#203B2E] hover:bg-[#F3F5F0] rounded-lg"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-1.5 text-[#546349] hover:text-[#203B2E] hover:bg-[#F3F5F0] rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Métricas en vivo */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 bg-[#F3F5F0] rounded-xl border border-[#E4E9DE]">
              <span className="text-xs font-extrabold text-[#546349] block">DESVÍO</span>
              <span className={`text-[17px] font-black tabular-nums ${isOffTrail ? "text-[#82642F]" : "text-[#2E6540]"}`}>
                {deviation} m
              </span>
            </div>
            <div className="p-2.5 bg-[#F3F5F0] rounded-xl border border-[#E4E9DE]">
              <span className="text-xs font-extrabold text-[#546349] block">ALTITUD</span>
              <span className="text-[17px] font-black tabular-nums text-[#203B2E]">{altitud} msnm</span>
            </div>
            <div className="p-2.5 bg-[#F3F5F0] rounded-xl border border-[#E4E9DE]">
              <span className="text-xs font-extrabold text-[#546349] block">AVANCE</span>
              <span className="text-[17px] font-black tabular-nums text-[#2E6540]">{progress}%</span>
            </div>
          </div>

          {/* Acciones de Emergencia */}
          <div className="flex gap-2">
            <button
              onClick={handleToggleWhistle}
              className={`flex-1 h-11 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                isWhistling
                  ? "bg-rose-600 text-white animate-pulse"
                  : "bg-[#F3F5F0] hover:bg-[#E4E9DE] text-[#203B2E] border border-[#E4E9DE]"
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>{isWhistling ? "Silbato Activo" : "Silbato 3000Hz"}</span>
            </button>

            <a
              href={emergencySmsUrl}
              className="flex-1 h-11 rounded-lg text-sm font-bold bg-[#F8F3E7] hover:bg-[#E4D8BB] text-[#82642F] border border-[#E4D8BB] flex items-center justify-center gap-1.5 transition-all"
            >
              <PhoneCall className="w-4 h-4" />
              <span>SMS Auxilio</span>
            </a>
          </div>

          {/* Simulador GPS para pruebas de senderismo */}
          <div className="pt-2.5 border-t border-[#E4E9DE] flex flex-col gap-2">
            <span className="text-xs font-extrabold text-[#546349] uppercase tracking-[0.05em]">
              SIMULADOR DE RUTA
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={handleSimulateAdvance}
                className="h-9 bg-[#F3F5F0] hover:bg-[#E4E9DE] text-sm font-bold text-[#203B2E] rounded-lg border border-[#E4E9DE]"
              >
                Avanzar +1
              </button>
              <button
                onClick={handleSimulateDeviation}
                className="h-9 bg-[#F8F3E7] hover:bg-[#E4D8BB] text-sm font-bold text-[#82642F] rounded-lg border border-[#E4D8BB]"
              >
                Desviar &gt;35m
              </button>
              <button
                onClick={handleSimulateSummit}
                className="h-9 bg-[#F0F5ED] hover:bg-[#CAD9BE] text-sm font-bold text-[#2E6540] rounded-lg border border-[#CAD9BE]"
              >
                Ir a Cumbre
              </button>
            </div>
          </div>

          {/* Sello de cumbre digital */}
          <button
            onClick={handleStampSummit}
            className={`h-11 w-full rounded-lg text-[15px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm ${
              hasSummitStamp
                ? "bg-[#F0F5ED] text-[#2E6540] border border-[#CAD9BE]"
                : "bg-[#243C2D] hover:bg-[#192b20] text-white"
            }`}
          >
            <Award className="w-4 h-4" />
            <span>{hasSummitStamp ? "Cumbre sellada (SHA-256)" : "Sellar cumbre digital"}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export const FogGuardianWidget = memo(FogGuardianWidgetComponent);
