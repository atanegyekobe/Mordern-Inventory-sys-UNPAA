# Render Backend Deployment Guide

This guide deploys only the backend service from this repository to Render.

## 1. Prerequisites

- Repository is pushed to GitHub.
- You have a Render account.
- You have PostgreSQL ready (Render PostgreSQL recommended).

## 2. Create a Render PostgreSQL Database

1. In Render, create a new PostgreSQL instance.
2. Copy the Internal Database URL (or External URL if needed).

Use that URL as `DATABASE_URL` in your backend web service.

## 3. Deploy the Backend Service

Option A (recommended): Blueprint
1. In Render, choose New + > Blueprint.
2. Connect this GitHub repository.
3. Render reads `render.yaml` and creates the service.
4. Fill any `sync: false` env vars in the dashboard.

Option B: Manual Web Service
1. In Render, choose New + > Web Service.
2. Connect this GitHub repository.
3. Configure:
   - Root Directory: `backend`
   - Runtime: Node
   - Build Command: `npm install && npm run db:migrate`
   - Start Command: `npm start`

## 4. Required Environment Variables

Set these in Render service settings:

- `DATABASE_URL` = your Postgres connection string
- `DB_SSL` = `true`
- `JWT_SECRET` = long random secret
- `CLIENT_ORIGIN` = your frontend URL (for CORS), e.g. `https://your-frontend-domain`

Recommended defaults:

- `NODE_ENV` = `production`
- `JWT_EXPIRES_IN` = `7d`
- `PAYSTACK_BASE_URL` = `https://api.paystack.co`
- `OPENAI_MODEL` = `gpt-4o-mini`
- `ENABLE_OFFLINE_PAYMENT_OVERRIDE` = `false`
- `PAYMENT_OVERRIDE_APPROVERS` = empty unless needed

Optional (only if those features are used):

- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_CALLBACK_URL`
- `OPENAI_API_KEY`

## 5. First Boot and Migration Notes

- This project starts without runtime schema sync.
- Schema is expected to be managed by `npm run db:migrate`.
- Because the build command runs migrations, each deploy applies pending migrations safely.

## 6. Health Check

`render.yaml` uses `/health` as health check path.

If health check fails, verify:
- service logs show successful DB connection
- `DATABASE_URL` is valid
- DB accepts SSL connections (`DB_SSL=true`)

## 7. Post-Deploy Validation

After deploy, verify:

1. `GET /health` returns success.
2. Auth endpoints work (`/api/auth/login`, `/api/auth/register`).
3. Shop context endpoints work with active shop:
   - OWNER can access `/api/shops/:shopId/members`.
   - STAFF receives permission denial on owner-only team endpoints.
4. Operational endpoints work for OWNER and STAFF:
   - `/api/pos/products`
   - `/api/pos/recent-sales`
   - `/api/admin/sales-management`
5. OWNER-only endpoints are blocked for STAFF:
   - `/api/admin/analytics`
   - `/api/admin/products/import/preview`

If permissions were recently changed and behavior looks stale, force a service restart after deploy.

## 8. Security Checklist

- Never commit `backend/.env`.
- Keep API keys only in Render environment settings.
- Rotate any key that was previously exposed.
- Use a strong `JWT_SECRET` in production.
