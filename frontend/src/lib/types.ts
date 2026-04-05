export type Category = {
  id: string;
  name: string;
  slug: string;
  ParentId?: string | null;
  Parent?: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

export type ProductVariant = {
  id: string;
  ProductId: string;
  attributes: Record<string, string | number>; // { size: "M", color: "Red" }
  sku?: string | null;
  price?: string | number | null; // null means use parent product price
  stock: number;
  imageUrl?: string | null;
  status: "active" | "inactive";
  createdAt?: string;
  updatedAt?: string;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  price: string | number;
  compareAtPrice?: string | number | null;
  sku?: string | null;
  stock: number;
  status: "active" | "draft";
  imageUrl?: string | null;
  Category?: Category;
  CategoryId?: string;
  ProductVariants?: ProductVariant[];
};

export type OrderItem = {
  id: string;
  OrderId: string;
  ProductId: string;
  quantity: number;
  unitPrice: string | number;
  price?: string | number;
  Product?: Product | null;
};

export type Order = {
  id: string;
  status:
    | "pending_payment"
    | "pending"
    | "paid"
    | "processing"
    | "packed"
    | "shipped"
    | "out_for_delivery"
    | "delivered"
    | "received"
    | "delivery_failed"
    | "delivery_pickup"
    | "fulfilled"
    | "cancelled"
    | "returned"
    | "refunded"
    | "fraud_hold";
  total: string | number;
  currency: string;
  createdAt: string;
  shippingAddress?: string | null;
  billingAddress?: string | null;
  UserId?: string;
  OrderItems?: OrderItem[];
  OrderStatusEvents?: OrderStatusEvent[];
  metadata?: {
    automationOverride?: {
      preventAutoTransition: boolean;
      reason?: string | null;
      category?: string | null;
      internalNote?: string | null;
      effectiveUntil?: string | null;
      setBy?: string;
      setAt?: string;
    };
    fraudReview?: {
      underReview: boolean;
      label?: string;
      score?: number;
      signals?: Array<{
        code: string;
        label: string;
        details?: string;
        severity?: "low" | "medium" | "high";
      }>;
      paymentFailuresDetected?: number;
      evaluatedAt?: string;
    };
    payment?: {
      provider?: string;
      status?: string;
      reference?: string;
      initializedAt?: string;
      verifiedAt?: string;
      verificationSource?:
        | "gateway_webhook"
        | "gateway_verify"
        | "admin_recheck"
        | "offline_override"
        | "reconciliation_interval"
        | "reconciliation_daily"
        | null;
      verificationActorRole?: string | null;
      verificationActorUserId?: string | null;
      paidAt?: string;
      callbackUrl?: string;
      gatewayStatus?: string;
      channel?: string | null;
      gatewayPaidAt?: string | null;
      amountSmallestUnit?: number | null;
      refundStatus?: string;
      refundedAmount?: number;
      refundedAt?: string;
      offlineOverride?: {
        reasonCode?: string;
        approvalReference?: string;
        amount?: number;
        requestedBy?: string | null;
        requestedEmail?: string | null;
        requestedAt?: string | null;
        requestInternalNote?: string | null;
        approvedBy?: string;
        approvedEmail?: string;
        approvedAt?: string;
        internalNote?: string;
      };
      pendingOfflineOverride?: {
        reasonCode?: string;
        approvalReference?: string;
        amount?: number;
        requestedBy?: string;
        requestedEmail?: string;
        requestedAt?: string;
        internalNote?: string;
      } | null;
      auditTrail?: Array<{
        action?: string;
        source?: string;
        actorRole?: string | null;
        actorUserId?: string | null;
        status?: string;
        reference?: string | null;
        gatewayStatus?: string | null;
        note?: string | null;
        timestamp?: string;
        amount?: number;
        currency?: string;
        reasonCode?: string;
        refundType?: "full" | "partial";
        approvalReference?: string;
      }>;
    };
    refunds?: Array<{
      id?: string;
      type?: "full" | "partial";
      amount?: number;
      currency?: string;
      reasonCode?: string;
      reasonNote?: string | null;
      internalNote?: string;
      processedBy?: string;
      processedAt?: string;
    }>;
    adjustments?: Array<{
      action?: "add" | "remove";
      item?: {
        id?: string;
        ProductId?: string;
        quantity?: number;
        unitPrice?: number;
      };
      internalNote?: string;
      changedBy?: string;
      changedAt?: string;
    }>;
    operational?: {
      shippingData?: {
        carrier?: string | null;
        trackingNumber?: string | null;
        shipDate?: string | null;
        deliveryEta?: string | null;
      };
      contact?: {
        phone?: string | null;
        deliveryInstructions?: string | null;
      };
      assignment?: {
        owner?: string | null;
        priority?: "low" | "normal" | "high" | "urgent";
        escalationFlag?: boolean;
      };
      addressCorrection?: {
        reason?: string | null;
        correctedBy?: string;
        correctedAt?: string;
      };
      updatedBy?: string;
      updatedAt?: string;
    };
    [key: string]: unknown;
  } | null;
  User?: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  };
};

export type OrderStatusEvent = {
  id: string;
  fromStatus?: string | null;
  toStatus: string;
  actorRole: string;
  note?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

export type OrderNotification = {
  id: string;
  status: string;
  subject: string;
  content: string;
  readAt: string | null;
  createdAt: string;
  Order?: {
    id: string;
    status: string;
    createdAt: string;
  };
};

export type CartItem = {
  id: string;
  CartId: string;
  ProductId: string;
  VariantId: string | null;
  quantity: number;
  unitPrice: string | number;
  Product: Product | null;
  ProductVariant?: ProductVariant | null;
};

export type Cart = {
  id: string;
  UserId: string;
  status: "open" | "converted";
};

export type CartSummary = {
  cart: Cart;
  items: CartItem[];
  totals: {
    subtotal: number;
    items: number;
  };
};
