# SLA Automation & Order Lifecycle Management

## Overview

Phase 1.5 implements professional-grade order automation with Service Level Agreement (SLA) monitoring, automatic status transitions, and intelligent flagging of delayed orders.

## Features

### 1. **Automated Delivery Confirmation**
- **What**: Orders in `delivered` status automatically transition to `received` after a configurable grace period
- **Why**: Enables automatic order completion, seller payouts, and review prompts
- **Grace Period**: Default 48 hours (configurable in `backend/src/config/sla.js`)
- **Customer Protection**: Grace window allows customers to dispute delivery before auto-confirmation
- **Admin Override**: Individual orders can be exempted from automation (see below)

### 2. **Delayed Order Flagging**
- **What**: Automatic detection and flagging of orders exceeding SLA thresholds
- **Thresholds** (configurable):
  - `paid`: 24 hours (payment confirmed but not processing)
  - `processing`: 48 hours (processing but not packed)
  - `packed`: 24 hours (packed but not shipped)
  - `shipped`: 120 hours / 5 days (shipped but not delivered)
  - `out_for_delivery`: 24 hours (out for delivery but not delivered)
- **Notifications**: Admin receives alerts when SLA breaches detected
- **Timeline Tracking**: All SLA events logged in order timeline

### 3. **Job Scheduler**
- **Frequency**: Runs every 60 minutes (configurable)
- **Auto-Start**: Scheduler starts automatically when backend server launches
- **Manual Control**: Admin can start/stop scheduler via UI
- **Manual Trigger**: Instant job execution via "Run Now" button
- **Job History**: Tracks last 50 job executions with detailed metrics

### 4. **Admin Override System**
- **Purpose**: Prevent automation on specific orders requiring manual attention
- **Use Cases**:
  - Customer dispute in progress
  - Quality investigation ongoing
  - Special handling requirements
  - Fraud review pending
- **Timeline Logging**: All override actions recorded in order history
- **Easy Toggle**: One-click enable/disable per order in admin UI

### 5. **Payment Reconciliation & Mismatch Monitoring**
- **Continuous Reconciliation**: Scheduler verifies stale Paystack references in pending states
- **Daily Deep Reconciliation**: Runs once per day (UTC window) with wider scan limits
- **Mismatch Monitoring**: Detects divergence between payment status and order lifecycle
- **Observability Metrics**: Emits mismatch counters and reconciliation quality indicators

## Configuration

All settings in `backend/src/config/sla.js`:

```javascript
{
  // Grace period before delivered → received (hours)
  deliveryConfirmationGraceHours: 48,

  // Hours before flagging delayed orders
  delayedShipmentThresholds: {
    paid: 24,
    processing: 48,
    packed: 24,
    shipped: 120,
    out_for_delivery: 24,
  },

  // Job execution frequency (minutes)
  jobIntervalMinutes: 60,

  // Feature flags
  autoTransitions: {
    deliveredToReceived: true,
    pendingPaymentToCancel: false, // Future feature
  },

  // Payment reconciliation safeguards
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

  // Notification preferences
  notifications: {
    onAutoReceived: true,      // Notify customer on auto-confirm
    onDelayedShipment: true,   // Notify admin of delays
    onSLABreach: true,         // Notify admin of SLA breaches
  },
}
```

## API Endpoints

### SLA Jobs (Admin Only)

**POST** `/api/sla-jobs/trigger`
- Manually trigger all SLA jobs
- Response: Job execution results with metrics

**GET** `/api/sla-jobs/history`
- Retrieve job execution history
- Response: Last 50 job runs with timestamps and results

**GET** `/api/sla-jobs/config`
- Get current SLA configuration and scheduler status
- Response: Config object and scheduler state

**POST** `/api/sla-jobs/scheduler`
- Control scheduler (start/stop)
- Body: `{ "action": "start" | "stop" }`
- Response: Confirmation message

### Order Automation Override (Admin Only)

**PATCH** `/api/orders/:id/automation-override`
- Enable/disable automation for specific order
- Body:
  ```json
  {
    "preventAutoTransition": true,
    "reason": "Customer dispute investigation"
  }
  ```
- Response: Updated order object

## Admin UI

### SLA Automation Dashboard
**Location**: `/admin/sla`

**Features**:
- **Scheduler Control**: Start/stop automation engine
- **Manual Trigger**: Run jobs on-demand
- **Configuration Display**: View all SLA thresholds and settings
- **Execution History**: Real-time job results with metrics
- **Next Run Estimate**: Countdown to next scheduled execution

### Order Management Enhancements
**Location**: `/admin/orders`

**New Controls**:
- **Automation Override Button**: 
  - ⏸️ Disable Auto: Prevent automated transitions
  - ▶️ Enable Auto: Resume automation
  - Requires reason when disabling
- **Override Indicator**: Purple badge shows when automation disabled
- **Timeline Integration**: Override events appear in order history

## How It Works

### Automatic Delivery Confirmation Flow

1. **Carrier Confirms Delivery**: Order status manually set to `delivered`
2. **Grace Period Begins**: 48-hour window starts (configurable)
3. **Customer Can Dispute**: Customer contact admin if package not received
4. **Admin Can Override**: Set `preventAutoTransition` flag to block auto-confirm
5. **Job Runs**: Hourly job checks for orders past grace period
6. **Auto-Transition**: If no override, status → `received`
7. **Customer Notified**: Email/notification sent confirming receipt
8. **Timeline Logged**: Event recorded with "Auto-confirmed after 48h" note

### Delayed Order Detection Flow

1. **Job Scans Orders**: Checks all orders in active fulfillment statuses
2. **Calculates Age**: Compares current time vs. last status update
3. **Checks Thresholds**: Compares age against SLA config for that status
4. **Flags Breaches**: Creates OrderStatusEvent with SLA breach note
5. **Sends Alerts**: Notifies admin via OrderNotification
6. **Prevents Duplicates**: Won't re-flag same order within 24 hours
7. **Dashboard Updates**: Delayed shipment KPI increments

## Database Schema Changes

### Orders Table
**New Column**: `metadata` (JSONB)

Structure:
```json
{
  "automationOverride": {
    "preventAutoTransition": true,
    "reason": "Customer dispute in progress",
    "setBy": "admin-user-id",
    "setAt": "2026-03-04T10:30:00Z"
  }
}
```

### OrderStatusEvents Table
System-generated events now include:

**Auto-Confirmation Event**:
- `actorRole`: "system"
- `note`: "Auto-confirmed after 48h grace period"
- `metadata.automationType`: "delivery_confirmation"
- `metadata.graceHours`: 48

**SLA Breach Event**:
- `actorRole`: "system"
- `note`: "SLA breach detected: shipped for 120+ hours"
- `metadata.automationType`: "sla_breach"
- `metadata.thresholdHours`: 120
- `metadata.actualHours`: 132

**Override Event**:
- `actorRole`: "admin"
- `note`: "Automation disabled: Customer dispute investigation"
- `metadata.automationOverride`: { override config }

## Monitoring & Metrics

### Job Execution Metrics
Each job run tracks:
- **Timestamp**: When job executed
- **Duration**: Execution time in milliseconds
- **Delivery Confirmations**: Successful vs. failed auto-transitions
- **Delayed Orders**: Count of newly flagged breaches
- **Payment Reconciliation**: Scanned, attempted, reconciled, unresolved, and errors
- **Payment Mismatches**: Snapshot totals for mismatch categories

### Dashboard KPIs
The admin orders dashboard shows:
- **Delayed Shipments**: Real-time count of SLA breaches
- **Pending Fulfillment**: Orders awaiting admin action
- **Risk Flagged**: Orders in fraud_hold or pending payment 24h+
- **High Value**: Orders exceeding threshold (e.g., $1000+)

## Best Practices

### When to Disable Automation
✅ **Do disable** for:
- Active customer disputes
- Quality/fraud investigations
- Special handling orders (VIP, fragile, etc.)
- Manual review pending

❌ **Don't disable** for:
- Routine delays (flags are informational)
- Orders you just haven't processed yet
- All orders "just in case"

### Tuning SLA Thresholds
- **Start Conservative**: Use longer thresholds initially
- **Monitor Flags**: Review flagged orders weekly
- **Adjust Gradually**: Tighten thresholds as processes improve
- **Match Capacity**: Thresholds should align with fulfillment speed

### Grace Period Configuration
- **48h Standard**: Works for most e-commerce
- **24h Fast**: Use for next-day delivery services
- **72h Cautious**: Use for high-dispute-rate products
- **Consider Geography**: International vs. domestic delivery

## Future Enhancements (Phase 2+)

### Planned Features
- **Auto-Cancel Unpaid**: Cancel orders in `pending_payment` after N hours
- **Carrier Webhooks**: Auto-update status from shipping provider
- **Smart Escalation**: Alert managers for high-value delays
- **Performance Analytics**: Track SLA compliance rates over time
- **Customer Communication**: Auto-update customers on delays
- **Predictive Delays**: ML-based delay prediction before breach

### Carrier Integration (Phase 2)
- Real-time tracking updates
- Automatic `shipped` → `out_for_delivery` → `delivered` transitions
- Delivery proof storage (signatures, photos)
- Exception handling (address issues, weather delays)

## Troubleshooting

### Scheduler Not Running
1. Check admin UI: `/admin/sla` → Scheduler status
2. Review server logs: Look for "🚀 Starting SLA job scheduler" message
3. Verify config: Ensure `jobIntervalMinutes` is reasonable (> 0)
4. Restart server: Scheduler auto-starts on launch

### Orders Not Auto-Confirming
1. **Check grace period**: Has 48h passed since `delivered`?
2. **Check override**: Is `preventAutoTransition` true?
3. **Check feature flag**: `autoTransitions.deliveredToReceived` must be true
4. **Review logs**: Look for "⏸️ Skipping auto-transition" messages
5. **Manual trigger**: Use "Run Now" button to force execution

### False Delay Flags
1. **Review thresholds**: `sla.js` → `delayedShipmentThresholds`
2. **Check status**: Flags only trigger in specific statuses
3. **Consider weekends**: Thresholds count calendar hours, not business hours
4. **Adjust config**: Increase threshold for problematic status

### Job Performance Issues
1. **Check duration**: <5s for 1000 orders is good
2. **Database indexes**: Ensure `status` and `updatedAt` indexed
3. **Reduce frequency**: Increase `jobIntervalMinutes` if load is high
4. **Batch notifications**: Future enhancement to reduce email load

## Testing

### Manual Testing Checklist
- [ ] Create order, set to `delivered`, wait 48h (or adjust config to 1 min)
- [ ] Trigger job manually via "Run Now"
- [ ] Verify status changes to `received`
- [ ] Check customer receives notification
- [ ] Verify timeline shows auto-confirmation event
- [ ] Disable automation on order
- [ ] Trigger job again
- [ ] Verify order skipped (check logs)
- [ ] Re-enable automation
- [ ] Manual trigger should now work

### SLA Breach Testing
- [ ] Create order in `shipped` status
- [ ] Manually set `updatedAt` to 6 days ago (or adjust threshold to 1 hour)
- [ ] Trigger job
- [ ] Verify OrderStatusEvent created with SLA breach note
- [ ] Verify admin notification created
- [ ] Verify "Delayed Shipment" badge appears on order card

## Support

For questions or issues with SLA automation:
1. Check job execution history in admin UI
2. Review server logs for error messages
3. Verify configuration in `sla.js`
4. Check database for manual overrides
5. Test with manual job trigger

---

**Last Updated**: March 4, 2026  
**Version**: Phase 1.5  
**Status**: Production-Ready ✅
