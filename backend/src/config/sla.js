// SLA and automation configuration
module.exports = {
  // Grace period before delivered → received (in hours)
  deliveryConfirmationGraceHours: 48,

  // Hours before flagging order as delayed by status
  delayedShipmentThresholds: {
    paid: 0.1, // Payment confirmed but not processing
    processing: 0.10, // Processing but not packed
    packed: 0.1, // Packed but not shipped
    shipped: 0.10, // Shipped but not delivered (5 days)
    out_for_delivery: 0.1, // Out for delivery but not delivered
  },

  // Job execution interval (in minutes)
  jobIntervalMinutes: 5,

  // Auto-transition flags
  autoTransitions: {
    deliveredToReceived: true, // Auto-confirm receipt after grace period
    pendingPaymentToCancel: false, // Auto-cancel unpaid orders (future)
  },

  // Payment reconciliation safeguards (stale pending payments)
  paymentReconciliation: {
    enabled: true,
    lookbackHours: 72,
    minInitializationAgeMinutes: 2,
    maxOrdersPerRun: 50,
    mismatchLookbackHours: 72,
    mismatchMaxOrders: 300,
    dailyEnabled: true,
    dailyRunHourUtc: 2,
    dailyLookbackHours: 168,
    dailyMaxOrdersPerRun: 200,
  },

  // Alert when pending payments age beyond threshold
  pendingPaymentAlerts: {
    enabled: true,
    thresholdHours: 2,
    repeatAlertAfterHours: 24,
    maxOrdersPerRun: 50,
  },

  // Notification flags
  notifications: {
    onAutoReceived: true, // Notify customer when auto-confirmed
    onDelayedShipment: true, // Notify admin of delays
    onSLABreach: true, // Notify admin of SLA breaches
  },
};
