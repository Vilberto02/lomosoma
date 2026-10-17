import React, { useState, useMemo, memo } from "react";
import type { OptimizationResult, Loma, UserPreferencesRequest } from "../../types";
import {
  X,
  MapPin,
  Gauge,
  Cpu,
  ChevronRight,
  RotateCcw,
  Route,
  Check,
  CheckSquare,
  Users,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { FuzzyScoresModal } from "./FuzzyScoresModal";
import { useCountUp } from "../../hooks/useCountUp";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";

interface RouteResultsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  result: OptimizationResult | null;
  lomas: Loma[];
  prefs?: UserPreferencesRequest | null;
  onFocusLoma: (loma: Loma) => void;
  onNewSearch: () => void;
  isEmbedded?: boolean;
}

const RouteResultsPanelComponent: React.FC<RouteResultsPanelProps> = ({
  isOpen,
  onClose,
  result,
  lomas,
  prefs,
  onFocusLoma,
  onNewSearch,
  isEmbedded = false,
}) => {
  const [activeTab, setActiveTab] = useState<string>("itinerario");
  const [scoresModalOpen, setScoresModalOpen] = useState<boolean>(false);

  const lomasDict = useMemo(() => {
    const map = new Map<string, Loma>();
    lomas.forEach((l) => map.set(l.id, l));
    return map;
  }, [lomas]);

  // Cálculo de riesgo promedio difuso
  const riesgoPromedio = useMemo(() => {
    if (!result) return 0;
    return result.ruta_ids.reduce((acc, id) => acc + (result.riesgos_ruta[id] || 5.0), 0) /
      Math.max(1, result.ruta_ids.length);
  }, [result]);

  const checksCumplePresupuesto = result ? result.costo_total <= (prefs?.presupuesto_max ?? Infinity) : true;
  const horasUtilesMax = (prefs?.dias_disponibles ?? result?.k ?? 1) * 8;
  const checksCumpleTiempo = result ? result.tiempo_estimado_horas <= horasUtilesMax : true;
  const cumpleRequerimientos = checksCumplePresupuesto && checksCumpleTiempo;

  const kpiLomas = useCountUp(result?.k ?? 0);
  const kpiCosto = useCountUp(result?.costo_total ?? 0);
  const kpiDistancia = useCountUp(result?.distancia_total_km ?? 0);
  const kpiRiesgo = useCountUp(riesgoPromedio);

  if (!isOpen || !result) return null;

  const containerClass = isEmbedded
    ? "flex flex-col h-full w-full overflow-hidden bg-white"
    : "absolute top-20 left-4 z-20 w-[92vw] sm:w-[460px] max-w-[460px] h-[calc(100vh-140px)] max-h-[760px] flex flex-col animate-in slide-in-from-left-4 fade-in-50 duration-200";

  const cardClass = isEmbedded
    ? "border-0 shadow-none bg-transparent rounded-none flex flex-col h-full overflow-hidden bg-white"
    : "border border-slate-200 shadow-panel bg-white rounded-2xl flex flex-col h-full overflow-hidden";

  return (
    <div className={containerClass}>
      <Card className={cardClass}>
        {/* Cabecera Limpia */}
        <CardHeader className="p-4 border-b border-slate-200 bg-white flex-shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-primary hover:text-primary/80 transition-colors py-1 px-2 rounded-lg hover:bg-primary/10"
              title="Volver al catalogo de lomas"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver al catalogo</span>
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={onNewSearch}
                title="Nueva búsqueda"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Route className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-bold text-slate-900">
                  Ruta óptima calculada
                </CardTitle>
                <p
                  className="text-xs sm:text-sm text-slate-500 mt-0.5"
                  title="Método de optimización usado: atajo determinista para K=1, algoritmo genético en los demás casos"
                >
                  {result.metodo === "atajo_determinista"
                    ? "Atajo Determinista (K=1)"
                    : "Algoritmo Genético Multiobjetivo"}
                </p>
              </div>
            </div>
          </div>

          {/* Tarjetas de Métricas Clave */}
          <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-200">
            <div className="bg-slate-50 p-3 rounded-xl text-center border border-slate-200 shadow-sm">
              <div className="text-xs text-slate-500 uppercase font-semibold">
                Lomas
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5 font-mono">
                {Math.round(kpiLomas)}
              </div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl text-center border border-slate-200 shadow-sm">
              <div className="text-xs text-slate-500 uppercase font-semibold">
                Costo
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5 font-mono">
                S/ {kpiCosto.toFixed(0)}
              </div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl text-center border border-slate-200 shadow-sm">
              <div className="text-xs text-slate-500 uppercase font-semibold">
                Distancia
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5 font-mono">
                {kpiDistancia.toFixed(1)} km
              </div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl text-center border border-slate-200 shadow-sm">
              <div className="text-xs text-slate-500 uppercase font-semibold">
                Riesgo D.
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5 font-mono">
                {kpiRiesgo.toFixed(1)}/10
              </div>
            </div>
          </div>
        </CardHeader>

        {/* Contenido con Scroll Interno Controlado */}
        <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-white">
          {/* Verificación de Requerimientos */}
          <Accordion
            type="single"
            collapsible
            className="w-full border border-slate-200 px-3.5 rounded-xl mt-2 bg-slate-50/60"
          >
            <AccordionItem value="mamdani">
              <AccordionTrigger className="text-sm font-bold text-slate-900">
                <p className="flex gap-2">
                  La ruta cumple los requerimientos:{" "}
                  <span
                    className={
                      cumpleRequerimientos
                        ? "text-emerald-600"
                        : "text-destructive"
                    }
                  >
                    {cumpleRequerimientos ? "Sí" : "No"}
                  </span>
                </p>
              </AccordionTrigger>
              <AccordionContent className="px-2 text-xs sm:text-sm text-slate-600 leading-relaxed space-y-1.5">
                <div className="flex items-center gap-2">
                  {checksCumplePresupuesto ? (
                    <Check className="w-4 h-4 text-emerald-600"></Check>
                  ) : (
                    <X className="w-4 h-4 text-destructive"></X>
                  )}
                  Presupuesto: S/ {result.costo_total.toFixed(0)} de S/{" "}
                  {prefs?.presupuesto_max ?? "—"}
                </div>
                <div className="flex items-center gap-2">
                  {checksCumpleTiempo ? (
                    <Check className="w-4 h-4 text-emerald-600"></Check>
                  ) : (
                    <X className="w-4 h-4 text-destructive"></X>
                  )}
                  Tiempo estimado: {result.tiempo_estimado_horas.toFixed(1)} h
                  de {horasUtilesMax} h útiles
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  Horizonte de planificación: {result.k} lomas
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  Método:{" "}
                  {result.metodo === "atajo_determinista"
                    ? "atajo determinista"
                    : "algoritmo genético"}
                </div>
              </AccordionContent>
            </AccordionItem>

            {result.checklist_equipamiento && result.checklist_equipamiento.length > 0 && (
              <AccordionItem value="checklist">
                <AccordionTrigger className="text-sm font-bold text-slate-900">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    <span>Checklist de Equipamiento Inteligente</span>
                    <Badge variant="outline" className="text-xs font-mono px-2 py-0.5">
                      {result.checklist_equipamiento.length} items
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-2 text-xs sm:text-sm text-slate-700 space-y-2">
                  {result.checklist_equipamiento.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 py-0.5">
                      <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            )}

            <AccordionItem value="costos-grupales">
              <AccordionTrigger className="text-sm font-bold text-slate-900">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span>Resumen de Costos y Chancha Grupal</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-2 text-xs sm:text-sm text-slate-700 space-y-2.5">
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                    <div className="text-xs uppercase font-bold text-slate-500">
                      Costo Individual
                    </div>
                    <div className="text-lg font-black text-slate-900 mt-0.5 font-mono">
                      S/ {result.costo_total.toFixed(0)}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">Viajero solo</div>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-300 shadow-sm">
                    <div className="text-xs uppercase font-bold text-emerald-800">
                      Cuota Grupo 4
                    </div>
                    <div className="text-lg font-black text-emerald-700 mt-0.5 font-mono">
                      S/ {((result.costo_total * 4 * 0.72) / 4).toFixed(0)} / pers
                    </div>
                    <div className="text-xs text-emerald-700 font-semibold mt-0.5">
                      Ahorro compartiendo guia y transporte
                    </div>
                  </div>
                </div>
                <div className="text-xs text-slate-500 italic">
                  Total estimado para 4 personas: S/ {(result.costo_total * 4 * 0.72).toFixed(0)} (entradas completas, 1 guia compartido y taxis divididos).
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Secuencia Recomendada Día a Día */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Secuencia de excursiones
              </div>
              <Button
                variant={"link"}
                onClick={() => setScoresModalOpen(true)}
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                Ver scores difusos
              </Button>
            </div>
            <div className="space-y-2">
              {result.ruta_ids.map((id, index) => {
                const loma = lomasDict.get(id);
                if (!loma) return null;
                const riesgo = result.riesgos_ruta[id] || 5.0;

                return (
                  <button
                    key={id}
                    onClick={() => onFocusLoma(loma)}
                    className="w-full text-left p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 hover:border-primary/50 shadow-sm transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                        {index + 1}
                      </div>
                      <div className="min-w-0 truncate">
                        <div className="text-sm sm:text-base font-bold text-slate-900 leading-tight group-hover:text-primary truncate">
                          {loma.nombre}
                        </div>
                        <div className="text-xs sm:text-sm text-slate-500 mt-1 truncate">
                          {loma.distrito} · S/ {loma.costo_estimado} ·{" "}
                          {loma.dificultad}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-xs px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 font-semibold border border-amber-200">
                        Riesgo {riesgo.toFixed(1)}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pestañas de Detalle */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="bg-white">
            <TabsList className="grid grid-cols-4 w-full h-10">
              <TabsTrigger value="itinerario" className="text-xs sm:text-sm font-semibold">Itinerario</TabsTrigger>
              <TabsTrigger value="transporte" className="text-xs sm:text-sm font-semibold">Transporte</TabsTrigger>
              <TabsTrigger value="tramos" className="text-xs sm:text-sm font-semibold">Tramos</TabsTrigger>
              <TabsTrigger value="diagnostico" className="text-xs sm:text-sm font-semibold">AG</TabsTrigger>
            </TabsList>

            {/* Tab 1: Itinerario Narrativo con Renderizador Markdown */}
            <TabsContent value="itinerario" className="space-y-2 mt-3">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 leading-relaxed max-h-56 overflow-y-auto custom-scrollbar">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h2: ({ children }) => (
                      <h2 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider pb-1.5 border-b border-slate-200 mb-2">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-xs sm:text-sm font-bold text-primary mt-3 mb-1 flex items-center gap-1">
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed mb-2 last:mb-0">
                        {children}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc pl-4 space-y-1 mb-2 text-xs sm:text-sm text-slate-700 marker:text-primary">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal pl-4 space-y-1 mb-2 text-xs sm:text-sm text-slate-700 marker:text-primary">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                        {children}
                      </li>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-bold text-slate-900">
                        {children}
                      </strong>
                    ),
                    hr: () => <hr className="my-2 border-slate-200" />,
                  }}
                >
                  {result.itinerario_narrativo}
                </ReactMarkdown>
              </div>
              <p className="text-xs text-slate-400 text-right italic tracking-wide">
                {result.llm_provider === "gemini"
                  ? "Texto generado por Gemini"
                  : "Texto generado localmente (sin conexión)"}
              </p>
            </TabsContent>

            {/* Tab 2: Guía de Transporte */}
            <TabsContent
              value="transporte"
              className="space-y-3 mt-3 max-h-56 overflow-y-auto custom-scrollbar"
            >
              {result.guias_acceso.map((guia, i) => (
                <div
                  key={i}
                  className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      {guia.nombre}
                    </span>
                    <Badge variant="default" className="text-xs font-semibold shrink-0">
                      ~{guia.tiempo_total_min} min · S/ {guia.costo_total_soles}
                    </Badge>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-500 space-y-1">
                    <div>
                      <b>Medio:</b> {guia.medio_transporte}
                    </div>
                    <div>
                      <b>Partida:</b> {guia.punto_partida_recomendado}
                    </div>
                  </div>
                  <div className="pt-2 space-y-1.5 border-t border-slate-200">
                    {guia.pasos.map((paso, pIdx) => (
                      <div
                        key={pIdx}
                        className="text-xs text-slate-700 flex items-start gap-1.5 px-1"
                      >
                        <span>{paso}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </TabsContent>

            {/* Tab 3: Tramos Radiales */}
            <TabsContent value="tramos" className="space-y-2 mt-3">
              <div className="text-xs font-medium text-slate-500 mb-1">
                Distancias radiales (ida y vuelta diaria desde tu punto de
                partida):
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
                {result.tramos.map((t, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-destructive" />
                      <span className="text-slate-800 font-medium">
                        {t.hacia}
                      </span>
                    </div>
                    <span className="font-mono text-primary font-bold">
                      {t.distancia_km.toFixed(1)} km
                    </span>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Tab 4: Diagnóstico Heurístico & Difuso (AG) */}
            <TabsContent value="diagnostico" className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                    <Gauge className="w-4 h-4 text-primary" />
                    Fitness Multiobjetivo
                  </div>
                  <div className="text-lg font-bold text-slate-900 mt-1 font-mono">
                    {result.fitness.toFixed(3)}
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div
                    className="text-xs font-semibold text-slate-500 flex items-center gap-1.5"
                    title="Nivel de exigencia (0-1) traducido a partir de los genes reales del cromosoma por el sistema difuso"
                  >
                    <Cpu className="w-4 h-4 text-blue-600" />
                    Exigencia Cromosoma
                  </div>
                  <div className="text-lg font-bold text-slate-900 mt-1 font-mono">
                    {result.nivel_exigencia.toFixed(3)} / 1.0
                  </div>
                </div>
              </div>

              {/* Genes Reales del Cromosoma */}
              {result.genes_reales &&
                Object.keys(result.genes_reales).length > 0 && (
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs sm:text-sm">
                    <div className="font-bold text-slate-500 uppercase tracking-wider text-xs">
                      Genes reales optimizados
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>Horas de recorrido:</span>
                      <b className="font-mono text-slate-900">
                        {result.genes_reales.horas_recorrido?.toFixed(1) || 0} h
                      </b>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>Cobertura de zona:</span>
                      <b className="font-mono text-slate-900">
                        {(
                          (result.genes_reales.cobertura_zona || 0) * 100
                        ).toFixed(0)}
                        %
                      </b>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>Extensión de circuito:</span>
                      <b className="font-mono text-slate-900">
                        {result.genes_reales.extension_circuito?.toFixed(1) ||
                          0}{" "}
                        km
                      </b>
                    </div>
                  </div>
                )}

              {/* Gráfica ASCII de Convergencia */}
              {result.grafica_ascii && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-500 uppercase">
                    Curva de convergencia evolutiva
                  </div>
                  <pre className="text-xs font-mono bg-slate-950 text-emerald-400 p-3.5 rounded-xl overflow-x-auto max-h-48 overflow-y-auto custom-scrollbar leading-tight shadow-inner">
                    {result.grafica_ascii}
                  </pre>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>

        {/* Footer Fijo con Botón */}
        <div className="p-4 border-t border-slate-200 bg-white flex-shrink-0">
          <Button
            onClick={onNewSearch}
            variant="outline"
            className="w-full text-sm sm:text-base font-bold h-11 flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />
            <span>Reconfigurar parámetros</span>
          </Button>
        </div>
      </Card>
      <FuzzyScoresModal
        open={scoresModalOpen}
        onOpenChange={setScoresModalOpen}
        lomas={lomas}
      />
    </div>
  );
};

export const RouteResultsPanel = memo(RouteResultsPanelComponent);
