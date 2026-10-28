import { useEffect, useState } from "react";
import type { BillingPlan, Loma, PaymentOrder } from "../../types";
import { usePro } from "../../context/ProContext";
import { jsonApi, logout, verifyCode } from "../../services/http";
import { fetchBillingPlans } from "../../services/api";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  ArrowRight,
  Award,
  CircleCheck,
  CloudSun,
  Info,
  Lock,
  LogOut,
  Mail,
  QrCode,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

const inputClass =
  "w-full h-11 rounded-lg border border-lomo-border bg-lomo-surface-inset px-3 text-[15px] font-medium text-lomo-ink-primary placeholder:text-lomo-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lomo-accent/30 disabled:opacity-60";

const labels: Record<PaymentOrder["status"], string> = {
  pendiente_pago: "Pendiente de pago",
  en_revision: "En revisión",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

const FALLBACK_PLANS: BillingPlan[] = [
  {
    plan_id: "pack_lima_pro",
    nombre: "Todo Lima PRO",
    tipo_pago: "pago_unico",
    precio_pen: 19.9,
    descripcion: "Acceso permanente a todas las lomas de Lima.",
    beneficios: [],
  },
  {
    plan_id: "loma_individual",
    nombre: "Loma individual",
    tipo_pago: "pago_unico",
    precio_pen: 4.9,
    descripcion: "Acceso permanente a una loma de tu elección.",
    beneficios: [],
  },
];

type Yape = { qr_url: string; recipient: string; message: string };
type Factor = { id: string; status: string };

function planScopeCopy(plan: BillingPlan): string {
  if (plan.plan_id === "pack_lima_pro") {
    return "Acceso permanente a todas las lomas de Lima.";
  }
  if (plan.plan_id === "loma_individual") {
    return "Acceso permanente a una loma de tu elección.";
  }
  return plan.descripcion;
}

function ReviewCard({
  order,
  onReview,
}: {
  order: PaymentOrder;
  onReview: (
    order: PaymentOrder,
    decision: "aprobado" | "rechazado",
    reason: string
  ) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function resolve(decision: "aprobado" | "rechazado") {
    setBusy(true);
    try {
      await onReview(order, decision, reason);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-xl border border-lomo-border bg-lomo-surface p-4 space-y-3">
      <p className="text-base font-bold text-lomo-ink-primary tabular-nums">
        S/ {order.amount_pen.toFixed(2)} · {order.loma_id || "Todo Lima"}
      </p>
      <dl className="text-sm font-medium space-y-1 text-lomo-ink-secondary">
        <div>
          <dt className="inline text-lomo-ink-muted">Operación: </dt>
          <dd className="inline font-mono font-semibold break-all">{order.operation_code}</dd>
        </div>
        <div>
          <dt className="inline text-lomo-ink-muted">Fecha: </dt>
          <dd className="inline tabular-nums font-semibold">{order.payment_date}</dd>
        </div>
        <div>
          <dt className="inline text-lomo-ink-muted">Importe declarado: </dt>
          <dd className="inline tabular-nums font-semibold">
            S/ {order.reported_amount_pen?.toFixed(2)}
          </dd>
        </div>
        <div>
          <dt className="inline text-lomo-ink-muted">Orden: </dt>
          <dd className="inline font-mono break-all text-xs">{order.id}</dd>
        </div>
      </dl>
      <label className="block text-sm font-bold text-lomo-ink-secondary space-y-1.5">
        <span>Resultado de la comprobación en Yape</span>
        <textarea
          className="w-full rounded-lg border border-lomo-border bg-lomo-surface-inset p-3 text-sm font-medium text-lomo-ink-primary placeholder:text-lomo-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lomo-accent/30"
          rows={2}
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Registra el motivo de aprobación o rechazo"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={busy || reason.trim().length < 3}
          onClick={() => void resolve("aprobado")}
        >
          Confirmar abono recibido
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || reason.trim().length < 3}
          onClick={() => void resolve("rechazado")}
        >
          Rechazar
        </Button>
      </div>
    </article>
  );
}

/**
 * Modal de planes y cuenta PRO.
 * Referencia Pencil: "Lomosoma · Modal / Planes PRO" (b8zb0, 768 px, radio 20).
 */
export function ProUpgradeModal({ lomas }: { lomas: Loma[] }) {
  const {
    isUpgradeModalOpen,
    closeUpgradeModal,
    upgradeTargetLomaId,
    user,
    accountLoading,
    refreshAccount,
    hasFullLimaPack,
    summitStamps,
  } = usePro();

  const [tab, setTab] = useState<"pago" | "pasaporte" | "admin">("pago");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [plans, setPlans] = useState<BillingPlan[]>(FALLBACK_PLANS);
  const [planId, setPlanId] = useState("pack_lima_pro");
  const [lomaId, setLomaId] = useState("L1");
  const [yape, setYape] = useState<Yape | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [operation, setOperation] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [amount, setAmount] = useState("");
  const [reviewOrders, setReviewOrders] = useState<PaymentOrder[]>([]);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enrollment, setEnrollment] = useState<{
    id: string;
    secret: string;
  } | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  const displayedPlans = plans.length > 0 ? plans : FALLBACK_PLANS;
  const selectedPlan = displayedPlans.find((plan) => plan.plan_id === planId);
  const currentOrder = orders.find((order) => order.id === selectedOrder);
  const userId = user?.id;
  const hasPendingReview = orders.some(
    (order) => order.status === "en_revision"
  );

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo completar la operación"
      );
    } finally {
      setBusy(false);
    }
  }

  async function loadOrders() {
    setOrders(await jsonApi("/billing/orders"));
  }

  useEffect(() => {
    if (!isUpgradeModalOpen) return;
    setPlanId(
      upgradeTargetLomaId && upgradeTargetLomaId !== "L0"
        ? "loma_individual"
        : "pack_lima_pro"
    );
    setLomaId(
      upgradeTargetLomaId && upgradeTargetLomaId !== "L0"
        ? upgradeTargetLomaId
        : "L1"
    );
    setSelectedOrder(null);
    void fetchBillingPlans()
      .then((loaded) => {
        if (loaded.length > 0) setPlans(loaded);
      })
      .catch(() =>
        setPaymentError("No se pudieron cargar los planes. Inténtalo de nuevo.")
      );
    void jsonApi<Yape>("/billing/yape")
      .then((result) => {
        setYape(result);
        setPaymentError("");
      })
      .catch((error) => {
        setYape(null);
        setPaymentError(
          error instanceof Error
            ? error.message
            : "Los pagos Yape todavía no están habilitados."
        );
      });
  }, [isUpgradeModalOpen, upgradeTargetLomaId]);

  useEffect(() => {
    setOrders([]);
    setReviewOrders([]);
    setFactors([]);
    setEnrollment(null);
    setMfaCode("");
    if (isUpgradeModalOpen && userId)
      void loadOrders().catch((error) => toast.error(error.message));
  }, [isUpgradeModalOpen, userId]);

  useEffect(() => {
    if (!isUpgradeModalOpen || !userId || !hasPendingReview) return;
    const timer = window.setInterval(() => {
      void loadOrders()
        .then(refreshAccount)
        .catch(() => {});
    }, 15000);
    return () => window.clearInterval(timer);
  }, [isUpgradeModalOpen, userId, hasPendingReview, refreshAccount]);

  useEffect(() => {
    if (tab !== "admin" || !user?.admin || !isUpgradeModalOpen) return;
    if (user.aal === "aal2")
      void jsonApi<PaymentOrder[]>("/billing/admin/orders")
        .then(setReviewOrders)
        .catch((error) => toast.error(error.message));
    else
      void jsonApi<Factor[]>("/auth/mfa")
        .then(setFactors)
        .catch((error) => toast.error(error.message));
  }, [tab, user?.admin, user?.aal, isUpgradeModalOpen]);

  function chooseOrder(order: PaymentOrder) {
    setSelectedOrder(order.id);
    setOperation("");
    setPaymentDate("");
    setAmount(order.amount_pen.toFixed(2));
  }

  const canCreateOrder =
    !busy && Boolean(user) && Boolean(yape) && Boolean(selectedPlan) && !hasFullLimaPack;

  return (
    <Dialog
      open={isUpgradeModalOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeUpgradeModal();
          setEnrollment(null);
          setMfaCode("");
          setCode("");
        }
      }}
    >
      <DialogContent
        hideClose
        className="flex flex-col gap-0 p-0 w-[calc(100%_-_2rem)] max-w-[768px] max-h-[90dvh] overflow-x-hidden overflow-y-auto custom-scrollbar bg-lomo-surface border border-lomo-border rounded-[20px] shadow-lomo-panel sm:rounded-[20px]"
      >
        {/* 1. Cabecera del modal PRO (EPeMV en Pencil) */}
        <header className="flex items-center justify-between gap-4 px-5 sm:px-8 pt-6 pb-5 flex-shrink-0">
          <div className="flex flex-col gap-1 min-w-0">
            <DialogTitle className="text-[26px] leading-[1.2] font-extrabold tracking-[-0.025em] text-lomo-ink-primary">
              Lomosoma PRO
            </DialogTitle>
            <DialogDescription className="text-[15px] font-medium leading-[1.45] text-lomo-ink-secondary">
              Tus rutas, tus compras y tu pasaporte de cumbres.
            </DialogDescription>
          </div>
          <DialogClose
            aria-label="Cerrar modal de planes"
            className="w-10 h-10 rounded-lg bg-lomo-surface-inset text-lomo-ink-secondary flex items-center justify-center flex-shrink-0 transition-[background-color,transform] duration-150 hover:bg-lomo-surface-selected active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lomo-accent/30"
          >
            <X className="w-4 h-4" />
          </DialogClose>
        </header>

        {/* 2. Navegación de cuenta y compras (s0z9wu en Pencil) */}
        <nav
          aria-label="Cuenta PRO"
          className="h-12 px-5 sm:px-8 border-b border-lomo-border flex items-center gap-4 sm:gap-6 flex-shrink-0"
        >
          {(
            ["pago", "pasaporte", ...(user?.admin ? ["admin"] : [])] as const
          ).map((value) => {
            const isActive = tab === value;
            const label =
              value === "pago"
                ? "Planes y compras"
                : value === "pasaporte"
                ? "Pasaporte"
                : "Revisar pagos";
            return (
              <button
                key={value}
                type="button"
                aria-pressed={isActive}
                onClick={() => setTab(value as typeof tab)}
                className={`h-full -mb-px flex items-center border-b-2 text-xs sm:text-[15px] tracking-tight whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-lomo-accent text-lomo-accent font-extrabold"
                    : "border-transparent text-lomo-ink-muted font-semibold hover:text-lomo-ink-primary"
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>

        {/* 3. Contenido según pestaña */}
        {tab === "pago" && (
          <div className="flex flex-col">
            {/* Sección A: Elección del acceso (GCa8v en Pencil) */}
            <section className="px-5 sm:px-8 pt-6 pb-5 border-b border-lomo-border flex flex-col gap-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-[19px] font-extrabold text-lomo-ink-primary">
                  Elige tu acceso
                </h3>
                <span className="text-sm font-semibold text-lomo-ink-secondary">
                  Un pago. Acceso permanente.
                </span>
              </div>

              <fieldset
                disabled={busy || !!currentOrder}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              >
                <legend className="sr-only">Planes de acceso PRO</legend>
                {displayedPlans.map((plan) => {
                  const isSelected = planId === plan.plan_id;
                  return (
                    <label
                      key={plan.plan_id}
                      className={`cursor-pointer rounded-xl border p-5 flex flex-col justify-between gap-4 transition-all ${
                        isSelected
                          ? "bg-lomo-surface-selected border-lomo-accent"
                          : "bg-lomo-surface border-lomo-border hover:border-lomo-border-selected"
                      }`}
                    >
                      <input
                        type="radio"
                        name="plan"
                        value={plan.plan_id}
                        checked={isSelected}
                        onChange={() => setPlanId(plan.plan_id)}
                        className="sr-only"
                      />
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[19px] font-extrabold text-lomo-ink-primary">
                          {plan.nombre}
                        </span>
                        {isSelected ? (
                          <CircleCheck className="w-5 h-5 text-lomo-accent flex-shrink-0" />
                        ) : (
                          <span
                            aria-hidden
                            className="w-5 h-5 rounded-full border-[1.5px] border-lomo-border-selected flex-shrink-0"
                          />
                        )}
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-[30px] leading-none font-extrabold tracking-[-0.025em] text-lomo-ink-primary tabular-nums">
                          S/ {plan.precio_pen.toFixed(2)}
                        </span>
                        <span className="text-sm font-semibold text-lomo-ink-muted">
                          Pago único · sin mensualidades
                        </span>
                      </div>

                      <p className="text-[15px] font-medium leading-[1.5] text-lomo-ink-secondary">
                        {planScopeCopy(plan)}
                      </p>
                    </label>
                  );
                })}
              </fieldset>

              {planId === "loma_individual" && (
                <label className="flex flex-col gap-1.5 text-sm font-bold text-lomo-ink-secondary">
                  <span>Loma a desbloquear</span>
                  <select
                    className={inputClass}
                    value={lomaId}
                    disabled={busy || !!currentOrder}
                    onChange={(e) => setLomaId(e.target.value)}
                  >
                    {lomas
                      .filter((loma) => loma.id !== "L0")
                      .map((loma) => (
                        <option key={loma.id} value={loma.id}>
                          {loma.nombre}
                        </option>
                      ))}
                  </select>
                </label>
              )}

              <div className="flex items-center gap-2 text-sm font-semibold text-lomo-ink-secondary">
                <CloudSun className="w-4 h-4 text-lomo-ink-muted flex-shrink-0" />
                <span>Incluye LomaCast 7D, floración y estado del barro.</span>
              </div>
            </section>

            {/* Sección B: Acceso para guardar compras (HMdIs en Pencil) */}
            <section className="px-5 sm:px-8 py-5 border-b border-lomo-border flex flex-col gap-3">
              {user ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Mail className="w-4 h-4 text-lomo-accent flex-shrink-0" />
                      <span className="text-[15px] font-bold text-lomo-ink-primary break-all">
                        {user.email}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await logout();
                          await refreshAccount();
                          setSent(false);
                        })
                      }
                      className="h-9 px-3 text-sm font-semibold text-lomo-ink-secondary hover:bg-lomo-surface-inset"
                    >
                      <LogOut className="w-4 h-4 mr-1" />
                      Salir
                    </Button>
                  </div>
                  <p className="text-sm font-medium text-lomo-ink-secondary">
                    {hasFullLimaPack
                      ? "Todo Lima PRO activo"
                      : "Las compras aprobadas se recuperan con esta cuenta."}
                  </p>
                </div>
              ) : (
                <form
                  className="flex flex-col gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(async () => {
                      if (sent) {
                        await verifyCode(email, code);
                        await refreshAccount();
                        setCode("");
                        toast.success("Sesión iniciada");
                      } else {
                        await jsonApi("/auth/code", { email });
                        setSent(true);
                        toast.success(
                          "Revisa tu correo para encontrar el código"
                        );
                      }
                    });
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-lomo-ink-muted flex-shrink-0" />
                    <span className="text-[15px] font-bold text-lomo-ink-primary">
                      Accede para guardar tus compras
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="pro-upgrade-email"
                      className="text-sm font-semibold text-lomo-ink-secondary"
                    >
                      Correo electrónico
                    </label>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <input
                        id="pro-upgrade-email"
                        className={inputClass}
                        type="email"
                        autoComplete="email"
                        maxLength={254}
                        required
                        placeholder="nombre@correo.com"
                        value={email}
                        disabled={sent}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                      {!sent && (
                        <button
                          type="submit"
                          disabled={busy || accountLoading}
                          className="h-11 sm:w-44 px-4 rounded-lg bg-lomo-surface-selected hover:bg-lomo-border-selected/60 border border-lomo-border-selected text-lomo-accent text-sm font-bold flex items-center justify-center gap-1.5 flex-shrink-0 transition-colors disabled:opacity-60"
                        >
                          <ArrowRight className="w-4 h-4" />
                          <span>{busy ? "Espera…" : "Enviar código"}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {sent && (
                    <div className="flex flex-col gap-3 pt-1">
                      <label className="flex flex-col gap-1.5 text-sm font-semibold text-lomo-ink-secondary">
                        <span>Código recibido por correo</span>
                        <input
                          className={inputClass}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          pattern="[0-9]{6,8}"
                          required
                          placeholder="000000"
                          value={code}
                          maxLength={8}
                          onChange={(e) => setCode(e.target.value)}
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="submit"
                          disabled={busy || accountLoading}
                          className="h-11 px-4 rounded-lg bg-lomo-action-primary hover:bg-lomo-action-hover text-lomo-on-action text-sm font-bold transition-colors disabled:opacity-60"
                        >
                          {busy ? "Espera…" : "Verificar código"}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setSent(false);
                            setCode("");
                          }}
                          className="h-11 px-3 rounded-lg text-sm font-semibold text-lomo-ink-secondary hover:bg-lomo-surface-inset transition-colors"
                        >
                          Cambiar correo o reenviar
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              )}
            </section>

            {/* Sección C: Estado del pago y orden (GnsFd en Pencil) */}
            <section className="px-5 sm:px-8 pt-4 pb-6 flex flex-col gap-4">
              {paymentError && (
                <div
                  role="status"
                  className="w-full p-3.5 rounded-lg bg-lomo-warning-surface border border-lomo-warning-border flex items-center gap-2 text-sm font-semibold text-lomo-warning-ink"
                >
                  <Info className="w-4 h-4 text-lomo-warning-ink flex-shrink-0" />
                  <span>{paymentError}</span>
                </div>
              )}

              {!currentOrder && (
                <button
                  type="button"
                  disabled={!canCreateOrder}
                  onClick={() =>
                    void run(async () => {
                      const order = await jsonApi<PaymentOrder>(
                        "/billing/orders",
                        {
                          plan_id: planId,
                          ...(planId === "loma_individual"
                            ? { loma_id: lomaId }
                            : {}),
                        }
                      );
                      await loadOrders();
                      chooseOrder(order);
                    })
                  }
                  className={`h-12 w-full rounded-lg text-[15px] font-bold flex items-center justify-center gap-2 transition-all tabular-nums ${
                    canCreateOrder
                      ? "bg-lomo-action-primary hover:bg-lomo-action-hover text-lomo-on-action shadow-sm"
                      : "bg-lomo-surface-inset border border-lomo-border text-lomo-ink-secondary cursor-not-allowed"
                  }`}
                >
                  {!canCreateOrder && (
                    <Lock className="w-4 h-4 text-lomo-ink-muted" />
                  )}
                  <span>
                    Crear orden · S/{" "}
                    {selectedPlan?.precio_pen.toFixed(2) ?? "19.90"}
                  </span>
                </button>
              )}

              {currentOrder?.status === "pendiente_pago" && yape && (
                <div className="space-y-4 rounded-xl border border-lomo-border bg-lomo-surface-inset/50 p-4">
                  <h4 className="font-bold text-[15px] text-lomo-ink-primary flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-lomo-accent" />
                    <span>2. Paga con Yape</span>
                  </h4>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <img
                      src={yape.qr_url}
                      alt={`QR Yape de ${yape.recipient}`}
                      width={176}
                      height={176}
                      className="rounded-lg bg-white p-2 border border-lomo-border object-contain"
                    />
                    <div className="space-y-1.5 text-[15px] font-medium text-lomo-ink-secondary">
                      <p>
                        Destinatario:{" "}
                        <strong className="font-bold text-lomo-ink-primary">
                          {yape.recipient}
                        </strong>
                      </p>
                      <p className="text-2xl font-extrabold text-lomo-ink-primary tabular-nums">
                        S/ {currentOrder.amount_pen.toFixed(2)}
                      </p>
                      <p className="text-sm text-lomo-ink-muted">
                        Comprueba el destinatario en Yape antes de confirmar el
                        envío.
                      </p>
                      <a
                        className="inline-block font-bold text-lomo-accent underline"
                        href={yape.qr_url}
                        download
                      >
                        Guardar QR para abrirlo en Yape
                      </a>
                    </div>
                  </div>

                  <form
                    className="space-y-3 pt-2 border-t border-lomo-border"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void run(async () => {
                        await jsonApi(
                          `/billing/orders/${currentOrder.id}/reference`,
                          {
                            operation_code: operation,
                            payment_date: paymentDate,
                            amount_pen: amount,
                          }
                        );
                        await loadOrders();
                        toast.success(
                          "Solicitud enviada. Activaremos PRO después de verificar el abono."
                        );
                      });
                    }}
                  >
                    <h4 className="font-bold text-[15px] text-lomo-ink-primary">
                      3. Registra el abono para revisión
                    </h4>
                    <label className="block text-sm font-semibold text-lomo-ink-secondary space-y-1">
                      <span>Código de operación de Yape</span>
                      <input
                        className={inputClass}
                        required
                        minLength={4}
                        maxLength={64}
                        pattern="[A-Za-z0-9-]{4,64}"
                        value={operation}
                        onChange={(e) => setOperation(e.target.value)}
                      />
                    </label>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <label className="block text-sm font-semibold text-lomo-ink-secondary space-y-1">
                        <span>Fecha del pago</span>
                        <input
                          className={inputClass}
                          required
                          type="date"
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                        />
                      </label>
                      <label className="block text-sm font-semibold text-lomo-ink-secondary space-y-1">
                        <span>Importe enviado (S/)</span>
                        <input
                          className={inputClass}
                          required
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                        />
                      </label>
                    </div>
                    <p className="text-sm font-medium text-lomo-ink-secondary">
                      {yape.message} No envíes claves, códigos de seguridad ni
                      capturas.
                    </p>
                    <button
                      type="submit"
                      disabled={busy}
                      className="h-11 px-4 rounded-lg bg-lomo-action-primary hover:bg-lomo-action-hover text-lomo-on-action text-[15px] font-bold transition-colors disabled:opacity-60"
                    >
                      Ya pagué · enviar a revisión
                    </button>
                  </form>
                </div>
              )}

              {currentOrder && (
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="self-start h-10 px-3 rounded-lg text-sm font-semibold text-lomo-ink-secondary hover:bg-lomo-surface-inset transition-colors"
                >
                  Volver a elegir un plan
                </button>
              )}

              {user && (
                <div className="space-y-3 pt-2 border-t border-lomo-border">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-[15px] text-lomo-ink-primary">
                      Mis compras
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await loadOrders();
                          await refreshAccount();
                        })
                      }
                      className="h-9 px-3 text-sm font-semibold text-lomo-ink-secondary hover:bg-lomo-surface-inset"
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Actualizar
                    </Button>
                  </div>
                  {!orders.length && (
                    <p className="text-sm font-medium text-lomo-ink-secondary">
                      Todavía no tienes órdenes.
                    </p>
                  )}
                  {orders.map((order) => (
                    <article
                      key={order.id}
                      className="border border-lomo-border rounded-xl p-3.5 space-y-2 bg-lomo-surface"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[15px] font-bold text-lomo-ink-primary tabular-nums">
                          {order.loma_id || "Todo Lima"} · S/{" "}
                          {order.amount_pen.toFixed(2)}
                        </span>
                        <Badge
                          variant={
                            order.status === "aprobado" ? "default" : "outline"
                          }
                        >
                          {labels[order.status]}
                        </Badge>
                      </div>
                      <p className="text-xs text-lomo-ink-muted font-mono break-all">
                        Orden {order.id}
                      </p>
                      {order.reason && (
                        <p className="text-sm font-medium text-lomo-ink-secondary">
                          {order.reason}
                        </p>
                      )}
                      {order.status === "pendiente_pago" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => chooseOrder(order)}
                        >
                          Continuar pago
                        </Button>
                      )}
                      {order.status === "en_revision" && (
                        <p className="text-sm font-medium text-lomo-ink-secondary">
                          El acceso se activará cuando se confirme el abono.
                          Puedes cerrar esta ventana.
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {tab === "pasaporte" && (
          <section className="px-5 sm:px-8 py-6 space-y-4">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-lomo-accent" />
              <h3 className="text-base font-bold text-lomo-ink-primary tabular-nums">
                {summitStamps.length} cumbres registradas en este dispositivo
              </h3>
            </div>
            {!summitStamps.length && (
              <p className="text-[15px] font-medium text-lomo-ink-secondary">
                Tus visitas registradas aparecerán aquí.
              </p>
            )}
            <div className="grid gap-2.5">
              {summitStamps.map((stamp) => (
                <article
                  className="rounded-xl border border-lomo-border bg-lomo-surface-selected/50 p-4 flex items-center justify-between gap-3"
                  key={stamp.loma_id}
                >
                  <div>
                    <p className="text-[15px] font-bold text-lomo-ink-primary">
                      {stamp.nombre_loma}
                    </p>
                    <p className="text-sm font-medium text-lomo-ink-secondary tabular-nums">
                      {new Date(stamp.fecha_iso).toLocaleDateString()} ·{" "}
                      {stamp.altitud_msnm} msnm
                    </p>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded bg-lomo-surface-selected text-lomo-accent border border-lomo-border-selected">
                    SHA-256
                  </span>
                </article>
              ))}
            </div>
          </section>
        )}

        {tab === "admin" && user?.admin && (
          <section className="px-5 sm:px-8 py-6 space-y-4">
            <h3 className="text-base font-bold text-lomo-ink-primary flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-lomo-accent" />
              <span>Revisión de abonos</span>
            </h3>
            {user.aal !== "aal2" ? (
              <div className="space-y-3">
                <p className="text-[15px] font-medium text-lomo-ink-secondary">
                  Verifica tu segundo factor para revisar pagos.
                </p>
                {!factors.some((f) => f.status === "verified") &&
                  !enrollment && (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          setEnrollment(await jsonApi("/auth/mfa/enroll", {}));
                        })
                      }
                    >
                      Configurar autenticador
                    </Button>
                  )}
                {enrollment && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-lomo-ink-secondary">
                      Añade esta clave a tu aplicación de autenticación y
                      verifica un código:
                    </p>
                    <code className="block break-all rounded-lg bg-lomo-surface-inset border border-lomo-border p-3 text-sm font-mono font-semibold select-all">
                      {enrollment.secret}
                    </code>
                  </div>
                )}
                {(enrollment ||
                  factors.some((f) => f.status === "verified")) && (
                  <form
                    className="space-y-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void run(async () => {
                        await jsonApi("/auth/mfa/verify", {
                          factor_id:
                            enrollment?.id ||
                            factors.find((f) => f.status === "verified")?.id,
                          code: mfaCode,
                        });
                        setEnrollment(null);
                        setMfaCode("");
                        await refreshAccount();
                      });
                    }}
                  >
                    <label className="block text-sm font-semibold text-lomo-ink-secondary space-y-1">
                      <span>Código del autenticador</span>
                      <input
                        className={inputClass}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        required
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value)}
                      />
                    </label>
                    <Button size="sm" disabled={busy} type="submit">
                      Verificar segundo factor
                    </Button>
                  </form>
                )}
              </div>
            ) : (
              <>
                <p className="text-sm font-medium text-lomo-ink-secondary">
                  Contrasta destinatario, código, fecha e importe con el
                  movimiento recibido en Yape antes de aprobar.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void run(async () =>
                      setReviewOrders(await jsonApi("/billing/admin/orders"))
                    )
                  }
                >
                  Actualizar pendientes
                </Button>
                {!reviewOrders.length && (
                  <p className="text-sm font-medium text-lomo-ink-secondary">
                    No hay pagos pendientes de revisión.
                  </p>
                )}
                {reviewOrders.map((order) => (
                  <ReviewCard
                    key={order.id}
                    order={order}
                    onReview={async (item, decision, reason) => {
                      try {
                        await jsonApi(
                          `/billing/admin/orders/${item.id}/review`,
                          { decision, reason }
                        );
                        setReviewOrders(await jsonApi("/billing/admin/orders"));
                        toast.success("Revisión registrada");
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "No se pudo guardar la revisión"
                        );
                      }
                    }}
                  />
                ))}
              </>
            )}
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
