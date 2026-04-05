const sequelize = require("../config/database");

async function addFinancialConstraints() {
  try {
    console.log("Adding financial integrity constraints...\n");

    // Drop existing constraints if they exist (safe from errors)
    const dropConstraints = [
      "ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_total_minor_positive",
      "ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_total_paid_non_negative",
      "ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_balance_non_negative",
      "ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_total_paid_le_total_minor",
      "ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_balance_consistency",
      "ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_price_positive",
      "ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_price_minor_positive",
      "ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_cost_minor_non_negative",
      "ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_stock_non_negative",
      "ALTER TABLE product_variants DROP CONSTRAINT IF EXISTS chk_product_variants_stock_non_negative",
      "ALTER TABLE order_items DROP CONSTRAINT IF EXISTS chk_order_items_quantity_positive",
      "ALTER TABLE order_items DROP CONSTRAINT IF EXISTS chk_order_items_unit_price_positive",
      "ALTER TABLE payments DROP CONSTRAINT IF EXISTS chk_payments_amount_positive",
    ];

    for (const dropSql of dropConstraints) {
      try {
        await sequelize.query(dropSql);
      } catch (err) {
        // Silently ignore constraint not found errors
        if (!err.message.includes("does not exist")) {
          console.warn(`  Warning removing constraint: ${err.message}`);
        }
      }
    }

    console.log("✓ Cleaned up existing constraints\n");

    // ========================================
    // ORDER TABLE CONSTRAINTS
    // ========================================
    console.log("Adding Order table constraints:");

    // 1. totalMinor must be non-negative
    await sequelize.query(`
      ALTER TABLE orders 
      ADD CONSTRAINT chk_orders_total_minor_positive 
      CHECK (total_minor >= 0);
    `);
    console.log("  ✓ totalMinor >= 0");

    // 2. totalPaid must be non-negative
    await sequelize.query(`
      ALTER TABLE orders 
      ADD CONSTRAINT chk_orders_total_paid_non_negative 
      CHECK (total_paid >= 0);
    `);
    console.log("  ✓ totalPaid >= 0");

    // 3. balanceDue must be non-negative
    await sequelize.query(`
      ALTER TABLE orders 
      ADD CONSTRAINT chk_orders_balance_non_negative 
      CHECK (balance_due >= 0);
    `);
    console.log("  ✓ balanceDue >= 0");

    // 4. totalPaid cannot exceed totalMinor
    await sequelize.query(`
      ALTER TABLE orders 
      ADD CONSTRAINT chk_orders_total_paid_le_total_minor 
      CHECK (total_paid <= total_minor);
    `);
    console.log("  ✓ totalPaid <= totalMinor");

    // 5. balanceDue must equal totalMinor - totalPaid
    await sequelize.query(`
      ALTER TABLE orders 
      ADD CONSTRAINT chk_orders_balance_consistency 
      CHECK (balance_due = total_minor - total_paid);
    `);
    console.log("  ✓ balanceDue = totalMinor - totalPaid");

    // ========================================
    // PRODUCT TABLE CONSTRAINTS
    // ========================================
    console.log("\nAdding Product table constraints:");

    // 1. price must be positive
    await sequelize.query(`
      ALTER TABLE products 
      ADD CONSTRAINT chk_products_price_positive 
      CHECK (price > 0);
    `);
    console.log("  ✓ price > 0");

    // 2. priceMinor must be positive
    await sequelize.query(`
      ALTER TABLE products 
      ADD CONSTRAINT chk_products_price_minor_positive 
      CHECK (price_minor > 0);
    `);
    console.log("  ✓ priceMinor > 0");

    // 3. costMinor must be non-negative if provided
    await sequelize.query(`
      ALTER TABLE products 
      ADD CONSTRAINT chk_products_cost_minor_non_negative 
      CHECK (cost_minor IS NULL OR cost_minor >= 0);
    `);
    console.log("  ✓ costMinor >= 0 OR costMinor IS NULL");

    // 4. stock must be non-negative
    await sequelize.query(`
      ALTER TABLE products 
      ADD CONSTRAINT chk_products_stock_non_negative 
      CHECK (stock >= 0);
    `);
    console.log("  ✓ stock >= 0");

    // ========================================
    // PRODUCT VARIANT TABLE CONSTRAINTS
    // ========================================
    console.log("\nAdding ProductVariant table constraints:");

    // 1. stock must be non-negative
    await sequelize.query(`
      ALTER TABLE product_variants 
      ADD CONSTRAINT chk_product_variants_stock_non_negative 
      CHECK (stock >= 0);
    `);
    console.log("  ✓ stock >= 0");

    // ========================================
    // ORDER ITEM TABLE CONSTRAINTS
    // ========================================
    console.log("\nAdding OrderItem table constraints:");

    // Backfill legacy rows where unit_price_minor was never populated
    await sequelize.query(`
      UPDATE order_items
      SET
        unit_price_minor = ROUND(COALESCE(unit_price, 0) * 100)::INTEGER,
        price_at_purchase = CASE
          WHEN price_at_purchase IS NULL OR price_at_purchase <= 0
            THEN ROUND(COALESCE(unit_price, 0) * 100)::INTEGER
          ELSE price_at_purchase
        END,
        cost_at_purchase = COALESCE(cost_at_purchase, 0)
      WHERE unit_price_minor IS NULL OR unit_price_minor <= 0;
    `);
    console.log("  ✓ backfilled legacy order item minor-unit values");

    // 1. quantity must be positive
    await sequelize.query(`
      ALTER TABLE order_items 
      ADD CONSTRAINT chk_order_items_quantity_positive 
      CHECK (quantity > 0);
    `);
    console.log("  ✓ quantity > 0");

    // 2. unitPriceMinor must be positive
    await sequelize.query(`
      ALTER TABLE order_items 
      ADD CONSTRAINT chk_order_items_unit_price_positive 
      CHECK (unit_price_minor > 0);
    `);
    console.log("  ✓ unitPriceMinor > 0");

    // ========================================
    // PAYMENT TABLE CONSTRAINTS
    // ========================================
    console.log("\nAdding Payment table constraints:");

    // 1. amount must be positive if provided
    await sequelize.query(`
      ALTER TABLE payments 
      ADD CONSTRAINT chk_payments_amount_positive 
      CHECK (amount IS NULL OR amount > 0);
    `);
    console.log("  ✓ amount > 0 OR amount IS NULL");

    // ========================================
    // VERIFY UNIQUE CONSTRAINTS
    // ========================================
    console.log("\nVerifying unique constraints:");

    // Check if payment_reference unique constraint exists
    const uniquePaymentRef = await sequelize.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'payments' 
      AND constraint_name LIKE '%payment_reference%unique%'
      AND constraint_type = 'UNIQUE';
    `);

    if (uniquePaymentRef[0].length > 0) {
      console.log("  ✓ paymentReference uniqueness enforced");
    } else {
      console.log("  ⚠ paymentReference uniqueness check: may need manual verification");
    }

    console.log("\n✅ All financial integrity constraints added successfully!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error adding constraints:", error.message);
    if (error.detail) {
      console.error("Detail:", error.detail);
    }
    process.exit(1);
  }
}

addFinancialConstraints();
