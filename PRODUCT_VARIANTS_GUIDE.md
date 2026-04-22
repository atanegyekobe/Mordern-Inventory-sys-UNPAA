# Product Variants System - Implementation Guide

## Overview

The Product Variants system allows a single product to have multiple variations (e.g., different sizes, colors, styles) with unique pricing, stock levels, and SKUs. This eliminates product duplication while providing flexible inventory management.

## Current Process Notes (April 2026)

- Product and variant management is OWNER-only in admin.
- STAFF users can sell variants through operational flows (POS/sales visibility) but should not modify catalog structure.
- Shop context is required for all variant operations (`x-shop-id` via authenticated session).

## Database Schema

### ProductVariant Model

Located in `backend/src/models/ProductVariant.js`

```javascript
{
  id: UUID (primary key),
  ProductId: UUID (foreign key to Product),
  attributes: JSON { size: "M", color: "Red", ... },
  sku: STRING (optional, variant-specific SKU),
  price: DECIMAL (optional, null = use parent price),
  stock: INTEGER (variant-specific stock count),
  imageUrl: STRING (optional, variant-specific image),
  status: ENUM ('active', 'inactive'),
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP
}
```

### Relationships

```
Product (1) ----< ProductVariant (Many)
  - Product.hasMany(ProductVariant)
  - ProductVariant.belongsTo(Product)
  - onDelete: CASCADE (deleting product deletes its variants)
```

## API Endpoints

### Base URL: `/api/products/:productId/variants`

#### Create Variant
```
POST /api/products/:productId/variants
Authorization: Bearer {owner_token}

Request Body:
{
  "attributes": { "size": "M", "color": "Red" },
  "sku": "PROD-SKU-001",
  "price": 29.99,
  "stock": 50,
  "imageUrl": "/uploads/variant-image.jpg"
}

Response (201):
{
  "variant": {
    "id": "uuid",
    "ProductId": "uuid",
    "attributes": { "size": "M", "color": "Red" },
    "sku": "PROD-SKU-001",
    "price": "29.99",
    "stock": 50,
    "imageUrl": "/uploads/variant-image.jpg",
    "status": "active",
    "createdAt": "2026-02-28T...",
    "updatedAt": "2026-02-28T..."
  }
}
```

#### Get All Variants for Product
```
GET /api/products/:productId/variants

Response (200):
{
  "variants": [
    {
      "id": "uuid",
      "ProductId": "uuid",
      "attributes": { "size": "M", "color": "Red" },
      "sku": "PROD-001",
      "price": "29.99",
      "stock": 50,
      ...
    },
    ...
  ]
}
```

#### Get Single Variant
```
GET /api/products/:productId/variants/:variantId

Response (200):
{
  "variant": {
    "id": "uuid",
    "ProductId": "uuid",
    "attributes": { "size": "M", "color": "Red" },
    ...
    "Product": {
      "id": "uuid",
      "name": "T-Shirt",
      "price": "25.00"
    }
  }
}
```

#### Update Variant
```
PATCH /api/products/:productId/variants/:variantId
Authorization: Bearer {owner_token}

Request Body (all fields optional):
{
  "attributes": { "size": "L", "color": "Blue" },
  "sku": "PROD-002",
  "price": 34.99,
  "stock": 45,
  "imageUrl": "/uploads/new-image.jpg",
  "status": "inactive"
}

Response (200):
{
  "variant": { ... }
}
```

#### Update Variant Stock
```
PATCH /api/products/:productId/variants/:variantId/stock
Authorization: Bearer {owner_token}

Request Body:
{
  "operation": "add" | "subtract" | "set",
  "value": 10
}

Examples:
- { "operation": "add", "value": 5 } → +5 units
- { "operation": "subtract", "value": 3 } → -3 units (floors to 0)
- { "operation": "set", "value": 100 } → set to 100

Response (200):
{
  "variant": { ... },
  "message": "Variant stock updated to 55"
}
```

#### Delete Variant
```
DELETE /api/products/:productId/variants/:variantId
Authorization: Bearer {owner_token}

Response (200):
{
  "message": "Variant deleted successfully"
}
```

## Frontend Usage

### VariantManager Component

Located in `frontend/src/components/VariantManager.tsx`

```tsx
import VariantManager from "@/components/VariantManager";

<VariantManager
  productId="uuid"
  variants={product.ProductVariants || []}
  parentPrice={product.price}
  onVariantsChange={(variants) => handleVariantsUpdated(variants)}
/>
```

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `productId` | string | UUID of the parent product |
| `variants` | ProductVariant[] | Array of existing variants |
| `parentPrice` | number | Default product price (used if variant has no price) |
| `onVariantsChange` | (variants: ProductVariant[]) => void | Callback when variants are modified |

### Features

- **Add Variants**: Create new size/color/attribute combinations
- **Dynamic Attributes**: Add custom attribute keys (size, color, material, etc.)
- **Flexible Pricing**: Override parent price or inherit it
- **Stock Management**: Track variant-specific inventory
- **Variant SKUs**: Optional variant-specific SKUs for warehouse tracking
- **Edit/Delete**: Modify or remove variants individually

### Example: Adding a Variant

```tsx
// In VariantManager:
// 1. Click "Add variant"
// 2. Set attributes: Size = "M", Color = "Red"
// 3. Set SKU: "TSHIRT-M-RED"
// 4. Stock: 50
// 5. Use parent price: Yes (inherits $25.00)
// 6. Click "Create variant"
```

## Data Types

### ProductVariant Type
```typescript
type ProductVariant = {
  id: string;
  ProductId: string;
  attributes: Record<string, string | number>; // e.g., { size: "M", color: "Red" }
  sku?: string | null;
  price?: string | number | null;
  stock: number;
  imageUrl?: string | null;
  status: "active" | "inactive";
  createdAt?: string;
  updatedAt?: string;
};
```

### Product Type (Updated)
```typescript
type Product = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  price: string | number;
  sku?: string | null;
  stock: number;
  status: "active" | "draft";
  imageUrl?: string | null;
  Category?: Category;
  CategoryId?: string;
  ProductVariants?: ProductVariant[];
};
```

## Business Logic

### Price Resolution
1. When a variant has a price: use variant-specific price
2. When a variant has no price: inherit parent product price
3. For display: show variant price if available, else parent price

### Stock Management
- Each variant has independent stock tracking
- Parent product stock is the sum of all variant stocks (for reporting)
- When creating a variant, set its initial stock separately
- Stock operations: add, subtract, set

### Variant Attributes
- Flexible JSON-based attributes system
- Common attributes: size, color, material, style
- Custom attributes can be added by user
- All attributes are required when creating a variant

### Status
- Variants can be individually enabled/disabled
- `active`: Available for purchase
- `inactive`: Hidden from storefronts

## Admin Interface Integration

### Product Create/Edit Form
When editing a product:
1. Fill in basic product details
2. Scroll down to "Product Variants" section
3. Add variants using VariantManager component
4. Variants are managed separately from product save

### Bulk Edit Limitations
- Bulk edit operations on products don't affect variants
- Variants must be managed individually
- Consider adding variant bulk operations in future releases

## Example Workflows

### Workflow 1: Add T-Shirt Variants
```
Product: "Classic T-Shirt"
Price: $25.00
Stock: 200 (sum of all variants)

Variants:
1. Size=S, Color=Red → SKU: TS-S-RED → Stock: 50 → Price: $25.00
2. Size=M, Color=Red → SKU: TS-M-RED → Stock: 60 → Price: $25.00
3. Size=L, Color=Red → SKU: TS-L-RED → Stock: 40 → Price: $25.00
4. Size=M, Color=Blue → SKU: TS-M-BLU → Stock: 50 → Price: $25.00
```

### Workflow 2: Premium Variant with Different Price
```
Product: "Polo Shirt"
Price: $35.00

Variants:
1. Material=Cotton, Size=M → SKU: PS-COTTON-M → Stock: 30 → Price: $35.00
2. Material=Silk, Size=M → SKU: PS-SILK-M → Stock: 10 → Price: $49.99 (premium)
3. Material=Cotton, Size=L → SKU: PS-COTTON-L → Stock: 25 → Price: $37.00 (upsell)
```

### Workflow 3: Manage Stock by Variant
```
Variant: "Size=M, Color=Red"
Current Stock: 50

Operations:
- Receive shipment: PATCH with operation="add", value=25 → new stock: 75
- Sell 10 units: PATCH with operation="subtract", value=10 → new stock: 65
- Inventory adjustment: PATCH with operation="set", value=60 → new stock: 60
```

## Storefront Integration (Optional)

Once variants are created, the storefront can:
1. Show variant selector on product detail page
2. Update price based on variant selection
3. Check variant-specific stock availability
4. Add variant to cart (with ProductVariantId)

### Example API Call (Storefront)
```javascript
// Get product with all variants
GET /api/products/{productId}
→ Returns product with ProductVariants array

// Select variant and add to cart
POST /api/cart/items
{
  "productId": "uuid",
  "variantId": "uuid",  // Optional: if product has variants
  "quantity": 1
}
```

## Validation Rules

### Creating/Updating Variants
- ✓ ProductId must reference existing product
- ✓ Attributes object cannot be empty
- ✓ All attribute values must be provided
- ✓ Stock must be a non-negative number
- ✓ Price (if provided) must be a valid decimal
- ✓ Status must be 'active' or 'inactive'

### Stock Operations
- ✓ Operation must be 'add', 'subtract', or 'set'
- ✓ Value must be a non-negative number
- ✓ Subtract operation floors result at 0 (no negative stock)

## Performance Considerations

1. **Lazy Loading**: Variants are included in product GET requests
   - Product list includes variant count
   - Product detail includes full variants array

2. **Database Indexes**: Variants are indexed by:
   - ProductId (foreign key)
   - Status (for filtering active variants)

3. **Query Optimization**: 
   - List products: includes Category + light variant info
   - Get product: includes full variant details

## Future Enhancements

- [ ] Bulk variant operations (create multiple at once, delete all)
- [ ] Variant combination matrix (all size/color combinations)
- [ ] CSV import for variants
- [ ] Variant reordering UI
- [ ] Inventory alerts per variant
- [ ] Variant analytics (which sizes sell best)
- [ ] Variant images gallery
- [ ] Dynamic pricing rules by variant

## Testing Checklist

- [ ] Create variant with all attributes
- [ ] Create variant with custom price
- [ ] Update variant attributes
- [ ] Update variant price
- [ ] Update variant stock (add, subtract, set)
- [ ] Delete variant
- [ ] Verify variant doesn't appear after deletion
- [ ] Verify variant appears in product GET endpoint
- [ ] Test attribute key addition/removal
- [ ] Verify parent price inheritance
- [ ] Test with various attribute combinations

## Common Issues

### Issue: "Variant not found"
**Solution**: Ensure productId and variantId are correct UUIDs

### Issue: "Attributes must be a valid object"
**Solution**: Ensure all attribute fields are filled (no empty strings)

### Issue: Variant price not showing
**Solution**: If variant.price is null, frontend displays parent price

### Issue: Stock goes negative
**Solution**: Subtract operation automatically floors to 0

## API Authentication

All variant endpoints (except GET) require:
- **Authorization Header**: `Bearer {admin_jwt_token}`
- **Role**: Admin role (enforced by `requireRole("admin")` middleware)

Non-authenticated endpoints:
- GET /products/:productId/variants (list)
- GET /products/:productId/variants/:variantId (detail)

