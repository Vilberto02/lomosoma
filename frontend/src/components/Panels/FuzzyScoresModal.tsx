import React, { memo } from "react";
import type { Loma } from "../../types";
import { Activity } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";

interface FuzzyScoresModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lomas: Loma[];
}

const FuzzyScoresModalComponent: React.FC<FuzzyScoresModalProps> = ({
  open,
  onOpenChange,
  lomas,
}) => {
  const sorted = [...lomas].sort(
    (a, b) => (a.score_difuso ?? 10) - (b.score_difuso ?? 10),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Activity className="w-4 h-4 text-primary" />
            </div>
            Scores difusos del catálogo
          </DialogTitle>
          <DialogDescription className="pt-1">
            Nivel de riesgo (0-10) calculado por el sistema de inferencia difusa
            Mamdani para cada una de las 15 lomas. Menor valor, menor riesgo.
          </DialogDescription>
        </DialogHeader>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Loma</TableHead>
              <TableHead>Distrito</TableHead>
              <TableHead className="text-right">Score difuso</TableHead>
              <TableHead className="text-right">Saturación</TableHead>
              <TableHead className="text-right">Seguridad</TableHead>
              <TableHead className="text-right">Accesibilidad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((loma) => (
              <TableRow key={loma.id}>
                <TableCell className="font-medium">{loma.nombre}</TableCell>
                <TableCell className="text-muted-foreground">
                  {loma.distrito}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {(loma.score_difuso ?? 0).toFixed(1)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {(loma.saturacion_base * 100).toFixed(0)}%
                </TableCell>
                <TableCell className="text-right font-mono">
                  {loma.seguridad_base.toFixed(1)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {loma.accesibilidad_base.toFixed(1)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Accordion
          type="single"
          collapsible
          className="w-full border px-3 rounded-lg mt-2 bg-secondary/40"
        >
          <AccordionItem value="mamdani">
            <AccordionTrigger className="text-sm font-semibold">
              ¿Cómo se calcula este score?
            </AccordionTrigger>
            <AccordionContent className="px-2 text-sm text-muted-foreground leading-relaxed space-y-1">
              <p>
                Cada loma recibe un score continuo de 0 a 10 mediante un sistema
                de inferencia difusa de tipo Mamdani. Las variables de entrada
                son la saturación turística (0-1), la seguridad percibida (0-10)
                y la accesibilidad del sendero (0-10); la salida es el nivel de
                riesgo.
              </p>
              <p>
                El motor evalúa una base de 16 reglas lingüísticas (por ejemplo,
                "si saturación es alta y seguridad es riesgosa, entonces el
                riesgo es muy alto") y aplica defusificación por centroide para
                obtener el valor numérico final.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </DialogContent>
    </Dialog>
  );
};

export const FuzzyScoresModal = memo(FuzzyScoresModalComponent);
