# Ellora Supply

A full-stack ecommerce web app with a customer storefront and admin dashboard.

## Tech Stack

Frontend: Next.js, React, Tailwind CSS, Framer Motion, Three.js, Axios
Backend: Node.js, Express, Sequelize, JWT, bcrypt, multer, PostgreSQL

## Setup

### Backend

1) Copy backend/.env.example to backend/.env and set your values.
2) Install dependencies:
   - Run: npm.cmd install (from the backend folder)
3) Sync the database:
   - Run: npm.cmd run db:sync
4) Create an admin user:
   - Run: npm.cmd run db:seed-admin
5) Start the API:
   - Run: npm.cmd run dev

### Frontend

1) Copy frontend/.env.example to frontend/.env and set your values.
2) Install dependencies:
   - Run: npm.cmd install (from the frontend folder)
3) Start the app:
   - Run: npm.cmd run dev

## Key Routes

API base: http://localhost:4000/api

Auth: POST /auth/register, POST /auth/login, GET /auth/me
Catalog: GET /products, GET /products/:id, GET /categories
Cart: GET /cart, POST /cart/items, PATCH /cart/items/:id, DELETE /cart/items/:id
Checkout: POST /cart/checkout
Orders: GET /orders, GET /orders/:id, PATCH /orders/:id/status
Admin summary: GET /admin/summary

## Notes

- Add product images by uploading a file with the `image` field to /products.
- Admin-only routes require a JWT with role=admin.
