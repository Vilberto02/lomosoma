import React, { useState, useEffect, useMemo, memo } from "react";
import type { Loma, Coordenadas, ReporteCiudadano } from "../../types";
import { usePro } from "../../context/ProContext";
import {
  fetchLomaCast,
  fetchSenderoProfile,
  downloadGpxUrl,
  postReporteCiudadano,
} from "../../services/api";
import {
  X,
  Mountain,
  Download,
  ShieldCheck,
  Lock,
  Sparkles,
  Send,
  CloudSun,
  MessageCircle,
  Navigation,
  Car,
  Footprints,
  Users,
  Award,
  ArrowLeft,
  Sun,
  Compass,
  WifiOff,
  Copy,
  Clock,
  Bus,
  Bike,
  Check,
  FileDown,
  Bookmark,
} from "lucide-react";
import toast from "react-hot-toast";

interface LomaDetailSheetProps {
  loma: Loma | null;
  onClose: () => void;
  onSetAsStartPoint: (coords: Coordenadas) => void;
  onFocusMap: (coords: Coordenadas) => void;
  isEmbedded?: boolean;
  isSaved?: boolean;
  onToggleSave?: () => void;
  isGuardianActive?: boolean;
  onToggleGuardian?: () => void;
}

const LomaDetailSheetComponent: React.FC<LomaDetailSheetProps> = ({
  loma,
  onClose,
  onSetAsStartPoint,
  onFocusMap,
  isEmbedded: _isEmbedded = false,
  isSaved = false,
  onToggleSave,
  isGuardianActive = false,
  onToggleGuardian,
}) => {
  const {
    isLomaProUnlocked,
    openUpgradeModal,
    offlinePackIds,
    downloadOfflinePackForLoma,
    summitStamps,
  } = usePro();

  const [activeTab, setActiveTab] = useState<"lomacast" | "sendero" | "transporte" | "grupo">("lomacast");
  const [lomaDetails, setLomaDetails] = useState<Loma | null>(loma);
  const [groupCount, setGroupCount] = useState<number>(4);
  const [isDownloadingPack, setIsDownloadingPack] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);

  // Formulario nuevo reporte ciudadano
  const [reportAuthor, setReportAuthor] = useState<string>("");
  const [reportComment, setReportComment] = useState<string>("");
  const [reportBarro, setReportBarro] = useState<string>("Moderado");
  const [reportAmancaes, setReportAmancaes] = useState<boolean>(true);
  const [reportColchon, setReportColchon] = useState<boolean>(true);
  const [isSubmittingReport, setIsSubmittingReport] = useState<boolean>(false);

  useEffect(() => {
    setLomaDetails(loma);
    if (!loma) return;

    if (!loma.lomacast && isLomaProUnlocked(loma.id)) {
      fetchLomaCast(loma.id)
        .then((cast) => {
          setLomaDetails((prev) => (prev ? { ...prev, lomacast: cast } : prev));
        })
        .catch(() => {});
    }

    if (!loma.sendero && isLomaProUnlocked(loma.id)) {
      fetchSenderoProfile(loma.id)
        .then((profile) => {
          setLomaDetails((prev) => (prev ? { ...prev, sendero: profile } : prev));
        })
        .catch(() => {});
    }
  }, [loma, isLomaProUnlocked]);

  const currentLoma = lomaDetails || loma;

  const isUnlocked = useMemo(() => {
    if (!currentLoma) return false;
    return isLomaProUnlocked(currentLoma.id);
  }, [currentLoma, isLomaProUnlocked]);

  const isOfflineSaved = useMemo(() => {
    if (!currentLoma) return false;
    return offlinePackIds.includes(currentLoma.id);
  }, [currentLoma, offlinePackIds]);

  const summitStamp = useMemo(() => {
    if (!currentLoma) return null;
    return summitStamps.find((s) => s.loma_id === currentLoma.id) || null;
  }, [currentLoma, summitStamps]);

  if (!currentLoma) return null;

  const sendero = currentLoma.sendero;
  const guia = currentLoma.guia_acceso;
  const tarifario = currentLoma.tarifario_oficial;

  const handleDownloadPack = async () => {
    if (!currentLoma) return;
    setIsDownloadingPack(true);
    await downloadOfflinePackForLoma(currentLoma.id);
    setIsDownloadingPack(false);
  };

  // Cálculos de Chancha
  const costGuia = tarifario?.guiado_grupal_pen ?? 35;
  const costEntrada = (tarifario?.entrada_adulto_pen ?? 10) * groupCount;
  const mototaxiUnit = guia?.tarifa_justa_mototaxi_pen ?? tarifario?.mototaxi_justo_pen ?? 6;
  const mototaxisNeeded = Math.ceil(groupCount / 3);
  const costTransporte = mototaxiUnit * mototaxisNeeded * 2;
  const totalChancha = costGuia + costEntrada + costTransporte;
  const cuotaPorPersona = Math.round((totalChancha / Math.max(1, groupCount)) * 10) / 10;

  const handleCopyChancha = () => {
    const text = `CHANCHA LOMOSOMA PARA ${currentLoma.nombre.toUpperCase()}:\n` +
      `Grupo: ${groupCount} excursionistas\n` +
      `Entradas (${groupCount}x S/ ${tarifario?.entrada_adulto_pen ?? 10}): S/ ${costEntrada}\n` +
      `Guía comunitario: S/ ${costGuia}\n` +
      `Transporte mototaxi (${mototaxisNeeded} motos ida y vuelta): S/ ${costTransporte}\n` +
      `TOTAL: S/ ${totalChancha}\n` +
      `CUOTA POR PERSONA: S/ ${cuotaPorPersona}\n` +
      `Organizado en Lomosoma Ecoturismo`;

    navigator.clipboard.writeText(text);
    toast.success("Presupuesto de chancha copiado al portapapeles.");
  };

  const handleSendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportAuthor.trim() || !reportComment.trim()) {
      toast.error("Por favor completa tu nombre y comentario.");
      return;
    }

    setIsSubmittingReport(true);
    try {
      const newReport: Partial<ReporteCiudadano> = {
        loma_id: currentLoma.id,
        autor: reportAuthor.trim(),
        estado_barro: reportBarro,
        flor_amancaes_vista: reportAmancaes,
        colchon_nubes_visto: reportColchon,
        comentario: reportComment.trim(),
      };
      const created = await postReporteCiudadano(currentLoma.id, newReport);
      setLomaDetails((prev) => {
        if (!prev) return prev;
        const list = prev.reportes_recientes ? [created, ...prev.reportes_recientes] : [created];
        return { ...prev, reportes_recientes: list };
      });
      setReportComment("");
      setShowReportModal(false);
      toast.success("¡Reporte ciudadano publicado con éxito!");
    } catch {
      toast.error("No se pudo publicar el reporte. Verifica tu conexión.");
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Curva de elevación SVG
  const elevationPoints = sendero?.perfil_elevacion ?? [];
  const minEle = sendero?.altitud_min_msnm ?? 200;
  const maxEle = sendero?.altitud_max_msnm ?? (currentLoma.altitud_max_msnm ?? 1000);
  const maxDist = sendero?.distancia_km ?? currentLoma.distancia_sendero_km ?? 6;

  const svgWidth = 320;
  const svgHeight = 90;
  const svgPoints = elevationPoints.length > 1
    ? elevationPoints
        .map((p) => {
          const x = (p.distancia_km / Math.max(0.1, maxDist)) * (svgWidth - 20) + 10;
          const y =
            svgHeight - 12 - ((p.altitud_msnm - minEle) / Math.max(1, maxEle - minEle)) * (svgHeight - 24);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ")
    : `10,${svgHeight - 10} 70,${svgHeight - 35} 160,${svgHeight - 55} 240,${svgHeight - 75} ${svgWidth - 10},15`;

  const compTierra =
    sendero?.composicion_terreno?.tierra_compacta_pct ??
    currentLoma.composicion_terreno?.tierra_compacta_pct ??
    45;
  const compRoca =
    sendero?.composicion_terreno?.roca_granito_pct ??
    currentLoma.composicion_terreno?.roca_granito_pct ??
    30;
  const compBarro =
    sendero?.composicion_terreno?.barro_arcilloso_pct ??
    currentLoma.composicion_terreno?.barro_arcilloso_pct ??
    25;

  const colchonPct =
    currentLoma.lomacast?.probabilidad_colchon_hoy_pct ??
    currentLoma.lomacast_resumen?.probabilidad_colchon_hoy_pct ??
    67;
  const florFase =
    currentLoma.lomacast?.fase_floracion_nombre ??
    currentLoma.lomacast_resumen?.fase_floracion_nombre ??
    "Semillado y transición";
  const florIndex = Math.max(
    1,
    Math.min(5, currentLoma.lomacast?.fase_floracion_index ?? 5)
  );
  const ventanaHoy = currentLoma.lomacast?.ventana_optima_hoy ?? "06:00–08:30";
  const goldenHourRaw = currentLoma.lomacast?.golden_hour_hoy ?? "05:36 · 17:22";
  const [goldenAm, goldenPm] = goldenHourRaw.includes("·")
    ? goldenHourRaw.split("·").map((s) => s.trim())
    : ["05:36", "17:22"];
  const barroEstado =
    currentLoma.lomacast?.estado_sendero_barro ??
    currentLoma.lomacast_resumen?.estado_sendero_barro ??
    "Moderado";

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-white">
      {/* 1. CABECERA: Identidad y navegación de la loma (bBDGl en Pencil) */}
      <div className="p-5 border-b border-[#E4E9DE] bg-white flex-shrink-0 flex flex-col gap-3">
        {/* Fila volver y guardar */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 text-[15px] font-bold text-[#3E5238] hover:text-[#203B2E] transition-colors py-1 px-2 rounded-lg hover:bg-[#F3F5F0] -ml-2"
          >
            <ArrowLeft className="w-4 h-4 text-[#546349]" />
            <span>Todas las lomas</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onToggleSave?.();
              toast.success(
                isSaved ? "Loma quitada de tus guardados" : "Loma guardada en tus favoritas"
              );
            }}
            className="p-1.5 rounded-lg text-[#546349] hover:text-[#203B2E] hover:bg-[#F3F5F0] transition-colors"
            title={isSaved ? "Quitar de guardados" : "Guardar loma"}
            aria-label={isSaved ? "Quitar de guardados" : "Guardar loma"}
          >
            <Bookmark
              className={`w-4 h-4 ${isSaved ? "fill-[#2E6540] text-[#2E6540]" : ""}`}
            />
          </button>
        </div>

        {/* Nombre y Ubicación */}
        <div>
          <h2 className="text-[26px] font-extrabold text-[#203B2E] leading-tight tracking-[-0.02em]">
            {currentLoma.nombre}
          </h2>
          <p className="text-[15px] text-[#3E5238] font-semibold mt-0.5">
            {currentLoma.distrito} {currentLoma.id === "L0" ? "· Apu Siqay" : ""}
          </p>
        </div>

        {/* Badges de Dificultad y Acceso PRO */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-bold border ${
            currentLoma.dificultad === "Fácil" || currentLoma.dificultad === "Facil"
              ? "bg-[#F0F5ED] text-[#2E6540] border-[#CAD9BE]"
              : currentLoma.dificultad === "Moderado"
              ? "bg-[#F8F3E7] text-[#82642F] border-[#E4D8BB]"
              : "bg-rose-50 text-rose-700 border-rose-200"
          }`}>
            <Mountain className="w-4 h-4 text-[#546349]" />
            <span>{currentLoma.dificultad}</span>
          </span>

          {isUnlocked ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-bold bg-[#F0F5ED] text-[#2E6540] border border-[#CAD9BE]">
              <ShieldCheck className="w-4 h-4" />
              <span>PRO desbloqueado</span>
            </span>
          ) : (
            <button
              onClick={() => openUpgradeModal(currentLoma.id)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-bold bg-[#F3F5F0] hover:bg-[#E4E9DE] text-[#3E5238] border border-[#E4E9DE] transition-colors"
            >
              <Lock className="w-4 h-4" />
              <span>Acceso PRO</span>
            </button>
          )}

          <span className="text-sm font-bold text-[#3E5238] ml-auto tabular-nums">
            {(currentLoma.altitud_max_msnm ?? 0).toLocaleString()} msnm
          </span>
        </div>
      </div>

      {/* 2. PESTAÑAS · Subnavegación de la Ficha (RFwu1 en Pencil) */}
      <div className="h-12 px-4 border-b border-[#E4E9DE] flex items-center bg-[#F3F5F0]/60 flex-shrink-0 gap-1">
        <button
          onClick={() => setActiveTab("lomacast")}
          className={`flex-1 h-10 rounded-lg text-[13px] sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "lomacast"
              ? "bg-white text-[#203B2E] shadow-sm border border-[#E4E9DE]"
              : "text-[#546349] hover:text-[#203B2E]"
          }`}
        >
          <CloudSun className="w-4 h-4" />
          <span>LomaCast</span>
        </button>

        <button
          onClick={() => setActiveTab("sendero")}
          className={`flex-1 h-10 rounded-lg text-[13px] sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "sendero"
              ? "bg-white text-[#203B2E] shadow-sm border border-[#E4E9DE]"
              : "text-[#546349] hover:text-[#203B2E]"
          }`}
        >
          <Footprints className="w-4 h-4" />
          <span>Sendero</span>
        </button>

        <button
          onClick={() => setActiveTab("transporte")}
          className={`flex-1 h-10 rounded-lg text-[13px] sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "transporte"
              ? "bg-white text-[#203B2E] shadow-sm border border-[#E4E9DE]"
              : "text-[#546349] hover:text-[#203B2E]"
          }`}
        >
          <Car className="w-4 h-4" />
          <span>Transporte</span>
        </button>

        <button
          onClick={() => setActiveTab("grupo")}
          className={`flex-1 h-10 rounded-lg text-[13px] sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "grupo"
              ? "bg-white text-[#203B2E] shadow-sm border border-[#E4E9DE]"
              : "text-[#546349] hover:text-[#203B2E]"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Grupo & Sello</span>
        </button>
      </div>

      {/* 3. CONTENIDO PRINCIPAL SCROLLEABLE SEGÚN PESTAÑA */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-5 bg-white">
        
        {/* PESTAÑA 1: LOMACAST (Frames 01, 02, 11) */}
        {activeTab === "lomacast" && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-150">
            {/* Ciclo de flor de Amancaes (JC1Vp en Pencil) */}
            <div className="p-4 bg-[#F0F5ED] border border-[#CAD9BE] rounded-xl flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs font-extrabold tracking-wider text-[#3E5238]">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#2E6540]" />
                  <span>FLOR DE AMANCAES</span>
                </div>
                <span className="text-[#203B2E] tabular-nums font-extrabold">
                  {String(florIndex).padStart(2, "0")} / 05
                </span>
              </div>

              <div>
                <span className="text-[17px] font-extrabold text-[#203B2E]">
                  {florFase}
                </span>
                <p className="text-sm font-medium text-[#3E5238] mt-0.5">
                  {currentLoma.temporada_optima
                    ? `Temporada óptima: ${currentLoma.temporada_optima}.`
                    : "Hojas maduras y formación de cápsula de semillas."}
                </p>
              </div>

              {/* Barra de 5 fases */}
              <div className="grid grid-cols-5 gap-1.5 pt-1">
                {[0, 1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`h-2 rounded-full ${
                      step < florIndex ? "bg-[#2E6540]" : "bg-[#CAD9BE]/60"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Condiciones de hoy (HD2NN en Pencil) */}
            <div className="grid grid-cols-2 gap-3">
              {/* Colchón de nubes */}
              <div className="p-4 bg-white border border-[#E4E9DE] rounded-xl flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-xs font-extrabold tracking-wider text-[#546349]">
                  <CloudSun className="w-4 h-4 text-[#546349]" />
                  <span>COLCHÓN DE NUBES</span>
                </div>
                <div className="my-1.5">
                  <span className="text-[28px] font-extrabold text-[#203B2E] tracking-tight tabular-nums">
                    {colchonPct}%
                  </span>
                </div>
                <span className="text-sm font-semibold text-[#3E5238] tabular-nums">
                  Ventana {ventanaHoy}
                </span>
              </div>

              {/* Luz y Terreno */}
              <div className="p-4 bg-white border border-[#E4E9DE] rounded-xl flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-xs font-extrabold tracking-wider text-[#546349]">
                  <Sun className="w-4 h-4 text-[#82642F]" />
                  <span>GOLDEN HOUR · HOY</span>
                </div>
                <div className="my-1.5 flex items-baseline gap-2 tabular-nums">
                  <span className="text-[18px] font-extrabold text-[#203B2E]">{goldenAm}</span>
                  <span className="text-sm text-[#546349]">·</span>
                  <span className="text-[18px] font-extrabold text-[#203B2E]">{goldenPm}</span>
                </div>
                <div className="flex items-center gap-1 text-sm font-bold text-[#82642F] bg-[#F8F3E7] px-2.5 py-0.5 rounded-md border border-[#E4D8BB]">
                  <span>Barro {barroEstado.toLowerCase()}</span>
                </div>
              </div>
            </div>

            {/* Pronóstico de siete días (mKLpa en Pencil) */}
            <div className="p-4 bg-white border border-[#E4E9DE] rounded-xl flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[16px] font-extrabold text-[#203B2E]">Esta semana</h4>
                <span className="text-xs font-bold text-[#546349] tracking-wider uppercase">
                  {currentLoma.lomacast?.mejor_dia_semana
                    ? `MEJOR DÍA: ${currentLoma.lomacast.mejor_dia_semana}`
                    : "PRONÓSTICO 7 DÍAS"}
                </span>
              </div>

              <div className="flex flex-col divide-y divide-[#E4E9DE]/60 text-[15px]">
                {(currentLoma.lomacast?.pronostico_7_dias &&
                currentLoma.lomacast.pronostico_7_dias.length > 0
                  ? currentLoma.lomacast.pronostico_7_dias.map((d, idx) => ({
                      dia: idx === 0 ? `Hoy · ${d.dia_nombre}` : d.dia_nombre,
                      temp: `${d.temp_min_c.toFixed(1)}° – ${d.temp_max_c.toFixed(1)}°`,
                      nubes: `${d.probabilidad_colchon_nubes_pct}%`,
                    }))
                  : [
                      { dia: "Hoy · 27", temp: "13.2° – 18.4°", nubes: `${colchonPct}%` },
                      { dia: "Miércoles 28", temp: "13.5° – 18.7°", nubes: "69%" },
                      { dia: "Jueves 29", temp: "13.8° – 19.1°", nubes: "72%" },
                      { dia: "Viernes 30", temp: "14.0° – 19.3°", nubes: "74%" },
                      { dia: "Sábado 31", temp: "13.4° – 18.7°", nubes: "66%" },
                      { dia: "Domingo 01", temp: "13.6° – 18.9°", nubes: "67%" },
                      { dia: "Lunes 02", temp: "13.5° – 18.9°", nubes: "64%" },
                    ]
                ).map((row, i) => (
                  <div
                    key={i}
                    className="py-2 flex items-center justify-between first:pt-0 last:pb-0 tabular-nums"
                  >
                    <span className="font-bold text-[#203B2E] w-32 truncate">{row.dia}</span>
                    <CloudSun className="w-4 h-4 text-[#546349]" />
                    <span className="text-[#3E5238] font-semibold">{row.temp}</span>
                    <span className="font-extrabold text-[#2E6540] w-12 text-right">
                      {row.nubes}
                    </span>
                  </div>
                ))}
              </div>

              {!isUnlocked && (
                <button
                  type="button"
                  onClick={() => openUpgradeModal(currentLoma.id)}
                  className="mt-1 h-11 px-3 bg-[#F0F5ED] hover:bg-[#E4E9DE] text-[#2E6540] border border-[#CAD9BE] rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Desbloquear LomaCast 7D en tiempo real con PRO</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* PESTAÑA 2: SENDERO / OFFLINE (Frames 05, 12) */}
        {activeTab === "sendero" && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-150">
            {/* Maletín offline Zero Signal (VNG6z en Pencil) */}
            <div className="p-4 bg-[#F0F5ED] border border-[#CAD9BE] rounded-xl flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-white border border-[#CAD9BE] flex items-center justify-center text-[#2E6540]">
                  <WifiOff className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-[16px] font-extrabold text-[#203B2E]">Tu ruta, incluso sin señal.</h4>
                  <p className="text-sm font-medium text-[#3E5238]">Mapas, sendero 3D y waypoints offline.</p>
                </div>
              </div>

              <button
                onClick={handleDownloadPack}
                disabled={isDownloadingPack}
                className="mt-1 h-11 px-3 bg-[#243C2D] hover:bg-[#192b20] text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                {isDownloadingPack ? (
                  <span>Descargando pack offline...</span>
                ) : isOfflineSaved ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Pack guardado en tu dispositivo</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Descargar maletín offline Zero Signal</span>
                  </>
                )}
              </button>
            </div>

            {/* Perfil de elevación (vjIQv en Pencil) */}
            <div className="p-4 bg-white border border-[#E4E9DE] rounded-xl flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[16px] font-extrabold text-[#203B2E]">Perfil de elevación</span>
                <span className="text-sm font-extrabold text-[#2E6540] bg-[#F0F5ED] px-2.5 py-0.5 rounded-md border border-[#CAD9BE] tabular-nums">
                  ↗ +{currentLoma.desnivel_positivo_m ?? 580} m
                </span>
              </div>

              {/* Gráfico SVG de elevación */}
              <div className="w-full bg-[#F3F5F0] rounded-lg p-2 flex items-center justify-center">
                <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-24 overflow-visible">
                  <polyline
                    fill="none"
                    stroke="#2E6540"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={svgPoints}
                  />
                  <path
                    d={`M 10,${svgHeight - 12} L ${svgPoints} L ${svgWidth - 10},${svgHeight - 12} Z`}
                    fill="url(#gradElevation)"
                    opacity="0.25"
                  />
                  <defs>
                    <linearGradient id="gradElevation" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#2E6540" />
                      <stop offset="100%" stopColor="#CAD9BE" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              <div className="flex items-center justify-between text-[13px] text-[#3E5238] font-semibold pt-1 tabular-nums">
                <span>Inicio: {minEle} msnm</span>
                <span>Distancia: {maxDist} km</span>
                <span>Máx: {maxEle} msnm</span>
              </div>
            </div>

            {/* Composición del terreno (Y7spIz en Pencil) */}
            <div className="p-4 bg-white border border-[#E4E9DE] rounded-xl flex flex-col gap-2.5">
              <span className="text-[16px] font-extrabold text-[#203B2E]">Conoce el terreno</span>

              {/* Barra segmentada */}
              <div className="h-3 w-full rounded-full overflow-hidden flex bg-[#E4E9DE]">
                <div style={{ width: `${compTierra}%` }} className="bg-[#8CA276]" title="Tierra compacta" />
                <div style={{ width: `${compRoca}%` }} className="bg-[#BDC8AF]" title="Roca granito" />
                <div style={{ width: `${compBarro}%` }} className="bg-[#D8C8A6]" title="Barro arcilloso" />
              </div>

              {/* Leyenda */}
              <div className="flex items-center justify-between text-sm font-bold text-[#3E5238] pt-1 tabular-nums">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#8CA276]" />
                  <span>Tierra {compTierra}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#BDC8AF]" />
                  <span>Roca {compRoca}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#D8C8A6]" />
                  <span>Barro {compBarro}%</span>
                </div>
              </div>
            </div>

            {/* Descarga GPX para dispositivos (USuEw en Pencil) */}
            <a
              href={downloadGpxUrl(currentLoma.id)}
              download={`${currentLoma.nombre.replace(/\s+/g, "_")}.gpx`}
              className="h-11 px-3 bg-white border border-[#CAD9BE] hover:bg-[#F3F5F0] text-[#203B2E] text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <FileDown className="w-4 h-4 text-[#2E6540]" />
              <span>Descargar archivo GPX (Garmin / Strava)</span>
            </a>
          </div>
        )}

        {/* PESTAÑA 3: TRANSPORTE / 3 MODOS (Frames 04, 13, 14) */}
        {activeTab === "transporte" && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <h4 className="text-[17px] font-extrabold text-[#203B2E]">Cómo llegar al sendero</h4>
              <span className="text-sm font-bold text-[#546349]">3 Modos de acceso</span>
            </div>

            {/* Modo 1: Transporte Público */}
            <div className="p-4 bg-white border border-[#E4E9DE] rounded-xl flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-[#F0F5ED] text-[#2E6540] flex items-center justify-center">
                    <Bus className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-[16px] font-extrabold text-[#203B2E]">Transporte Público / Intermodal</h5>
                    <span className="text-sm font-semibold text-[#546349]">Tren Eléctrico L1 + Combi</span>
                  </div>
                </div>
                <div className="text-right tabular-nums">
                  <span className="text-[16px] font-extrabold text-[#203B2E]">S/ 8.50</span>
                  <p className="text-sm font-medium text-[#546349]">~95 min</p>
                </div>
              </div>
              <p className="text-sm font-medium text-[#3E5238] border-t border-[#E4E9DE]/60 pt-2 leading-relaxed">
                Bajar en Estación María Auxiliadora y tomar combi a Nueva Esperanza hasta el último paradero.
              </p>
            </div>

            {/* Modo 2: Auto o Taxi Directo */}
            <div className="p-4 bg-white border border-[#E4E9DE] rounded-xl flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-[#F0F5ED] text-[#2E6540] flex items-center justify-center">
                    <Car className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-[16px] font-extrabold text-[#203B2E]">Auto Particular o Taxi</h5>
                    <span className="text-sm font-semibold text-[#546349]">Vía Panamericana Sur</span>
                  </div>
                </div>
                <div className="text-right tabular-nums">
                  <span className="text-[16px] font-extrabold text-[#203B2E]">S/ 35.00</span>
                  <p className="text-sm font-medium text-[#546349]">~42 min</p>
                </div>
              </div>
              <p className="text-sm font-medium text-[#3E5238] border-t border-[#E4E9DE]/60 pt-2 leading-relaxed">
                Estacionamiento comunitario vigilado disponible junto a la garita de control oficial.
              </p>
            </div>

            {/* Modo 3: Mototaxi Última Milla */}
            <div className="p-4 bg-white border border-[#E4E9DE] rounded-xl flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-[#F8F3E7] text-[#82642F] flex items-center justify-center">
                    <Bike className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-[16px] font-extrabold text-[#203B2E]">Mototaxi Comunitario</h5>
                    <span className="text-sm text-[#82642F] font-bold">Tarifa Justa Oficial</span>
                  </div>
                </div>
                <div className="text-right tabular-nums">
                  <span className="text-[16px] font-extrabold text-[#82642F]">S/ 3.50</span>
                  <p className="text-sm font-medium text-[#546349]">por persona</p>
                </div>
              </div>
              <p className="text-sm font-medium text-[#3E5238] border-t border-[#E4E9DE]/60 pt-2 leading-relaxed">
                Desde paradero final de Edén del Manantial hasta la entrada del circuito ecoturístico.
              </p>
            </div>

            {/* Horario de Retorno y Seguridad */}
            <div className="p-4 bg-[#F8F3E7] border border-[#E4D8BB] rounded-xl flex items-center gap-2.5 text-sm text-[#82642F]">
              <Clock className="w-4 h-4 flex-shrink-0 text-[#82642F]" />
              <div>
                <span className="font-bold tabular-nums">
                  Hora límite de bajada: {currentLoma.garita_control?.hora_limite_bajada ?? "16:30"}.
                </span>
                <p className="text-sm font-medium text-[#82642F]/90 mt-0.5 tabular-nums">
                  Último transporte de retorno a las{" "}
                  {currentLoma.garita_control?.ultimo_transporte_retorno ??
                    guia?.ultimo_transporte_retorno ??
                    "17:45"}
                  .
                </p>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 4: GRUPO & PASAPORTE (Frames 03, 15, 16) */}
        {activeTab === "grupo" && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-150">
            {/* Título de grupo */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-[17px] font-extrabold text-[#203B2E]">La escapada, en grupo.</h4>
                <p className="text-sm font-medium text-[#546349]">Calcula la cuota por persona (chancha).</p>
              </div>
              <Users className="w-5 h-5 text-[#2E6540]" />
            </div>

            {/* Selector de participantes (Wn39Y en Pencil) */}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-[#3E5238]">¿Cuántos van? ({groupCount} personas)</span>
              <div className="grid grid-cols-6 gap-1.5">
                {[1, 2, 4, 6, 8, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setGroupCount(num)}
                    className={`h-10 rounded-lg text-[15px] font-extrabold tabular-nums transition-all ${
                      groupCount === num
                        ? "bg-[#243C2D] text-white shadow-sm"
                        : "bg-[#F3F5F0] text-[#3E5238] hover:bg-[#E4E9DE]"
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Desglose de gastos (l7R46T en Pencil) */}
            <div className="p-4 bg-white border border-[#E4E9DE] rounded-xl flex flex-col gap-2 text-[15px]">
              <div className="flex justify-between items-center py-1.5 border-b border-[#E4E9DE]/60">
                <div>
                  <span className="font-bold text-[#203B2E]">Guía comunitario</span>
                  <p className="text-sm font-medium text-[#546349]">
                    {tarifario?.asociacion ?? "Asociación local Ecoturística"}
                  </p>
                </div>
                <span className="font-extrabold text-[#203B2E] tabular-nums">S/ {costGuia}</span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-b border-[#E4E9DE]/60">
                <div>
                  <span className="font-bold text-[#203B2E]">Entradas</span>
                  <p className="text-sm font-medium text-[#546349] tabular-nums">
                    {groupCount} personas x S/ {tarifario?.entrada_adulto_pen ?? 10}
                  </p>
                </div>
                <span className="font-extrabold text-[#203B2E] tabular-nums">S/ {costEntrada}</span>
              </div>

              <div className="flex justify-between items-center py-1.5">
                <div>
                  <span className="font-bold text-[#203B2E]">Transporte última milla</span>
                  <p className="text-sm font-medium text-[#546349] tabular-nums">
                    {mototaxisNeeded} motos · ida y vuelta
                  </p>
                </div>
                <span className="font-extrabold text-[#203B2E] tabular-nums">S/ {costTransporte}</span>
              </div>
            </div>

            {/* Tarjeta de Cuota Individual (OCEn5 en Pencil) */}
            <div className="p-4 bg-[#F0F5ED] border border-[#CAD9BE] rounded-xl flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-extrabold tracking-wider text-[#3E5238] uppercase">
                  CUOTA POR PERSONA
                </span>
                <span className="text-sm font-semibold text-[#546349] tabular-nums">
                  S/ {totalChancha} en total · entre {groupCount}
                </span>
              </div>
              <span className="text-[28px] font-extrabold text-[#203B2E] tracking-tight tabular-nums">
                S/ {cuotaPorPersona}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCopyChancha}
              className="h-11 px-3 bg-white border border-[#CAD9BE] hover:bg-[#F3F5F0] text-[#203B2E] text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <Copy className="w-4 h-4 text-[#2E6540]" />
              <span>Copiar desglose al portapapeles</span>
            </button>

            {/* Pasaporte digital de cumbres (lkkxL en Pencil) */}
            <div className="p-4 bg-white border border-[#E4E9DE] rounded-xl flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-[#2E6540]" />
                  <span className="text-[16px] font-extrabold text-[#203B2E]">Pasaporte de cumbres</span>
                </div>
                <span className={`text-sm font-bold px-2.5 py-0.5 rounded-md ${
                  summitStamp ? "bg-[#F0F5ED] text-[#2E6540]" : "bg-[#F3F5F0] text-[#546349]"
                }`}>
                  {summitStamp ? "Sellado" : "Pendiente"}
                </span>
              </div>
              <p className="text-sm font-medium text-[#3E5238] leading-relaxed">
                Acércate a menos de 60 m del punto de cumbre y activa Fog Guardian para registrar tu sello digital con firma SHA-256.
              </p>
              {onToggleGuardian && (
                <button
                  type="button"
                  onClick={onToggleGuardian}
                  className={`h-11 px-3 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-all border ${
                    isGuardianActive
                      ? "bg-[#243C2D] text-white border-[#243C2D]"
                      : "bg-[#F0F5ED] hover:bg-[#E4E9DE] text-[#2E6540] border-[#CAD9BE]"
                  }`}
                >
                  <Compass className="w-4 h-4" />
                  <span>
                    {isGuardianActive
                      ? "Ocultar Fog Guardian GPS"
                      : "Activar Fog Guardian GPS"}
                  </span>
                </button>
              )}
            </div>

            {/* Disparador de Reporte Ciudadano (Frame 16) */}
            <button
              type="button"
              onClick={() => setShowReportModal(true)}
              className="h-11 px-3 bg-[#F3F5F0] hover:bg-[#E4E9DE] text-[#203B2E] text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all border border-[#E4E9DE]"
            >
              <MessageCircle className="w-4 h-4 text-[#2E6540]" />
              <span>¿Cómo está la loma hoy? Enviar reporte ciudadano</span>
            </button>
          </div>
        )}
      </div>

      {/* 4. PIE DE PANEL FIJO (Euby2 en Pencil) */}
      <div className="p-4 border-t border-[#E4E9DE] bg-white flex flex-col gap-2 flex-shrink-0">
        <button
          onClick={() => onSetAsStartPoint(currentLoma.coordenadas)}
          className="h-12 w-full bg-[#243C2D] hover:bg-[#192b20] active:scale-[0.99] text-white text-[15px] font-bold rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all"
        >
          <Navigation className="w-4 h-4" />
          <span>Usar como punto de partida</span>
        </button>

        <button
          onClick={() => onFocusMap(currentLoma.coordenadas)}
          className="h-11 w-full bg-white border border-[#CAD9BE] hover:bg-[#F3F5F0] text-[#3E5238] text-[15px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all"
        >
          <Compass className="w-4 h-4 text-[#546349]" />
          <span>Centrar en el mapa</span>
        </button>
      </div>

      {/* MODAL / OVERLAY: Reporte Ciudadano (Frame 16: pr52w) */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-[#CAD9BE] rounded-2xl shadow-lomo-panel p-5 flex flex-col gap-4 animate-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[20px] font-extrabold text-[#203B2E]">¿Cómo está la loma hoy?</h3>
                <p className="text-sm font-medium text-[#546349] mt-0.5">Tu reporte ayuda a quienes vienen después.</p>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-1 rounded-lg text-[#546349] hover:text-[#203B2E] hover:bg-[#F3F5F0]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendReport} className="flex flex-col gap-3">
              <div>
                <label className="text-sm font-bold text-[#3E5238] block mb-1">Tu nombre</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Valeria Romero"
                  value={reportAuthor}
                  onChange={(e) => setReportAuthor(e.target.value)}
                  className="w-full h-11 px-3 bg-[#F3F5F0] border border-[#E4E9DE] rounded-lg text-[15px] font-medium text-[#203B2E] placeholder-[#546349] focus:outline-none focus:border-[#2E6540]"
                />
              </div>

              {/* Casillas de Avistamiento */}
              <div className="flex items-center gap-4 py-1">
                <label className="flex items-center gap-2 cursor-pointer text-[15px] font-bold text-[#203B2E]">
                  <input
                    type="checkbox"
                    checked={reportAmancaes}
                    onChange={(e) => setReportAmancaes(e.target.checked)}
                    className="w-4 h-4 accent-[#2E6540] rounded"
                  />
                  <span>Flor de Amancaes</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-[15px] font-bold text-[#203B2E]">
                  <input
                    type="checkbox"
                    checked={reportColchon}
                    onChange={(e) => setReportColchon(e.target.checked)}
                    className="w-4 h-4 accent-[#2E6540] rounded"
                  />
                  <span>Colchón de nubes</span>
                </label>
              </div>

              {/* Estado de barro */}
              <div>
                <label className="text-sm font-bold text-[#3E5238] block mb-1">Estado del terreno / barro</label>
                <div className="grid grid-cols-3 gap-2">
                  {["Seco", "Moderado", "Resbaladizo"].map((nivel) => (
                    <button
                      key={nivel}
                      type="button"
                      onClick={() => setReportBarro(nivel)}
                      className={`h-10 rounded-lg text-sm font-bold transition-all ${
                        reportBarro === nivel
                          ? "bg-[#2E6540] text-white shadow-xs"
                          : "bg-[#F3F5F0] text-[#3E5238] hover:bg-[#E4E9DE]"
                      }`}
                    >
                      {nivel}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comentario */}
              <div>
                <label className="text-sm font-bold text-[#3E5238] block mb-1">Cuéntanos sobre el sendero y el clima…</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detalla cómo está el viento, la visibilidad y el calzado recomendado hoy..."
                  value={reportComment}
                  onChange={(e) => setReportComment(e.target.value)}
                  className="w-full p-3 bg-[#F3F5F0] border border-[#E4E9DE] rounded-lg text-[15px] font-medium text-[#203B2E] placeholder-[#546349] focus:outline-none focus:border-[#2E6540]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E9DE]">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="h-11 px-4 text-sm font-bold text-[#546349] hover:bg-[#F3F5F0] rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReport}
                  className="h-11 px-5 bg-[#243C2D] hover:bg-[#192b20] text-white text-sm font-bold rounded-lg flex items-center gap-1.5 shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmittingReport ? "Publicando..." : "Enviar reporte"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const LomaDetailSheet = memo(LomaDetailSheetComponent);
