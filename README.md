# Ellora Supply - Inventory and POS Platform

A full-stack inventory-first platform with customer storefront, operations dashboard, and POS built with Node.js, Express, PostgreSQL, Next.js, and React.

## Current Process (April 2026)

This repository is now centered on inventory operations and in-store sales processing.

- POS has a full workflow: product lookup, cart, two-step sale confirmation, optional transaction note, receipt print, and recent-sales detail modal.
- Team management is available in admin: add existing users by email to the active shop and remove members.
- Multi-shop context is enforced via `x-shop-id` and membership in `user_shops`.

### Access Model (OWNER vs STAFF)

Shop permissions are controlled by `user_shops.role` (not the global `users.role`):

- OWNER-only modules:
  - Inventory Insights (`/admin/analytics`)
  - Inventory (`/admin/products`)
  - Categories (`/admin/categories`)
  - Import (`/admin/import`)
  - Team (`/admin/team`)
- OWNER + STAFF modules:
  - POS (`/admin/pos`)
  - Stock Movement (`/admin/sales`)
  - Customers (`/admin/customers`)
  - Messages (`/admin/messages`)

The UI hides OWNER-only links for STAFF and backend middleware enforces the same restrictions.

### Shop Identity and Branding

- The top-left app brand is now shop-aware for the active shop context.
- When an active shop is selected, the header logo/name uses that shop identity instead of the static app label.
- Owners (and platform admins) can update shop identity in Profile:
  - Rename shop
  - Set logo by URL
  - Upload logo file (stored under `/uploads/...`)
- Changes are reflected immediately in client shop state and navbar branding.
- Shop slug is preserved when renaming (name-only identity update).

## 🧭 Operations Docs

- Incident runbook: `OPS_INCIDENT_PLAYBOOK.md`
- Render backend deployment: `RENDER_BACKEND_DEPLOY.md`

## ✨ Features

### Customer Features
- 🛍️ Product browsing and search
- 🛒 Shopping cart management with real-time updates
- ✅ Secure checkout with address collection
- 📦 Order history and tracking
- 🔐 User registration and authentication
- 💳 Cart count badge in navigation

### Admin Features
- 📊 Dashboard with inventory/operations summary
- 🧾 POS with receipt print and recent sales details
- 📈 Stock movement analysis and profitability views
- 👥 Team management by shop membership (OWNER/STAFF)
- 🏷️ Category and product management (OWNER-only)
- 📥 Bulk import for inventory updates (OWNER-only)
- 🔒 Shop-aware role-based access control

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express 4.19.2
- **Database**: PostgreSQL with Sequelize ORM 6.37.3
- **Authentication**: JWT (jsonwebtoken 9.0.2) + bcrypt 5.1.1
- **File Upload**: Multer 1.4.5
- **Security**: Helmet, CORS, Express Rate Limit

### Frontend
- **Framework**: Next.js 16.1.6 (App Router, Turbopack)
- **UI Library**: React 19.2.3
- **Styling**: Tailwind CSS 4
- **HTTP Client**: Axios 1.7.7
- **Animations**: Framer Motion 11.5.4
- **3D Graphics**: Three.js 0.167.1
- **State Management**: React Context API

## 📁 Project Structure

```
.
├── backend/
│   ├── src/
│   │   ├── config/          # Configuration (database, multer, env)
│   │   ├── controllers/     # Request handlers (auth, products, cart, orders)
│   │   ├── middleware/      # Auth, error handling, role checks
│   │   ├── models/          # Sequelize models (User, Product, Cart, Order, etc.)
│   │   ├── routes/          # API routes
│   │   ├── scripts/         # Database sync and seeding scripts
│   │   ├── app.js          # Express app setup
│   │   └── server.js       # Server entry point
│   ├── uploads/            # Product images storage
│   ├── .env               # Environment variables (not in git)
│   ├── .env.example       # Environment template
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── admin/      # Admin dashboard pages
    │   │   ├── account/    # User account pages
    │   │   ├── cart/       # Shopping cart page
    │   │   ├── checkout/   # Checkout flow
    │   │   ├── shop/       # Product catalog
    │   │   ├── login/      # Login page
    │   │   ├── register/   # Registration page
    │   │   └── page.tsx    # Homepage
    │   ├── components/     # Reusable React components
    │   │   ├── NavBar.tsx
    │   │   ├── AdminShell.tsx
    │   │   ├── RouteGuards.tsx
    │   │   └── ...
    │   └── lib/
    │       ├── api.ts          # Axios client with JWT interceptor
    │       ├── auth-context.tsx # Auth state management
    │       ├── cart-context.tsx # Cart state management
    │       ├── types.ts         # TypeScript types
    │       └── format.ts        # Formatting utilities
    └── package.json

```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 14+
- Git

### 1. Clone the Repository

```bash
git clone <repository-url>
cd "ELLY'Shop"
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file from example
cp .env.example .env

# Edit .env with your configuration:
# Required settings:
# - DB_HOST=localhost
# - DB_PORT=5432
# - DB_NAME=ellora_shop
# - DB_USER=postgres
# - DB_PASSWORD=your_password
# - JWT_SECRET=your-super-secret-key-here
# - ADMIN_EMAIL=admin@ellora.local
# - ADMIN_PASSWORD=*************
# - CLIENT_ORIGIN=http://localhost:3000
# - ENABLE_OFFLINE_PAYMENT_OVERRIDE=false
# - PAYMENT_OVERRIDE_APPROVERS=finance.lead@example.com

# Create PostgreSQL database
createdb ellora_shop

# Run database migrations
npm run db:migrate

# Seed admin user
npm run db:seed-admin

# Seed sample categories and products (optional)
npm run db:seed-catalog

# Start development server
npm run dev
```

Backend will run on `http://localhost:4000`

### 3. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Create .env.local file
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api" > .env.local

# Start development server
npm run dev
```

Frontend will run on `http://localhost:3000`

## 🔑 Default Credentials

After running `npm run db:seed-admin`:

**Admin Account**
- Email: `admin@ellora.local`
- Password: (as set in backend/.env ADMIN_PASSWORD)

**Test Customer** (if you run seed-catalog)
- Register a new customer account at `/register`

## 📚 API Documentation

### Base URL
```
http://localhost:4000/api
```

### Authentication
Most endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

### Endpoints

#### 🔐 Auth
- `POST /auth/register` - Register new user
  - Body: `{ name, email, password, role?: "customer" | "business", shopName?: string }`
  - Returns: `{ token, user, shops, activeShopId }`
  
- `POST /auth/login` - Login user
  - Body: `{ email, password, activeShopId? }`
  - Returns: `{ token, user, shops, activeShopId, requiresShopSelection }`
  
- `GET /auth/me` - Get current user info (requires auth)
  - Returns: `{ user: { id, name, email, role } }`

#### 👥 Shop Team Management

- `GET /shops/:shopId/members` - List shop members (OWNER-only)
- `POST /shops/:shopId/members` - Add/update member by email and role (OWNER-only)
  - Body: `{ email, role: "OWNER" | "STAFF" }`
- `DELETE /shops/:shopId/members/:userId` - Remove member (OWNER-only)

#### 🏪 Shop Identity

- `PATCH /shops/:shopId` - Update shop identity (OWNER/platform admin)
  - Body: `{ name?, logoUrl? }`
- `POST /shops/:shopId/logo` - Upload shop logo image (OWNER/platform admin)
  - Multipart field: `logo`
  - Returns: `{ logoUrl, shop, message }`

#### 🧾 POS

- `GET /pos/products` - List active products for sale (OWNER + STAFF)
- `GET /pos/products/search?q=...` - Search products by name/SKU (OWNER + STAFF)
- `POST /pos/sale` - Complete sale (OWNER + STAFF)
  - Body: `{ items: [{ productId, quantity }], note? }`
- `GET /pos/recent-sales` - Recent transaction cards (OWNER + STAFF)
- `GET /pos/recent-sales/:saleId` - Sale detail modal payload (OWNER + STAFF)

#### 📦 Products
- `GET /products` - Get product list
  - Default behavior: returns only `active` products (public-safe)
  - Optional query: `?includeAll=true` to include `draft` products for admin tooling
  - Returns: `{ products: [...] }`

- `GET /products/slug/:slug` - Get product by slug
  - Default behavior: returns only `active` products
  - Optional query: `?includeAll=true` to resolve draft products
  - Returns: `{ product }`
  
- `GET /products/:id` - Get product by ID
  
- `POST /products` - Create product (admin only)
  - Body: multipart/form-data with fields: `name`, `description`, `price`, `cost?`, `sku?`, `stock`, `status`, `categoryId`, `image?`
  
- `PATCH /products/:id` - Update product (admin only)
  - Body: multipart/form-data (same as create)
  
- `DELETE /products/:id` - Delete product (admin only)

#### 🏷️ Categories
- `GET /categories` - Get all categories
- `GET /categories/:id` - Get category by ID
- `POST /categories` - Create category (admin only)
  - Body: `{ name, slug }`
- `PATCH /categories/:id` - Update category (admin only)
- `DELETE /categories/:id` - Delete category (admin only)

#### 🛒 Cart
- `GET /cart` - Get user's cart (requires auth)
  - Returns: `{ cart, items, totals: { subtotal, items } }`
  
- `POST /cart/items` - Add item to cart (requires auth)
  - Body: `{ productId, quantity }`
  
- `PATCH /cart/items/:id` - Update cart item quantity (requires auth)
  - Body: `{ quantity }`
  
- `DELETE /cart/items/:id` - Remove cart item (requires auth)

- `POST /cart/checkout` - Checkout cart (requires auth)
  - Body: `{ shippingAddress, billingAddress }`
  - Returns: `{ order, cart }`

#### 💳 Payments
- `POST /payments/initialize` - Initialize Paystack checkout (requires auth)
  - Body: `{ orderId, callbackUrl? }`
  - Returns: `{ orderId, reference, authorizationUrl, accessCode }`

- `GET /payments/verify/:reference` - Verify payment result and update order (requires auth)
  - Returns: `{ verified, orderId, orderStatus, paymentStatus }`

- `POST /payments/webhook` - Paystack webhook (public)
  - Verifies `x-paystack-signature` using server secret

#### 📋 Orders
- `GET /orders` - Get orders (requires auth)
  - Customers receive only their own orders; admins can view all orders
  - Optional query params: `status`, `userId` (admin only), `orderId` (prefix), `from`, `to`, `page`, `limit`
  - Returns: `{ orders: [...] }` and when pagination is requested also `{ pagination: { page, limit, total, totalPages } }`
  - Included order user fields are limited to: `id`, `name`, `email`, `role`

- `GET /orders/dashboard` - Orders operations dashboard summary (admin only)
  - Returns: `{ kpis, statusCounts, thresholds }`
  - `kpis`: `totalOrdersToday`, `pendingFulfillment`, `delayedShipments`, `highValueOrders`, `riskFlaggedOrders`, `refundsAwaitingApproval`
  - `statusCounts`: aggregate counts for each dashboard status bucket
  - `thresholds`: `highValueThreshold`, `delayedShipmentDays`, `pendingRiskHours`, `refundWindowDays`
  
- `GET /orders/:id` - Get order by ID (requires auth)
  - Returns: `{ order }`
  
- `PATCH /orders/:id/status` - Update order status (admin only)
  - Body: `{ status, note, metadata? }`
  - `note` is required for manual admin actions (minimum 10 characters)
  - `status` must be a valid lifecycle state configured by the backend (examples: `pending_payment`, `paid`, `processing`, `packed`, `shipped`, `out_for_delivery`, `delivered`, `received`, `delivery_failed`, `cancelled`, `returned`, `refunded`, `fraud_hold`)

- `PATCH /orders/:id/automation-override` - Toggle automation override (admin only)
  - Body: `{ preventAutoTransition, reason?, category?, internalNote, effectiveUntil? }`
  - `internalNote` is required (minimum 10 characters)
  - When disabling automation (`preventAutoTransition=true`), `reason` is required (minimum 10 characters)

- `PATCH /orders/:id/fraud-review` - Apply fraud review action (admin only)
  - Body: `{ action, reason, internalNote, releaseStatus? }`
  - `action` supports: `hold`, `release`, `mark_reviewed`
  - `reason` and `internalNote` are required (minimum 10 characters)

- `POST /orders/:id/recheck-payment` - Manually recheck a single order payment with Paystack (admin only)
  - Body: `{ internalNote }`
  - `internalNote` is required (minimum 10 characters)
  - Uses stored payment reference from order metadata
  - Returns whether payment is verified and updates order/payment state when needed

#### 📊 Admin
- `GET /admin/summary` - Get dashboard statistics (admin only)
  - Returns: `{ users, products, orders }`

## 🔧 Environment Variables

### Backend (.env)
```env
# Server
PORT=4000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ellora_shop
DB_USER=postgres
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your-super-secret-key-change-this-in-production

# Admin Seed
ADMIN_EMAIL=admin@ellora.local
ADMIN_PASSWORD=Admin123!
ADMIN_NAME=Admin User

# CORS
CLIENT_ORIGIN=http://localhost:3000

# Payments (Paystack test mode)
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
PAYSTACK_BASE_URL=https://api.paystack.co
PAYSTACK_CALLBACK_URL=http://localhost:3000/checkout/verify
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
```

## 🧪 Paystack Sandbox Runbook

Use this checklist to fully test the payment flow end-to-end.

1. Configure backend payment env values in `backend/.env`:
```env
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
PAYSTACK_BASE_URL=https://api.paystack.co
PAYSTACK_CALLBACK_URL=http://localhost:3000/checkout/verify
```

2. Restart backend after updating env:
```bash
cd backend
npm run dev
```

3. Start frontend:
```bash
cd frontend
npm run dev
```

4. Expose backend publicly for webhook testing (local dev):
```bash
ngrok http 4000
```

5. Set Paystack test webhook URL in your dashboard to:
```text
https://<your-ngrok-domain>/api/payments/webhook
```

6. Test the full flow:
- Add items to cart and checkout
- Complete Paystack test payment
- Confirm redirect to `/checkout/verify`
- Confirm order transitions to `paid` (or remains `fraud_hold` if flagged)
- Confirm `order.metadata.payment` is populated with provider/status/reference

7. Payment retry support is available for pending orders:
- `Account -> Orders` list (`Pay Now`)
- `Account -> Order Details` (`Pay Now`)
- `Order Confirmation` (`Complete Payment`)

Note: Current integration uses server-side transaction initialization + hosted redirect and does not require exposing Paystack public key in frontend.

## 💻 Development Scripts

### Backend
```bash
npm run dev              # Start with nodemon (auto-reload)
npm start                # Start production server
npm run db:migrate       # Run database migrations
npm run db:seed-admin    # Create admin user
npm run db:seed-catalog  # Seed sample categories and products
```

### Frontend
```bash
npm run dev          # Start development server (Turbopack)
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Run ESLint
```

## 🗄️ Database Schema

### Users
- `id` (UUID, PK)
- `name` (String)
- `email` (String, unique)
- `passwordHash` (String)
- `role` (enum: customer, admin)
- `createdAt`, `updatedAt`

### Categories
- `id` (UUID, PK)
- `name` (String)
- `slug` (String, unique)
- `createdAt`, `updatedAt`

### Products
- `id` (UUID, PK)
- `name` (String)
- `slug` (String)
- `description` (Text)
- `price` (Decimal)
- `sku` (String)
- `stock` (Integer)
- `status` (enum: active, draft)
- `imageUrl` (String)
- `CategoryId` (UUID, FK → Categories)
- `createdAt`, `updatedAt`

### Carts
- `id` (UUID, PK)
- `UserId` (UUID, FK → Users)
- `status` (enum: open, converted)
- `createdAt`, `updatedAt`

### CartItems
- `id` (UUID, PK)
- `CartId` (UUID, FK → Carts)
- `ProductId` (UUID, FK → Products)
- `quantity` (Integer)
- `unitPrice` (Decimal)
- `createdAt`, `updatedAt`

### Orders
- `id` (UUID, PK)
- `UserId` (UUID, FK → Users)
- `status` (enum: pending_payment, paid, processing, packed, shipped, out_for_delivery, delivered, received, delivery_failed, cancelled, returned, refunded, fraud_hold, plus legacy compatibility states pending, delivery_pickup, fulfilled)
- `total` (Decimal)
- `currency` (String, default: USD)
- `shippingAddress` (Text)
- `billingAddress` (Text)
- `createdAt`, `updatedAt`

### OrderItems
- `id` (UUID, PK)
- `OrderId` (UUID, FK → Orders)
- `ProductId` (UUID, FK → Products)
- `quantity` (Integer)
- `unitPrice` (Decimal)
- `createdAt`, `updatedAt`

## 🔒 Security Features

- 🔐 **Password Hashing**: bcrypt with 10 salt rounds
- 🎟️ **JWT Authentication**: Secure token-based auth
- 🛡️ **HTTP Security**: Helmet.js for security headers
- 🚦 **Rate Limiting**: 300 requests per minute per IP
- 🔒 **Role-Based Access**: Admin and customer roles
- 🌐 **CORS**: Configured for allowed origins
- ✅ **Input Validation**: Server-side validation
- 🔍 **SQL Injection Protection**: Sequelize ORM parameterized queries

## 🎨 Frontend Features

### Context Providers
- **AuthContext**: Global authentication state, login/logout
- **CartContext**: Shopping cart state, real-time count updates

### Route Guards
- **ProtectedRoute**: Requires authentication
- **AdminRoute**: Requires admin role

### Protected Pages
- Admin dashboard and all admin routes (admin only)
- Cart, checkout, order confirmation (authenticated users)
- Account pages (authenticated users)

### Public Pages
- Homepage with featured products
- Shop page (product catalog)
- Login and registration

## 🚀 Deployment

### Backend Deployment (Heroku/Railway/Render)
1. Set environment variables:
   - `NODE_ENV=production`
   - `DATABASE_URL` (PostgreSQL connection string)
   - `JWT_SECRET` (strong random string)
   - `CLIENT_ORIGIN` (frontend production URL)
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`

2. Build and deploy:
   ```bash
   npm install --production
  npm run db:migrate
   npm run db:seed-admin
   npm start
   ```

### Frontend Deployment
1. Set environment variable:
  - `NEXT_PUBLIC_API_BASE_URL` (production API URL)

2. Build frontend:
  ```bash
  npm run build
  ```

3. Start frontend in production mode:
  ```bash
  npm run start
  ```

## 🐛 Troubleshooting

### Backend Issues

**Server won't start**
- ✅ Verify PostgreSQL is running: `pg_isready`
- ✅ Check database credentials in `.env`
- ✅ Ensure database exists: `createdb ellora_shop`
- ✅ Run database migrations: `npm run db:migrate`

**JWT errors**
- ✅ Check `JWT_SECRET` is set in `.env`
- ✅ Ensure token is being sent with requests

**Image upload fails**
- ✅ Verify `backend/uploads` directory exists
- ✅ Check file size limits (default 5MB)
- ✅ Ensure only image MIME types are uploaded

### Frontend Issues

**Cannot connect to API**
- ✅ Verify backend is running on port 4000
- ✅ Check `NEXT_PUBLIC_API_BASE_URL` in `.env.local`
- ✅ Verify CORS `CLIENT_ORIGIN` in backend `.env`

**Route guards redirect immediately**
- ✅ Clear localStorage and login again
- ✅ Check JWT token validity
- ✅ Verify `/auth/me` endpoint returns user data

**Cart count not updating**
- ✅ Ensure user is logged in
- ✅ Check cart context provider is wrapping the app
- ✅ Verify cart API endpoints are working

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues or questions, please open an issue on GitHub.

---

**Built with ❤️ using Next.js, React, Node.js, and PostgreSQL**
