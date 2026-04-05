const sequelize = require("../config/database");

async function addOrderNotificationsTable() {
  try {
    console.log("Adding order_notifications table...");

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS order_notifications (
        id UUID PRIMARY KEY,
        status VARCHAR(32) NOT NULL,
        subject VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    console.log("✓ Successfully added order_notifications table");
    process.exit(0);
  } catch (error) {
    console.error("Error adding order_notifications table:", error);
    process.exit(1);
  }
}

addOrderNotificationsTable();
