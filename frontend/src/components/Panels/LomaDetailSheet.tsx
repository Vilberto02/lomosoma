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
  MapPin,
  Compass,
  Mountain,
  Download,
  ShieldCheck,
  Lock,
  Sparkles,
  Share2,
  CheckCircle2,
  Send,
  CloudSun,
  AlertCircle,
  MessageCircle,
  Navigation,
  Car,
  Footprints,
  Users,
  Award,
  ArrowLeft,
} from "lucide-react";
import { Card, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import toast from "react-hot-toast";

interface LomaDetailSheetProps {
  loma: Loma | null;
  onClose: () => void;
  onSetAsStartPoint: (coords: Coordenadas) => void;
  onFocusMap: (coords: Coordenadas) => void;
  isEmbedded?: boolean;
}

const LomaDetailSheetComponent: React.FC<LomaDetailSheetProps> = ({
  loma,
  onClose,
  onSetAsStartPoint,
  onFocusMap,
  isEmbedded = false,
}) => {
  const {
    isLomaProUnlocked,
    openUpgradeModal,
    offlinePackIds,
    downloadOfflinePackForLoma,
    summitStamps,
  } = usePro();

  const [activeTab, setActiveTab] = useState<string>("lomacast");
  const [lomaDetails, setLomaDetails] = useState<Loma | null>(loma);
  const [groupCount, setGroupCount] = useState<number>(4);
  const [isDownloadingPack, setIsDownloadingPack] = useState<boolean>(false);

  // Formulario nuevo reporte ciudadano
  const [reportAuthor, setReportAuthor] = useState<string>("");
  const [reportComment, setReportComment] = useState<string>("");
  const [reportBarro, setReportBarro] = useState<string>("Optimo y Seco");
  const [reportAmancaes, setReportAmancaes] = useState<boolean>(true);
  const [reportColchon, setReportColchon] = useState<boolean>(true);
  const [isSubmittingReport, setIsSubmittingReport] = useState<boolean>(false);

  useEffect(() => {
    setLomaDetails(loma);
    if (!loma) return;

    if (!loma.lomacast) {
      fetchLomaCast(loma.id)
        .then((cast) => {
          setLomaDetails((prev) => (prev ? { ...prev, lomacast: cast } : prev));
        })
        .catch(() => {});
    }

    if (!loma.sendero) {
      fetchSenderoProfile(loma.id)
        .then((profile) => {
          setLomaDetails((prev) => (prev ? { ...prev, sendero: profile } : prev));
        })
        .catch(() => {});
    }
  }, [loma]);

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

  const lomacast = currentLoma.lomacast;
  const sendero = currentLoma.sendero;
  const guia = currentLoma.guia_acceso;
  const tarifario = currentLoma.tarifario_oficial;

  const handleDownloadPack = async () => {
    if (!currentLoma) return;
    setIsDownloadingPack(true);
    await downloadOfflinePackForLoma(currentLoma.id);
    setIsDownloadingPack(false);
  };

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
      `Guia comunitario: S/ ${costGuia}\n` +
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
      toast.success("Reporte ciudadano publicado con exito");
    } catch {
      toast.error("No se pudo publicar el reporte. Verifica tu conexion.");
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const elevationPoints = sendero?.perfil_elevacion ?? [];
  const minEle = sendero?.altitud_min_msnm ?? 200;
  const maxEle = sendero?.altitud_max_msnm ?? 1000;
  const maxDist = sendero?.distancia_km ?? currentLoma.distancia_sendero_km ?? 6;

  const svgWidth = 320;
  const svgHeight = 120;
  const svgPoints = elevationPoints.length > 1
    ? elevationPoints
        .map((p) => {
          const x = (p.distancia_km / Math.max(0.1, maxDist)) * (svgWidth - 20) + 10;
          const y =
            svgHeight - 15 - ((p.altitud_msnm - minEle) / Math.max(1, maxEle - minEle)) * (svgHeight - 30);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ")
    : `10,${svgHeight - 15} ${svgWidth / 2},${svgHeight / 2} ${svgWidth - 10},15`;

  const compTierra =
    sendero?.composicion_terreno?.tierra_compacta_pct ??
    currentLoma.composicion_terreno?.tierra_compacta_pct ??
    60;
  const compRoca =
    sendero?.composicion_terreno?.roca_granito_pct ??
    currentLoma.composicion_terreno?.roca_granito_pct ??
    25;
  const compBarro =
    sendero?.composicion_terreno?.barro_arcilloso_pct ??
    currentLoma.composicion_terreno?.barro_arcilloso_pct ??
    15;

  const containerClass = isEmbedded
    ? "flex flex-col h-full w-full overflow-hidden bg-white"
    : "absolute top-20 right-4 z-20 w-[92vw] sm:w-[440px] max-w-[440px] h-[calc(100vh-140px)] max-h-[760px] flex flex-col animate-in slide-in-from-right-4 fade-in-50 duration-200";

  const cardClass = isEmbedded
    ? "border-0 shadow-none bg-transparent rounded-none flex flex-col h-full overflow-hidden bg-white"
    : "border border-slate-200 shadow-panel bg-white rounded-2xl flex flex-col h-full overflow-hidden";

  return (
    <div className={containerClass}>
      <Card className={cardClass}>
        {/* Cabecera Principal */}
        <div className="p-4 border-b border-slate-200 bg-white flex-shrink-0 relative">
          <div className="flex items-center justify-between mb-2.5">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-primary hover:text-primary/80 transition-colors py-1 px-2 rounded-lg hover:bg-primary/10"
              title="Volver al catalogo de lomas"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver al catalogo</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge
              variant={
                currentLoma.dificultad === "Facil" || currentLoma.dificultad === "Fácil"
                  ? "success"
                  : currentLoma.dificultad === "Moderado"
                  ? "warning"
                  : "destructive"
              }
              className="text-xs font-semibold px-2.5 py-0.5"
            >
              {currentLoma.dificultad}
            </Badge>
            <span className="text-xs sm:text-sm text-slate-500 flex items-center gap-1 font-medium">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              {currentLoma.distrito}
            </span>
            {isUnlocked && (
              <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-300 text-xs font-semibold gap-1 px-2 py-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                PRO Desbloqueado
              </Badge>
            )}
          </div>
          <CardTitle className="text-xl font-bold text-slate-900 leading-snug">
            {currentLoma.nombre}
          </CardTitle>
          <div className="text-xs text-slate-400 font-mono mt-1">
            {currentLoma.coordenadas.lat.toFixed(4)}, {currentLoma.coordenadas.lon.toFixed(4)}
          </div>
        </div>

        {/* Pestañas de Alto Valor */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 bg-white">
          <div className="px-4 pt-2 border-b border-slate-200 bg-slate-50">
            <TabsList className="grid grid-cols-4 w-full h-10">
              <TabsTrigger value="lomacast" className="text-xs sm:text-sm font-semibold py-1.5">
                LomaCast
              </TabsTrigger>
              <TabsTrigger value="sendero" className="text-xs sm:text-sm font-semibold py-1.5">
                Sendero
              </TabsTrigger>
              <TabsTrigger value="acceso" className="text-xs sm:text-sm font-semibold py-1.5">
                3 Modos
              </TabsTrigger>
              <TabsTrigger value="grupo" className="text-xs sm:text-sm font-semibold py-1.5">
                Grupo & Sello
              </TabsTrigger>
            </TabsList>
          </div>

          <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-white">
            {/* PESTAÑA 1: LOMACAST 7D */}
            <TabsContent value="lomacast" className="space-y-4 m-0">
              {!isUnlocked && currentLoma.id !== "L0" ? (
                <div className="p-4 rounded-xl border border-primary/30 bg-emerald-50/40 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      LomaCast 7D Exclusivo de Lomosoma PRO
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600 mt-1">
                      Desbloquea la prediccion de colchon de nubes a 7 dias, medidor de floracion y estado del barro con un pago unico vitalicio.
                    </p>
                  </div>
                  <Button
                    onClick={() => openUpgradeModal(currentLoma.id)}
                    className="w-full text-xs sm:text-sm font-bold h-10 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Sparkles className="w-4 h-4 mr-1.5" />
                    Desbloquear Loma (S/ 4.90) o Pack Lima (S/ 19.90)
                  </Button>
                </div>
              ) : null}

              {/* Medidor de Flor de Amancaes en 5 Fases */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Mountain className="w-4 h-4 text-primary" />
                    Fase Flor de Amancaes
                  </span>
                  <Badge variant="outline" className="text-xs font-mono font-bold text-primary border-primary/30 px-2 py-0.5">
                    Fase {lomacast?.fase_floracion_index ?? 3} / 5
                  </Badge>
                </div>
                <div className="text-sm sm:text-base font-bold text-slate-900">
                  {lomacast?.fase_floracion_nombre ?? "Fase 3: Alfombra Verde Activa"}
                </div>
                <div className="grid grid-cols-5 gap-1.5 pt-1">
                  {[1, 2, 3, 4, 5].map((f) => (
                    <div
                      key={f}
                      className={`h-2.5 rounded-full transition-all ${
                        f <= (lomacast?.fase_floracion_index ?? 3)
                          ? "bg-emerald-600"
                          : "bg-slate-200"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Colchon de Nubes y Golden Hour */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                  <div className="text-xs text-slate-500 uppercase font-semibold">
                    Colchon de Nubes
                  </div>
                  <div className="text-2xl font-black text-primary font-mono mt-0.5">
                    {lomacast?.probabilidad_colchon_hoy_pct ?? 85}%
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    Ventana: {lomacast?.ventana_optima_hoy ?? "06:00 a 08:30"}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                  <div className="text-xs text-slate-500 uppercase font-semibold">
                    Golden Hour Hoy
                  </div>
                  <div className="text-sm font-bold text-slate-900 mt-1">
                    {lomacast?.golden_hour_hoy ?? "06:15 AM / 17:35 PM"}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    Barro: {lomacast?.estado_sendero_barro ?? "Firme"}
                  </div>
                </div>
              </div>

              {/* Tabla de Pronostico 7 Dias */}
              {lomacast?.pronostico_7_dias && lomacast.pronostico_7_dias.length > 0 && (
                <div className="space-y-2.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Pronostico LomaCast 7 Dias
                  </div>
                  <div className="space-y-2">
                    {lomacast.pronostico_7_dias.map((d, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs sm:text-sm"
                      >
                        <div className="flex items-center gap-2.5">
                          <CloudSun className="w-4 h-4 text-primary shrink-0" />
                          <div>
                            <span className="font-bold text-slate-900">{d.dia_nombre}</span>
                            <span className="text-slate-400 ml-1.5 text-xs">{d.fecha}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 font-medium">
                            {d.temp_min_c}C - {d.temp_max_c}C
                          </span>
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                            {d.probabilidad_colchon_nubes_pct}% nubes
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* PESTAÑA 2: SENDERO Y SIN SENAL */}
            <TabsContent value="sendero" className="space-y-4 m-0">
              {/* Boton Maletin Offline */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Download className="w-4 h-4 text-primary" />
                      Maletin Offline Zero Signal
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Mapas, sendero 3D y waypoints para navegar sin conexion
                    </div>
                  </div>
                  {isOfflineSaved && (
                    <Badge variant="default" className="bg-emerald-600 text-white text-xs font-semibold px-2 py-0.5">
                      Descargado
                    </Badge>
                  )}
                </div>
                <Button
                  onClick={handleDownloadPack}
                  disabled={isDownloadingPack}
                  variant={isOfflineSaved ? "outline" : "default"}
                  className="w-full text-xs sm:text-sm font-bold h-10 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {isDownloadingPack
                    ? "Descargando maletin..."
                    : isOfflineSaved
                    ? "Actualizar Maletin Offline"
                    : "Descargar Maletin Offline (Sin Senal)"}
                </Button>
              </div>

              {/* Grafico SVG de Perfil de Elevacion */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="font-bold uppercase tracking-wider text-slate-500">
                    Perfil de Elevacion
                  </span>
                  <span className="font-mono text-primary font-bold">
                    +{sendero?.desnivel_positivo_m ?? currentLoma.desnivel_positivo_m ?? 580} m desnivel
                  </span>
                </div>

                <div className="w-full bg-slate-900 rounded-xl p-3.5 relative overflow-hidden shadow-inner">
                  <svg
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    className="w-full h-28 overflow-visible"
                  >
                    <polyline
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={svgPoints}
                    />
                  </svg>
                  <div className="flex justify-between text-xs font-mono text-slate-400 mt-1.5">
                    <span>{minEle} msnm</span>
                    <span>Max {maxEle} msnm</span>
                    <span>{maxDist} km</span>
                  </div>
                </div>
              </div>

              {/* Composicion de Superficie Estilo Komoot */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Composicion de Terreno
                </div>
                <div className="h-3 rounded-full flex overflow-hidden border border-slate-300">
                  <div style={{ width: `${compTierra}%` }} className="bg-amber-600" title="Tierra compacta" />
                  <div style={{ width: `${compRoca}%` }} className="bg-slate-500" title="Roca granito" />
                  <div style={{ width: `${compBarro}%` }} className="bg-emerald-700" title="Barro arcilloso" />
                </div>
                <div className="flex justify-between text-xs text-slate-700 font-semibold pt-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block" />
                    Tierra {compTierra}%
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-500 inline-block" />
                    Roca {compRoca}%
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-700 inline-block" />
                    Barro {compBarro}%
                  </span>
                </div>
              </div>

              {/* Descargar GPX */}
              <a
                href={downloadGpxUrl(currentLoma.id)}
                download={`${currentLoma.id}_sendero.gpx`}
                className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs sm:text-sm font-bold text-slate-900 flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <Compass className="w-4 h-4 text-primary" />
                <span>Descargar Archivo GPX (Garmin / Apple Watch)</span>
              </a>
            </TabsContent>

            {/* PESTAÑA 3: ULTIMA MILLA 3 MODOS */}
            <TabsContent value="acceso" className="space-y-4 m-0">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Comparador Ultima Milla (Citymapper)
              </div>

              {guia?.modos_transporte && guia.modos_transporte.length > 0 ? (
                <div className="space-y-3">
                  {guia.modos_transporte.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          {m.modo === "mochilero" && <Footprints className="w-4 h-4 text-primary" />}
                          {m.modo === "smart" && <Navigation className="w-4 h-4 text-blue-600" />}
                          {m.modo === "directo" && <Car className="w-4 h-4 text-emerald-600" />}
                          {m.etiqueta}
                        </span>
                        <Badge variant="outline" className="text-xs font-mono font-bold px-2 py-0.5">
                          {m.tiempo_estimado_min} min
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-500">
                        <span>Por persona: S/ {m.costo_por_persona_pen}</span>
                        <span>Grupo 4: S/ {m.costo_grupal_4_pen}</span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        {m.resumen_ruta}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 space-y-1">
                  <div className="font-bold text-slate-900">Transporte sugerido:</div>
                  <p>{currentLoma.transporte_principal}</p>
                </div>
              )}

              {/* Tarifario Justo Anti Estafa */}
              <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/60 space-y-2 text-xs">
                <div className="font-bold text-amber-900 flex items-center gap-2 text-xs sm:text-sm">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  Tarifario Oficial y Alerta Anti Estafa
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-800">
                  <div>
                    <span className="text-slate-500">Mototaxi justo garita:</span>
                    <div className="font-bold text-slate-900 text-sm">
                      S/ {guia?.tarifa_justa_mototaxi_pen ?? tarifario?.mototaxi_justo_pen ?? 6}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Ultimo retorno:</span>
                    <div className="font-bold text-slate-900 text-sm">
                      {guia?.ultimo_transporte_retorno ?? "18:30 PM"}
                    </div>
                  </div>
                </div>
              </div>

              {tarifario?.whatsapp_contacto && (
                <a
                  href={`https://wa.me/${tarifario.whatsapp_contacto.replace(/[^0-9]/g, "")}?text=Hola,%20quisiera%20informacion%20sobre%20el%20acceso%20a%20${encodeURIComponent(currentLoma.nombre)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Contactar Asociacion Comunal (WhatsApp)</span>
                </a>
              )}
            </TabsContent>

            {/* PESTAÑA 4: GRUPO Y PASAPORTE */}
            <TabsContent value="grupo" className="space-y-4 m-0">
              {/* Calculadora Chancha Grupal */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-primary" />
                    Chancha Grupal (Splitwise)
                  </div>
                  <Badge variant="outline" className="text-xs font-mono font-bold px-2 py-0.5">
                    {groupCount} Personas
                  </Badge>
                </div>

                <div className="flex items-center gap-1.5">
                  {[1, 2, 4, 6, 8, 10].map((num) => (
                    <button
                      key={num}
                      onClick={() => setGroupCount(num)}
                      className={`flex-1 py-1.5 text-xs sm:text-sm rounded-lg font-bold transition-all ${
                        groupCount === num
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>

                <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm space-y-1.5">
                  <div className="flex justify-between text-slate-500">
                    <span>Guia comunitario ({tarifario?.asociacion ?? "Comunal"}):</span>
                    <span className="font-mono font-semibold text-slate-800">S/ {costGuia}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Entradas ({groupCount} pers):</span>
                    <span className="font-mono font-semibold text-slate-800">S/ {costEntrada}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Transporte ({mototaxisNeeded} motos ida y vuelta):</span>
                    <span className="font-mono font-semibold text-slate-800">S/ {costTransporte}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-bold pt-1.5 border-t border-slate-100">
                    <span>Cuota por persona:</span>
                    <span className="text-primary font-black text-base">S/ {cuotaPorPersona}</span>
                  </div>
                </div>

                <Button
                  onClick={handleCopyChancha}
                  variant="outline"
                  className="w-full text-xs sm:text-sm font-bold h-10 flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Copiar Desglose para WhatsApp / Yape</span>
                </Button>
              </div>

              {/* Sello de Cumbre */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-emerald-600" />
                    Pasaporte Digital de Cumbres
                  </span>
                  {summitStamp ? (
                    <Badge variant="default" className="bg-emerald-600 text-white text-xs font-semibold px-2 py-0.5">
                      Cumbre Sellada
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-slate-400 text-xs px-2 py-0.5">
                      Pendiente
                    </Badge>
                  )}
                </div>

                {summitStamp ? (
                  <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-300 text-xs sm:text-sm space-y-1 text-slate-900">
                    <div className="font-bold text-emerald-800 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Cumbre Verificada a {summitStamp.altitud_msnm} msnm
                    </div>
                    <div className="text-xs text-slate-500">
                      Sellado el {new Date(summitStamp.fecha_iso).toLocaleDateString()} a {summitStamp.distancia_cumbre_m}m de la cumbre
                    </div>
                    <div className="text-xs font-mono text-slate-400 truncate">
                      SHA256: {summitStamp.hash_firma_sha256}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                    Llega a menos de 60m de la cumbre y activa el Fog Guardian para sellar tu pasaporte digital de cumbres.
                  </div>
                )}
              </div>

              {/* Muro de Reportes Ciudadanos */}
              <div className="space-y-3 pt-1">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Muro de Reportes Ciudadanos
                </div>

                <form onSubmit={handleSendReport} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Tu nombre"
                      value={reportAuthor}
                      onChange={(e) => setReportAuthor(e.target.value)}
                      className="p-2.5 rounded-lg border border-slate-200 bg-white text-xs sm:text-sm text-slate-900"
                    />
                    <select
                      value={reportBarro}
                      onChange={(e) => setReportBarro(e.target.value)}
                      className="p-2.5 rounded-lg border border-slate-200 bg-white text-xs sm:text-sm text-slate-900"
                    >
                      <option value="Optimo y Seco">Optimo y Seco</option>
                      <option value="Humedo / Resbaloso">Humedo / Resbaloso</option>
                      <option value="Muy Embarrado">Muy Embarrado</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-medium text-slate-700">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reportAmancaes}
                        onChange={(e) => setReportAmancaes(e.target.checked)}
                      />
                      <span>Flor Amancaes vista</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reportColchon}
                        onChange={(e) => setReportColchon(e.target.checked)}
                      />
                      <span>Colchon de nubes</span>
                    </label>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Reporte breve sobre el sendero y clima hoy..."
                    value={reportComment}
                    onChange={(e) => setReportComment(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-xs sm:text-sm text-slate-900"
                  />
                  <Button
                    type="submit"
                    disabled={isSubmittingReport}
                    className="w-full text-xs sm:text-sm font-bold h-9 bg-primary text-primary-foreground"
                  >
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    {isSubmittingReport ? "Publicando..." : "Enviar Reporte Ciudadano"}
                  </Button>
                </form>

                {currentLoma.reportes_recientes && currentLoma.reportes_recientes.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {currentLoma.reportes_recientes.map((rep) => (
                      <div key={rep.id} className="p-3 rounded-xl border border-slate-200 bg-white text-xs space-y-1">
                        <div className="flex items-center justify-between text-slate-500">
                          <span className="font-bold text-slate-900 text-xs sm:text-sm">{rep.autor}</span>
                          <span className="text-xs text-slate-400">
                            {new Date(rep.fecha_iso).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-700">{rep.comentario}</p>
                        <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold pt-0.5">
                          {rep.flor_amancaes_vista && <span>Amancaes visible</span>}
                          {rep.colchon_nubes_visto && <span>Colchon visible</span>}
                          <span className="text-slate-400 font-normal">{rep.estado_barro}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </CardContent>

          {/* Botones de Accion Fijos */}
          <div className="p-3.5 border-t border-slate-200 bg-white flex-shrink-0 space-y-2">
            <Button
              onClick={() => onSetAsStartPoint(currentLoma.coordenadas)}
              variant="outline"
              className="w-full text-xs sm:text-sm font-bold h-10 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive flex items-center justify-center gap-2"
            >
              <span>Usar como punto de partida</span>
            </Button>
            <Button
              onClick={() => onFocusMap(currentLoma.coordenadas)}
              variant="secondary"
              className="w-full text-xs sm:text-sm font-bold h-10 flex items-center justify-center gap-2"
            >
              <span>Centrar en el mapa</span>
            </Button>
          </div>
        </Tabs>
      </Card>
    </div>
  );
};

export const LomaDetailSheet = memo(LomaDetailSheetComponent);
