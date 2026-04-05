// Central Zod schemas for product, order, payment, category, and bulk operations
const { z } = require("zod");

const MAX_PRICE = 1000000;
const MAX_STOCK = 100000;
const MAX_BULK_ITEMS = 100;

const idSchema = z.string().trim().min(1);

const bulkIdsSchema = z
  .array(idSchema)
  .nonempty({ message: "At least one product id is required." })
  .max(MAX_BULK_ITEMS, {
    message: `Bulk operations cannot exceed ${MAX_BULK_ITEMS} items.`,
  })
  .superRefine((arr, ctx) => {
    if (new Set(arr).size !== arr.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Product IDs must be unique.",
      });
    }
  });

// Product schema
const productSchema = z.object({
  name: z.string().trim().min(1),
  price: z.coerce.number().min(0).max(MAX_PRICE),
  stock: z.coerce.number().int().min(0).max(MAX_STOCK).optional(),
  categoryId: idSchema,
  description: z.string().optional(),
  sku: z.string().trim().min(1).optional(),
  cost: z.coerce.number().min(0).max(MAX_PRICE).nullable().optional(),
  status: z.enum(["active", "draft", "inactive"]).optional(),
});

const productUpdateSchema = productSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  { message: "At least one field is required for update." }
);

const bulkPriceSchema = z.object({
  productIds: bulkIdsSchema,
  operation: z.enum(["increase", "decrease", "set"]),
  value: z.coerce.number().min(0).max(MAX_PRICE),
});

const bulkCategorySchema = z.object({
  productIds: bulkIdsSchema,
  categoryId: idSchema,
});

const bulkStockSchema = z.object({
  productIds: bulkIdsSchema,
  operation: z.enum(["add", "subtract", "set"]),
  value: z.coerce.number().int().min(0).max(MAX_STOCK),
});

const bulkStatusSchema = z.object({
  productIds: bulkIdsSchema,
  status: z.enum(["active", "draft", "inactive"]),
});

const bulkDeleteSchema = z.object({
  productIds: bulkIdsSchema,
});

// Payment schema
const paymentSchema = z.object({
  payment_reference: z.string().min(1),
  amount: z.number().min(0).max(MAX_PRICE),
  orderId: z.string().min(1),
});

const paymentInitializeSchema = z.object({
  orderId: idSchema,
  callbackUrl: z.string().trim().url().optional(),
  idempotencyKey: z
    .string()
    .trim()
    .min(8)
    .max(120)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),
});

// Order item schema
const orderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(1000),
  unitPrice: z.number().min(0).max(MAX_PRICE),
});

// Category schema
const categorySchema = z.object({
  name: z.string().min(1),
  parentId: z.string().optional(),
});

module.exports = {
  productSchema,
  productUpdateSchema,
  paymentSchema,
  paymentInitializeSchema,
  orderItemSchema,
  bulkIdsSchema,
  bulkPriceSchema,
  bulkCategorySchema,
  bulkStockSchema,
  bulkStatusSchema,
  bulkDeleteSchema,
  categorySchema,
};
