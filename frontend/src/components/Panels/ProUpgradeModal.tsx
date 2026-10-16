import React, { useState } from "react";
import type { Loma } from "../../types";
import { usePro } from "../../context/ProContext";
import { checkoutPlan } from "../../services/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Mountain,
  Sparkles,
  QrCode,
  CreditCard,
  CheckCircle2,
  Award,
  ShieldCheck,
  Check,
  Calendar,
  Compass,
} from "lucide-react";
import toast from "react-hot-toast";

interface ProUpgradeModalProps {
  lomas: Loma[];
}

export const ProUpgradeModal: React.FC<ProUpgradeModalProps> = ({ lomas }) => {
  const {
    isUpgradeModalOpen,
    upgradeTargetLomaId,
    closeUpgradeModal,
    hasFullLimaPack,
    unlockedLomaIds,
    unlockLoma,
    unlockFullLimaPack,
    summitStamps,
  } = usePro();

  const [activeTab, setActiveTab] = useState<"checkout" | "pasaporte">("checkout");
  const [selectedPlan, setSelectedPlan] = useState<"pack_lima_pro" | "loma_individual">(
    upgradeTargetLomaId && upgradeTargetLomaId !== "L0" ? "loma_individual" : "pack_lima_pro"
  );
  const [selectedLomaId, setSelectedLomaId] = useState<string>(
    upgradeTargetLomaId || (lomas[0]?.id ?? "L0")
  );
  const [paymentMethod, setPaymentMethod] = useState<"yape_plin" | "tarjeta">("yape_plin");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const targetLoma = lomas.find((l) => l.id === selectedLomaId);

  const handleProcessPayment = async () => {
    setIsProcessing(true);
    try {
      await checkoutPlan({
        plan_id: selectedPlan,
        loma_id: selectedPlan === "loma_individual" ? selectedLomaId : undefined,
        metodo_pago: paymentMethod,
      });

      if (selectedPlan === "pack_lima_pro") {
        unlockFullLimaPack();
        toast.success("Pack Vitalicio Todo Lima PRO activado con exito.");
      } else {
        unlockLoma(selectedLomaId);
        toast.success(`Loma ${targetLoma?.nombre || selectedLomaId} desbloqueada de por vida.`);
      }

      closeUpgradeModal();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al procesar el pago";
      toast.error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isUpgradeModalOpen} onOpenChange={(open) => !open && closeUpgradeModal()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl bg-card border border-border shadow-panel">
        <DialogHeader className="p-5 pb-3 border-b border-border bg-gradient-to-r from-primary/10 via-emerald-500/10 to-teal-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                <Mountain className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Lomosoma PRO y Pasaporte
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Modelo Komoot de Pago Unico sin suscripciones mensuales
                </p>
              </div>
            </div>
            {hasFullLimaPack && (
              <Badge variant="default" className="bg-emerald-600 text-white text-xs gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Lima PRO Vitalicio
              </Badge>
            )}
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActiveTab("checkout")}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === "checkout"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Planes y Desbloqueo
            </button>
            <button
              onClick={() => setActiveTab("pasaporte")}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === "pasaporte"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              Pasaporte de Cumbres ({summitStamps.length})
            </button>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4">
          {activeTab === "checkout" ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setSelectedPlan("pack_lima_pro")}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all relative ${
                    selectedPlan === "pack_lima_pro"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/40 bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                      Mas Popular
                    </span>
                    <Badge variant="outline" className="text-xs font-mono">
                      Pago Unico
                    </Badge>
                  </div>
                  <div className="text-base font-bold text-foreground">Pack Todo Lima PRO</div>
                  <div className="text-2xl font-black text-primary mt-1">S/ 19.90</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Desbloquea las 15 lomas de Lima para siempre con maletines offline y GPX.
                  </p>
                  <div className="mt-3 space-y-1.5 text-xs text-foreground/80">
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>15 Lomas de Lima completas</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Navegacion sin senal en neblina</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Pasaporte y sellos de cumbres</span>
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => setSelectedPlan("loma_individual")}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedPlan === "loma_individual"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/40 bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Loma Individual
                    </span>
                    <Badge variant="outline" className="text-xs font-mono">
                      Pago Unico
                    </Badge>
                  </div>
                  <div className="text-base font-bold text-foreground">Circuito Especifico</div>
                  <div className="text-2xl font-black text-foreground mt-1">S/ 4.90</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Acceso vitalicio al sendero y LomaCast de una sola loma.
                  </p>

                  <div className="mt-3">
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      Elige la loma a desbloquear:
                    </label>
                    <select
                      value={selectedLomaId}
                      onChange={(e) => setSelectedLomaId(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-border bg-background text-foreground"
                    >
                      {lomas.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.nombre} {unlockedLomaIds.includes(l.id) ? "(Ya desbloqueada)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-secondary/30 p-3.5 rounded-xl border border-border space-y-3">
                <div className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Metodo de Pago Seguro
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentMethod("yape_plin")}
                    className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                      paymentMethod === "yape_plin"
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border bg-card text-foreground"
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    <div>
                      <div className="text-xs">Yape / Plin QR</div>
                      <div className="text-[10px] text-muted-foreground">Confirmacion directa</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setPaymentMethod("tarjeta")}
                    className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                      paymentMethod === "tarjeta"
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border bg-card text-foreground"
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <div>
                      <div className="text-xs">Tarjeta Bancaria</div>
                      <div className="text-[10px] text-muted-foreground">Visa, Mastercard, Amex</div>
                    </div>
                  </button>
                </div>

                {paymentMethod === "yape_plin" ? (
                  <div className="p-3 bg-white rounded-xl border border-border flex items-center gap-3">
                    <div className="w-16 h-16 bg-slate-900 rounded-lg flex items-center justify-center text-white shrink-0">
                      <QrCode className="w-10 h-10" />
                    </div>
                    <div className="text-xs text-foreground space-y-0.5">
                      <div className="font-bold">Escanear con Yape o Plin</div>
                      <div className="text-muted-foreground">Numero Oficial: 987 654 321</div>
                      <div className="text-[11px] text-primary font-medium">
                        Titular: Lomosoma Ecoturismo SAC
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-xs">
                    <input
                      type="text"
                      placeholder="Numero de Tarjeta (4242 ...)"
                      className="w-full p-2.5 rounded-lg border border-border bg-background"
                      defaultValue="4242 •••• •••• 4242"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="MM/AA"
                        className="w-full p-2.5 rounded-lg border border-border bg-background"
                        defaultValue="12/28"
                      />
                      <input
                        type="text"
                        placeholder="CVV"
                        className="w-full p-2.5 rounded-lg border border-border bg-background"
                        defaultValue="888"
                      />
                    </div>
                  </div>
                )}
              </div>

              <Button
                onClick={handleProcessPayment}
                disabled={isProcessing}
                className="w-full h-11 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-md flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isProcessing
                  ? "Procesando pago seguro..."
                  : `Pagar y Desbloquear (S/ ${selectedPlan === "pack_lima_pro" ? "19.90" : "4.90"})`}
              </Button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/15 to-teal-500/15 border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                    Pasaporte Digital de Cumbres
                  </div>
                  <div className="text-lg font-bold text-foreground mt-0.5">
                    {summitStamps.length} de {lomas.length || 15} Cumbres Verificadas
                  </div>
                </div>
                <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-base shadow-sm">
                  {Math.round((summitStamps.length / Math.max(1, lomas.length)) * 100)}%
                </div>
              </div>

              {summitStamps.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground space-y-2 bg-secondary/20 rounded-xl border border-dashed border-border p-6">
                  <Compass className="w-8 h-8 mx-auto text-muted-foreground/60" />
                  <div className="text-sm font-semibold text-foreground">
                    Aun no tienes sellos registrados
                  </div>
                  <p className="text-xs max-w-sm mx-auto">
                    Visita las lomas de Lima, llega a menos de 60m de la cumbre y pulsa Sellar
                    Pasaporte en el Guardian Anti Neblina para registrar tu hito con firma SHA256.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                  {summitStamps.map((stamp) => (
                    <div
                      key={stamp.loma_id}
                      className="p-3 rounded-xl border border-border bg-card flex items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <div className="text-sm font-bold text-foreground flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          {stamp.nombre_loma}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Mountain className="w-3 h-3" />
                            {stamp.altitud_msnm} msnm
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(stamp.fecha_iso).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground truncate max-w-xs">
                          Hash SHA256: {stamp.hash_firma_sha256}
                        </div>
                      </div>
                      <Badge variant="default" className="bg-emerald-600 text-white text-xs shrink-0">
                        Verificado
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
