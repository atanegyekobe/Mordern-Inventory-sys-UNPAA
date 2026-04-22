# Ops Incident Playbook

This runbook is for current inventory/POS operations and role-access incidents.

## Scope

Covers incidents around:

- POS sale execution failures
- POS product list/search not loading
- shop membership/permission mismatches (OWNER vs STAFF)
- customer/messages admin workflow failures
- recent sales and receipt-print flow issues

## Key Admin Surfaces

- POS: `/admin/pos`
- Stock movement: `/admin/sales`
- Customers: `/admin/customers`
- Messages: `/admin/messages`
- Team management (OWNER-only): `/admin/team`

## Access Model Summary

- OWNER-only modules:
	- `/admin/analytics`
	- `/admin/products`
	- `/admin/categories`
	- `/admin/import`
	- `/admin/team`
- OWNER + STAFF modules:
	- `/admin/pos`
	- `/admin/sales`
	- `/admin/customers`
	- `/admin/messages`

Important: shop permissions are enforced by `user_shops.role` (`OWNER` / `STAFF`), not the global `users.role` value.

## Key APIs

Operational (OWNER + STAFF):

- `GET /api/pos/products`
- `GET /api/pos/products/search`
- `POST /api/pos/sale`
- `GET /api/pos/recent-sales`
- `GET /api/pos/recent-sales/:saleId`
- `GET /api/admin/sales-management`
- `GET /api/admin/low-stock-alerts`
- `GET /api/customers`
- `GET /api/messages`

Restricted (OWNER-only):

- `GET /api/admin/analytics`
- `POST /api/admin/products/import/preview`
- `POST /api/admin/products/import/execute`
- `GET /api/shops/:shopId/members`
- `POST /api/shops/:shopId/members`
- `DELETE /api/shops/:shopId/members/:userId`
- `PATCH /api/shops/:shopId` (shop identity update)
- `POST /api/shops/:shopId/logo` (shop logo upload)

## Quick Triage Checklist

1. Confirm identity and active shop:

- verify JWT user
- verify active shop id (`x-shop-id`)
- verify `user_shops` membership role

2. Confirm route access expectation:

- if module is OWNER-only, check user has `OWNER` role in active shop
- if module is operational, OWNER/STAFF should both pass

3. Reproduce with one API call from browser/devtools or Postman.

4. If middleware was recently changed, restart backend process.

## Incident Playbooks

### 1) POS opens but products do not load

Symptoms:

- `/admin/pos` renders
- product grid shows error or empty due to 403/401

Actions:

1. Verify `GET /api/pos/products` returns 200 for the affected user.
2. Confirm the active shop id maps to a valid membership.
3. Confirm user has `OWNER` or `STAFF` in that shop.
4. Restart backend if permission middleware was recently updated.

Expected outcome:

- product list loads and checkout flow works.

### 2) STAFF blocked from operational pages

Symptoms:

- STAFF can open page but API calls return `Insufficient permissions for this shop`.

Actions:

1. Verify route uses staff-capable middleware (`requireShopStaffAccess`) for operational modules.
2. Confirm STAFF membership row exists for active shop.
3. Verify frontend is using correct active shop context.

Expected outcome:

- STAFF can use POS, stock movement, customers, and messages.

### 3) OWNER cannot add team member

Symptoms:

- `/admin/team` add member fails.

Actions:

1. Verify request payload has existing user email and valid role (`OWNER` or `STAFF`).
2. Confirm caller role is `OWNER` in active shop.
3. Confirm target user exists in `users` table.

Expected outcome:

- membership is created or updated in `user_shops`.

### 4) Receipt print not working

Symptoms:

- `Print receipt` button does nothing or shows popup warning.

Actions:

1. Ensure popup blocker is disabled for the app origin.
2. Confirm sale receipt data exists in current POS session.
3. Retry print from latest completed sale panel.

Expected outcome:

- print window opens with line items and totals.

## Communication Template

- Incident: `<short name>`
- Started: `<time>`
- Impact: `<who/what>`
- Role/shop context: `<user role + active shop>`
- Actions taken: `<steps performed>`
- Next checkpoint: `<time>`

## Post-Incident Checklist

1. Document root cause and impacted roles.
2. Document timeline and affected shop(s).
3. Document fix and verification steps.
4. Add follow-up task for missing guardrails/tests.
