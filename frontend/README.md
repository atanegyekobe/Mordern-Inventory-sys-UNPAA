This is the Next.js frontend for Ellora Supply's storefront, admin workspace, and POS.

## Current Process (April 2026)

- Admin workspace is role-aware by active shop membership.
- OWNER-only pages: Inventory Insights, Inventory, Categories, Import, Team.
- OWNER + STAFF pages: POS, Stock Movements, Customers, Messages.
- POS includes two-step sale confirmation, optional transaction note, recent-sales detail modal, and printable receipt.
- Header branding is active-shop aware: logo + name in the navbar switch to the selected shop identity.
- Profile includes shop identity controls (OWNER/platform admin):
	- shop name
	- logo URL
	- logo file picker/upload

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

For local API integration, ensure `NEXT_PUBLIC_API_BASE_URL` points to backend `/api`.

The app auto-updates as you edit files.

## Key Admin Routes

- `/admin`
- `/admin/pos`
- `/admin/sales`
- `/admin/customers`
- `/admin/messages`
- `/admin/team` (OWNER-only)
- `/admin/products` (OWNER-only)
- `/admin/categories` (OWNER-only)
- `/admin/import` (OWNER-only)
- `/admin/analytics` (OWNER-only)

Shop context is sent through the API client via `x-shop-id` from local storage (`ellora_active_shop_id`).

## Notes

- If page access looks correct but data calls fail with 403, verify active shop and membership role.
- After backend permission changes, restart backend server so middleware updates apply.
- Shop identity updates are reflected immediately in navbar branding via auth context state updates.

## Deployment Notes

For local desktop usage with Electron, run this app on port 3000 and point the Electron window to that URL.
For web hosting, follow the Next.js deployment guide for your preferred platform:
[Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying).
