import React, { useState, useMemo, memo } from "react";
import type { OptimizationResult, Loma, UserPreferencesRequest } from "../../types";
import { X, MapPin, Gauge, Cpu, ChevronRight, RotateCcw, Route, Check } from "lucide-react";
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
}

const RouteResultsPanelComponent: React.FC<RouteResultsPanelProps> = ({
  isOpen,
  onClose,
  result,
  lomas,
  prefs,
  onFocusLoma,
  onNewSearch,
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

  return (
    <div className="absolute top-20 left-4 z-20 w-[92vw] sm:w-[440px] max-w-[440px] h-[calc(100vh-140px)] max-h-[720px] flex flex-col animate-in slide-in-from-left-4 fade-in-50 duration-200">
      <Card className="border border-border shadow-panel bg-card/98 backdrop-blur-md rounded-2xl flex flex-col h-full overflow-hidden">
        {/* Cabecera del Panel - Minimalista */}
        <CardHeader className="p-4 border-b border-border bg-card flex-shrink-0">
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Route className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-foreground">
                  Ruta óptima calculada
                </CardTitle>
                <p
                  className="text-sm text-muted-foreground mt-0.5"
                  title="Método de optimización usado: atajo determinista para K=1, algoritmo genético en los demás casos"
                >
                  {result.metodo === "atajo_determinista"
                    ? "Atajo Determinista (K=1)"
                    : "Algoritmo Genético Multiobjetivo"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={onNewSearch}
                title="Nueva búsqueda"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tarjetas de Métricas Clave */}
          <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-border/60">
            <div className="bg-secondary/20 p-3 rounded-xl text-center border-2 border-primary/20">
              <div className="text-[11px] text-muted-foreground uppercase font-medium">
                Lomas
              </div>
              <div className="text-base font-bold text-foreground mt-0.5">
                {Math.round(kpiLomas)}
              </div>
            </div>
            <div className="bg-secondary/20 p-3 rounded-xl text-center border-2 border-primary/20">
              <div className="text-[11px] text-muted-foreground uppercase font-medium">
                Costo
              </div>
              <div className="text-base font-bold text-foreground mt-0.5">
                S/ {kpiCosto.toFixed(0)}
              </div>
            </div>
            <div className="bg-secondary/20 p-3 rounded-xl text-center border-2 border-primary/20">
              <div className="text-[11px] text-muted-foreground uppercase font-medium">
                Distancia
              </div>
              <div className="text-base font-bold text-foreground mt-0.5">
                {kpiDistancia.toFixed(1)} km
              </div>
            </div>
            <div className="bg-secondary/20 p-3 rounded-xl text-center border-2 border-primary/20">
              <div className="text-[11px] text-muted-foreground uppercase font-medium">
                Riesgo D.
              </div>
              <div className="text-base font-bold text-foreground mt-0.5">
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
            className="w-full border px-3 rounded-lg mt-2 bg-secondary/20"
          >
            <AccordionItem value="mamdani">
              <AccordionTrigger className="text-sm font-semibold">
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
              <AccordionContent className="px-2 text-sm text-muted-foreground leading-relaxed space-y-1">
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
          </Accordion>

          {/* Secuencia Recomendada Día a Día */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Secuencia de excursiones
              </div>
              <Button
                variant={"link"}
                onClick={() => setScoresModalOpen(true)}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Ver scores difusos
              </Button>
            </div>
            <div className="space-y-1.5">
              {result.ruta_ids.map((id, index) => {
                const loma = lomasDict.get(id);
                if (!loma) return null;
                const riesgo = result.riesgos_ruta[id] || 5.0;

                return (
                  <button
                    key={id}
                    onClick={() => onFocusLoma(loma)}
                    className="w-full text-left p-2.5 rounded-xl border border-border bg-card hover:bg-secondary/60 hover:border-primary/40 transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                        {index + 1}
                      </div>
                      <div className="min-w-0 truncate">
                        <div className="text-sm font-semibold text-foreground leading-tight group-hover:text-primary truncate">
                          {loma.nombre}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {loma.distrito} · S/ {loma.costo_estimado} ·{" "}
                          {loma.dificultad}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="text-xs px-2 py-1 rounded-md bg-amber-600/10 text-amber-600 font-medium">
                        Riesgo {riesgo.toFixed(1)}
                      </span>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pestañas de Detalle */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="itinerario">Itinerario</TabsTrigger>
              <TabsTrigger value="transporte">Transporte</TabsTrigger>
              <TabsTrigger value="tramos">Tramos</TabsTrigger>
              <TabsTrigger value="diagnostico">AG</TabsTrigger>
            </TabsList>

            {/* Tab 1: Itinerario Narrativo con Renderizador Markdown */}
            <TabsContent value="itinerario" className="space-y-2 mt-3">
              <div className="bg-secondary/50 p-3.5 rounded-xl border border-border text-xs text-foreground/90 leading-relaxed max-h-56 overflow-y-auto custom-scrollbar">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h2: ({ children }) => (
                      <h2 className="text-xs font-bold text-foreground uppercase tracking-wider pb-1.5 border-b border-border/60 mb-2">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-xs font-semibold text-primary mt-3 mb-1 flex items-center gap-1">
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p className="text-xs text-foreground/80 leading-relaxed mb-2 last:mb-0">
                        {children}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc pl-4 space-y-1 mb-2 text-xs text-foreground/80 marker:text-primary">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal pl-4 space-y-1 mb-2 text-xs text-foreground/80 marker:text-primary">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="text-xs text-foreground/80 leading-relaxed">
                        {children}
                      </li>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold text-foreground">
                        {children}
                      </strong>
                    ),
                    hr: () => <hr className="my-2 border-border/60" />,
                  }}
                >
                  {result.itinerario_narrativo}
                </ReactMarkdown>
              </div>
              <p className="text-xs text-muted-foreground text-right italic tracking-wide">
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
                  className="bg-secondary/50 p-3 rounded-xl border border-border space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground truncate">
                      {guia.nombre}
                    </span>
                    <Badge variant="default" className="text-xs shrink-0">
                      ~{guia.tiempo_total_min} min · S/ {guia.costo_total_soles}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-2">
                    <div>
                      <b>Medio:</b> {guia.medio_transporte}
                    </div>
                    <div>
                      <b>Partida:</b> {guia.punto_partida_recomendado}
                    </div>
                  </div>
                  <div className="pt-1.5 space-y-2 border-t border-border/50">
                    {guia.pasos.map((paso, pIdx) => (
                      <div
                        key={pIdx}
                        className="text-xs text-foreground/80 flex items-start gap-1.5 px-2"
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
              <div className="text-xs text-muted-foreground mb-1">
                Distancias radiales (ida y vuelta diaria desde tu punto de
                partida):
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar">
                {result.tramos.map((t, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center p-2.5 rounded-lg bg-secondary/50 border border-border text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-destructive" />
                      <span className="text-foreground font-medium">
                        {t.hacia}
                      </span>
                    </div>
                    <span className="font-mono text-primary font-semibold">
                      {t.distancia_km.toFixed(1)} km
                    </span>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Tab 4: Diagnóstico Heurístico & Difuso (AG) */}
            <TabsContent value="diagnostico" className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-secondary/20 p-2.5 rounded-xl border border-border">
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-primary" />
                    Fitness Multiobjetivo
                  </div>
                  <div className="text-base font-bold text-foreground mt-1 font-mono">
                    {result.fitness.toFixed(3)}
                  </div>
                </div>
                <div className="bg-secondary/20 p-2.5 rounded-xl border border-border">
                  <div
                    className="text-xs text-muted-foreground flex items-center gap-1.5"
                    title="Nivel de exigencia (0-1) traducido a partir de los genes reales del cromosoma por el sistema difuso"
                  >
                    <Cpu className="w-3.5 h-3.5 text-blue-600" />
                    Exigencia Cromosoma
                  </div>
                  <div className="text-base font-bold text-foreground mt-1 font-mono">
                    {result.nivel_exigencia.toFixed(3)} / 1.0
                  </div>
                </div>
              </div>

              {/* Genes Reales del Cromosoma */}
              {result.genes_reales &&
                Object.keys(result.genes_reales).length > 0 && (
                  <div className="bg-secondary/20 p-3 rounded-xl border border-border space-y-1.5 text-xs">
                    <div className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
                      Genes reales optimizados
                    </div>
                    <div className="flex justify-between text-foreground">
                      <span>Horas de recorrido:</span>
                      <b className="font-mono">
                        {result.genes_reales.horas_recorrido?.toFixed(1) || 0} h
                      </b>
                    </div>
                    <div className="flex justify-between text-foreground">
                      <span>Cobertura de zona:</span>
                      <b className="font-mono">
                        {(
                          (result.genes_reales.cobertura_zona || 0) * 100
                        ).toFixed(0)}
                        %
                      </b>
                    </div>
                    <div className="flex justify-between text-foreground">
                      <span>Extensión de circuito:</span>
                      <b className="font-mono">
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
                  <div className="text-xs font-semibold text-muted-foreground">
                    Curva de convergencia evolutiva
                  </div>
                  <pre className="text-xs font-mono bg-zinc-950 text-emerald-400 p-3 rounded-xl overflow-x-auto max-h-48 overflow-y-auto custom-scrollbar leading-tight">
                    {result.grafica_ascii}
                  </pre>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>

        {/* Footer Fijo con Botón */}
        <div className="p-3.5 border-t border-border bg-card flex-shrink-0">
          <Button
            onClick={onNewSearch}
            variant="outline"
            className="w-full text-sm font-semibold h-10 flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
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
