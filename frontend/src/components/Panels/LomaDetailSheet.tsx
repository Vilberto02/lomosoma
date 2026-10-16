import React, { memo } from "react";
import type { Loma, Coordenadas } from "../../types";
import { X, MapPin, Clock, Bus, Mountain, Shield, Footprints } from "lucide-react";
import { Card, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";

interface LomaDetailSheetProps {
  loma: Loma | null;
  onClose: () => void;
  onSetAsStartPoint: (coords: Coordenadas) => void;
  onFocusMap: (coords: Coordenadas) => void;
}

const LomaDetailSheetComponent: React.FC<LomaDetailSheetProps> = ({
  loma,
  onClose,
  onSetAsStartPoint,
  onFocusMap,
}) => {
  if (!loma) return null;

  return (
    <div className="absolute top-20 right-4 z-20 w-[92vw] sm:w-[420px] max-w-[420px] h-[calc(100vh-140px)] max-h-[720px] flex flex-col animate-in slide-in-from-right-4 fade-in-50 duration-200">
      <Card className="border border-border shadow-panel bg-card/98 backdrop-blur-md rounded-2xl flex flex-col h-full overflow-hidden">
        {/* Header Limpio y Minimalista */}
        <div className="p-4 border-b border-border bg-card flex-shrink-0 relative">
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge
              variant={
                loma.dificultad === "Fácil"
                  ? "success"
                  : loma.dificultad === "Moderado"
                  ? "warning"
                  : "destructive"
              }
              className="text-xs font-semibold"
            >
              {loma.dificultad}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              {loma.distrito}
            </span>
          </div>
          <CardTitle className="text-lg font-bold text-foreground leading-snug">
            {loma.nombre}
          </CardTitle>
          <div className="text-xs text-muted-foreground font-mono mt-1">
            {loma.coordenadas.lat.toFixed(4)}, {loma.coordenadas.lon.toFixed(4)}
          </div>
        </div>

        {/* Contenido con Scroll Interno Controlado */}
        <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-white">
          {/* Métricas Rápidas */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-secondary/20 p-2.5 rounded-xl text-center border-2 border-primary/20">
              <div className="text-xs text-muted-foreground font-medium">Duración</div>
              <div className="text-base font-bold text-foreground mt-0.5">{loma.tiempo_estimado_horas}h</div>
            </div>
            <div className="bg-secondary/20 p-2.5 rounded-xl text-center border-2 border-primary/20">
              <div className="text-xs text-muted-foreground font-medium">Costo Est.</div>
              <div className="text-base font-bold text-foreground mt-0.5">S/ {loma.costo_estimado}</div>
            </div>
            <div className="bg-secondary/20 p-2.5 rounded-xl text-center border-2 border-primary/20">
              <div className="text-xs text-muted-foreground font-medium">Temporada</div>
              <div className="text-xs font-bold text-foreground mt-1 truncate">
                {loma.temporada_optima || "Jun - Oct"}
              </div>
            </div>
          </div>

          {/* Descripción de la Loma */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Descripción y circuitos
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed bg-secondary/20 p-4 rounded-xl border border-border">
              {loma.descripcion}
            </p>
          </div>

          {/* Indicadores Ambientales */}
          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Indicadores ambientales
            </div>
            <div className="space-y-4 bg-secondary/20 p-3.5 rounded-xl border border-border">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="flex items-center gap-1.5 text-foreground font-medium">
                    <Mountain className="w-3.5 h-3.5 text-primary" />
                    Clima y verdor
                  </span>
                  <b className="font-mono text-primary">{loma.clima_verdor_base} / 10</b>
                </div>
                <Progress
                  value={(loma.clima_verdor_base / 10) * 100}
                  className="h-2 bg-secondary"
                  indicatorClassName="bg-primary"
                />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="flex items-center gap-1.5 text-foreground font-medium">
                    <Shield className="w-3.5 h-3.5 text-blue-600" />
                    Seguridad
                  </span>
                  <b className="font-mono text-blue-600">{loma.seguridad_base} / 10</b>
                </div>
                <Progress
                  value={(loma.seguridad_base / 10) * 100}
                  className="h-2 bg-secondary"
                  indicatorClassName="bg-blue-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="flex items-center gap-1.5 text-foreground font-medium">
                    <Footprints className="w-3.5 h-3.5 text-amber-600" />
                    Accesibilidad
                  </span>
                  <b className="font-mono text-amber-600">{loma.accesibilidad_base} / 10</b>
                </div>
                <Progress
                  value={(loma.accesibilidad_base / 10) * 100}
                  className="h-2 bg-secondary"
                  indicatorClassName="bg-amber-600"
                />
              </div>
            </div>
          </div>

          {/* Cómo Llegar / Transporte Público */}
          <div className="bg-secondary/20 p-4 rounded-xl border border-primary/15 space-y-2">
            <div className="font-semibold text-primary flex items-center gap-1.5 text-sm">
              <Bus className="w-4 h-4" />
              Cómo Llegar (Transporte Público)
            </div>
            <p className="text-xs text-foreground/80 leading-relaxed">
              {loma.transporte_principal}
            </p>
            <div className="text-xs text-muted-foreground flex items-center gap-1 pt-2 mt-1 border-t border-primary/10">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              Tiempo desde centro urbano: ~{loma.distancia_centro_min} min
            </div>
          </div>
        </CardContent>

        {/* Botones de Acción Fijos */}
        <div className="p-3.5 border-t border-border bg-card flex-shrink-0 space-y-2">
          <Button
            onClick={() => onSetAsStartPoint(loma.coordenadas)}
            variant="outline"
            className="w-full text-sm font-semibold h-10 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive flex items-center justify-center gap-1.5"
          >
            <span>Usar como punto de partida</span>
          </Button>
          <Button
            onClick={() => onFocusMap(loma.coordenadas)}
            variant="secondary"
            className="w-full text-sm font-semibold h-10 flex items-center justify-center gap-1.5"
          >
            <span>Centrar en el mapa</span>
          </Button>
        </div>
      </Card>
    </div>
  );
};

export const LomaDetailSheet = memo(LomaDetailSheetComponent);
