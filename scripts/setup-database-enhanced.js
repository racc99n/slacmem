// scripts/setup-database-enhanced.js - Enhanced database setup with migration support

const { Pool } = require("@neondatabase/serverless");
require("dotenv").config();

class DatabaseSetup {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 30000,
    });
    this.force = process.argv.includes("--force");
  }

  log(message, type = "info") {
    const icons = {
      info: "📋",
      success: "✅",
      warning: "⚠️",
      error: "❌",
      migration: "🔄",
    };
    console.log(`${icons[type]} ${message}`);
  }

  async testConnection() {
    try {
      const result = await this.pool.query(
        "SELECT NOW() as current_time, version() as version"
      );
      const { current_time, version } = result.rows[0];

      this.log(`Database connected successfully`);
      this.log(`Server time: ${current_time}`);
      this.log(`PostgreSQL: ${version.split(" ")[0]} ${version.split(" ")[1]}`);

      return true;
    } catch (error) {
      this.log(`Connection failed: ${error.message}`, "error");
      return false;
    }
  }

  async checkExistingSchema() {
    try {
      // Check for old schema (user_mappings table)
      const oldTableCheck = await this.pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'user_mappings'
        );
      `);

      // Check for new schema (user_accounts table)
      const newTableCheck = await this.pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'user_accounts'
        );
      `);

      return {
        hasOldSchema: oldTableCheck.rows[0].exists,
        hasNewSchema: newTableCheck.rows[0].exists,
      };
    } catch (error) {
      this.log(`Schema check failed: ${error.message}`, "error");
      return { hasOldSchema: false, hasNewSchema: false };
    }
  }

  async migrateFromOldSchema() {
    this.log("Starting migration from old schema...", "migration");

    try {
      // Create new user_accounts table first
      await this.createUserAccountsTable();

      // Migrate data from user_mappings to user_accounts
      const migrationQuery = `
        INSERT INTO user_accounts (
          line_user_id, 
          prima_username, 
          created_at, 
          updated_at
        )
        SELECT 
          line_user_id,
          prima_username,
          created_at,
          updated_at
        FROM user_mappings
        ON CONFLICT (line_user_id) DO NOTHING;
      `;

      const result = await this.pool.query(migrationQuery);
      this.log(
        `Migrated ${result.rowCount} records from old schema`,
        "success"
      );

      // Backup old table (rename it)
      await this.pool.query(
        "ALTER TABLE user_mappings RENAME TO user_mappings_backup;"
      );
      this.log("Old table backed up as user_mappings_backup", "success");

      return result.rowCount;
    } catch (error) {
      this.log(`Migration failed: ${error.message}`, "error");
      throw error;
    }
  }

  async createUserAccountsTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS user_accounts (
        id SERIAL PRIMARY KEY,
        line_user_id VARCHAR(255) UNIQUE NOT NULL,
        line_display_name VARCHAR(255),
        prima_username VARCHAR(255) NOT NULL,
        prima_phone VARCHAR(20),
        member_tier VARCHAR(50) DEFAULT 'Standard',
        credit_balance DECIMAL(15,2) DEFAULT 0.00,
        last_sync TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await this.pool.query(createTableQuery);
    this.log("Created user_accounts table", "success");
  }

  async createSessionLogsTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS session_logs (
        id SERIAL PRIMARY KEY,
        line_user_id VARCHAR(255) NOT NULL,
        action VARCHAR(100) NOT NULL,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await this.pool.query(createTableQuery);
    this.log("Created session_logs table", "success");
  }

  async createIndexes() {
    const indexes = [
      {
        name: "idx_user_accounts_line_user_id",
        query:
          "CREATE INDEX IF NOT EXISTS idx_user_accounts_line_user_id ON user_accounts(line_user_id);",
      },
      {
        name: "idx_user_accounts_prima_username",
        query:
          "CREATE INDEX IF NOT EXISTS idx_user_accounts_prima_username ON user_accounts(prima_username);",
      },
      {
        name: "idx_user_accounts_member_tier",
        query:
          "CREATE INDEX IF NOT EXISTS idx_user_accounts_member_tier ON user_accounts(member_tier);",
      },
      {
        name: "idx_session_logs_line_user_id",
        query:
          "CREATE INDEX IF NOT EXISTS idx_session_logs_line_user_id ON session_logs(line_user_id);",
      },
      {
        name: "idx_session_logs_created_at",
        query:
          "CREATE INDEX IF NOT EXISTS idx_session_logs_created_at ON session_logs(created_at);",
      },
      {
        name: "idx_session_logs_action",
        query:
          "CREATE INDEX IF NOT EXISTS idx_session_logs_action ON session_logs(action);",
      },
    ];

    for (const index of indexes) {
      try {
        await this.pool.query(index.query);
        this.log(`Created index: ${index.name}`, "success");
      } catch (error) {
        this.log(
          `Index creation failed for ${index.name}: ${error.message}`,
          "warning"
        );
      }
    }
  }

  async createTriggers() {
    // Auto-update timestamp trigger
    const triggerFunction = `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;

    const trigger = `
      DROP TRIGGER IF EXISTS update_user_accounts_updated_at ON user_accounts;
      CREATE TRIGGER update_user_accounts_updated_at
        BEFORE UPDATE ON user_accounts
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `;

    await this.pool.query(triggerFunction);
    await this.pool.query(trigger);
    this.log("Created auto-update timestamp trigger", "success");
  }

  async insertSampleData() {
    if (!this.force) {
      this.log("Skipping sample data (use --force to include)", "info");
      return;
    }

    const sampleData = `
      INSERT INTO user_accounts (
        line_user_id, 
        line_display_name, 
        prima_username, 
        prima_phone,
        member_tier,
        credit_balance
      ) VALUES 
        ('U1234567890sample1', 'Sample User 1', 'SAMPLE001', '0812345678', 'Gold', 25000.00),
        ('U1234567890sample2', 'Sample User 2', 'SAMPLE002', '0823456789', 'Silver', 15000.00),
        ('U1234567890sample3', 'Sample User 3', 'SAMPLE003', '0834567890', 'Standard', 5000.00)
      ON CONFLICT (line_user_id) DO NOTHING;
    `;

    const result = await this.pool.query(sampleData);
    this.log(`Inserted ${result.rowCount} sample records`, "success");
  }

  async verifySetup() {
    try {
      // Check tables exist
      const tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('user_accounts', 'session_logs');
      `;

      const tables = await this.pool.query(tablesQuery);
      const tableNames = tables.rows.map((row) => row.table_name);

      this.log(`Tables found: ${tableNames.join(", ")}`, "success");

      // Check indexes
      const indexesQuery = `
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename IN ('user_accounts', 'session_logs')
        AND schemaname = 'public';
      `;

      const indexes = await this.pool.query(indexesQuery);
      this.log(`Indexes created: ${indexes.rows.length}`, "success");

      // Count records
      const userCount = await this.pool.query(
        "SELECT COUNT(*) FROM user_accounts"
      );
      const sessionCount = await this.pool.query(
        "SELECT COUNT(*) FROM session_logs"
      );

      this.log(
        `Current data: ${userCount.rows[0].count} users, ${sessionCount.rows[0].count} sessions`,
        "info"
      );

      // Test a sample query
      await this.pool.query(`
        SELECT ua.line_user_id, ua.prima_username, ua.member_tier, ua.credit_balance
        FROM user_accounts ua
        LIMIT 1
      `);

      this.log("Database setup verification completed successfully", "success");
      return true;
    } catch (error) {
      this.log(`Verification failed: ${error.message}`, "error");
      return false;
    }
  }

  async generateReport() {
    try {
      const queries = {
        totalUsers: "SELECT COUNT(*) as count FROM user_accounts",
        tierDistribution: `
          SELECT member_tier, COUNT(*) as count 
          FROM user_accounts 
          GROUP BY member_tier 
          ORDER BY count DESC
        `,
        recentActivity: `
          SELECT COUNT(*) as count 
          FROM session_logs 
          WHERE created_at >= NOW() - INTERVAL '7 days'
        `,
        topActions: `
          SELECT action, COUNT(*) as count 
          FROM session_logs 
          GROUP BY action 
          ORDER BY count DESC 
          LIMIT 5
        `,
      };

      console.log("\n📊 DATABASE REPORT");
      console.log("=".repeat(50));

      // Total users
      const totalUsers = await this.pool.query(queries.totalUsers);
      console.log(`👥 Total Users: ${totalUsers.rows[0].count}`);

      // Tier distribution
      const tierDist = await this.pool.query(queries.tierDistribution);
      console.log("\n🏆 Member Tier Distribution:");
      tierDist.rows.forEach((row) => {
        console.log(`   ${row.member_tier}: ${row.count} users`);
      });

      // Recent activity
      const recentActivity = await this.pool.query(queries.recentActivity);
      console.log(
        `\n📈 Recent Activity (7 days): ${recentActivity.rows[0].count} sessions`
      );

      // Top actions
      const topActions = await this.pool.query(queries.topActions);
      console.log("\n🎯 Top Actions:");
      topActions.rows.forEach((row) => {
        console.log(`   ${row.action}: ${row.count} times`);
      });

      console.log("=".repeat(50));
    } catch (error) {
      this.log(`Report generation failed: ${error.message}`, "error");
    }
  }

  async run() {
    try {
      console.log("🚀 Prima789 Enhanced Database Setup\n");

      // Test connection
      const connected = await this.testConnection();
      if (!connected) {
        throw new Error("Database connection failed");
      }

      // Check existing schema
      const schemaStatus = await this.checkExistingSchema();

      if (schemaStatus.hasOldSchema && !schemaStatus.hasNewSchema) {
        this.log("Old schema detected, starting migration...", "migration");
        await this.migrateFromOldSchema();
      }

      // Create tables
      this.log("Creating database tables...", "info");
      await this.createUserAccountsTable();
      await this.createSessionLogsTable();

      // Create indexes
      this.log("Creating database indexes...", "info");
      await this.createIndexes();

      // Create triggers
      this.log("Creating database triggers...", "info");
      await this.createTriggers();

      // Insert sample data if requested
      if (this.force) {
        await this.insertSampleData();
      }

      // Verify setup
      const verified = await this.verifySetup();
      if (!verified) {
        throw new Error("Database verification failed");
      }

      // Generate report
      await this.generateReport();

      this.log("\n🎉 Database setup completed successfully!", "success");
      this.log("You can now run: npm run dev", "info");
    } catch (error) {
      this.log(`Setup failed: ${error.message}`, "error");
      process.exit(1);
    } finally {
      await this.pool.end();
    }
  }
}

// Run if called directly
if (require.main === module) {
  const setup = new DatabaseSetup();
  setup.run();
}

module.exports = DatabaseSetup;
