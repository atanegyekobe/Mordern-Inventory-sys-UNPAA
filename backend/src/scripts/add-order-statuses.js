const sequelize = require("../config/database");

async function addOrderStatuses() {
  try {
    console.log("Adding order status values to enum...");

    await sequelize.query(`
      DO $$
      BEGIN
        ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'pending_payment';
        ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'packed';
        ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'shipped';
        ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'out_for_delivery';
        ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'delivered';
        ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'received';
        ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'delivery_failed';
        ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'returned';
        ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'refunded';
        ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'fraud_hold';
        ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'processing';
        ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'delivery_pickup';
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    console.log("✓ Successfully added order status values");
    process.exit(0);
  } catch (error) {
    console.error("Error adding order status values:", error);
    process.exit(1);
  }
}

addOrderStatuses();
