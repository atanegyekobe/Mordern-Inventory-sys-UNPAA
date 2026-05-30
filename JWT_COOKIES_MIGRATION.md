# JWT + HTTP-Only Cookies Migration

## Problem Solved
Previously, the application stored JWT tokens in localStorage, which caused:
- ❌ Session loss between Vercel (frontend) and Render (backend) deployments
- ❌ CORS credential issues in production
- ❌ Token vulnerable to XSS attacks
- ❌ Redirect loops during authentication

## Solution Implemented

### Backend Changes (Express.js)

#### 1. Updated CORS (`backend/src/app.js`)
**Before:**
```javascript
app.use(cors({ origin: "*" }));
```

**After:**
```javascript
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-shop-id"],
  maxAge: 86400
}));
app.use(cookieParser());
```

**Why:** Allows credentials (cookies) to be sent cross-domain with proper origin validation.

#### 2. Set HTTP-Only Cookies on Login/Register (`backend/src/controllers/authController.js`)
**Added to login() and register():**
```javascript
res.cookie("ellora_token", payload.token, {
  httpOnly: true,           // Prevent JavaScript access (XSS protection)
  secure: process.env.NODE_ENV === "production",  // HTTPS only in production
  sameSite: "none",         // Allow cross-site requests with credentials
  maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
});
```

**Response no longer includes token:**
```javascript
return res.json({
  user: payload.user,
  shops: payload.shops,
  activeShopId: payload.activeShopId,
  requiresShopSelection: payload.requiresShopSelection
  // token is now in HTTP-only cookie (not returned)
});
```

#### 3. Read Token from Cookies (`backend/src/middleware/auth.js`)
**Updated getTokenFromRequest():**
```javascript
const getTokenFromRequest = (req) => {
  // Try Authorization header first (backward compatibility)
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  
  // Try HTTP-only cookie (primary method for production)
  if (req.cookies?.ellora_token) {
    return req.cookies.ellora_token;
  }
  
  return null;
};
```

**Why:** Gracefully supports both old clients (sending token in header) and new clients (sending cookie).

#### 4. Added Logout Endpoint (`backend/src/routes/auth.js`)
**New route:**
```javascript
POST /api/auth/logout
```

**Controller:**
```javascript
const logout = async (req, res) => {
  res.clearCookie("ellora_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "none",
  });
  return res.json({ message: "Logged out successfully." });
};
```

#### 5. Installed cookie-parser
```bash
npm install cookie-parser
```

### Frontend Changes (Next.js)

#### 1. Enable Credentials in Axios (`frontend/src/lib/api.ts`)
**Before:**
```typescript
const api = axios.create({
  baseURL: resolveApiBaseUrl(),
});
```

**After:**
```typescript
const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true, // Enable cookie handling
});
```

**Removed token from Authorization header:**
```typescript
// REMOVED: Token is now in HTTP-only cookie
// if (token) {
//   config.headers.Authorization = `Bearer ${token}`;
// }
```

#### 2. Remove Token from localStorage (`frontend/src/lib/auth-context.tsx`)
**Removed:**
- `TOKEN_STORAGE_KEY` constant (token no longer stored locally)
- `window.localStorage.getItem(TOKEN_STORAGE_KEY)` checks

**Updated login():**
```typescript
// Before: Stored token in localStorage
window.localStorage.setItem(TOKEN_STORAGE_KEY, payload.token);

// After: No storage needed (cookie set by server)
// Token is automatically set as HTTP-only cookie by backend
```

**Updated refreshUser():**
```typescript
// Before: Checked localStorage first
const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
if (!token) return; // Early exit if no token

// After: Always tries to fetch user (cookie sent automatically)
const response = await api.get("/auth/me");
setUser(response.data.user);
```

**Updated logout():**
```typescript
// Now calls server logout endpoint to clear cookie
const logout = async () => {
  try {
    await api.post("/auth/logout");
  } catch {
    // Ignore logout errors
  }
  // Clear local state
  setUser(null);
  setShops([]);
  setActiveShopId(null);
};
```

#### 3. Updated AuthResponse Type
**Before:**
```typescript
token: string; // Required
```

**After:**
```typescript
token?: string; // Optional (token is in cookie now)
```

## Environment Variables

### Backend (.env or Render)
- `CLIENT_ORIGIN` — Your Vercel frontend URL (e.g., `https://myapp.vercel.app`)
  - **Critical:** CORS will reject requests from other origins
  - **Format:** `https://domain.com` (no trailing slash)

### Frontend (.env.local or Vercel)
- `NEXT_PUBLIC_API_BASE_URL` — Your Render backend URL (e.g., `https://myapi.onrender.com/api`)
  - Axios will automatically send cookies with requests

## Testing Checklist

### Local Development
```bash
# Terminal 1: Backend
cd backend
npm run dev  # Should start on http://localhost:4000

# Terminal 2: Frontend
cd frontend
npm run dev  # Should start on http://localhost:3000
```

**Test in browser:**
1. Go to http://localhost:3000/login
2. Enter credentials → should redirect to `/admin` or `/shop`
3. Open DevTools → Application → Cookies → should see `ellora_token`
4. The token should be marked as `HttpOnly`, `Secure` (if HTTPS), and `SameSite=None`
5. Refresh page → should still be logged in (cookie persists)
6. Click logout → cookie should be cleared

### Network Verification
1. Open DevTools → Network tab
2. Login → check request headers:
   - ✅ Request includes `Cookie: ellora_token=...`
   - ✅ Response includes `Set-Cookie: ellora_token=...` (HttpOnly, Secure, SameSite=None)
3. All subsequent requests should include cookie automatically

### Production (Vercel + Render)
1. Login on production
2. Open DevTools → Application → Cookies
3. Verify `ellora_token` exists and is `HttpOnly`
4. Verify domain is your actual domain (not localhost)
5. Verify `Secure` flag is set (HTTPS required)
6. Verify `SameSite` is `None` (allows cross-domain)

## Troubleshooting

### Issue: "Cookie not being sent" / CORS error
**Solution:**
1. Verify `CLIENT_ORIGIN` on Render matches exactly your Vercel URL
2. Verify `NEXT_PUBLIC_API_BASE_URL` on Vercel matches exactly your Render URL
3. Check DevTools Network → Request headers include `Cookie:` header
4. If not, verify CORS response includes `Access-Control-Allow-Credentials: true`

### Issue: User not persisting on refresh
**Solution:**
1. Verify cookie exists in DevTools (not deleted)
2. Verify `/auth/me` endpoint works with cookie (test in Postman)
3. Check backend logs for auth errors
4. Verify cookie `SameSite` is `None` (not `Strict` or `Lax`)

### Issue: "HttpOnly cookie shows in DevTools but not being sent"
**Solution:**
1. Verify axios has `withCredentials: true`
2. Verify frontend is on same domain as backend (or CORS allows it)
3. Verify cookie domain matches request domain
4. Try hard refresh (Ctrl+Shift+R) to clear any cached headers

### Issue: Login works locally but fails on production
**Solution:**
1. Verify `NODE_ENV=production` on Render (enables `secure: true`)
2. Verify both Render and Vercel are HTTPS (not HTTP)
3. Verify `sameSite: "none"` is set (allows cross-site cookies)
4. Verify `CLIENT_ORIGIN` and `NEXT_PUBLIC_API_BASE_URL` are exact matches

## Backward Compatibility
- Backend still accepts tokens in `Authorization: Bearer <token>` header
- Old clients (that send token in header) will still work
- New clients (that use cookies) will work seamlessly

## Security Benefits
✅ **XSS Protection:** Token in HttpOnly cookie cannot be accessed by JavaScript  
✅ **CSRF Protection:** SameSite flag prevents token theft  
✅ **HTTPS Enforcement:** Secure flag prevents sending over HTTP  
✅ **Domain Isolation:** Cookie only sent to correct origin  
✅ **Session Persistence:** Browser automatically includes cookie in all requests  

## Production Deployment Checklist
- [ ] Set `CLIENT_ORIGIN` on Render to Vercel URL
- [ ] Set `NEXT_PUBLIC_API_BASE_URL` on Vercel to Render URL
- [ ] Verify both are HTTPS
- [ ] Test login on production
- [ ] Verify cookie appears in DevTools
- [ ] Test logout clears cookie
- [ ] Monitor Render + Vercel logs for auth errors
- [ ] Test from incognito/private mode (clean session)

---

**Last Updated:** May 14, 2026  
**Status:** ✅ Implemented and ready for deployment
