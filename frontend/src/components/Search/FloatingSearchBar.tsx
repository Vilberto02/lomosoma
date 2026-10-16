import React, { useState, useRef, useEffect, useMemo, memo } from "react";
import { Search, X, SlidersHorizontal, MapPin, Compass } from "lucide-react";
import type { Loma } from "../../types";
import { Badge } from "../ui/badge";

interface FloatingSearchBarProps {
  lomas: Loma[];
  onSelectLoma: (loma: Loma) => void;
  isPlannerOpen: boolean;
  onTogglePlanner: () => void;
  hasActiveRoute: boolean;
  onOpenResults: () => void;
}

const FloatingSearchBarComponent: React.FC<FloatingSearchBarProps> = ({
  lomas,
  onSelectLoma,
  isPlannerOpen,
  onTogglePlanner,
  hasActiveRoute,
  onOpenResults,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filtrado de lomas en memoria para autocompletado en tiempo real
  const filteredLomas = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return lomas.filter((l) =>
      l.nombre.toLowerCase().includes(term) ||
      l.distrito.toLowerCase().includes(term) ||
      l.dificultad.toLowerCase().includes(term)
    );
  }, [lomas, searchTerm]);

  // Cerrar sugerencias al hacer clic fuera del componente
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (loma: Loma) => {
    onSelectLoma(loma);
    setSearchTerm("");
    setIsFocused(false);
  };

  return (
    <div
      ref={containerRef}
      className="absolute top-4 left-4 z-40 w-[92vw] sm:w-[420px] max-w-[420px]"
    >
      {/* Barra de Búsqueda Principal Estilo Google Maps con forma Pill */}
      <div className="flex items-center bg-card rounded-full shadow-panel px-3.5 py-2 border border-border transition-all focus-within:ring-2 focus-within:ring-ring focus-within:border-primary/50">
        {/* Botón de Menú / Alternar Planificador */}
        <button
          onClick={onTogglePlanner}
          title={isPlannerOpen ? "Ocultar Planificador" : "Abrir Planificador de Rutas"}
          className={`p-2 rounded-full transition-colors active:scale-95 ${
            isPlannerOpen ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>

        {/* Input de Búsqueda */}
        <div className="flex-1 flex items-center px-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsFocused(true)}
            placeholder="Buscar lomas o distritos de Lima..."
            className="w-full text-sm text-foreground placeholder:text-muted-foreground bg-transparent focus:outline-none"
          />
        </div>

        {/* Botón Limpiar Búsqueda */}
        {searchTerm ? (
          <button
            onClick={() => setSearchTerm("")}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <div className="p-1.5 text-muted-foreground">
            <Search className="w-4 h-4" />
          </div>
        )}

        {/* Botón rápido si hay ruta calculada */}
        {hasActiveRoute && (
          <>
            <div className="h-5 w-[1px] bg-border mx-1"></div>
            <button
              onClick={onOpenResults}
              title="Ver itinerario de ruta calculada"
              className="px-3 py-1 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-full transition-colors flex items-center gap-1.5 active:scale-95"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Ruta</span>
            </button>
          </>
        )}
      </div>

      {/* Menú Desplegable con Sugerencias y Autocompletado */}
      {isFocused && searchTerm.trim() && (
        <div className="mt-2 bg-card rounded-2xl shadow-panel border border-border overflow-hidden max-h-80 overflow-y-auto custom-scrollbar animate-in fade-in-50 duration-150">
          {filteredLomas.length > 0 ? (
            <div className="py-2">
              <div className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Lomas Encontradas ({filteredLomas.length})
              </div>
              {filteredLomas.map((loma) => (
                <button
                  key={loma.id}
                  onClick={() => handleSelect(loma)}
                  className="w-full text-left px-4 py-2.5 hover:bg-secondary/70 flex items-center justify-between transition-colors border-b border-border/40 last:border-none group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 transition-transform group-hover:scale-105">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 truncate">
                      <div className="text-sm font-semibold text-foreground leading-tight truncate">
                        {loma.nombre}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{loma.distrito}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <Badge
                      variant={
                        loma.dificultad === "Fácil"
                          ? "success"
                          : loma.dificultad === "Moderado"
                          ? "warning"
                          : "destructive"
                      }
                      className="text-xs"
                    >
                      {loma.dificultad}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No se encontraron lomas que coincidan con "<b>{searchTerm}</b>"
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const FloatingSearchBar = memo(FloatingSearchBarComponent);
