# Complete Deployment Prompt for ChatGPT
## Deploy UNPAA Inventory System to Neon + Render + Vercel (Assume Nothing is Set Up)

---

## PROJECT OVERVIEW

**Project Name**: UNPAA Inventory System (Elora)  
**Tech Stack**: 
- Frontend: Next.js 16 (React 19) deployed on Vercel
- Backend: Express.js (Node 20) deployed on Render
- Database: PostgreSQL 14+ deployed on Neon
- Authentication: JWT tokens with bcrypt hashing

**GitHub Repository**: (User will provide)  
**Project Structure**:
```
.
├── frontend/              # Next.js app (Vercel deployment target)
│   ├── src/app/          # Next.js pages and routes
│   ├── package.json      # Frontend deps (Next.js, React, Axios, TailwindCSS)
│   └── next.config.ts    # Next.js config
│
├── backend/              # Express.js API (Render deployment target)
│   ├── src/
│   │   ├── app.js        # Express app setup
│   │   ├── server.js     # Server entry point
│   │   ├── routes/       # API route definitions
│   │   ├── controllers/  # Business logic
│   │   ├── models/       # Sequelize ORM models
│   │   ├── middleware/   # Auth, CORS, error handlers
│   │   ├── config/       # Environment and database config
│   │   └── scripts/      # Migration and seeding scripts
│   ├── package.json      # Backend deps (Express, Sequelize, bcrypt, JWT)
│   └── uploads/          # User file uploads (created at runtime)
│
└── render.yaml           # Render deployment manifest (backend config)
```

---

## FRONTEND PAGES (Next.js Routes)

### Public Pages (no auth required):
- `/` — Homepage with featured products
- `/login` — User login
- `/register` — User registration
- `/shop` — Product catalog/shop page
- `/shop/[slug]` — Individual product detail page

### Admin Pages (auth required, role-based):
- `/admin` — Admin dashboard overview
- `/admin/products` — Product management (CRUD)
- `/admin/categories` — Category management
- `/admin/stock-ledger` — Inventory tracking
- `/admin/stock-requests` — View and approve/reject stock requests (OWNER/ADMIN only)
- `/admin/stock-requests/request` — Create stock request (STAFF only)
- `/admin/sales` — Sales/orders management
- `/admin/pos` — Point-of-sale system
- `/admin/analytics` — Business analytics
- `/admin/team` — Team member management
- `/admin/import` — CSV import tool

### Customer Pages (auth required):
- `/account/profile` — Customer profile

---

## BACKEND API ENDPOINTS

All endpoints prefixed with `/api` (base: `http://backend-url/api`)

### Authentication (`/auth`)
- `POST /auth/register` — Create new user account
- `POST /auth/login` — Login and receive JWT token
- `GET /auth/me` — Get current user info (requires JWT)

### Products (`/products`)
- `GET /products` — List all products
- `GET /products/public` — List active products (public)
- `POST /products` — Create product (admin)
- `PATCH /products/:id` — Update product (admin)
- `DELETE /products/:id` — Delete product (admin)

### Categories (`/categories`)
- `GET /categories` — List categories
- `POST /categories` — Create category (admin)
- `PATCH /categories/:id` — Update category (admin)

### Stock Requests (`/stock-requests`)
- `POST /stock-requests` — Create stock request (staff only)
- `GET /stock-requests` — List requests (staff see own, admin see all)
- `PATCH /stock-requests/:id/approve` — Approve request (admin)
- `PATCH /stock-requests/:id/reject` — Reject request (admin)

### Admin (`/admin`)
- `POST /admin/bulk-update-prices` — Update prices in bulk
- `POST /admin/bulk-update-categories` — Update categories in bulk
- `POST /admin/bulk-update-stock` — Update stock in bulk
- `POST /admin/bulk-update-status` — Update product status in bulk
- `POST /admin/bulk-delete` — Delete products in bulk

### POS (`/pos`)
- `POST /pos/sales` — Record a sale/transaction
- `GET /pos/sales` — List sales
- `GET /pos/sales/:id` — Get sale details

### Shops (`/shops`)
- `GET /shops` — List user's shops
- `POST /shops` — Create new shop (admin)

### Other
- `GET /health` — Health check (returns `{ status: "ok" }`)
- `GET /` — Root endpoint (returns `"API is running"`)

---

## DATABASE (PostgreSQL on Neon)

The backend automatically creates all tables on first deployment. No manual SQL needed.

### Key Tables Created:
- `users` — User accounts (email, password hash, role)
- `shops` — Multi-tenant shop data
- `user_shops` — User membership in shops (role: OWNER/STAFF/ADMIN)
- `products` — Product catalog
- `categories` — Product categories
- `product_variants` — Product variants (color, size, etc.)
- `stock_requests` — Staff stock requests to admins
- `inventory_lots` — Lot tracking for FIFO stock management
- `orders` — Customer orders
- `cart_items` — Shopping cart items
- `messages` — Customer/admin messaging
- And ~15 more supporting tables

**Connection String Format**:
```
postgresql://user:password@host:port/dbname?sslmode=require
```

---

## ENVIRONMENT VARIABLES

### Neon (No direct env vars — just create a free project and get connection string)

### Backend (Render)
**Required**:
- `DATABASE_URL` — PostgreSQL connection string from Neon
- `JWT_SECRET` — Strong random string (e.g., 32+ chars, mix of alphanumeric/symbols)
- `CLIENT_ORIGIN` — Frontend URL (e.g., `https://your-frontend.vercel.app`)
- `ADMIN_EMAIL` — Initial admin email (e.g., `admin@example.com`)
- `ADMIN_PASSWORD` — Initial admin password (will be hashed)
- `ADMIN_NAME` — Initial admin name

**Optional** (default provided):
- `NODE_ENV` — Set to `production` (Render uses this by default)
- `NODE_VERSION` — Use `20` (Render uses this by default)
- `JWT_EXPIRES_IN` — JWT expiration (default: `7d`)
- `DB_SSL` — Set to `true` (Neon requires SSL)
- `PORT` — Server port (default: `4000`, Render auto-assigns)
- `PAYSTACK_SECRET_KEY` — Payment gateway key (optional)
- `OPENAI_API_KEY` — AI features key (optional)

### Frontend (Vercel)
**Required**:
- `NEXT_PUBLIC_API_BASE_URL` — Backend API URL (e.g., `https://your-backend.onrender.com/api`)
  - **Note**: Must include `/api` suffix
  - **Must be public** (prefixed with `NEXT_PUBLIC_`)

---

## STEP-BY-STEP DEPLOYMENT WORKFLOW

### Phase 1: Create Database on Neon

1. Go to https://console.neon.tech
2. **Sign up** (free account)
3. Create a new **Project** (give it a name, e.g., "elora-inventory")
4. Wait for project to initialize (~30 sec)
5. Go to **SQL Editor** or **Connection String** section
6. Copy the full PostgreSQL connection string:
   ```
   postgresql://neondb_owner:PASSWORD@HOST:5432/neondb?sslmode=require
   ```
7. **Save this string** — you'll need it for Render

### Phase 2: Deploy Backend on Render

1. Go to https://render.com
2. **Sign up** (free account, or use GitHub sign-in)
3. Click **New +** → **Web Service**
4. **Select your repository**:
   - Connect your GitHub account
   - Find and select the repository
5. Configure the service:
   - **Name**: `ellyshop-backend` (or any name)
   - **Environment**: Select `Node`
   - **Build Command**: `npm install && npm run db:migrate`
   - **Start Command**: `npm start`
   - **Root Directory**: `backend` (important!)
6. Select **Free** plan
7. Click **Create Web Service** (don't deploy yet)
8. Once created, go to **Environment** tab
9. Add these environment variables **one by one**:
   - `DATABASE_URL` = (paste Neon connection string from Phase 1)
   - `JWT_SECRET` = (generate a random string, e.g., `$(openssl rand -base64 32)`)
   - `CLIENT_ORIGIN` = (leave blank for now, set later after Vercel deploys)
   - `ADMIN_EMAIL` = `admin@example.com`
   - `ADMIN_PASSWORD` = `change-me` (or your choice)
   - `ADMIN_NAME` = `Admin`
   - `NODE_ENV` = `production`
   - `NODE_VERSION` = `20`
10. Click **Save**
11. Render auto-deploys. **Wait for build to complete** (~3-5 min). Check logs for success.
12. Once deployed, go to **Settings** → copy your backend URL (e.g., `https://ellyshop-backend.onrender.com`)
13. **Update `CLIENT_ORIGIN`** environment variable:
    - Edit `CLIENT_ORIGIN` = `https://your-vercel-frontend-url.vercel.app` (do this after Vercel is deployed, or use Render URL as placeholder for now)

### Phase 3: Deploy Frontend on Vercel

1. Go to https://vercel.com
2. **Sign up** (free account, recommend GitHub sign-in)
3. Click **New Project** → **Import Git Repository**
4. Select your repository
5. Configure:
   - **Root Directory**: `frontend`
   - **Framework**: `Next.js` (auto-detected)
   - **Build Command**: `npm run build`
   - **Install Command**: `npm install`
   - **Output Directory**: `.next`
6. **Environment Variables**:
   - Add `NEXT_PUBLIC_API_BASE_URL` = `https://your-backend-url.onrender.com/api`
     - Replace `your-backend-url` with the actual Render backend URL from Phase 2
     - **Must include `/api` at the end**
7. Click **Deploy**
8. **Wait for build to complete** (~2-3 min). Check logs for success.
9. Once deployed, copy your **Vercel frontend URL** (e.g., `https://your-project.vercel.app`)
10. **Go back to Render** and update `CLIENT_ORIGIN` environment variable:
    - Set it to your Vercel frontend URL
    - Render will auto-redeploy

### Phase 4: Verify Deployments

1. **Backend Health Check**:
   - Visit: `https://your-backend.onrender.com/`
   - Should see: `"API is running"`
   - Visit: `https://your-backend.onrender.com/health`
   - Should see: `{ "status": "ok" }`

2. **Frontend**:
   - Visit: `https://your-project.vercel.app/`
   - Should see homepage with products
   - Check browser console for errors (F12)

3. **Login Test**:
   - Go to `/login`
   - Email: `admin@example.com`
   - Password: (whatever you set as `ADMIN_PASSWORD` in Render)
   - Should succeed and redirect to dashboard

4. **API Communication**:
   - In browser console, check network tab
   - Requests should go to your Render backend URL
   - No CORS errors

---

## COMMON MISTAKES TO AVOID

1. **Missing `/api` in `NEXT_PUBLIC_API_BASE_URL`**
   - ❌ `https://backend.onrender.com`
   - ✅ `https://backend.onrender.com/api`

2. **Wrong `CLIENT_ORIGIN` on Render**
   - This causes CORS errors when frontend tries to call backend
   - Must be exact Vercel frontend URL

3. **DATABASE_URL with wrong format**
   - Must include `?sslmode=require` for Neon
   - Password special characters must be URL-encoded

4. **Forgetting to set `JWT_SECRET`**
   - Backend will start but login will fail
   - Generate a random secure string

5. **Deploying backend without `root backend` set**
   - Render won't find the backend code

6. **Not waiting for migrations to complete**
   - Render runs `npm run db:migrate` during build
   - If it fails, app won't start

---

## ENVIRONMENT VARIABLE CHEAT SHEET

Copy-paste these into each platform:

### Neon
```
No environment variables needed. Just create a project and get the connection string.
```

### Render
```
DATABASE_URL=postgresql://neondb_owner:PASSWORD@HOST/neondb?sslmode=require
JWT_SECRET=YOUR_RANDOM_SECURE_STRING_HERE_32_CHARS_MIN
CLIENT_ORIGIN=https://your-vercel-frontend.vercel.app
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me
ADMIN_NAME=Admin
NODE_ENV=production
NODE_VERSION=20
DB_SSL=true
JWT_EXPIRES_IN=7d
```

### Vercel
```
NEXT_PUBLIC_API_BASE_URL=https://your-backend.onrender.com/api
```

---

## POST-DEPLOYMENT TESTING CHECKLIST

- [ ] Backend `/health` returns `{ status: "ok" }`
- [ ] Frontend homepage loads
- [ ] Login works with admin credentials
- [ ] Can view products/categories
- [ ] Can create new product (as admin)
- [ ] Can add item to cart
- [ ] No CORS errors in browser console
- [ ] Vercel logs show no build errors
- [ ] Render logs show database connection successful
- [ ] Network requests in DevTools go to correct backend URL

---

## TROUBLESHOOTING COMMON DEPLOYMENT ISSUES

### Backend won't start / Render shows "Failed to compile"
- Check Render logs for database connection errors
- Verify `DATABASE_URL` is correct (copy directly from Neon)
- Verify `JWT_SECRET` is set (non-empty string)
- Check build command completed successfully

### Frontend shows "Cannot connect to API" or network errors
- Verify `NEXT_PUBLIC_API_BASE_URL` in Vercel env vars (including `/api`)
- Check Render backend is running (visit health endpoint)
- Check Render logs for CORS errors
- Verify `CLIENT_ORIGIN` on Render matches Vercel URL exactly

### Login fails but backend is running
- Check `ADMIN_EMAIL` and `ADMIN_PASSWORD` match what you set in Render
- Check Render logs for database errors
- Clear browser cache and localStorage
- Try logging in again

### Neon connection errors ("password authentication failed")
- Copy the connection string directly from Neon console (don't type it)
- Verify special characters in password are URL-encoded
- Check Neon project is "ready" status (not suspended/paused)

---

## NEXT STEPS AFTER DEPLOYMENT

1. Create test accounts (register via frontend)
2. Create test products/categories
3. Test full checkout flow
4. Monitor Render/Vercel logs daily
5. Set up Neon backups (free tier has automatic daily backups)

---

## SUPPORT & DOCUMENTATION LINKS

- Neon: https://docs.neon.tech
- Render: https://render.com/docs
- Vercel: https://vercel.com/docs
- Next.js: https://nextjs.org/docs
- Express: https://expressjs.com

---

## FINAL NOTES

- **Free tier limitations**: Render free tier sleeps after 15 min inactivity (slow first request). Upgrade to paid for always-on.
- **Database backups**: Neon free tier includes daily automatic backups. You can restore anytime.
- **Edge cases**: If you have custom payment providers (Paystack), provide those API keys in Render env vars.
- **AI features**: If you use OpenAI features, set `OPENAI_API_KEY` in Render.

---

**Ready to deploy? Start with Phase 1 (Neon), then Phase 2 (Render), then Phase 3 (Vercel).**
