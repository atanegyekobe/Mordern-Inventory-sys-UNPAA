const sequelize = require("../config/database");

async function addReadAtColumn() {
  try {
    console.log("Adding read_at column to messages table...");
    
    await sequelize.query(`
      ALTER TABLE messages 
      ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    `);
    
    console.log("✓ Successfully added read_at column to messages table");
    process.exit(0);
  } catch (error) {
    console.error("Error adding read_at column:", error);
    process.exit(1);
  }
}

addReadAtColumn();
