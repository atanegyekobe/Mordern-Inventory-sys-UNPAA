"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/AdminShell";
import AdminActionNoteModal from "@/components/AdminActionNoteModal";
import api from "@/lib/api";
import { formatCurrency, formatDateShort } from "@/lib/format";
import type { Order } from "@/lib/types";
import { useToast } from "@/hooks/useToast";

const statusLabelOverride: Partial<Record<OrderStatus, string>> = {
  fraud_hold: "Under Review",
};

const formatStatus = (value: string) => {
  const overridden = statusLabelOverride[value as OrderStatus];
  if (overridden) {
    return overridden;
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const ExpandChevron = ({ expanded }: { expanded: boolean }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 20 20"
    fill="none"
    className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
  >
    <path
      d="M5 7.5L10 12.5L15 7.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

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

const getAllowedStatusOptions = (currentStatus: string): OrderStatus[] => {
  const typedCurrent = currentStatus as OrderStatus;
  if (!statusOptions.includes(typedCurrent)) {
    return [...statusOptions];
  }

  const nextStatuses = statusTransitions[typedCurrent] ?? [];
  const options = [typedCurrent, ...nextStatuses];
  return options.filter((value, index) => options.indexOf(value) === index);
};

type OrderDashboard = {
  kpis: {
    totalOrdersToday: number;
    pendingFulfillment: number;
    delayedShipments: number;
    highValueOrders: number;
    riskFlaggedOrders: number;
    refundsAwaitingApproval: number;
  };
  statusCounts: Record<OrderStatus, number>;
  thresholds: {
    highValueThreshold: number;
    delayedShipmentDays: number;
    pendingRiskHours: number;
    refundWindowDays: number;
  };
};

type DailyViewMode = "all" | "latest_daily";
type DaySort = "latest_first" | "oldest_first";
type DateRangePreset = "all" | "today" | "last_7_days" | "last_30_days" | "custom";
type OrderListView = "cards" | "table";
type AlertGroupKey =
  | "fraud_review"
  | "delayed_shipments"
  | "automation_disabled"
  | "payment_attention";

type AlertGroup = {
  key: AlertGroupKey;
  label: string;
  description: string;
  orders: Order[];
};

type DashboardSectionKey = "status_health" | "filters" | "orders_list";

type PendingActionNote =
  | {
      kind: "status_update";
      orderId: string;
      orderLabel: string;
      nextStatus: OrderStatus;
    }
  | {
      kind: "enable_automation";
      orderId: string;
      orderLabel: string;
    }
  | {
      kind: "payment_recheck";
      orderId: string;
      orderLabel: string;
    };

type ApiError = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

const ORDERS_PER_PAGE = 10;
const delayedStatuses = ["shipped", "out_for_delivery", "delivery_pickup"];
const MIN_INTERNAL_NOTE_LENGTH = 10;

const getLocalDayKey = (value: string) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getApiErrorMessage = (error: unknown, fallbackMessage: string) => {
  const candidate = error as ApiError;
  return candidate.response?.data?.message ?? fallbackMessage;
};

const isOrderDelayed = (order: Order, snapshotTimestamp: number, delayedShipmentDays: number) => {
  if (!delayedStatuses.includes(order.status)) {
    return false;
  }

  if (snapshotTimestamp <= 0) {
    return false;
  }

  const ageInDays =
    (snapshotTimestamp - new Date(order.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return ageInDays >= delayedShipmentDays;
};

const isNeedsActionOrder = (order: Order, snapshotTimestamp: number, delayedShipmentDays: number) => {
  return (
    order.status === "fraud_hold" ||
    !!order.metadata?.automationOverride?.preventAutoTransition ||
    isOrderDelayed(order, snapshotTimestamp, delayedShipmentDays)
  );
};

const isPaymentAttentionOrder = (order: Order, snapshotTimestamp: number, pendingRiskHours: number) => {
  if (!["pending_payment", "pending"].includes(order.status)) {
    return false;
  }

  if (snapshotTimestamp <= 0) {
    return false;
  }

  const paymentStatus = order.metadata?.payment?.status || "";
  if (paymentStatus === "success") {
    return false;
  }

  const ageInHours = (snapshotTimestamp - new Date(order.createdAt).getTime()) / (1000 * 60 * 60);
  return ageInHours >= pendingRiskHours;
};

const statusTone: Record<OrderStatus, string> = {
  pending_payment: "border-yellow-200 bg-yellow-50 text-yellow-800",
  fraud_hold: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
  pending: "border-yellow-200 bg-yellow-50 text-yellow-800",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-800",
  processing: "border-blue-200 bg-blue-50 text-blue-800",
  packed: "border-indigo-200 bg-indigo-50 text-indigo-800",
  shipped: "border-sky-200 bg-sky-50 text-sky-800",
  out_for_delivery: "border-cyan-200 bg-cyan-50 text-cyan-800",
  delivered: "border-teal-200 bg-teal-50 text-teal-800",
  received: "border-zinc-200 bg-zinc-100 text-zinc-800",
  delivery_failed: "border-rose-200 bg-rose-50 text-rose-800",
  delivery_pickup: "border-violet-200 bg-violet-50 text-violet-800",
  fulfilled: "border-zinc-200 bg-zinc-100 text-zinc-800",
  cancelled: "border-red-200 bg-red-50 text-red-700",
  returned: "border-orange-200 bg-orange-50 text-orange-800",
  refunded: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

const defaultDashboard: OrderDashboard = {
  kpis: {
    totalOrdersToday: 0,
    pendingFulfillment: 0,
    delayedShipments: 0,
    highValueOrders: 0,
    riskFlaggedOrders: 0,
    refundsAwaitingApproval: 0,
  },
  statusCounts: {
    pending_payment: 0,
    fraud_hold: 0,
    pending: 0,
    paid: 0,
    processing: 0,
    packed: 0,
    shipped: 0,
    out_for_delivery: 0,
    delivered: 0,
    received: 0,
    delivery_failed: 0,
    delivery_pickup: 0,
    fulfilled: 0,
    cancelled: 0,
    returned: 0,
    refunded: 0,
  },
  thresholds: {
    highValueThreshold: 100000,
    delayedShipmentDays: 5,
    pendingRiskHours: 24,
    refundWindowDays: 14,
  },
};

export default function AdminOrdersPage() {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [dashboard, setDashboard] = useState<OrderDashboard>(defaultDashboard);
  const [snapshotTimestamp, setSnapshotTimestamp] = useState<number>(0);
  const [viewMode, setViewMode] = useState<DailyViewMode>("all");
  const [daySort, setDaySort] = useState<DaySort>("latest_first");
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<OrderStatus[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [needsActionOnly, setNeedsActionOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [automationActionOrderId, setAutomationActionOrderId] = useState<string | null>(null);
  const [recheckPaymentOrderId, setRecheckPaymentOrderId] = useState<string | null>(null);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [overrideOrderId, setOverrideOrderId] = useState<string | null>(null);
  const [overrideOrderLabel, setOverrideOrderLabel] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideCategory, setOverrideCategory] =
    useState<AutomationOverrideCategory>("fulfillment_issue");
  const [overrideInternalNote, setOverrideInternalNote] = useState("");
  const [overrideEffectiveUntil, setOverrideEffectiveUntil] = useState("");
  const [overrideFormError, setOverrideFormError] = useState("");
  const [isActionNoteModalOpen, setIsActionNoteModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingActionNote | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [actionNoteError, setActionNoteError] = useState("");
  const [actionNoteSubmitting, setActionNoteSubmitting] = useState(false);
  const [expandedAlertGroups, setExpandedAlertGroups] = useState<Record<AlertGroupKey, boolean>>({
    fraud_review: false,
    delayed_shipments: false,
    automation_disabled: false,
    payment_attention: false,
  });
  const [expandedSections, setExpandedSections] = useState<Record<DashboardSectionKey, boolean>>({
    status_health: false,
    filters: false,
    orders_list: false,
  });
  const [orderListView, setOrderListView] = useState<OrderListView>("table");

  const hasActiveFilters =
    dateRangePreset !== "all" ||
    selectedStatuses.length > 0 ||
    searchTerm.trim().length > 0 ||
    minAmount.trim().length > 0 ||
    maxAmount.trim().length > 0 ||
    needsActionOnly;

  const displayOrders = useMemo(() => {
    const sortedOrders = [...orders].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return daySort === "latest_first" ? bTime - aTime : aTime - bTime;
    });

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    let dateStartMs: number | null = null;
    let dateEndMs: number | null = null;

    if (dateRangePreset === "today") {
      dateStartMs = startOfToday.getTime();
      dateEndMs = endOfToday.getTime();
    }

    if (dateRangePreset === "last_7_days") {
      const start = new Date(startOfToday);
      start.setDate(start.getDate() - 6);
      dateStartMs = start.getTime();
      dateEndMs = endOfToday.getTime();
    }

    if (dateRangePreset === "last_30_days") {
      const start = new Date(startOfToday);
      start.setDate(start.getDate() - 29);
      dateStartMs = start.getTime();
      dateEndMs = endOfToday.getTime();
    }

    if (dateRangePreset === "custom") {
      if (customStartDate) {
        dateStartMs = new Date(`${customStartDate}T00:00:00`).getTime();
      }
      if (customEndDate) {
        dateEndMs = new Date(`${customEndDate}T23:59:59.999`).getTime();
      }
    }

    const trimmedSearch = searchTerm.trim().toLowerCase();
    const minAmountValue = minAmount.trim() ? Number(minAmount) : null;
    const maxAmountValue = maxAmount.trim() ? Number(maxAmount) : null;

    const filteredOrders = sortedOrders.filter((order) => {
      const createdAtMs = new Date(order.createdAt).getTime();

      if (dateStartMs !== null && createdAtMs < dateStartMs) {
        return false;
      }

      if (dateEndMs !== null && createdAtMs > dateEndMs) {
        return false;
      }

      if (selectedStatuses.length > 0 && !selectedStatuses.includes(order.status as OrderStatus)) {
        return false;
      }

      if (trimmedSearch) {
        const searchableContent = [
          order.id,
          order.User?.name ?? "",
          order.User?.email ?? "",
          order.User?.phone ?? "",
          formatStatus(order.status),
        ]
          .join(" ")
          .toLowerCase();

        if (!searchableContent.includes(trimmedSearch)) {
          return false;
        }
      }

      const orderTotal = Number(order.total || 0);
      if (minAmountValue !== null && !Number.isNaN(minAmountValue) && orderTotal < minAmountValue) {
        return false;
      }

      if (maxAmountValue !== null && !Number.isNaN(maxAmountValue) && orderTotal > maxAmountValue) {
        return false;
      }

      if (
        needsActionOnly &&
        !isNeedsActionOrder(order, snapshotTimestamp, dashboard.thresholds.delayedShipmentDays)
      ) {
        return false;
      }

      return true;
    });

    if (viewMode === "all") {
      return filteredOrders;
    }

    const latestByDay = new Map<string, Order>();
    for (const order of filteredOrders) {
      const dayKey = getLocalDayKey(order.createdAt);
      const existing = latestByDay.get(dayKey);

      if (!existing) {
        latestByDay.set(dayKey, order);
        continue;
      }

      if (new Date(order.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
        latestByDay.set(dayKey, order);
      }
    }

    return Array.from(latestByDay.values()).sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return daySort === "latest_first" ? bTime - aTime : aTime - bTime;
    });
  }, [
    orders,
    viewMode,
    daySort,
    dateRangePreset,
    customStartDate,
    customEndDate,
    selectedStatuses,
    searchTerm,
    minAmount,
    maxAmount,
    needsActionOnly,
    snapshotTimestamp,
    dashboard.thresholds.delayedShipmentDays,
  ]);

  const alertGroups = useMemo<AlertGroup[]>(() => {
    const sorted = [...orders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return [
      {
        key: "fraud_review",
        label: "Fraud / Review Alerts",
        description: "Orders under manual security review.",
        orders: sorted.filter(
          (order) => order.status === "fraud_hold" || !!order.metadata?.fraudReview?.underReview
        ),
      },
      {
        key: "delayed_shipments",
        label: "Delayed Shipment Alerts",
        description: `Orders delayed beyond ${dashboard.thresholds.delayedShipmentDays} days in shipment statuses.`,
        orders: sorted.filter((order) =>
          isOrderDelayed(order, snapshotTimestamp, dashboard.thresholds.delayedShipmentDays)
        ),
      },
      {
        key: "automation_disabled",
        label: "Automation Override Alerts",
        description: "Orders where automation is currently disabled by admin override.",
        orders: sorted.filter((order) => !!order.metadata?.automationOverride?.preventAutoTransition),
      },
      {
        key: "payment_attention",
        label: "Payment Attention Alerts",
        description: `Pending payment orders older than ${dashboard.thresholds.pendingRiskHours} hours.`,
        orders: sorted.filter((order) =>
          isPaymentAttentionOrder(order, snapshotTimestamp, dashboard.thresholds.pendingRiskHours)
        ),
      },
    ];
  }, [
    orders,
    snapshotTimestamp,
    dashboard.thresholds.delayedShipmentDays,
    dashboard.thresholds.pendingRiskHours,
  ]);

  const totalAlertCount = useMemo(
    () => alertGroups.reduce((sum, group) => sum + group.orders.length, 0),
    [alertGroups]
  );

  const totalPages = Math.max(1, Math.ceil(displayOrders.length / ORDERS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);

  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * ORDERS_PER_PAGE;
    return displayOrders.slice(startIndex, startIndex + ORDERS_PER_PAGE);
  }, [displayOrders, currentPage]);

  const displayStart = displayOrders.length === 0 ? 0 : (currentPage - 1) * ORDERS_PER_PAGE + 1;
  const displayEnd = Math.min(currentPage * ORDERS_PER_PAGE, displayOrders.length);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      try {
        const [ordersResponse, dashboardResponse] = await Promise.all([
          api.get("/orders"),
          api.get("/orders/dashboard"),
        ]);
        if (isActive) {
          setOrders(ordersResponse.data.orders ?? []);
          setDashboard(dashboardResponse.data ?? defaultDashboard);
          setSnapshotTimestamp(new Date().getTime());
          setStatus("ready");
        }
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
  }, []);

  const updateOrderStatus = async (
    orderId: string,
    nextStatus: OrderStatus,
    internalNote: string
  ) => {
    try {
      const response = await api.patch(`/orders/${orderId}/status`, {
        status: nextStatus,
        note: internalNote,
      });
      toast.success("Order status updated.");
      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, ...response.data.order } : order
        )
      );

      const dashboardResponse = await api.get("/orders/dashboard");
      setDashboard(dashboardResponse.data ?? defaultDashboard);
      setSnapshotTimestamp(new Date().getTime());
      return true;
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Failed to update order status."));
      return false;
    }
  };

  const reloadOrders = async () => {
    const ordersResponse = await api.get("/orders");
    setOrders(ordersResponse.data.orders ?? []);
  };

  const closeOverrideModal = () => {
    if (automationActionOrderId) {
      return;
    }

    setIsOverrideModalOpen(false);
    setOverrideOrderId(null);
    setOverrideOrderLabel("");
    setOverrideReason("");
    setOverrideCategory("fulfillment_issue");
    setOverrideInternalNote("");
    setOverrideEffectiveUntil("");
    setOverrideFormError("");
  };

  const openDisableAutomationModal = (order: Order) => {
    setOverrideOrderId(order.id);
    setOverrideOrderLabel(order.id.slice(0, 8));
    setOverrideReason("");
    setOverrideCategory("fulfillment_issue");
    setOverrideInternalNote("");
    setOverrideEffectiveUntil("");
    setOverrideFormError("");
    setIsOverrideModalOpen(true);
  };

  const enableAutomationOverride = async (orderId: string, internalNote: string) => {
    try {
      setAutomationActionOrderId(orderId);

      await api.patch(`/orders/${orderId}/automation-override`, {
        preventAutoTransition: false,
        reason: null,
        category: null,
        internalNote,
        effectiveUntil: null,
      });

      toast.success("Automation enabled");
      await reloadOrders();
      const dashboardResponse = await api.get("/orders/dashboard");
      setDashboard(dashboardResponse.data ?? defaultDashboard);
      setSnapshotTimestamp(new Date().getTime());
      return true;
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Failed to update automation settings."));
      return false;
    } finally {
      setAutomationActionOrderId(null);
    }
  };

  const recheckOrderPayment = async (orderId: string, internalNote: string) => {
    try {
      setRecheckPaymentOrderId(orderId);

      const response = await api.post(`/orders/${orderId}/recheck-payment`, {
        internalNote,
      });
      const payload = response.data || {};

      if (payload.verified) {
        if (payload.alreadyPaid) {
          toast.info("Payment already confirmed. Order state verified.");
        } else {
          toast.success("Payment confirmed and order updated.");
        }
      } else {
        toast.warning(
          `Payment still unresolved (${payload.paymentStatus || "failed"}). Please follow up.`
        );
      }

      await reloadOrders();
      const dashboardResponse = await api.get("/orders/dashboard");
      setDashboard(dashboardResponse.data ?? defaultDashboard);
      setSnapshotTimestamp(new Date().getTime());
      return true;
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Failed to recheck payment."));
      return false;
    } finally {
      setRecheckPaymentOrderId(null);
    }
  };

  const openActionNoteModal = (action: PendingActionNote) => {
    setPendingAction(action);
    setActionNote("");
    setActionNoteError("");
    setIsActionNoteModalOpen(true);
  };

  const closeActionNoteModal = (force = false) => {
    if (actionNoteSubmitting && !force) {
      return;
    }

    setIsActionNoteModalOpen(false);
    setPendingAction(null);
    setActionNote("");
    setActionNoteError("");
  };

  const submitActionNote = async () => {
    if (!pendingAction) {
      return;
    }

    const trimmed = actionNote.trim();
    if (trimmed.length < MIN_INTERNAL_NOTE_LENGTH) {
      setActionNoteError(
        `Internal note must be at least ${MIN_INTERNAL_NOTE_LENGTH} characters.`
      );
      return;
    }

    if (trimmed.length > 500) {
      setActionNoteError("Internal note cannot exceed 500 characters.");
      return;
    }

    setActionNoteError("");
    setActionNoteSubmitting(true);

    let successful = false;
    try {
      if (pendingAction.kind === "status_update") {
        successful = await updateOrderStatus(
          pendingAction.orderId,
          pendingAction.nextStatus,
          trimmed
        );
      }

      if (pendingAction.kind === "enable_automation") {
        successful = await enableAutomationOverride(pendingAction.orderId, trimmed);
      }

      if (pendingAction.kind === "payment_recheck") {
        successful = await recheckOrderPayment(pendingAction.orderId, trimmed);
      }
    } finally {
      setActionNoteSubmitting(false);
    }

    if (successful) {
      closeActionNoteModal(true);
    }
  };

  const submitDisableAutomationOverride = async () => {
    if (!overrideOrderId) {
      return;
    }

    const trimmedReason = overrideReason.trim();
    const trimmedInternalNote = overrideInternalNote.trim();

    if (trimmedReason.length < 10) {
      setOverrideFormError("Reason must be at least 10 characters.");
      return;
    }

    if (trimmedInternalNote.length < MIN_INTERNAL_NOTE_LENGTH) {
      setOverrideFormError(`Internal note must be at least ${MIN_INTERNAL_NOTE_LENGTH} characters.`);
      return;
    }

    if (trimmedInternalNote.length > 500) {
      setOverrideFormError("Internal note cannot exceed 500 characters.");
      return;
    }

    let effectiveUntilIso: string | null = null;
    if (overrideEffectiveUntil) {
      const parsedDate = new Date(overrideEffectiveUntil);
      if (Number.isNaN(parsedDate.getTime())) {
        setOverrideFormError("Please enter a valid effective-until date.");
        return;
      }

      if (parsedDate.getTime() <= Date.now()) {
        setOverrideFormError("Effective-until date must be in the future.");
        return;
      }

      effectiveUntilIso = parsedDate.toISOString();
    }

    try {
      setOverrideFormError("");
      setAutomationActionOrderId(overrideOrderId);

      await api.patch(`/orders/${overrideOrderId}/automation-override`, {
        preventAutoTransition: true,
        reason: trimmedReason,
        category: overrideCategory,
        internalNote: trimmedInternalNote,
        effectiveUntil: effectiveUntilIso,
      });

      toast.success("Automation disabled");
      await reloadOrders();
      closeOverrideModal();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Failed to update automation settings."));
    } finally {
      setAutomationActionOrderId(null);
    }
  };

  const toggleStatusFilter = (nextStatus: OrderStatus) => {
    setSelectedStatuses((previous) => {
      if (previous.includes(nextStatus)) {
        return previous.filter((value) => value !== nextStatus);
      }

      return [...previous, nextStatus];
    });
    setPage(1);
  };

  const resetFilters = () => {
    setDateRangePreset("all");
    setCustomStartDate("");
    setCustomEndDate("");
    setSelectedStatuses([]);
    setSearchTerm("");
    setMinAmount("");
    setMaxAmount("");
    setNeedsActionOnly(false);
    setPage(1);
  };

  const toggleAlertGroup = (groupKey: AlertGroupKey) => {
    setExpandedAlertGroups((previous) => ({
      ...previous,
      [groupKey]: !previous[groupKey],
    }));
  };

  const toggleSection = (sectionKey: DashboardSectionKey) => {
    setExpandedSections((previous) => ({
      ...previous,
      [sectionKey]: !previous[sectionKey],
    }));
  };

  const actionNoteModalContent = (() => {
    if (!pendingAction) {
      return {
        title: "Confirm action",
        description: "Add an internal note to continue.",
        submitLabel: "Continue",
      };
    }

    if (pendingAction.kind === "status_update") {
      return {
        title: `Update status for ${pendingAction.orderLabel}`,
        description: `Set status to ${formatStatus(
          pendingAction.nextStatus
        )}. Add an audit note before applying this change.`,
        submitLabel: "Apply Status Update",
      };
    }

    if (pendingAction.kind === "enable_automation") {
      return {
        title: `Enable automation for ${pendingAction.orderLabel}`,
        description:
          "Provide a note explaining why automation is being re-enabled for this order.",
        submitLabel: "Enable Automation",
      };
    }

    return {
      title: `Recheck payment for ${pendingAction.orderLabel}`,
      description:
        "Provide an internal note before running manual payment reconciliation.",
      submitLabel: "Run Payment Recheck",
    };
  })();

  return (
    <AdminShell title="Orders">
      <section className="relative overflow-hidden rounded-3xl border border-black/10 bg-[radial-gradient(circle_at_top_left,_#dbeafe_0%,_transparent_38%),radial-gradient(circle_at_top_right,_#fde68a_0%,_transparent_36%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-5">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-200/35 blur-2xl" />
        <div className="absolute -bottom-12 -left-8 h-28 w-28 rounded-full bg-amber-200/35 blur-2xl" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/55">Order Operations</p>
          <p className="mt-2 text-sm text-black/65">
            Track fulfillment status and customer shipping activity.
          </p>
        </div>
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-sky-200/70 bg-linear-to-br from-sky-100 to-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.4)]">
          <p className="text-xs uppercase tracking-[0.2em] text-black/50">Total orders today</p>
          <p className="mt-3 text-3xl font-semibold">{dashboard.kpis.totalOrdersToday}</p>
        </div>
        <div className="rounded-2xl border border-indigo-200/70 bg-linear-to-br from-indigo-100 to-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.4)]">
          <p className="text-xs uppercase tracking-[0.2em] text-black/50">Pending fulfillment</p>
          <p className="mt-3 text-3xl font-semibold">{dashboard.kpis.pendingFulfillment}</p>
        </div>
        <div className="rounded-2xl border border-rose-200/70 bg-linear-to-br from-rose-100 to-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.4)]">
          <p className="text-xs uppercase tracking-[0.2em] text-black/50">Delayed shipments</p>
          <p className="mt-3 text-3xl font-semibold">{dashboard.kpis.delayedShipments}</p>
        </div>
        <div className="rounded-2xl border border-amber-200/70 bg-linear-to-br from-amber-100 to-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.4)]">
          <p className="text-xs uppercase tracking-[0.2em] text-black/50">High-value orders</p>
          <p className="mt-3 text-3xl font-semibold">{dashboard.kpis.highValueOrders}</p>
          <p className="mt-1 text-xs text-black/50">
            Threshold: {formatCurrency(dashboard.thresholds.highValueThreshold)}+
          </p>
        </div>
        <div className="rounded-2xl border border-fuchsia-200/70 bg-linear-to-br from-fuchsia-100 to-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.4)]">
          <p className="text-xs uppercase tracking-[0.2em] text-black/50">Risk / fraud flagged</p>
          <p className="mt-3 text-3xl font-semibold">{dashboard.kpis.riskFlaggedOrders}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200/70 bg-linear-to-br from-emerald-100 to-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.4)]">
          <p className="text-xs uppercase tracking-[0.2em] text-black/50">Refunds awaiting approval</p>
          <p className="mt-3 text-3xl font-semibold">{dashboard.kpis.refundsAwaitingApproval}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-black/10 bg-white p-5 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.45)]">
        <button
          type="button"
          onClick={() => toggleSection("status_health")}
          className="flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={expandedSections.status_health}
        >
          <p className="text-xs uppercase tracking-[0.2em] text-black/50">Order status health</p>
          <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
            <ExpandChevron expanded={expandedSections.status_health} />
            {expandedSections.status_health ? "Collapse" : "Expand"}
          </span>
        </button>

        {expandedSections.status_health && (
          <div className="mt-3 flex flex-wrap gap-2">
            {statusOptions.map((option) => (
              <span
                key={option}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone[option]}`}
              >
                {formatStatus(option)} · {dashboard.statusCounts[option] ?? 0}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-black/10 bg-white p-5 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.45)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-black/50">Priority alert groups</p>
            <p className="mt-1 text-sm text-black/60">
              Expand each group to triage urgent orders quickly.
            </p>
          </div>
          <span className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-black/70">
            {totalAlertCount} active alerts
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {alertGroups.map((group) => {
            const isExpanded = expandedAlertGroups[group.key] ?? true;

            return (
              <div key={group.key} className="rounded-xl border border-black/10 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-3">
                <button
                  type="button"
                  onClick={() => toggleAlertGroup(group.key)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1 text-left"
                  aria-expanded={isExpanded}
                >
                  <div>
                    <p className="text-sm font-semibold text-black">{group.label}</p>
                    <p className="text-xs text-black/60">{group.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-black/15 px-2 py-1 text-xs font-semibold text-black/70">
                      {group.orders.length}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                      <ExpandChevron expanded={isExpanded} />
                      {isExpanded ? "Collapse" : "Expand"}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-3">
                    {group.orders.length === 0 ? (
                      <p className="text-xs text-black/60">No active alerts in this group.</p>
                    ) : (
                      <div className="space-y-2">
                        {group.orders.slice(0, 5).map((order) => (
                          <div
                            key={`${group.key}-${order.id}`}
                            className="flex flex-col gap-2 rounded-lg border border-black/10 bg-white p-3 shadow-[0_10px_20px_-18px_rgba(0,0,0,0.5)] sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                                Order {order.id.slice(0, 8)}
                              </p>
                              <p className="mt-1 text-sm font-semibold text-black">
                                {formatStatus(order.status)} · {formatDateShort(order.createdAt)}
                              </p>
                              <p className="text-xs text-black/60">
                                {order.User?.name || "Customer"} · {formatCurrency(order.total, order.currency)}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {group.key === "payment_attention" && order.metadata?.payment?.reference && (
                                <button
                                  onClick={() =>
                                    openActionNoteModal({
                                      kind: "payment_recheck",
                                      orderId: order.id,
                                      orderLabel: order.id.slice(0, 8),
                                    })
                                  }
                                  disabled={recheckPaymentOrderId === order.id}
                                  className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {recheckPaymentOrderId === order.id ? "Rechecking..." : "Recheck Payment"}
                                </button>
                              )}

                              {group.key === "automation_disabled" && (
                                <button
                                  onClick={() =>
                                    openActionNoteModal({
                                      kind: "enable_automation",
                                      orderId: order.id,
                                      orderLabel: order.id.slice(0, 8),
                                    })
                                  }
                                  disabled={automationActionOrderId === order.id}
                                  className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {automationActionOrderId === order.id ? "Saving..." : "Enable Auto"}
                                </button>
                              )}

                              <Link
                                href={`/admin/orders/${order.id}`}
                                className="rounded-full border border-black/15 px-3 py-1 text-xs font-semibold text-black/70 transition hover:border-black/30"
                              >
                                Open
                              </Link>
                            </div>
                          </div>
                        ))}

                        {group.orders.length > 5 && (
                          <p className="text-xs text-black/60">
                            +{group.orders.length - 5} more alerts in this group.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-black/10 bg-white p-5 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.45)]">
        <button
          type="button"
          onClick={() => toggleSection("filters")}
          className="flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={expandedSections.filters}
        >
          <p className="text-xs uppercase tracking-[0.2em] text-black/50">Filters and views</p>
          <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
            <ExpandChevron expanded={expandedSections.filters} />
            {expandedSections.filters ? "Collapse" : "Expand"}
          </span>
        </button>

        {expandedSections.filters && (
        <>
        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-black/50">
              View mode
              <select
                value={viewMode}
                onChange={(event) => {
                  setViewMode(event.target.value as DailyViewMode);
                  setPage(1);
                }}
                className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium tracking-normal text-black"
              >
                <option value="all">All orders</option>
                <option value="latest_daily">Latest order per day</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-black/50">
              Day sort
              <select
                value={daySort}
                onChange={(event) => {
                  setDaySort(event.target.value as DaySort);
                  setPage(1);
                }}
                className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium tracking-normal text-black"
              >
                <option value="latest_first">Newest day first</option>
                <option value="oldest_first">Oldest day first</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-black/50">
              Date range
              <select
                value={dateRangePreset}
                onChange={(event) => {
                  setDateRangePreset(event.target.value as DateRangePreset);
                  setPage(1);
                }}
                className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium tracking-normal text-black"
              >
                <option value="all">All time</option>
                <option value="today">Today</option>
                <option value="last_7_days">Last 7 days</option>
                <option value="last_30_days">Last 30 days</option>
                <option value="custom">Custom range</option>
              </select>
            </label>
          </div>

          <p className="text-sm text-black/60">
            Showing {displayStart}-{displayEnd} of {displayOrders.length}
          </p>
        </div>

        {dateRangePreset === "custom" && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-black/50">
              From
              <input
                type="date"
                value={customStartDate}
                onChange={(event) => {
                  setCustomStartDate(event.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium tracking-normal text-black"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-black/50">
              To
              <input
                type="date"
                value={customEndDate}
                onChange={(event) => {
                  setCustomEndDate(event.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium tracking-normal text-black"
              />
            </label>
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-black/50 md:col-span-2">
            Search
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setPage(1);
              }}
              placeholder="Search by order ID, customer name, email, phone, or status"
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium tracking-normal text-black placeholder:text-black/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-black/50">
            Min amount
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={minAmount}
              onChange={(event) => {
                setMinAmount(event.target.value);
                setPage(1);
              }}
              placeholder="0"
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium tracking-normal text-black placeholder:text-black/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-black/50">
            Max amount
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={maxAmount}
              onChange={(event) => {
                setMaxAmount(event.target.value);
                setPage(1);
              }}
              placeholder="Any"
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium tracking-normal text-black placeholder:text-black/40"
            />
          </label>
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/50">Status multi-select</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={() => {
                setSelectedStatuses([]);
                setPage(1);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                selectedStatuses.length === 0
                  ? "border-black bg-black text-white"
                  : "border-black/15 bg-white text-black/70 hover:border-black/30"
              }`}
            >
              All statuses
            </button>
            {statusOptions.map((option) => {
              const selected = selectedStatuses.includes(option);
              return (
                <button
                  key={option}
                  onClick={() => toggleStatusFilter(option)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    selected
                      ? statusTone[option]
                      : "border-black/15 bg-white text-black/70 hover:border-black/30"
                  }`}
                >
                  {formatStatus(option)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              setNeedsActionOnly((previous) => !previous);
              setPage(1);
            }}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              needsActionOnly
                ? "border-rose-300 bg-rose-50 text-rose-700"
                : "border-black/15 bg-white text-black/70 hover:border-black/30"
            }`}
          >
            Needs Action
          </button>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="rounded-full border border-black/15 bg-white px-3 py-1 text-xs font-semibold text-black/70 transition hover:border-black/30"
            >
              Clear filters
            </button>
          )}
        </div>
        </>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-black/10 bg-white p-5 shadow-[0_20px_45px_-30px_rgba(0,0,0,0.45)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <button
            type="button"
            onClick={() => toggleSection("orders_list")}
            className="flex w-full items-center justify-between gap-3 text-left sm:flex-1"
            aria-expanded={expandedSections.orders_list}
          >
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-black/50">Orders list</p>
              <p className="mt-1 text-sm text-black/60">Showing {displayStart}-{displayEnd} of {displayOrders.length}</p>
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
              <ExpandChevron expanded={expandedSections.orders_list} />
              {expandedSections.orders_list ? "Collapse" : "Expand"}
            </span>
          </button>

          <label className="flex min-w-45 flex-col gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-black/50">
            List view
            <select
              value={orderListView}
              onChange={(event) => setOrderListView(event.target.value as OrderListView)}
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium tracking-normal text-black"
            >
              <option value="cards">Cards</option>
              <option value="table">Table</option>
            </select>
          </label>
        </div>

        {expandedSections.orders_list && (
        <>
        {paginatedOrders.length > 0 ? (
          orderListView === "cards" ? (
            <div className="mt-4 grid gap-4">
              {paginatedOrders.map((order) => {
                const fraudReview = order.metadata?.fraudReview;
                const fraudSignals = fraudReview?.signals ?? [];
                const allowedStatusOptions = getAllowedStatusOptions(order.status);
                const hasStatusChangeOptions = allowedStatusOptions.length > 1;

                return (
                <div
                  key={order.id}
                  className="flex flex-col justify-between gap-4 rounded-2xl border border-black/10 bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_100%)] p-5 shadow-[0_12px_24px_-20px_rgba(0,0,0,0.55)] md:flex-row md:items-center"
                >
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-black/50">
                      {`Order ${order.id.slice(0, 8)}`}
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {formatDateShort(order.createdAt)}
                    </p>
                    <p className="text-xs text-black/50 mt-1">
                      {new Date(order.createdAt).toLocaleString()}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {Number(order.total) >= dashboard.thresholds.highValueThreshold && (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                          High Value
                        </span>
                      )}
                      {isOrderDelayed(
                        order,
                        snapshotTimestamp,
                        dashboard.thresholds.delayedShipmentDays
                      ) && (
                          <span className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
                            Delayed Shipment
                          </span>
                        )}
                    </div>

                    {fraudReview?.underReview && (
                      <div className="mt-3 rounded-lg border border-fuchsia-200 bg-fuchsia-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fuchsia-800">
                          Under Review
                        </p>
                        {fraudSignals.length > 0 ? (
                          <div className="mt-2 space-y-1">
                            {fraudSignals.map((signal) => (
                              <p key={signal.code} className="text-xs text-fuchsia-900/90">
                                {signal.label}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-1 text-xs text-fuchsia-900/80">
                            Manual security verification required.
                          </p>
                        )}
                      </div>
                    )}

                    {order.User && (
                      <div className="mt-3 rounded-lg bg-black/5 p-3">
                        <p className="text-xs font-semibold text-black/70">Customer</p>
                        <p className="mt-1 text-sm font-medium">{order.User.name}</p>
                        <p className="text-xs text-black/60">{order.User.email}</p>
                        {order.User.phone && (
                          <p className="text-xs text-black/60">{order.User.phone}</p>
                        )}
                        <Link
                          href={`/admin/customers/${order.UserId}`}
                          className="mt-2 inline-block text-xs font-semibold text-blue-600 hover:text-blue-700 underline"
                        >
                          View Profile →
                        </Link>
                      </div>
                    )}

                    {order.OrderStatusEvents && order.OrderStatusEvents.length > 0 && (
                      <div className="mt-3 rounded-lg border border-black/10 bg-white p-3">
                        <p className="text-xs font-semibold text-black/60">Timeline</p>
                        <div className="mt-2 space-y-2">
                          {order.OrderStatusEvents.slice(0, 3).map((event) => (
                            <div key={event.id} className="text-xs text-black/70">
                              <p>
                                <span className="font-semibold">{formatStatus(event.toStatus)}</span>
                                {event.fromStatus ? ` (from ${formatStatus(event.fromStatus)})` : ""}
                              </p>
                              <p className="text-black/50">{new Date(event.createdAt).toLocaleString()}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="text-sm text-black/60">
                    {formatCurrency(order.total, order.currency)}
                  </div>

                  <div className="flex flex-col items-start gap-2 md:items-end">
                    {order.metadata?.automationOverride?.preventAutoTransition && (
                      <div className="rounded-full border border-purple-200 bg-purple-50 px-2 py-1 text-[11px] font-semibold text-purple-700">
                        ⏸️ Automation Disabled
                      </div>
                    )}

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        statusTone[order.status as OrderStatus] ?? "border-black/10"
                      }`}
                    >
                      {formatStatus(order.status)}
                    </span>
                    <select
                      value={order.status}
                      onChange={(event) => {
                        const nextStatus = event.target.value as OrderStatus;
                        if (nextStatus === order.status) {
                          return;
                        }

                        openActionNoteModal({
                          kind: "status_update",
                          orderId: order.id,
                          orderLabel: order.id.slice(0, 8),
                          nextStatus,
                        });
                      }}
                      disabled={!hasStatusChangeOptions}
                      title={
                        hasStatusChangeOptions
                          ? "Select the next valid status"
                          : "No further status transitions available"
                      }
                      className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {allowedStatusOptions.map((option) => (
                        <option key={option} value={option}>
                          {formatStatus(option)}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => {
                        if (order.metadata?.automationOverride?.preventAutoTransition) {
                          openActionNoteModal({
                            kind: "enable_automation",
                            orderId: order.id,
                            orderLabel: order.id.slice(0, 8),
                          });
                          return;
                        }
                        openDisableAutomationModal(order);
                      }}
                      disabled={automationActionOrderId === order.id}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        order.metadata?.automationOverride?.preventAutoTransition
                          ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                          : "border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                      title={
                        order.metadata?.automationOverride?.preventAutoTransition
                          ? "Click to enable automation"
                          : "Click to disable automation"
                      }
                    >
                      {automationActionOrderId === order.id
                        ? "Saving..."
                        : order.metadata?.automationOverride?.preventAutoTransition
                        ? "Enable Auto"
                        : "Disable Auto"}
                    </button>

                    {order.metadata?.payment?.reference && (
                      <button
                        onClick={() =>
                          openActionNoteModal({
                            kind: "payment_recheck",
                            orderId: order.id,
                            orderLabel: order.id.slice(0, 8),
                          })
                        }
                        disabled={recheckPaymentOrderId === order.id}
                        className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                        title="Manually verify this order payment with Paystack"
                      >
                        {recheckPaymentOrderId === order.id ? "Rechecking..." : "Recheck Payment"}
                      </button>
                    )}

                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-black/70 transition hover:border-black/25"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              );
              })}
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-black/10 shadow-[0_16px_30px_-24px_rgba(0,0,0,0.55)]">
              <table className="min-w-245 w-full border-collapse bg-white text-sm">
                <thead>
                  <tr className="bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] text-left">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-black/60">Order</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-black/60">Customer</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-black/60">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-black/60">Total</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-black/60">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order) => {
                    const allowedStatusOptions = getAllowedStatusOptions(order.status);
                    const hasStatusChangeOptions = allowedStatusOptions.length > 1;
                    const customerName = order.User?.name || "Customer";

                    return (
                      <tr key={order.id} className="border-t border-black/10 align-top">
                        <td className="px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/60">
                            {`Order ${order.id.slice(0, 8)}`}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-black">{formatDateShort(order.createdAt)}</p>
                          <p className="text-xs text-black/50">{new Date(order.createdAt).toLocaleString()}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {Number(order.total) >= dashboard.thresholds.highValueThreshold && (
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                High Value
                              </span>
                            )}
                            {isOrderDelayed(
                              order,
                              snapshotTimestamp,
                              dashboard.thresholds.delayedShipmentDays
                            ) && (
                              <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                                Delayed
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <p className="font-semibold text-black">{customerName}</p>
                          {order.User?.email && (
                            <p className="text-xs text-black/60">{order.User.email}</p>
                          )}
                          {order.User?.phone && (
                            <p className="text-xs text-black/60">{order.User.phone}</p>
                          )}
                          {order.User && (
                            <Link
                              href={`/admin/customers/${order.UserId}`}
                              className="mt-1 inline-block text-xs font-semibold text-blue-600 hover:text-blue-700 underline"
                            >
                              View Profile
                            </Link>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                              statusTone[order.status as OrderStatus] ?? "border-black/10"
                            }`}
                          >
                            {formatStatus(order.status)}
                          </span>
                          <select
                            value={order.status}
                            onChange={(event) => {
                              const nextStatus = event.target.value as OrderStatus;
                              if (nextStatus === order.status) {
                                return;
                              }

                              openActionNoteModal({
                                kind: "status_update",
                                orderId: order.id,
                                orderLabel: order.id.slice(0, 8),
                                nextStatus,
                              });
                            }}
                            disabled={!hasStatusChangeOptions}
                            title={
                              hasStatusChangeOptions
                                ? "Select the next valid status"
                                : "No further status transitions available"
                            }
                            className="mt-2 w-full rounded-lg border border-black/10 bg-white px-2 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {allowedStatusOptions.map((option) => (
                              <option key={option} value={option}>
                                {formatStatus(option)}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="px-4 py-3 text-sm font-semibold text-black/70">
                          {formatCurrency(order.total, order.currency)}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => {
                                if (order.metadata?.automationOverride?.preventAutoTransition) {
                                  openActionNoteModal({
                                    kind: "enable_automation",
                                    orderId: order.id,
                                    orderLabel: order.id.slice(0, 8),
                                  });
                                  return;
                                }
                                openDisableAutomationModal(order);
                              }}
                              disabled={automationActionOrderId === order.id}
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                order.metadata?.automationOverride?.preventAutoTransition
                                  ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                                  : "border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
                              } disabled:cursor-not-allowed disabled:opacity-60`}
                            >
                              {automationActionOrderId === order.id
                                ? "Saving..."
                                : order.metadata?.automationOverride?.preventAutoTransition
                                ? "Enable Auto"
                                : "Disable Auto"}
                            </button>

                            {order.metadata?.payment?.reference && (
                              <button
                                onClick={() =>
                                  openActionNoteModal({
                                    kind: "payment_recheck",
                                    orderId: order.id,
                                    orderLabel: order.id.slice(0, 8),
                                  })
                                }
                                disabled={recheckPaymentOrderId === order.id}
                                className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {recheckPaymentOrderId === order.id ? "Rechecking..." : "Recheck Payment"}
                              </button>
                            )}

                            <Link
                              href={`/admin/orders/${order.id}`}
                              className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-black/70 transition hover:border-black/25"
                            >
                              View Details
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="rounded-2xl border border-dashed border-black/15 bg-white p-6 text-sm text-black/60">
            {status === "error"
              ? "Login as admin to load orders."
              : status === "loading"
                ? "Loading orders dashboard..."
                : "No orders found for the selected filter."}
          </div>
        )}

      {displayOrders.length > ORDERS_PER_PAGE && (
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-black/10 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4">
          <button
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={currentPage === 1}
            className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-black transition hover:border-black/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>

          <p className="text-sm font-medium text-black/70">
            Page {currentPage} of {totalPages}
          </p>

          <button
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={currentPage === totalPages}
            className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-black transition hover:border-black/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
        </>
        )}
      </div>

      <AdminActionNoteModal
        open={isActionNoteModalOpen}
        title={actionNoteModalContent.title}
        description={actionNoteModalContent.description}
        note={actionNote}
        error={actionNoteError}
        isSubmitting={actionNoteSubmitting}
        submitLabel={actionNoteModalContent.submitLabel}
        onNoteChange={(value) => {
          setActionNote(value);
          if (actionNoteError) {
            setActionNoteError("");
          }
        }}
        onSubmit={submitActionNote}
        onClose={() => closeActionNoteModal()}
      />

      {isOverrideModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeOverrideModal();
            }
          }}
        >
          <div className="w-full max-w-xl rounded-2xl border border-black/10 bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold">Disable Automation</h2>
            <p className="mt-1 text-sm text-black/60">
              Provide a clear reason for order {overrideOrderLabel}. This is saved for audit history.
            </p>

            <div className="mt-5 space-y-4">
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                Reason <span className="text-red-600">*</span>
                <textarea
                  value={overrideReason}
                  onChange={(event) => setOverrideReason(event.target.value)}
                  placeholder="Explain why automation is being disabled for this order"
                  rows={4}
                  className="rounded-xl border border-black/10 px-3 py-2 text-sm font-medium tracking-normal text-black placeholder:text-black/40"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                Category
                <select
                  value={overrideCategory}
                  onChange={(event) =>
                    setOverrideCategory(event.target.value as AutomationOverrideCategory)
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
                  value={overrideEffectiveUntil}
                  onChange={(event) => setOverrideEffectiveUntil(event.target.value)}
                  className="rounded-xl border border-black/10 px-3 py-2 text-sm font-medium tracking-normal text-black"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
                Internal Note <span className="text-red-600">*</span>
                <textarea
                  value={overrideInternalNote}
                  onChange={(event) => setOverrideInternalNote(event.target.value)}
                  placeholder="Required internal note for audit trail (minimum 10 characters)"
                  rows={3}
                  className="rounded-xl border border-black/10 px-3 py-2 text-sm font-medium tracking-normal text-black placeholder:text-black/40"
                />
              </label>

              {overrideFormError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                  {overrideFormError}
                </p>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={closeOverrideModal}
                disabled={!!automationActionOrderId}
                className="rounded-full border border-black/15 px-4 py-2 text-sm font-semibold text-black/70 transition hover:border-black/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitDisableAutomationOverride}
                disabled={!!automationActionOrderId}
                className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {automationActionOrderId ? "Saving..." : "Disable Automation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
