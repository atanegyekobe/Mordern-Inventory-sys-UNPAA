"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AdminShell from "@/components/AdminShell";
import api from "@/lib/api";
import { formatCurrency, formatDateShort } from "@/lib/format";
import type { Order } from "@/lib/types";
import { useToast } from "@/hooks/useToast";

const statusOptions = [
  "pending_payment",
  "fraud_hold",
  "pending",
  "paid",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "received",
  "delivery_failed",
  "delivery_pickup",
  "fulfilled",
  "cancelled",
  "returned",
  "refunded",
] as const;

type OrderStatus = (typeof statusOptions)[number];
type AutomationOverrideCategory =
  | "customer_request"
  | "fraud_review"
  | "fulfillment_issue"
  | "inventory_issue"
  | "compliance"
  | "other";

type FraudReviewAction = "hold" | "release" | "mark_reviewed";
type AssignmentPriority = "low" | "normal" | "high" | "urgent";

const automationOverrideCategoryOptions: Array<{
  value: AutomationOverrideCategory;
  label: string;
}> = [
  { value: "customer_request", label: "Customer Request" },
  { value: "fraud_review", label: "Fraud Review" },
  { value: "fulfillment_issue", label: "Fulfillment Issue" },
  { value: "inventory_issue", label: "Inventory Issue" },
  { value: "compliance", label: "Compliance" },
  { value: "other", label: "Other" },
];

const MIN_INTERNAL_NOTE_LENGTH = 10;
const ADDRESS_LOCKED_STATUSES = new Set([
  "shipped",
  "out_for_delivery",
  "delivery_pickup",
  "delivered",
  "received",
  "delivery_failed",
  "returned",
  "refunded",
  "fulfilled",
]);

const statusTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending_payment: ["paid", "cancelled", "fraud_hold"],
  paid: ["processing", "cancelled", "refunded", "fraud_hold"],
  processing: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["out_for_delivery", "delivery_failed", "returned"],
  out_for_delivery: ["delivered", "delivery_failed", "returned"],
  delivered: ["received", "returned", "refunded"],
  received: ["returned", "refunded"],
  delivery_failed: ["out_for_delivery", "returned", "cancelled"],
  cancelled: ["refunded"],
  returned: ["refunded"],
  refunded: [],
  fraud_hold: ["paid", "cancelled"],
  pending: ["paid", "processing", "cancelled", "fraud_hold"],
  delivery_pickup: ["out_for_delivery", "delivered", "fulfilled"],
  fulfilled: ["received", "refunded"],
};
const MANUAL_STATUS_RESTRICTED_OPTIONS = new Set<OrderStatus>(["paid", "refunded"]);

const getAllowedStatusOptions = (currentStatus: string): OrderStatus[] => {
  const typedCurrent = currentStatus as OrderStatus;
  if (!statusOptions.includes(typedCurrent)) {
    return [...statusOptions];
  }

  const nextStatuses = statusTransitions[typedCurrent] ?? [];
  const options = [typedCurrent, ...nextStatuses];
  return options.filter((value, index) => options.indexOf(value) === index);
};

type ApiError = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

const getApiErrorMessage = (error: unknown, fallbackMessage: string) => {
  const candidate = error as ApiError;
  return candidate.response?.data?.message ?? fallbackMessage;
};

const normalizeEditableText = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const formatStatus = (value: string) =>
  value === "fraud_hold"
    ? "Under Review"
    : value
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");

const statusTone: Record<string, string> = {
  pending_payment: "border-yellow-200 bg-yellow-50 text-yellow-800",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-800",
  processing: "border-blue-200 bg-blue-50 text-blue-800",
  packed: "border-indigo-200 bg-indigo-50 text-indigo-800",
  shipped: "border-sky-200 bg-sky-50 text-sky-800",
  out_for_delivery: "border-cyan-200 bg-cyan-50 text-cyan-800",
  delivered: "border-teal-200 bg-teal-50 text-teal-800",
  received: "border-zinc-200 bg-zinc-100 text-zinc-800",
  delivery_failed: "border-rose-200 bg-rose-50 text-rose-800",
  cancelled: "border-red-200 bg-red-50 text-red-700",
  returned: "border-orange-200 bg-orange-50 text-orange-800",
  refunded: "border-emerald-200 bg-emerald-50 text-emerald-800",
  fraud_hold: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
  pending: "border-yellow-200 bg-yellow-50 text-yellow-800",
  delivery_pickup: "border-violet-200 bg-violet-50 text-violet-800",
  fulfilled: "border-zinc-200 bg-zinc-100 text-zinc-800",
};

export default function AdminOrderDetailPage() {
  const toast = useToast();
  const params = useParams<{ id: string }>();
  const orderId = params?.id;
  const [order, setOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
  const [adminActionNote, setAdminActionNote] = useState("");
  const [automationReason, setAutomationReason] = useState("");
  const [automationCategory, setAutomationCategory] =
    useState<AutomationOverrideCategory>("fulfillment_issue");
  const [automationEffectiveUntil, setAutomationEffectiveUntil] = useState("");
  const [automationActionLoading, setAutomationActionLoading] = useState(false);
  const [fraudReason, setFraudReason] = useState("");
  const [fraudReleaseStatus, setFraudReleaseStatus] = useState<OrderStatus>("paid");
  const [fraudActionLoading, setFraudActionLoading] = useState(false);
  const [operationalCarrier, setOperationalCarrier] = useState("");
  const [operationalTrackingNumber, setOperationalTrackingNumber] = useState("");
  const [operationalShipDate, setOperationalShipDate] = useState("");
  const [operationalDeliveryEta, setOperationalDeliveryEta] = useState("");
  const [operationalShippingAddress, setOperationalShippingAddress] = useState("");
  const [operationalBillingAddress, setOperationalBillingAddress] = useState("");
  const [operationalAddressCorrectionReason, setOperationalAddressCorrectionReason] = useState("");
  const [operationalCustomerPhone, setOperationalCustomerPhone] = useState("");
  const [operationalDeliveryInstructions, setOperationalDeliveryInstructions] = useState("");
  const [operationalAssignmentOwner, setOperationalAssignmentOwner] = useState("");
  const [operationalAssignmentPriority, setOperationalAssignmentPriority] =
    useState<AssignmentPriority>("normal");
  const [operationalEscalationFlag, setOperationalEscalationFlag] = useState(false);
  const [operationalSaving, setOperationalSaving] = useState(false);
  const [showShippingFields, setShowShippingFields] = useState(false);
  const [shippingVisibilityManuallySet, setShippingVisibilityManuallySet] = useState(false);

  const loadOrder = async () => {
    if (!orderId) {
      setStatus("error");
      return null;
    }

    const response = await api.get(`/orders/${orderId}`);
    const nextOrder = response.data.order ?? null;
    setOrder(nextOrder);
    setStatus("ready");
    return nextOrder;
  };

  const buildInternalNote = (actionLabel: string) => {
    const trimmed = adminActionNote.trim();

    if (trimmed.length > 500) {
      toast.error("Internal note cannot exceed 500 characters.");
      return null;
    }

    if (trimmed.length >= MIN_INTERNAL_NOTE_LENGTH) {
      return trimmed;
    }

    if (trimmed.length > 0) {
      return `Admin ${actionLabel} from order detail. Note: ${trimmed}`;
    }

    return `Admin ${actionLabel} from order detail without explicit note.`;
  };

  const updateOrderStatus = async (nextStatus: OrderStatus) => {
    if (!order || nextStatus === order.status) {
      return;
    }

    try {
      const internalNote = buildInternalNote("status update");
      if (!internalNote) {
        return;
      }

      setStatusUpdateLoading(true);
      await api.patch(`/orders/${order.id}/status`, {
        status: nextStatus,
        note: internalNote,
      });
      await loadOrder();
      toast.success("Order status updated.");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Failed to update order status."));
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  const submitAutomationOverride = async (preventAutoTransition: boolean) => {
    if (!order) {
      return;
    }

    const internalNote = buildInternalNote("automation override");
    if (!internalNote) {
      return;
    }

    const trimmedReason = automationReason.trim();

    if (preventAutoTransition && trimmedReason.length < 10) {
      toast.error("Automation reason must be at least 10 characters.");
      return;
    }

    let effectiveUntilIso: string | null = null;
    if (preventAutoTransition && automationEffectiveUntil) {
      const parsedDate = new Date(automationEffectiveUntil);
      if (Number.isNaN(parsedDate.getTime())) {
        toast.error("Please enter a valid effective-until date.");
        return;
      }

      if (parsedDate.getTime() <= Date.now()) {
        toast.error("Effective-until date must be in the future.");
        return;
      }

      effectiveUntilIso = parsedDate.toISOString();
    }

    try {
      setAutomationActionLoading(true);
      await api.patch(`/orders/${order.id}/automation-override`, {
        preventAutoTransition,
        reason: preventAutoTransition ? trimmedReason : null,
        category: preventAutoTransition ? automationCategory : null,
        internalNote,
        effectiveUntil: preventAutoTransition ? effectiveUntilIso : null,
      });

      await loadOrder();
      toast.success(preventAutoTransition ? "Automation disabled." : "Automation enabled.");

      if (preventAutoTransition) {
        setAutomationReason("");
        setAutomationEffectiveUntil("");
      }
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Failed to update automation settings."));
    } finally {
      setAutomationActionLoading(false);
    }
  };

  const applyFraudReviewAction = async (action: FraudReviewAction) => {
    if (!order) {
      return;
    }

    const internalNote = buildInternalNote("fraud review");
    if (!internalNote) {
      return;
    }

    const trimmedReason = fraudReason.trim();
    if (trimmedReason.length < 10) {
      toast.error("Fraud review reason must be at least 10 characters.");
      return;
    }

    try {
      setFraudActionLoading(true);
      const payload: {
        action: FraudReviewAction;
        reason: string;
        internalNote: string;
        releaseStatus?: OrderStatus;
      } = {
        action,
        reason: trimmedReason,
        internalNote,
      };

      if (action === "release" && order.status === "fraud_hold") {
        payload.releaseStatus = fraudReleaseStatus;
      }

      const response = await api.patch(`/orders/${order.id}/fraud-review`, payload);
      await loadOrder();
      toast.success(response.data?.message || "Fraud review action applied.");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Failed to update fraud review state."));
    } finally {
      setFraudActionLoading(false);
    }
  };

  const saveOperationalData = async () => {
    if (!order) {
      return;
    }

    const internalNote = buildInternalNote("operational data update");
    if (!internalNote) {
      return;
    }

    const payload: Record<string, unknown> = {
      carrier: normalizeEditableText(operationalCarrier),
      trackingNumber: normalizeEditableText(operationalTrackingNumber),
      shipDate: operationalShipDate || null,
      deliveryEta: operationalDeliveryEta || null,
      customerPhone: normalizeEditableText(operationalCustomerPhone),
      deliveryInstructions: normalizeEditableText(operationalDeliveryInstructions),
      assignmentOwner: normalizeEditableText(operationalAssignmentOwner),
      assignmentPriority: operationalAssignmentPriority,
      escalationFlag: operationalEscalationFlag,
      internalNote,
    };

    const nextShippingAddress = normalizeEditableText(operationalShippingAddress);
    const nextBillingAddress = normalizeEditableText(operationalBillingAddress);
    const currentShippingAddress = normalizeEditableText(order.shippingAddress || "");
    const currentBillingAddress = normalizeEditableText(order.billingAddress || "");

    const shippingAddressChanged = (nextShippingAddress || null) !== (currentShippingAddress || null);
    const billingAddressChanged = (nextBillingAddress || null) !== (currentBillingAddress || null);

    if (shippingAddressChanged || billingAddressChanged) {
      const correctionReason = normalizeEditableText(operationalAddressCorrectionReason);
      if (!correctionReason || correctionReason.length < 10) {
        toast.error("Address correction reason must be at least 10 characters.");
        return;
      }

      payload.shippingAddress = nextShippingAddress;
      payload.billingAddress = nextBillingAddress;
      payload.addressCorrectionReason = correctionReason;
    }

    try {
      setOperationalSaving(true);
      await api.patch(`/orders/${order.id}/operational-data`, payload);
      await loadOrder();
      setOperationalAddressCorrectionReason("");
      toast.success("Operational data updated.");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Failed to update operational data."));
    } finally {
      setOperationalSaving(false);
    }
  };

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      if (!orderId) {
        if (isActive) {
          setStatus("error");
        }
        return;
      }

      try {
        const response = await api.get(`/orders/${orderId}`);
        if (!isActive) {
          return;
        }

        setOrder(response.data.order ?? null);
        setStatus("ready");
      } catch {
        if (isActive) {
          setStatus("error");
        }
      }
    };

    load();

    return () => {
      isActive = false;
    };
  }, [orderId]);

  useEffect(() => {
    if (!order || order.status !== "fraud_hold") {
      return;
    }

    const releaseOptions = getAllowedStatusOptions(order.status).filter(
      (statusOption) => statusOption !== order.status
    );

    if (releaseOptions.length > 0 && !releaseOptions.includes(fraudReleaseStatus)) {
      setFraudReleaseStatus(releaseOptions[0]);
    }
  }, [order, fraudReleaseStatus]);

  useEffect(() => {
    setShippingVisibilityManuallySet(false);
    setShowShippingFields(false);
  }, [orderId]);

  useEffect(() => {
    if (!order || shippingVisibilityManuallySet) {
      return;
    }

    const shippingStatusReached = ADDRESS_LOCKED_STATUSES.has(order.status);
    setShowShippingFields(shippingStatusReached);
  }, [order, shippingVisibilityManuallySet]);

  useEffect(() => {
    if (!order) {
      return;
    }

    const shippingData = order.metadata?.operational?.shippingData;
    const contact = order.metadata?.operational?.contact;
    const assignment = order.metadata?.operational?.assignment;

    const toDateTimeLocalValue = (value?: string | null) => {
      if (!value) {
        return "";
      }

      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return "";
      }

      const pad = (n: number) => String(n).padStart(2, "0");
      return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(
        parsed.getHours()
      )}:${pad(parsed.getMinutes())}`;
    };

    setOperationalCarrier(shippingData?.carrier ?? "");
    setOperationalTrackingNumber(shippingData?.trackingNumber ?? "");
    setOperationalShipDate(toDateTimeLocalValue(shippingData?.shipDate));
    setOperationalDeliveryEta(toDateTimeLocalValue(shippingData?.deliveryEta));
    setOperationalShippingAddress(order.shippingAddress ?? "");
    setOperationalBillingAddress(order.billingAddress ?? "");
    setOperationalCustomerPhone(contact?.phone ?? "");
    setOperationalDeliveryInstructions(contact?.deliveryInstructions ?? "");
    setOperationalAssignmentOwner(assignment?.owner ?? "");
    setOperationalAssignmentPriority((assignment?.priority as AssignmentPriority) ?? "normal");
    setOperationalEscalationFlag(!!assignment?.escalationFlag);
  }, [order]);

  return (
    <AdminShell title="Order Details">
      {status === "loading" && (
        <div className="rounded-2xl border border-dashed border-black/15 bg-white p-6 text-sm text-black/60">
          Loading order details...
        </div>
      )}

      {status === "error" && (
        <div className="rounded-2xl border border-dashed border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Unable to load this order.
        </div>
      )}

      {status === "ready" && order && (
        <div className="space-y-6">
          <div>
            <Link
              href="/admin/orders"
              className="inline-flex rounded-full border border-black/15 px-4 py-2 text-sm font-semibold text-black/70 transition hover:border-black/30"
            >
              Back to Orders
            </Link>
          </div>

          {(() => {
            const allowedStatusOptions = getAllowedStatusOptions(order.status);
            const manualStatusOptions = allowedStatusOptions.filter(
              (option) => option === order.status || !MANUAL_STATUS_RESTRICTED_OPTIONS.has(option)
            );
            const hasStatusChangeOptions = manualStatusOptions.length > 1;
            const releaseStatusOptions =
              order.status === "fraud_hold"
                ? allowedStatusOptions.filter((statusOption) => statusOption !== order.status)
                : [];
            const addressesLocked = ADDRESS_LOCKED_STATUSES.has(order.status);
            const shippingStatusReached = ADDRESS_LOCKED_STATUSES.has(order.status);

            return (
              <>
          <div className="rounded-2xl border border-black/10 bg-white p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-black/50">Order {order.id.slice(0, 8)}</p>
                <p className="mt-1 text-2xl font-semibold">{formatDateShort(order.createdAt)}</p>
                <p className="text-xs text-black/50 mt-1">{new Date(order.createdAt).toLocaleString()}</p>
              </div>

              <div className="text-right">
                <p className="text-sm text-black/60">Total</p>
                <p className="text-2xl font-semibold">{formatCurrency(order.total, order.currency)}</p>
              </div>

              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  statusTone[order.status] ?? "border-black/10"
                }`}
              >
                {formatStatus(order.status)}
              </span>
            </div>

            <div className="mt-5 border-t border-black/10 pt-5">
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                Internal Note (Optional)
                <textarea
                  value={adminActionNote}
                  onChange={(event) => setAdminActionNote(event.target.value)}
                  placeholder="Optional note for status, automation, fraud, and operational actions"
                  rows={3}
                  className="rounded-xl border border-black/10 px-3 py-2 text-sm font-medium tracking-normal text-black placeholder:text-black/40"
                />
              </label>

              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                Status Action
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <select
                  value={order.status}
                  onChange={(event) =>
                    updateOrderStatus(event.target.value as OrderStatus)
                  }
                  disabled={statusUpdateLoading || !hasStatusChangeOptions}
                  title={
                    hasStatusChangeOptions
                      ? "Select the next valid status"
                      : "No further status transitions available"
                  }
                  className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {manualStatusOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatStatus(option)}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-black/50">
                  {hasStatusChangeOptions
                    ? "Only valid operational statuses are available. Payment statuses are controlled from Payments."
                    : "No additional status transitions available."}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-black/10 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/50">Payment Summary</p>
              <div className="mt-3 space-y-2 text-sm text-black/70">
                <p>
                  <span className="font-semibold text-black/50">Status:</span>{" "}
                  {order.metadata?.payment?.status || "-"}
                </p>
                <p>
                  <span className="font-semibold text-black/50">Provider:</span>{" "}
                  {order.metadata?.payment?.provider || "-"}
                </p>
                <p className="break-all">
                  <span className="font-semibold text-black/50">Reference:</span>{" "}
                  {order.metadata?.payment?.reference || "-"}
                </p>
              </div>

              <Link
                href={`/admin/payments?orderId=${order.id}`}
                className="mt-4 inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                Open in Payments
              </Link>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/50">Automation Override</p>
              <p className="mt-1 text-sm text-black/60">
                Current: {order.metadata?.automationOverride?.preventAutoTransition ? "Disabled" : "Enabled"}
              </p>

              {!order.metadata?.automationOverride?.preventAutoTransition && (
                <div className="mt-4 space-y-3">
                  <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                    Reason <span className="text-red-600">*</span>
                    <textarea
                      value={automationReason}
                      onChange={(event) => setAutomationReason(event.target.value)}
                      rows={3}
                      placeholder="Explain why automation should be disabled"
                      className="rounded-xl border border-black/10 px-3 py-2 text-sm font-medium tracking-normal text-black placeholder:text-black/40"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                    Category
                    <select
                      value={automationCategory}
                      onChange={(event) =>
                        setAutomationCategory(event.target.value as AutomationOverrideCategory)
                      }
                      className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium tracking-normal text-black"
                    >
                      {automationOverrideCategoryOptions.map((categoryOption) => (
                        <option key={categoryOption.value} value={categoryOption.value}>
                          {categoryOption.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                    Effective Until (Optional)
                    <input
                      type="datetime-local"
                      value={automationEffectiveUntil}
                      onChange={(event) => setAutomationEffectiveUntil(event.target.value)}
                      className="rounded-xl border border-black/10 px-3 py-2 text-sm font-medium tracking-normal text-black"
                    />
                  </label>
                </div>
              )}

              <div className="mt-4">
                <button
                  onClick={() =>
                    submitAutomationOverride(!order.metadata?.automationOverride?.preventAutoTransition)
                  }
                  disabled={automationActionLoading}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
                    order.metadata?.automationOverride?.preventAutoTransition
                      ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                      : "border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
                  }`}
                >
                  {automationActionLoading
                    ? "Saving..."
                    : order.metadata?.automationOverride?.preventAutoTransition
                      ? "Enable Automation"
                      : "Disable Automation"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/50">Fraud Review</p>
              <p className="mt-1 text-sm text-black/60">
                Current: {order.metadata?.fraudReview?.underReview ? "Under Review" : "Not Under Review"}
              </p>

              <label className="mt-4 flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                Reason <span className="text-red-600">*</span>
                <textarea
                  value={fraudReason}
                  onChange={(event) => setFraudReason(event.target.value)}
                  rows={3}
                  placeholder="Reason for hold, release, or mark reviewed"
                  className="rounded-xl border border-black/10 px-3 py-2 text-sm font-medium tracking-normal text-black placeholder:text-black/40"
                />
              </label>

              {order.status === "fraud_hold" && releaseStatusOptions.length > 0 && (
                <label className="mt-3 flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                  Release To Status
                  <select
                    value={fraudReleaseStatus}
                    onChange={(event) => setFraudReleaseStatus(event.target.value as OrderStatus)}
                    className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium tracking-normal text-black"
                  >
                    {releaseStatusOptions.map((statusOption) => (
                      <option key={statusOption} value={statusOption}>
                        {formatStatus(statusOption)}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => applyFraudReviewAction("hold")}
                  disabled={fraudActionLoading}
                  className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 py-1 text-xs font-semibold text-fuchsia-700 hover:bg-fuchsia-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Hold
                </button>
                <button
                  onClick={() => applyFraudReviewAction("release")}
                  disabled={fraudActionLoading}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Release
                </button>
                <button
                  onClick={() => applyFraudReviewAction("mark_reviewed")}
                  disabled={fraudActionLoading}
                  className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Mark Reviewed
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {order.User && (
              <div className="rounded-2xl border border-black/10 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/50">Customer</p>
                <p className="mt-2 text-sm font-semibold">{order.User.name}</p>
                <p className="text-sm text-black/70">{order.User.email}</p>
                {order.User.phone && <p className="text-sm text-black/70">{order.User.phone}</p>}
                {order.UserId && (
                  <Link
                    href={`/admin/customers/${order.UserId}`}
                    className="mt-2 inline-flex text-xs font-semibold text-blue-600 underline"
                  >
                    View Customer Profile
                  </Link>
                )}
              </div>
            )}

            {(order.shippingAddress || order.billingAddress) && (
              <div className="rounded-2xl border border-black/10 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/50">Addresses</p>
                {order.shippingAddress && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-black/60">Shipping</p>
                    <p className="whitespace-pre-wrap text-sm text-black/80">{order.shippingAddress}</p>
                  </div>
                )}
                {order.billingAddress && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-black/60">Billing</p>
                    <p className="whitespace-pre-wrap text-sm text-black/80">{order.billingAddress}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-black/10 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/50">Items</p>
            {order.OrderItems && order.OrderItems.length > 0 ? (
              <div className="mt-3 divide-y divide-black/5">
                {order.OrderItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <p className="font-semibold">{item.Product?.name ?? "Product"}</p>
                      <p className="text-black/60">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-semibold">{formatCurrency(Number(item.unitPrice) * item.quantity, order.currency)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-black/60">No order items found.</p>
            )}
          </div>

          <div className="rounded-2xl border border-black/10 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/50">Operational Data</p>
            <div className="mt-3 flex flex-col gap-2 rounded-xl border border-black/10 bg-black/2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-black/60">
                {shippingStatusReached
                  ? "Shipping status reached. Shipping fields are available."
                  : "Shipping fields stay hidden until status reaches Shipped. You can still toggle them manually."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setShippingVisibilityManuallySet(true);
                  setShowShippingFields((previous) => !previous);
                }}
                className="rounded-full border border-black/15 bg-white px-3 py-1 text-xs font-semibold text-black/70 transition hover:border-black/30"
              >
                {showShippingFields ? "Hide Shipping Fields" : "Show Shipping Fields"}
              </button>
            </div>

            {showShippingFields && (
              <>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                    Carrier
                    <input
                      type="text"
                      value={operationalCarrier}
                      onChange={(event) => setOperationalCarrier(event.target.value)}
                      placeholder="e.g. DHL"
                      className="rounded-xl border border-black/10 px-3 py-2 text-sm font-medium tracking-normal text-black"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                    Tracking Number
                    <input
                      type="text"
                      value={operationalTrackingNumber}
                      onChange={(event) => setOperationalTrackingNumber(event.target.value)}
                      placeholder="Shipment tracking reference"
                      className="rounded-xl border border-black/10 px-3 py-2 text-sm font-medium tracking-normal text-black"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                    Ship Date
                    <input
                      type="datetime-local"
                      value={operationalShipDate}
                      onChange={(event) => setOperationalShipDate(event.target.value)}
                      className="rounded-xl border border-black/10 px-3 py-2 text-sm font-medium tracking-normal text-black"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                    Delivery ETA
                    <input
                      type="datetime-local"
                      value={operationalDeliveryEta}
                      onChange={(event) => setOperationalDeliveryEta(event.target.value)}
                      className="rounded-xl border border-black/10 px-3 py-2 text-sm font-medium tracking-normal text-black"
                    />
                  </label>
                </div>

                <div className="mt-5 border-t border-black/10 pt-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/50">Address Correction Workflow</p>
                  {addressesLocked && (
                    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                      Shipping and billing addresses are locked after shipped state.
                    </p>
                  )}
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                      Shipping Address
                      <textarea
                        value={operationalShippingAddress}
                        onChange={(event) => setOperationalShippingAddress(event.target.value)}
                        rows={4}
                        disabled={addressesLocked}
                        className="rounded-xl border border-black/10 px-3 py-2 text-sm font-medium tracking-normal text-black disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </label>

                    <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                      Billing Address
                      <textarea
                        value={operationalBillingAddress}
                        onChange={(event) => setOperationalBillingAddress(event.target.value)}
                        rows={4}
                        disabled={addressesLocked}
                        className="rounded-xl border border-black/10 px-3 py-2 text-sm font-medium tracking-normal text-black disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </label>

                    <label className="md:col-span-2 flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                      Address Correction Reason (required when changing address)
                      <textarea
                        value={operationalAddressCorrectionReason}
                        onChange={(event) => setOperationalAddressCorrectionReason(event.target.value)}
                        rows={3}
                        disabled={addressesLocked}
                        placeholder="State why the address correction is needed"
                        className="rounded-xl border border-black/10 px-3 py-2 text-sm font-medium tracking-normal text-black placeholder:text-black/40 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </label>
                  </div>
                </div>
              </>
            )}

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                Customer Phone
                <input
                  type="text"
                  value={operationalCustomerPhone}
                  onChange={(event) => setOperationalCustomerPhone(event.target.value)}
                  placeholder="Corrected contact phone"
                  className="rounded-xl border border-black/10 px-3 py-2 text-sm font-medium tracking-normal text-black"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                Assignment Owner
                <input
                  type="text"
                  value={operationalAssignmentOwner}
                  onChange={(event) => setOperationalAssignmentOwner(event.target.value)}
                  placeholder="ops.agent or team owner"
                  className="rounded-xl border border-black/10 px-3 py-2 text-sm font-medium tracking-normal text-black"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                Assignment Priority
                <select
                  value={operationalAssignmentPriority}
                  onChange={(event) =>
                    setOperationalAssignmentPriority(event.target.value as AssignmentPriority)
                  }
                  className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium tracking-normal text-black"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>

              <label className="flex items-center gap-2 self-end rounded-xl border border-black/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                <input
                  type="checkbox"
                  checked={operationalEscalationFlag}
                  onChange={(event) => setOperationalEscalationFlag(event.target.checked)}
                  className="h-4 w-4"
                />
                Escalation Flag
              </label>

              <label className="md:col-span-2 flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                Delivery Instructions
                <textarea
                  value={operationalDeliveryInstructions}
                  onChange={(event) => setOperationalDeliveryInstructions(event.target.value)}
                  rows={3}
                  placeholder="Updated delivery notes for rider"
                  className="rounded-xl border border-black/10 px-3 py-2 text-sm font-medium tracking-normal text-black placeholder:text-black/40"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={saveOperationalData}
                disabled={operationalSaving}
                className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {operationalSaving ? "Saving..." : "Save Operational Data"}
              </button>
            </div>
          </div>

          {order.metadata?.fraudReview?.underReview && (
            <div className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fuchsia-800">Under Review</p>
              {order.metadata.fraudReview.signals?.length ? (
                <div className="mt-2 space-y-1">
                  {order.metadata.fraudReview.signals.map((signal) => (
                    <p key={signal.code} className="text-sm text-fuchsia-900/90">
                      {signal.label}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-fuchsia-900/80">Manual security verification required.</p>
              )}
            </div>
          )}

          {order.OrderStatusEvents && order.OrderStatusEvents.length > 0 && (
            <div className="rounded-2xl border border-black/10 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/50">Timeline</p>
              <div className="mt-3 space-y-3">
                {order.OrderStatusEvents.map((event) => (
                  <div key={event.id} className="rounded-lg border border-black/10 bg-black/2 p-3">
                    <p className="text-sm font-semibold">{formatStatus(event.toStatus)}</p>
                    {event.fromStatus && (
                      <p className="text-xs text-black/70">From: {formatStatus(event.fromStatus)}</p>
                    )}
                    {event.note && <p className="mt-1 text-xs text-black/70">{event.note}</p>}
                    <p className="mt-1 text-xs text-black/50">{new Date(event.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <Link
              href="/admin/orders"
              className="inline-flex rounded-full border border-black/15 px-4 py-2 text-sm font-semibold text-black/70 transition hover:border-black/30"
            >
              Back to Orders
            </Link>
          </div>
              </>
            );
          })()}
        </div>
      )}
    </AdminShell>
  );
}
