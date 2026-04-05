# Ops Incident Playbook

This runbook is for admin and support operations when payment and order automation incidents happen.

## Scope

Covers incidents around:
- payment webhook failures
- stale/pending payments
- reconciliation errors
- scheduler lock skips
- single-order payment mismatch

## Key Admin Surfaces

- Observability dashboard: `frontend /admin/observability`
- Order tooling: `frontend /admin/orders` (use `Recheck Payment` per order)
- SLA controls/history: `frontend /admin/sla`

## Key APIs (Admin only unless stated)

- `GET /api/sla-jobs/metrics`
- `GET /api/sla-jobs/history`
- `POST /api/sla-jobs/trigger`
- `POST /api/orders/:id/recheck-payment`
- Public webhook endpoint (provider use): `POST /api/payments/webhook`

## Quick Triage Checklist

1. Open `/admin/observability` and check:
- `Webhook Failures`
- `Reconciliation Errors`
- `Scheduler Lock Skips`
- `Pending Payment Alerts`

2. Open `/admin/sla` and confirm:
- scheduler is running
- latest runs are successful

3. If issue is about a specific order:
- open `/admin/orders`
- find order
- click `Recheck Payment`

4. If multiple pending payments are stuck:
- trigger SLA jobs from `/admin/sla`
- verify `paymentReconciliation` and `pendingPaymentAlerts` results

## Incident Playbooks

### 1) Webhook failure spike

Symptoms:
- `Webhook Failures` increases quickly
- pending-payment orders increase

Actions:
1. Confirm provider webhook secret and server env settings.
2. Check if signature failures dominate (from metrics/tag trends and logs).
3. Use `/admin/sla` -> `Run Now` to force reconciliation.
4. For critical customer orders, use `/admin/orders` -> `Recheck Payment`.

Expected outcome:
- failures stop climbing
- reconciliation and manual rechecks move valid paid orders to `paid`

Escalate when:
- failures continue for 15+ minutes after config check
- provider status page indicates outage

### 2) Single order paid but still pending

Symptoms:
- customer reports payment success
- order status remains `pending_payment` or `pending`

Actions:
1. Open `/admin/orders`, locate order.
2. Click `Recheck Payment`.
3. If verified success: status should become `paid` (or remain review state when applicable).
4. If unresolved: contact customer and confirm transaction evidence/reference.

Expected outcome:
- order metadata and status become consistent with gateway state

Escalate when:
- repeated recheck fails but customer has confirmed successful charge

### 3) Reconciliation errors increasing

Symptoms:
- `Reconciliation Errors` > 0 and rising

Actions:
1. Open `/admin/sla` history and inspect failed run windows.
2. Verify payment provider connectivity and credentials.
3. Trigger manual job run from `/admin/sla` after config/connectivity fix.

Expected outcome:
- errors flatten, reconciled count rises when pending payments exist

Escalate when:
- errors persist across 3 consecutive manual runs

### 4) Scheduler lock skips increasing

Symptoms:
- `Scheduler Lock Skips` keeps climbing

Actions:
1. Check if multiple app instances are intentionally running.
2. Confirm lock contention is expected (only one runner should execute jobs at a time).
3. Ensure at least one instance is successfully completing runs in `/admin/sla` history.

Expected outcome:
- lock skips may occur, but successful runs continue regularly

Escalate when:
- lock skips increase and no successful SLA runs appear

### 5) Pending payment alerts increasing

Symptoms:
- `Pending Payment Alerts` growing

Actions:
1. Review alerted orders in `/admin/orders` filtered by pending statuses.
2. Run `Recheck Payment` for top-value/older orders first.
3. Contact customers for unresolved payments.
4. Trigger manual SLA run if queue appears stale.

Expected outcome:
- high-risk pending orders are resolved or actively followed up

Escalate when:
- pending alerts continue growing for 24h with low reconciliation success

## Communication Template

Use this short update format in incident channels:

- Incident: `<short name>`
- Started: `<time>`
- Impact: `<who/what>`
- Current metrics: `<webhook failures/reconciliation errors/etc>`
- Actions taken: `<runbook steps performed>`
- Next checkpoint: `<time>`

## Post-Incident Checklist

1. Document root cause.
2. Document timeline and impact.
3. Capture which runbook step solved it (or failed).
4. Create follow-up engineering task if automation/tooling gaps remain.
