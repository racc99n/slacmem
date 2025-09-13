const { Pool } = require("@neondatabase/serverless");
require("dotenv").config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function setupDatabase() {
  try {
    console.log("🚀 Setting up database...");

    // สร้างตาราง user_mappings
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_mappings (
        id SERIAL PRIMARY KEY,
        line_user_id VARCHAR(255) UNIQUE NOT NULL,
        prima_username VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // สร้าง index สำหรับ performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_mappings_line_user_id 
      ON user_mappings(line_user_id);
    `);

    // สร้างตาราง session_logs (optional - สำหรับ tracking)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS session_logs (
        id SERIAL PRIMARY KEY,
        line_user_id VARCHAR(255) NOT NULL,
        action VARCHAR(100) NOT NULL,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("✅ Database setup completed successfully!");

    // Test connection
    const result = await pool.query("SELECT COUNT(*) FROM user_mappings");
    console.log(`📊 Current user mappings: ${result.rows[0].count}`);
  } catch (error) {
    console.error("❌ Database setup failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// เรียกใช้ script
if (require.main === module) {
  setupDatabase();
}

module.exports = { setupDatabase };
