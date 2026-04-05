"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/AdminShell";
import AdminActionNoteModal from "@/components/AdminActionNoteModal";
import PaginationControls from "@/components/PaginationControls";
import api from "@/lib/api";
import { formatCurrency, formatDateShort } from "@/lib/format";
import type { Order, OrderStatusEvent } from "@/lib/types";
import { useToast } from "@/hooks/useToast";

type ApiError = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

type RefundType = "full" | "partial";
type RefundReasonCode =
  | "customer_request"
  | "product_defect"
  | "wrong_item"
  | "delivery_failure"
  | "pricing_error"
  | "duplicate_payment"
  | "goodwill"
  | "other";
type PaymentOverrideReasonCode =
  | "offline_bank_transfer"
  | "cash_settlement"
  | "terminal_settlement"
  | "executive_approval"
  | "other";
type PaymentStatusFilter = "all" | "success" | "pending" | "failed" | "other";
type ProviderFilter = "all" | "paystack" | "offline" | "other";
type VerificationSourceFilter =
  | "all"
  | "gateway_webhook"
  | "gateway_verify"
  | "admin_recheck"
  | "offline_override"
  | "reconciliation_interval"
  | "reconciliation_daily"
  | "unknown";
type PaymentsViewTab = "payments" | "audit";

type AuditEntry = {
  id: string;
  type: "payment_audit";
  timestamp: string;
  action: string;
  source?: string | null;
  status?: string | null;
  note?: string | null;
  actorRole?: string | null;
  actorUserId?: string | null;
  reference?: string | null;
  gatewayStatus?: string | null;
  amount?: number;
  currency?: string;
  reasonCode?: string;
  approvalReference?: string;
};

const MIN_INTERNAL_NOTE_LENGTH = 10;
const MAX_INTERNAL_NOTE_LENGTH = 500;
const PAGE_SIZE = 10;

const refundReasonCodeOptions: Array<{ value: RefundReasonCode; label: string }> = [
  { value: "customer_request", label: "Customer Request" },
  { value: "product_defect", label: "Product Defect" },
  { value: "wrong_item", label: "Wrong Item" },
  { value: "delivery_failure", label: "Delivery Failure" },
  { value: "pricing_error", label: "Pricing Error" },
  { value: "duplicate_payment", label: "Duplicate Payment" },
  { value: "goodwill", label: "Goodwill" },
  { value: "other", label: "Other" },
];

const paymentOverrideReasonOptions: Array<{ value: PaymentOverrideReasonCode; label: string }> = [
  { value: "offline_bank_transfer", label: "Offline Bank Transfer" },
  { value: "cash_settlement", label: "Cash Settlement" },
  { value: "terminal_settlement", label: "Terminal Settlement" },
  { value: "executive_approval", label: "Executive Approval" },
  { value: "other", label: "Other" },
];

const getApiErrorMessage = (error: unknown, fallbackMessage: string) => {
  const candidate = error as ApiError;
  return candidate.response?.data?.message ?? fallbackMessage;
};

const normalizeText = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parsePositiveAmount = (value: string) => {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Number(parsed.toFixed(2));
};

const getPaymentStatus = (order: Order) => {
  const raw = String(order.metadata?.payment?.status || "unknown").toLowerCase();
  if (raw === "success") {
    return "success";
  }
  if (["pending", "abandoned", "processing"].includes(raw)) {
    return "pending";
  }
  if (["failed", "error"].includes(raw)) {
    return "failed";
  }
  return raw === "unknown" ? "other" : raw;
};

const getPaymentProvider = (order: Order) => {
  const raw = String(order.metadata?.payment?.provider || "other").toLowerCase();
  if (raw === "paystack") {
    return "paystack";
  }
  if (raw === "offline") {
    return "offline";
  }
  return "other";
};

const isPaymentAttention = (order: Order) => {
  if (!["pending_payment", "pending"].includes(order.status)) {
    return false;
  }

  return getPaymentStatus(order) !== "success";
};

const getVerificationSource = (order: Order) => {
  const source = String(order.metadata?.payment?.verificationSource || "").toLowerCase();
  if (
    source === "gateway_webhook" ||
    source === "gateway_verify" ||
    source === "admin_recheck" ||
    source === "offline_override" ||
    source === "reconciliation_interval" ||
    source === "reconciliation_daily"
  ) {
    return source;
  }

  if (order.metadata?.payment?.offlineOverride) {
    return "offline_override";
  }

  return "unknown";
};

const verificationSourceLabel: Record<Exclude<VerificationSourceFilter, "all">, string> = {
  gateway_webhook: "Gateway Webhook",
  gateway_verify: "Gateway Verify",
  admin_recheck: "Admin Recheck",
  offline_override: "Offline Override",
  reconciliation_interval: "Auto Reconciliation",
  reconciliation_daily: "Daily Reconciliation",
  unknown: "Unverified Source",
};

const verificationSourceTone: Record<Exclude<VerificationSourceFilter, "all">, string> = {
  gateway_webhook: "border-emerald-200 bg-emerald-50 text-emerald-800",
  gateway_verify: "border-sky-200 bg-sky-50 text-sky-800",
  admin_recheck: "border-amber-200 bg-amber-50 text-amber-800",
  offline_override: "border-indigo-200 bg-indigo-50 text-indigo-800",
  reconciliation_interval: "border-lime-200 bg-lime-50 text-lime-800",
  reconciliation_daily: "border-green-200 bg-green-50 text-green-800",
  unknown: "border-rose-200 bg-rose-50 text-rose-800",
};

const isReconciliationMismatch = (order: Order) => {
  const paymentStatus = getPaymentStatus(order);

  if (paymentStatus === "success") {
    return ["pending_payment", "pending"].includes(order.status);
  }

  return [
    "paid",
    "processing",
    "packed",
    "shipped",
    "out_for_delivery",
    "delivery_pickup",
    "delivered",
    "received",
    "fulfilled",
    "refunded",
  ].includes(order.status);
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString();
};

const stringifyStatusEventMetadata = (event: OrderStatusEvent) => {
  if (!event.metadata) {
    return null;
  }

  try {
    return JSON.stringify(event.metadata, null, 2);
  } catch {
    return null;
  }
};

const getPaymentAuditEntries = (order: Order): AuditEntry[] => {
  const raw = order.metadata?.payment?.auditTrail;
  if (!Array.isArray(raw)) {
    return [];
  }

  const entries: AuditEntry[] = [];

  raw.forEach((entry, index) => {
    if (!entry || typeof entry.timestamp !== "string") {
      return;
    }

    entries.push({
      id: `${order.id}-audit-${index}`,
      type: "payment_audit",
      timestamp: entry.timestamp,
      action: String(entry.action || "unknown_action"),
      source: entry.source || null,
      status: entry.status || null,
      note: entry.note || null,
      actorRole: entry.actorRole || null,
      actorUserId: entry.actorUserId || null,
      reference: entry.reference || null,
      gatewayStatus: entry.gatewayStatus || null,
      amount: typeof entry.amount === "number" ? entry.amount : undefined,
      currency: entry.currency,
      reasonCode: entry.reasonCode,
      approvalReference: entry.approvalReference,
    });
  });

  return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

const PaymentModalContainer = ({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onClose: () => void;
}) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
    onClick={(event) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    }}
  >
    <div className="w-full max-w-xl rounded-2xl border border-black/10 bg-white p-6 shadow-2xl">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-black/60">{description}</p>
      {children}
    </div>
  </div>
);

export default function AdminPaymentsPage() {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [activeTab, setActiveTab] = useState<PaymentsViewTab>("payments");
  const [searchTerm, setSearchTerm] = useState("");
  const [auditSearchTerm, setAuditSearchTerm] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilter>("all");
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>("all");
  const [verificationSourceFilter, setVerificationSourceFilter] =
    useState<VerificationSourceFilter>("all");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [mismatchOnly, setMismatchOnly] = useState(false);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);

  const [recheckTarget, setRecheckTarget] = useState<Order | null>(null);
  const [recheckNote, setRecheckNote] = useState("");
  const [recheckError, setRecheckError] = useState("");
  const [recheckSubmitting, setRecheckSubmitting] = useState(false);

  const [refundTarget, setRefundTarget] = useState<Order | null>(null);
  const [refundType, setRefundType] = useState<RefundType>("partial");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReasonCode, setRefundReasonCode] = useState<RefundReasonCode>("customer_request");
  const [refundReasonNote, setRefundReasonNote] = useState("");
  const [refundInternalNote, setRefundInternalNote] = useState("");
  const [refundError, setRefundError] = useState("");
  const [refundSubmitting, setRefundSubmitting] = useState(false);

  const [overrideTarget, setOverrideTarget] = useState<Order | null>(null);
  const [overrideReasonCode, setOverrideReasonCode] =
    useState<PaymentOverrideReasonCode>("offline_bank_transfer");
  const [overrideApprovalReference, setOverrideApprovalReference] = useState("");
  const [overrideAmount, setOverrideAmount] = useState("");
  const [overrideInternalNote, setOverrideInternalNote] = useState("");
  const [overrideError, setOverrideError] = useState("");
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  const [approveTarget, setApproveTarget] = useState<Order | null>(null);
  const [approveInternalNote, setApproveInternalNote] = useState("");
  const [approveError, setApproveError] = useState("");
  const [approveSubmitting, setApproveSubmitting] = useState(false);

  const loadOrders = async () => {
    try {
      setStatus("loading");
      const response = await api.get("/orders");
      setOrders(response.data.orders || []);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return orders
      .filter((order) => {
        if (paymentStatusFilter !== "all") {
          const computedStatus = getPaymentStatus(order);
          if (paymentStatusFilter === "other") {
            if (["success", "pending", "failed"].includes(computedStatus)) {
              return false;
            }
          } else if (computedStatus !== paymentStatusFilter) {
            return false;
          }
        }

        if (providerFilter !== "all" && getPaymentProvider(order) !== providerFilter) {
          return false;
        }

        if (verificationSourceFilter !== "all") {
          const source = getVerificationSource(order);
          if (source !== verificationSourceFilter) {
            return false;
          }
        }

        if (attentionOnly && !isPaymentAttention(order)) {
          return false;
        }

        if (mismatchOnly && !isReconciliationMismatch(order)) {
          return false;
        }

        if (!term) {
          return true;
        }

        const idMatch = order.id.toLowerCase().includes(term);
        const paymentRefMatch = String(order.metadata?.payment?.reference || "")
          .toLowerCase()
          .includes(term);
        const customerMatch = String(order.User?.email || "")
          .toLowerCase()
          .includes(term);

        return idMatch || paymentRefMatch || customerMatch;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [
    orders,
    searchTerm,
    paymentStatusFilter,
    providerFilter,
    verificationSourceFilter,
    attentionOnly,
    mismatchOnly,
  ]);

  const kpis = useMemo(() => {
    const settled = orders.filter((order) => getPaymentStatus(order) === "success").length;
    const pending = orders.filter((order) => isPaymentAttention(order)).length;
    const refunded = orders.filter((order) => Number(order.metadata?.payment?.refundedAmount || 0) > 0).length;
    const offlineOverrides = orders.filter(
      (order) =>
        getPaymentProvider(order) === "offline" &&
        !!order.metadata?.payment?.offlineOverride &&
        getPaymentStatus(order) === "success"
    ).length;
    const mismatches = orders.filter((order) => isReconciliationMismatch(order)).length;

    return {
      settled,
      pending,
      refunded,
      offlineOverrides,
      mismatches,
    };
  }, [orders]);

  const ordersWithAudit = useMemo(() => {
    return orders
      .map((order) => {
        const paymentAudit = getPaymentAuditEntries(order);
        const statusEvents = Array.isArray(order.OrderStatusEvents)
          ? [...order.OrderStatusEvents].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )
          : [];

        return {
          order,
          paymentAudit,
          statusEvents,
        };
      })
      .filter((entry) => entry.paymentAudit.length > 0 || entry.statusEvents.length > 0)
      .sort((a, b) => new Date(b.order.createdAt).getTime() - new Date(a.order.createdAt).getTime());
  }, [orders]);

  const filteredAudit = useMemo(() => {
    const term = auditSearchTerm.trim().toLowerCase();
    if (!term) {
      return ordersWithAudit;
    }

    return ordersWithAudit.filter(({ order, paymentAudit, statusEvents }) => {
      const orderIdMatch = order.id.toLowerCase().includes(term);
      const refMatch = String(order.metadata?.payment?.reference || "")
        .toLowerCase()
        .includes(term);
      const customerMatch = String(order.User?.email || "")
        .toLowerCase()
        .includes(term);
      const auditMatch = paymentAudit.some(
        (entry) =>
          entry.action.toLowerCase().includes(term) ||
          String(entry.note || "")
            .toLowerCase()
            .includes(term)
      );
      const statusEventMatch = statusEvents.some(
        (event) =>
          String(event.note || "")
            .toLowerCase()
            .includes(term) || event.toStatus.toLowerCase().includes(term)
      );

      return orderIdMatch || refMatch || customerMatch || auditMatch || statusEventMatch;
    });
  }, [ordersWithAudit, auditSearchTerm]);

  useEffect(() => {
    setPaymentsPage(1);
  }, [searchTerm, paymentStatusFilter, providerFilter, verificationSourceFilter, attentionOnly, mismatchOnly]);

  useEffect(() => {
    setAuditPage(1);
  }, [auditSearchTerm]);

  const totalPaymentsPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const safePaymentsPage = Math.min(paymentsPage, totalPaymentsPages);
  const paginatedFilteredOrders = filteredOrders.slice(
    (safePaymentsPage - 1) * PAGE_SIZE,
    safePaymentsPage * PAGE_SIZE
  );

  const totalAuditPages = Math.max(1, Math.ceil(filteredAudit.length / PAGE_SIZE));
  const safeAuditPage = Math.min(auditPage, totalAuditPages);
  const paginatedFilteredAudit = filteredAudit.slice(
    (safeAuditPage - 1) * PAGE_SIZE,
    safeAuditPage * PAGE_SIZE
  );

  const auditKpis = useMemo(() => {
    const totalPaymentAuditEntries = ordersWithAudit.reduce(
      (sum, item) => sum + item.paymentAudit.length,
      0
    );
    const totalStatusEvents = ordersWithAudit.reduce((sum, item) => sum + item.statusEvents.length, 0);

    return {
      ordersWithAudit: ordersWithAudit.length,
      totalPaymentAuditEntries,
      totalStatusEvents,
    };
  }, [ordersWithAudit]);

  const openRecheckModal = (order: Order) => {
    setRecheckTarget(order);
    setRecheckNote("");
    setRecheckError("");
  };

  const submitRecheckPayment = async () => {
    if (!recheckTarget) {
      return;
    }

    const note = recheckNote.trim();
    if (note.length < MIN_INTERNAL_NOTE_LENGTH) {
      setRecheckError(`Internal note must be at least ${MIN_INTERNAL_NOTE_LENGTH} characters.`);
      return;
    }

    if (note.length > MAX_INTERNAL_NOTE_LENGTH) {
      setRecheckError(`Internal note cannot exceed ${MAX_INTERNAL_NOTE_LENGTH} characters.`);
      return;
    }

    try {
      setRecheckSubmitting(true);
      setRecheckError("");
      const response = await api.post(`/orders/${recheckTarget.id}/recheck-payment`, {
        internalNote: note,
      });

      if (response.data?.verified) {
        if (response.data?.alreadyPaid) {
          toast.info("Payment already confirmed. Order state verified.");
        } else {
          toast.success("Payment confirmed and order updated.");
        }
      } else {
        toast.warning(`Payment still unresolved (${response.data?.paymentStatus || "failed"}).`);
      }

      setRecheckTarget(null);
      await loadOrders();
    } catch (error: unknown) {
      setRecheckError(getApiErrorMessage(error, "Failed to recheck payment."));
    } finally {
      setRecheckSubmitting(false);
    }
  };

  const openRefundModal = (order: Order) => {
    setRefundTarget(order);
    setRefundType("partial");
    setRefundAmount("");
    setRefundReasonCode("customer_request");
    setRefundReasonNote("");
    setRefundInternalNote("");
    setRefundError("");
  };

  const submitRefund = async () => {
    if (!refundTarget) {
      return;
    }

    const internalNote = refundInternalNote.trim();
    if (internalNote.length < MIN_INTERNAL_NOTE_LENGTH) {
      setRefundError(`Internal note must be at least ${MIN_INTERNAL_NOTE_LENGTH} characters.`);
      return;
    }

    const orderTotal = Number(refundTarget.total || 0);
    const refundedAmount = Number(refundTarget.metadata?.payment?.refundedAmount || 0);
    const remainingAmount = Number(Math.max(orderTotal - refundedAmount, 0).toFixed(2));

    if (remainingAmount <= 0) {
      setRefundError("Order has already been fully refunded.");
      return;
    }

    const payload: {
      refundType: RefundType;
      reasonCode: RefundReasonCode;
      reasonNote: string | null;
      internalNote: string;
      amount?: number;
    } = {
      refundType,
      reasonCode: refundReasonCode,
      reasonNote: normalizeText(refundReasonNote),
      internalNote,
    };

    if (refundType === "partial") {
      const amount = parsePositiveAmount(refundAmount);
      if (!amount) {
        setRefundError("Enter a valid partial refund amount.");
        return;
      }

      if (amount >= remainingAmount) {
        setRefundError("Partial refund must be less than remaining refundable amount.");
        return;
      }

      payload.amount = amount;
    }

    try {
      setRefundSubmitting(true);
      setRefundError("");
      const response = await api.post(`/orders/${refundTarget.id}/refunds`, payload);
      toast.success(response.data?.message || "Refund action submitted.");
      setRefundTarget(null);
      await loadOrders();
    } catch (error: unknown) {
      setRefundError(getApiErrorMessage(error, "Failed to process refund."));
    } finally {
      setRefundSubmitting(false);
    }
  };

  const openOverrideModal = (order: Order) => {
    setOverrideTarget(order);
    setOverrideReasonCode("offline_bank_transfer");
    setOverrideApprovalReference("");
    setOverrideAmount("");
    setOverrideInternalNote("");
    setOverrideError("");
  };

  const submitOfflineOverride = async () => {
    if (!overrideTarget) {
      return;
    }

    const internalNote = overrideInternalNote.trim();
    if (internalNote.length < MIN_INTERNAL_NOTE_LENGTH) {
      setOverrideError(`Internal note must be at least ${MIN_INTERNAL_NOTE_LENGTH} characters.`);
      return;
    }

    if (internalNote.length > MAX_INTERNAL_NOTE_LENGTH) {
      setOverrideError(`Internal note cannot exceed ${MAX_INTERNAL_NOTE_LENGTH} characters.`);
      return;
    }

    const approvalReference = overrideApprovalReference.trim();
    if (approvalReference.length < 6) {
      setOverrideError("Approval reference must be at least 6 characters.");
      return;
    }

    const payload: {
      reasonCode: PaymentOverrideReasonCode;
      approvalReference: string;
      internalNote: string;
      amount?: number;
    } = {
      reasonCode: overrideReasonCode,
      approvalReference,
      internalNote,
    };

    if (overrideAmount.trim()) {
      const amount = parsePositiveAmount(overrideAmount);
      if (!amount) {
        setOverrideError("Override amount must be a positive number.");
        return;
      }
      payload.amount = amount;
    }

    try {
      setOverrideSubmitting(true);
      setOverrideError("");
      const response = await api.post(`/orders/${overrideTarget.id}/payment-override`, payload);
      toast.success(response.data?.message || "Offline payment override request submitted.");
      setOverrideTarget(null);
      await loadOrders();
    } catch (error: unknown) {
      setOverrideError(getApiErrorMessage(error, "Failed to apply payment override."));
    } finally {
      setOverrideSubmitting(false);
    }
  };

  const openApproveModal = (order: Order) => {
    setApproveTarget(order);
    setApproveInternalNote("");
    setApproveError("");
  };

  const submitOverrideApproval = async () => {
    if (!approveTarget) {
      return;
    }

    const internalNote = approveInternalNote.trim();
    if (internalNote.length < MIN_INTERNAL_NOTE_LENGTH) {
      setApproveError(`Internal note must be at least ${MIN_INTERNAL_NOTE_LENGTH} characters.`);
      return;
    }

    if (internalNote.length > MAX_INTERNAL_NOTE_LENGTH) {
      setApproveError(`Internal note cannot exceed ${MAX_INTERNAL_NOTE_LENGTH} characters.`);
      return;
    }

    try {
      setApproveSubmitting(true);
      setApproveError("");
      const response = await api.post(`/orders/${approveTarget.id}/payment-override/approve`, {
        internalNote,
      });
      toast.success(response.data?.message || "Offline override approved.");
      setApproveTarget(null);
      await loadOrders();
    } catch (error: unknown) {
      setApproveError(getApiErrorMessage(error, "Failed to approve payment override."));
    } finally {
      setApproveSubmitting(false);
    }
  };

  return (
    <AdminShell title="Payments">
      {status === "loading" && (
        <div className="rounded-2xl border border-dashed border-black/15 bg-white p-6 text-sm text-black/60">
          Loading payment operations...
        </div>
      )}

      {status === "error" && (
        <div className="rounded-2xl border border-dashed border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Unable to load payment data.
        </div>
      )}

      {status === "ready" && (
        <div className="space-y-5">
          <section className="relative overflow-hidden rounded-3xl border border-black/10 bg-[radial-gradient(circle_at_top_left,_#dbeafe_0%,_transparent_36%),radial-gradient(circle_at_top_right,_#fde68a_0%,_transparent_34%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-5">
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cyan-200/45 blur-2xl" />
            <div className="absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-amber-200/45 blur-2xl" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/55">Payment Control Center</p>
              <p className="mt-2 text-sm text-black/65">
                Monitor payment state, resolve mismatches, and enforce audit-safe financial actions.
              </p>
            </div>
          </section>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("payments")}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
                activeTab === "payments"
                  ? "border-black bg-black text-white shadow-[0_10px_18px_-14px_rgba(0,0,0,0.9)]"
                  : "border-black/15 bg-white text-black/75 hover:border-black/30 hover:bg-black hover:text-white"
              }`}
            >
              Payments ({orders.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("audit")}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
                activeTab === "audit"
                  ? "border-black bg-black text-white shadow-[0_10px_18px_-14px_rgba(0,0,0,0.9)]"
                  : "border-black/15 bg-white text-black/75 hover:border-black/30 hover:bg-black hover:text-white"
              }`}
            >
              Payment Audit ({auditKpis.totalPaymentAuditEntries})
            </button>
          </div>

          {activeTab === "payments" && (
            <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-emerald-200/80 bg-linear-to-br from-emerald-100 to-white p-4 shadow-[0_10px_26px_-20px_rgba(0,0,0,0.4)]">
              <p className="text-xs uppercase tracking-[0.16em] text-emerald-900/70">Settled Payments</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-900">{kpis.settled}</p>
            </div>
            <div className="rounded-2xl border border-amber-200/80 bg-linear-to-br from-amber-100 to-white p-4 shadow-[0_10px_26px_-20px_rgba(0,0,0,0.4)]">
              <p className="text-xs uppercase tracking-[0.16em] text-amber-900/70">Pending Attention</p>
              <p className="mt-2 text-2xl font-semibold text-amber-900">{kpis.pending}</p>
            </div>
            <div className="rounded-2xl border border-sky-200/80 bg-linear-to-br from-sky-100 to-white p-4 shadow-[0_10px_26px_-20px_rgba(0,0,0,0.4)]">
              <p className="text-xs uppercase tracking-[0.16em] text-sky-900/70">Refunded Orders</p>
              <p className="mt-2 text-2xl font-semibold text-sky-900">{kpis.refunded}</p>
            </div>
            <div className="rounded-2xl border border-indigo-200/80 bg-linear-to-br from-indigo-100 to-white p-4 shadow-[0_10px_26px_-20px_rgba(0,0,0,0.4)]">
              <p className="text-xs uppercase tracking-[0.16em] text-indigo-900/70">Offline Overrides</p>
              <p className="mt-2 text-2xl font-semibold text-indigo-900">{kpis.offlineOverrides}</p>
            </div>
            <div className="rounded-2xl border border-rose-200/80 bg-linear-to-br from-rose-100 to-white p-4 shadow-[0_10px_26px_-20px_rgba(0,0,0,0.4)]">
              <p className="text-xs uppercase tracking-[0.16em] text-rose-900/70">Reconciliation Mismatches</p>
              <p className="mt-2 text-2xl font-semibold text-rose-900">{kpis.mismatches}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.45)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/50">Filters</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                Search
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Order ID, payment ref, customer email"
                  className="rounded-xl border border-black/10 px-3 py-2 text-sm text-black"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                Payment Status
                <select
                  value={paymentStatusFilter}
                  onChange={(event) => setPaymentStatusFilter(event.target.value as PaymentStatusFilter)}
                  className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black"
                >
                  <option value="all">All</option>
                  <option value="success">Success</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                Provider
                <select
                  value={providerFilter}
                  onChange={(event) => setProviderFilter(event.target.value as ProviderFilter)}
                  className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black"
                >
                  <option value="all">All</option>
                  <option value="paystack">Paystack</option>
                  <option value="offline">Offline</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                Verification Source
                <select
                  value={verificationSourceFilter}
                  onChange={(event) =>
                    setVerificationSourceFilter(event.target.value as VerificationSourceFilter)
                  }
                  className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black"
                >
                  <option value="all">All</option>
                  <option value="gateway_webhook">Gateway Webhook</option>
                  <option value="gateway_verify">Gateway Verify</option>
                  <option value="admin_recheck">Admin Recheck</option>
                  <option value="reconciliation_interval">Auto Reconciliation</option>
                  <option value="reconciliation_daily">Daily Reconciliation</option>
                  <option value="offline_override">Offline Override</option>
                  <option value="unknown">Unverified Source</option>
                </select>
              </label>

              <label className="flex items-center gap-2 self-end rounded-xl border border-black/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                <input
                  type="checkbox"
                  checked={attentionOnly}
                  onChange={(event) => setAttentionOnly(event.target.checked)}
                  className="h-4 w-4"
                />
                Pending Attention Only
              </label>

              <label className="flex items-center gap-2 self-end rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-800">
                <input
                  type="checkbox"
                  checked={mismatchOnly}
                  onChange={(event) => setMismatchOnly(event.target.checked)}
                  className="h-4 w-4"
                />
                Mismatch Only
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_20px_45px_-32px_rgba(0,0,0,0.5)]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-black/70">{filteredOrders.length} payment records</p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-black/10">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-black/10 bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] text-xs uppercase tracking-[0.16em] text-black/50">
                    <th className="px-3 py-2">Order</th>
                    <th className="px-3 py-2">Payment</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedFilteredOrders.map((order) => {
                    const paymentStatus = String(order.metadata?.payment?.status || "unknown");
                    const provider = String(order.metadata?.payment?.provider || "-");
                    const reference = String(order.metadata?.payment?.reference || "-");
                    const refundedAmount = Number(order.metadata?.payment?.refundedAmount || 0);
                    const paymentSettled = paymentStatus.toLowerCase() === "success";
                    const verificationSource = getVerificationSource(order);
                    const verificationActorRole = order.metadata?.payment?.verificationActorRole || null;
                    const verificationActorUserId = order.metadata?.payment?.verificationActorUserId || null;
                    const verifiedAt = order.metadata?.payment?.verifiedAt || null;
                    const pendingOfflineOverride = order.metadata?.payment?.pendingOfflineOverride || null;
                    const overridePendingApproval = !!pendingOfflineOverride;
                    const overrideEligible = provider.toLowerCase() === "offline" && !overridePendingApproval;
                    const canApprovePending = provider.toLowerCase() === "offline" && overridePendingApproval;
                    const overrideActionEnabled = overrideEligible || canApprovePending;
                    const hasMismatch = isReconciliationMismatch(order);

                    return (
                      <tr key={order.id} className="border-b border-black/5 align-top transition-colors hover:bg-black/[0.02]">
                        <td className="px-3 py-3">
                          <p className="font-semibold">{order.id.slice(0, 8)}</p>
                          <p className="text-xs text-black/55">{formatDateShort(order.createdAt)}</p>
                          <p className="mt-1 text-[11px] text-black/45">Status: {order.status}</p>
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="mt-1 inline-flex text-xs font-semibold text-blue-700 underline"
                          >
                            View order
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-semibold">{paymentStatus}</p>
                          <p className="text-xs text-black/55">Provider: {provider}</p>
                          <p className="break-all text-xs text-black/55">Ref: {reference}</p>
                          {verifiedAt && (
                            <p className="text-[11px] text-black/50">Verified: {formatDateShort(verifiedAt)}</p>
                          )}
                          {verificationActorRole && (
                            <p className="text-[11px] text-black/50">
                              Actor: {verificationActorRole}
                              {verificationActorUserId ? ` (${verificationActorUserId})` : ""}
                            </p>
                          )}
                          <p className="mt-1">
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                                verificationSourceTone[verificationSource]
                              }`}
                            >
                              {verificationSourceLabel[verificationSource]}
                            </span>
                          </p>
                          {hasMismatch && (
                            <p className="mt-1 inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
                              Reconciliation Mismatch
                            </p>
                          )}
                          {overridePendingApproval && (
                            <div className="mt-2 space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
                              <p className="font-semibold">Offline Override Pending Approval</p>
                              <p>Reason: {pendingOfflineOverride?.reasonCode || "-"}</p>
                              <p>Ref: {pendingOfflineOverride?.approvalReference || "-"}</p>
                              {pendingOfflineOverride?.requestedAt && (
                                <p>Requested: {formatDateShort(pendingOfflineOverride.requestedAt)}</p>
                              )}
                              {pendingOfflineOverride?.requestedBy && (
                                <p>Requested by: {pendingOfflineOverride.requestedBy}</p>
                              )}
                            </div>
                          )}
                          {refundedAmount > 0 && (
                            <p className="mt-1 text-xs font-semibold text-emerald-700">
                              Refunded: {formatCurrency(refundedAmount, order.currency)}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-semibold">{formatCurrency(order.total, order.currency)}</p>
                        </td>
                        <td className="px-3 py-3">
                          <p>{order.User?.name || "-"}</p>
                          <p className="text-xs text-black/55">{order.User?.email || "-"}</p>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openRecheckModal(order)}
                              disabled={!order.metadata?.payment?.reference}
                              className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Recheck
                            </button>
                            <button
                              type="button"
                              onClick={() => openRefundModal(order)}
                              disabled={!paymentSettled}
                              className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Refund
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                overridePendingApproval ? openApproveModal(order) : openOverrideModal(order)
                              }
                              disabled={!overrideActionEnabled}
                              title={
                                overridePendingApproval
                                  ? "Approve pending offline override request"
                                  : overrideEligible
                                    ? "Record an approved offline settlement"
                                    : "Override is only available for offline payments"
                              }
                              className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {overridePendingApproval ? "Approve" : "Override"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-sm text-black/60">
                        No payment records match current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls
              totalItems={filteredOrders.length}
              currentPage={safePaymentsPage}
              pageSize={PAGE_SIZE}
              onPageChange={setPaymentsPage}
              itemLabel="payment records"
              className="mt-4"
            />
          </div>
            </>
          )}

          {activeTab === "audit" && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-blue-200/80 bg-linear-to-br from-blue-100 to-white p-4 shadow-[0_10px_26px_-20px_rgba(0,0,0,0.4)]">
                  <p className="text-xs uppercase tracking-[0.16em] text-blue-900/70">Orders with Logs</p>
                  <p className="mt-2 text-2xl font-semibold text-blue-900">{auditKpis.ordersWithAudit}</p>
                </div>
                <div className="rounded-2xl border border-indigo-200/80 bg-linear-to-br from-indigo-100 to-white p-4 shadow-[0_10px_26px_-20px_rgba(0,0,0,0.4)]">
                  <p className="text-xs uppercase tracking-[0.16em] text-indigo-900/70">Payment Audit Entries</p>
                  <p className="mt-2 text-2xl font-semibold text-indigo-900">{auditKpis.totalPaymentAuditEntries}</p>
                </div>
                <div className="rounded-2xl border border-emerald-200/80 bg-linear-to-br from-emerald-100 to-white p-4 shadow-[0_10px_26px_-20px_rgba(0,0,0,0.4)]">
                  <p className="text-xs uppercase tracking-[0.16em] text-emerald-900/70">Status Timeline Events</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-900">{auditKpis.totalStatusEvents}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.45)]">
                <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                  Search logs
                  <input
                    type="text"
                    value={auditSearchTerm}
                    onChange={(event) => setAuditSearchTerm(event.target.value)}
                    placeholder="Order ID, payment ref, customer, action, note"
                    className="rounded-xl border border-black/10 px-3 py-2 text-sm text-black"
                  />
                </label>
              </div>

              <div className="space-y-3">
                {paginatedFilteredAudit.map(({ order, paymentAudit, statusEvents }) => (
                  <details key={order.id} className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_14px_32px_-26px_rgba(0,0,0,0.5)]">
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-black">Order {order.id.slice(0, 8)}</p>
                          <p className="text-xs text-black/55">
                            {order.User?.email || "-"} | Ref: {order.metadata?.payment?.reference || "-"}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 font-semibold text-indigo-800">
                            {paymentAudit.length} payment logs
                          </span>
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 font-semibold text-emerald-800">
                            {statusEvents.length} status events
                          </span>
                          <span className="rounded-full border border-black/10 bg-black/5 px-2 py-1 font-semibold text-black/70">
                            {formatDateShort(order.createdAt)}
                          </span>
                        </div>
                      </div>
                    </summary>

                    <div className="mt-4 space-y-3 border-t border-black/10 pt-4">
                      <details open className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
                        <summary className="cursor-pointer text-sm font-semibold text-indigo-900">
                          Payment Audit Trail ({paymentAudit.length})
                        </summary>
                        <div className="mt-3 space-y-2">
                          {paymentAudit.length === 0 && (
                            <p className="text-xs text-black/60">No payment audit entries for this order.</p>
                          )}

                          {paymentAudit.map((entry) => (
                            <div key={entry.id} className="rounded-lg border border-indigo-200 bg-white p-3 text-xs">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-semibold text-indigo-900">{entry.action}</p>
                                <p className="text-black/50">{formatDateTime(entry.timestamp)}</p>
                              </div>
                              <p className="mt-1 text-black/70">
                                Actor: {entry.actorRole || "-"}
                                {entry.actorUserId ? ` (${entry.actorUserId})` : ""}
                              </p>
                              {entry.note && <p className="mt-1 text-black/70">Reason: {entry.note}</p>}
                              <p className="mt-1 text-black/60">
                                Source: {entry.source || "-"} | Status: {entry.status || "-"} | Gateway: {entry.gatewayStatus || "-"}
                              </p>
                              <p className="mt-1 text-black/60">
                                Ref: {entry.reference || "-"}
                                {entry.approvalReference ? ` | Approval Ref: ${entry.approvalReference}` : ""}
                                {typeof entry.amount === "number"
                                  ? ` | Amount: ${formatCurrency(entry.amount, entry.currency || order.currency || "GHS")}`
                                  : ""}
                                {entry.reasonCode ? ` | Reason Code: ${entry.reasonCode}` : ""}
                              </p>
                            </div>
                          ))}
                        </div>
                      </details>

                      <details className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                        <summary className="cursor-pointer text-sm font-semibold text-emerald-900">
                          Status Timeline Events ({statusEvents.length})
                        </summary>
                        <div className="mt-3 space-y-2">
                          {statusEvents.length === 0 && (
                            <p className="text-xs text-black/60">No status timeline events for this order.</p>
                          )}

                          {statusEvents.map((event) => {
                            const metadataText = stringifyStatusEventMetadata(event);

                            return (
                              <div key={event.id} className="rounded-lg border border-emerald-200 bg-white p-3 text-xs">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="font-semibold text-emerald-900">
                                    {event.fromStatus ? `${event.fromStatus} -> ${event.toStatus}` : event.toStatus}
                                  </p>
                                  <p className="text-black/50">{formatDateTime(event.createdAt)}</p>
                                </div>
                                <p className="mt-1 text-black/70">
                                  Actor: {event.actorRole}
                                </p>
                                {event.note && <p className="mt-1 text-black/70">Reason: {event.note}</p>}
                                {metadataText && (
                                  <details className="mt-2 rounded border border-black/10 bg-black/5 p-2">
                                    <summary className="cursor-pointer text-[11px] font-semibold text-black/60">
                                      View metadata
                                    </summary>
                                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[11px] text-black/70">
                                      {metadataText}
                                    </pre>
                                  </details>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    </div>
                  </details>
                ))}

                {filteredAudit.length === 0 && (
                  <div className="rounded-2xl border border-black/10 bg-white p-6 text-center text-sm text-black/60">
                    No audit records match your search.
                  </div>
                )}
              </div>
              <PaginationControls
                totalItems={filteredAudit.length}
                currentPage={safeAuditPage}
                pageSize={PAGE_SIZE}
                onPageChange={setAuditPage}
                itemLabel="audit records"
                className="mt-4"
              />
            </>
          )}
        </div>
      )}

      <AdminActionNoteModal
        open={!!recheckTarget}
        title={recheckTarget ? `Recheck payment for ${recheckTarget.id.slice(0, 8)}` : "Recheck payment"}
        description="Provide an internal note before triggering manual payment verification."
        note={recheckNote}
        error={recheckError}
        isSubmitting={recheckSubmitting}
        submitLabel="Run Payment Recheck"
        onNoteChange={(value) => {
          setRecheckNote(value);
          if (recheckError) {
            setRecheckError("");
          }
        }}
        onSubmit={submitRecheckPayment}
        onClose={() => {
          if (!recheckSubmitting) {
            setRecheckTarget(null);
            setRecheckNote("");
            setRecheckError("");
          }
        }}
      />

      {refundTarget && (
        <PaymentModalContainer
          title={`Refund ${refundTarget.id.slice(0, 8)}`}
          description="Process full or partial refunds with reason codes and audit note."
          onClose={() => {
            if (!refundSubmitting) {
              setRefundTarget(null);
              setRefundError("");
            }
          }}
        >
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-black/10 bg-black/2 px-3 py-2 text-xs text-black/65">
              <p>Total: {formatCurrency(refundTarget.total, refundTarget.currency)}</p>
              <p>
                Already refunded: {formatCurrency(Number(refundTarget.metadata?.payment?.refundedAmount || 0), refundTarget.currency)}
              </p>
            </div>

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
              Refund Type
              <select
                value={refundType}
                onChange={(event) => setRefundType(event.target.value as RefundType)}
                className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black"
              >
                <option value="partial">Partial</option>
                <option value="full">Full</option>
              </select>
            </label>

            {refundType === "partial" && (
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                Partial Refund Amount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={refundAmount}
                  onChange={(event) => setRefundAmount(event.target.value)}
                  placeholder="Enter partial refund amount"
                  className="rounded-xl border border-black/10 px-3 py-2 text-sm text-black"
                />
              </label>
            )}

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
              Refund Reason Code
              <select
                value={refundReasonCode}
                onChange={(event) => setRefundReasonCode(event.target.value as RefundReasonCode)}
                className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black"
              >
                {refundReasonCodeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
              Reason Note (Optional)
              <textarea
                rows={2}
                value={refundReasonNote}
                onChange={(event) => setRefundReasonNote(event.target.value)}
                placeholder="Optional context for refund reason"
                className="rounded-xl border border-black/10 px-3 py-2 text-sm text-black"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
              Internal Note
              <textarea
                rows={3}
                value={refundInternalNote}
                onChange={(event) => setRefundInternalNote(event.target.value)}
                placeholder="Required internal note for audit trail"
                className="rounded-xl border border-black/10 px-3 py-2 text-sm text-black"
              />
            </label>

            {refundError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {refundError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRefundTarget(null)}
                disabled={refundSubmitting}
                className="rounded-full border border-black/15 px-4 py-2 text-sm font-semibold text-black/70"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitRefund}
                disabled={refundSubmitting}
                className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refundSubmitting ? "Processing..." : "Apply Refund"}
              </button>
            </div>
          </div>
        </PaymentModalContainer>
      )}

      {overrideTarget && (
        <PaymentModalContainer
          title={`Offline Override ${overrideTarget.id.slice(0, 8)}`}
          description="Submit an offline settlement request that requires separate admin approval."
          onClose={() => {
            if (!overrideSubmitting) {
              setOverrideTarget(null);
              setOverrideError("");
            }
          }}
        >
          <div className="mt-4 space-y-3">
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
              Override Reason Code
              <select
                value={overrideReasonCode}
                onChange={(event) =>
                  setOverrideReasonCode(event.target.value as PaymentOverrideReasonCode)
                }
                className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black"
              >
                {paymentOverrideReasonOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
              Approval Reference
              <input
                type="text"
                value={overrideApprovalReference}
                onChange={(event) => setOverrideApprovalReference(event.target.value)}
                placeholder="Approved settlement reference"
                className="rounded-xl border border-black/10 px-3 py-2 text-sm text-black"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
              Override Amount (Optional)
              <input
                type="number"
                min="0"
                step="0.01"
                value={overrideAmount}
                onChange={(event) => setOverrideAmount(event.target.value)}
                placeholder="Must match full order total"
                className="rounded-xl border border-black/10 px-3 py-2 text-sm text-black"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
              Internal Note
              <textarea
                rows={3}
                value={overrideInternalNote}
                onChange={(event) => setOverrideInternalNote(event.target.value)}
                placeholder="Required internal note for audit trail"
                className="rounded-xl border border-black/10 px-3 py-2 text-sm text-black"
              />
            </label>

            {overrideError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {overrideError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOverrideTarget(null)}
                disabled={overrideSubmitting}
                className="rounded-full border border-black/15 px-4 py-2 text-sm font-semibold text-black/70"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitOfflineOverride}
                disabled={overrideSubmitting}
                className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {overrideSubmitting ? "Submitting..." : "Apply Override"}
              </button>
            </div>
          </div>
        </PaymentModalContainer>
      )}

      {approveTarget && (
        <PaymentModalContainer
          title={`Approve Override ${approveTarget.id.slice(0, 8)}`}
          description="Approve a pending offline override request as the second reviewer."
          onClose={() => {
            if (!approveSubmitting) {
              setApproveTarget(null);
              setApproveError("");
            }
          }}
        >
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <p>
                Reason: {approveTarget.metadata?.payment?.pendingOfflineOverride?.reasonCode || "-"}
              </p>
              <p>
                Approval Ref: {approveTarget.metadata?.payment?.pendingOfflineOverride?.approvalReference || "-"}
              </p>
              <p>
                Requested By: {approveTarget.metadata?.payment?.pendingOfflineOverride?.requestedBy || "-"}
              </p>
            </div>

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
              Approval Note
              <textarea
                rows={3}
                value={approveInternalNote}
                onChange={(event) => setApproveInternalNote(event.target.value)}
                placeholder="Required internal note for approval"
                className="rounded-xl border border-black/10 px-3 py-2 text-sm text-black"
              />
            </label>

            {approveError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {approveError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setApproveTarget(null)}
                disabled={approveSubmitting}
                className="rounded-full border border-black/15 px-4 py-2 text-sm font-semibold text-black/70"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitOverrideApproval}
                disabled={approveSubmitting}
                className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {approveSubmitting ? "Approving..." : "Approve Override"}
              </button>
            </div>
          </div>
        </PaymentModalContainer>
      )}
    </AdminShell>
  );
}
