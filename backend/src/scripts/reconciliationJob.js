// Daily reconciliation job: compare orders and payments, log discrepancies
const { sequelize } = require("../models");
const fs = require("fs");
const path = require("path");

const LOG_PATH = path.join(__dirname, "../../reconciliation-log.json");
const LOG_HISTORY_PATH = path.join(
  __dirname,
  "../../reconciliation-log-history.jsonl"
);

const SQL_TOTALS = `
  SELECT
    COALESCE((
      SELECT SUM(o.total_minor)::bigint
      FROM orders o
      WHERE o.status = 'paid'
        AND o.updated_at >= :startDate
        AND o.updated_at < :endDate
    ), 0) AS paid_orders_total_minor,
    COALESCE((
      SELECT SUM(p.amount)::bigint
      FROM payments p
      WHERE p.status = 'success'
        AND p.created_at >= :startDate
        AND p.created_at < :endDate
    ), 0) AS successful_payments_total_minor;
`;

const SQL_PAID_ORDER_WITHOUT_SUCCESS_PAYMENT = `
  SELECT
    o.id,
    o.total_minor,
    o.currency,
    o.updated_at
  FROM orders o
  LEFT JOIN payments p
    ON p.order_id = o.id
   AND p.status = 'success'
  WHERE o.status = 'paid'
    AND o.updated_at >= :startDate
    AND o.updated_at < :endDate
    AND p.id IS NULL
  ORDER BY o.updated_at DESC;
`;

const SQL_SUCCESS_PAYMENT_WITHOUT_ORDER = `
  SELECT
    p.id,
    p.order_id,
    p.payment_reference,
    p.amount,
    p.currency,
    p.created_at
  FROM payments p
  LEFT JOIN orders o ON o.id = p.order_id
  WHERE p.status = 'success'
    AND p.created_at >= :startDate
    AND p.created_at < :endDate
    AND o.id IS NULL
  ORDER BY p.created_at DESC;
`;

const SQL_PAID_ORDER_PAYMENT_TOTAL_MISMATCH = `
  SELECT
    o.id,
    o.total_minor,
    COALESCE(SUM(CASE WHEN p.status = 'success' THEN p.amount ELSE 0 END), 0) AS successful_payments_minor,
    o.currency,
    o.updated_at
  FROM orders o
  LEFT JOIN payments p ON p.order_id = o.id
  WHERE o.status = 'paid'
    AND o.updated_at >= :startDate
    AND o.updated_at < :endDate
  GROUP BY o.id, o.total_minor, o.currency, o.updated_at
  HAVING COALESCE(SUM(CASE WHEN p.status = 'success' THEN p.amount ELSE 0 END), 0) <> o.total_minor
  ORDER BY o.updated_at DESC;
`;

const getDailyWindowUtc = (baseDate = new Date()) => {
  const startDate = new Date(baseDate);
  startDate.setUTCHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  return { startDate, endDate };
};

const appendHistoryLine = (payload) => {
  try {
    fs.appendFileSync(LOG_HISTORY_PATH, `${JSON.stringify(payload)}\n`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to append reconciliation history:", error.message);
  }
};

async function runReconciliationJob(options = {}) {
  const { startDate, endDate } = options.startDate && options.endDate
    ? {
        startDate: new Date(options.startDate),
        endDate: new Date(options.endDate),
      }
    : getDailyWindowUtc(new Date());

  const replacements = { startDate, endDate };

  const [totalsRows] = await sequelize.query(SQL_TOTALS, { replacements });
  const [paidOrdersNoPayment] = await sequelize.query(
    SQL_PAID_ORDER_WITHOUT_SUCCESS_PAYMENT,
    { replacements }
  );
  const [paymentsNoOrder] = await sequelize.query(
    SQL_SUCCESS_PAYMENT_WITHOUT_ORDER,
    { replacements }
  );
  const [paidOrderPaymentMismatches] = await sequelize.query(
    SQL_PAID_ORDER_PAYMENT_TOTAL_MISMATCH,
    { replacements }
  );

  const totals = totalsRows?.[0] || {
    paid_orders_total_minor: 0,
    successful_payments_total_minor: 0,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    period: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
    totals: {
      paidOrdersMinor: Number(totals.paid_orders_total_minor || 0),
      successfulPaymentsMinor: Number(totals.successful_payments_total_minor || 0),
      driftMinor:
        Number(totals.successful_payments_total_minor || 0) -
        Number(totals.paid_orders_total_minor || 0),
    },
    discrepancies: {
      paidOrdersWithoutSuccessfulPayment: paidOrdersNoPayment,
      successfulPaymentsWithoutOrder: paymentsNoOrder,
      paidOrderPaymentTotalMismatch: paidOrderPaymentMismatches,
    },
    counts: {
      paidOrdersWithoutSuccessfulPayment: paidOrdersNoPayment.length,
      successfulPaymentsWithoutOrder: paymentsNoOrder.length,
      paidOrderPaymentTotalMismatch: paidOrderPaymentMismatches.length,
    },
    sql: {
      totals: SQL_TOTALS.trim(),
      paidOrdersWithoutSuccessfulPayment:
        SQL_PAID_ORDER_WITHOUT_SUCCESS_PAYMENT.trim(),
      successfulPaymentsWithoutOrder: SQL_SUCCESS_PAYMENT_WITHOUT_ORDER.trim(),
      paidOrderPaymentTotalMismatch:
        SQL_PAID_ORDER_PAYMENT_TOTAL_MISMATCH.trim(),
    },
  };

  fs.writeFileSync(LOG_PATH, JSON.stringify(report, null, 2));
  appendHistoryLine(report);

  return report;
}

if (require.main === module) {
  runReconciliationJob().then((report) => {
    // eslint-disable-next-line no-console
    console.log("Reconciliation report written:", LOG_PATH);
    process.exit(0);
  });
}

module.exports = { runReconciliationJob, LOG_PATH };
