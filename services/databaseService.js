// services/databaseService.js - Enhanced Production-ready database service

const { Pool } = require("@neondatabase/serverless");
const config = require("../config/config");
const logger = require("../utils/logger");
const { DatabaseError, ValidationError } = require("../utils/errors");

class DatabaseService {
  constructor() {
    this.pool = new Pool({
      connectionString: config.database.url,
      max: config.database.maxConnections,
      connectionTimeoutMillis: config.database.connectionTimeout,
    });

    // Test connection on startup
    this.testConnection();
  }

  /**
   * Test database connection
   */
  async testConnection() {
    try {
      await this.pool.query("SELECT 1");
      logger.info("Database connection established successfully");
    } catch (error) {
      logger.error("Database connection failed", { error: error.message });
      throw new DatabaseError("Failed to connect to database");
    }
  }

  /**
   * Execute a query with error handling and logging
   * @param {string} query - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} Query result
   */
  async query(query, params = []) {
    const startTime = Date.now();
    let client;

    try {
      client = await this.pool.connect();
      const result = await client.query(query, params);
      const duration = Date.now() - startTime;

      logger.debug("Database query executed", {
        query: query.substring(0, 100) + (query.length > 100 ? "..." : ""),
        duration: `${duration}ms`,
        rows: result.rowCount,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error("Database query failed", {
        query: query.substring(0, 100) + (query.length > 100 ? "..." : ""),
        error: error.message,
        duration: `${duration}ms`,
        code: error.code,
      });

      // Transform database errors to application errors
      if (error.code === "23505") {
        // Unique violation
        throw new DatabaseError("Duplicate entry found");
      } else if (error.code === "23503") {
        // Foreign key violation
        throw new DatabaseError("Referenced record not found");
      } else if (error.code === "23502") {
        // Not null violation
        throw new DatabaseError("Required field is missing");
      } else {
        throw new DatabaseError(`Database operation failed: ${error.message}`);
      }
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Find user mapping by LINE User ID
   * @param {string} lineUserId - LINE User ID
   * @returns {Promise<Object|null>} User mapping or null
   */
  async findUserMapping(lineUserId) {
    if (!lineUserId || typeof lineUserId !== "string") {
      throw new ValidationError("LINE User ID is required");
    }

    const query = `
      SELECT 
        id,
        line_user_id,
        line_display_name,
        prima_username,
        prima_phone,
        member_tier,
        credit_balance,
        created_at,
        updated_at
      FROM user_accounts 
      WHERE line_user_id = $1
    `;

    try {
      const result = await this.query(query, [lineUserId]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error("Failed to find user mapping", {
        lineUserId: lineUserId.substring(0, 10) + "***",
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create or update user mapping (legacy method for compatibility)
   * @param {string} lineUserId - LINE User ID
   * @param {string} primaUsername - Prima789 username
   * @returns {Promise<Object>} Created/updated mapping
   */
  async upsertUserMapping(lineUserId, primaUsername) {
    return this.upsertUserMappingWithData({
      line_user_id: lineUserId,
      prima_username: primaUsername,
    });
  }

  /**
   * Create or update user mapping with enhanced data
   * @param {Object} mappingData - Complete mapping data
   * @returns {Promise<Object>} Created/updated mapping
   */
  async upsertUserMappingWithData(mappingData) {
    const {
      line_user_id,
      line_display_name,
      prima_username,
      prima_phone,
      member_tier,
      credit_balance,
    } = mappingData;

    if (!line_user_id || typeof line_user_id !== "string") {
      throw new ValidationError("LINE User ID is required");
    }

    if (!prima_username || typeof prima_username !== "string") {
      throw new ValidationError("Prima username is required");
    }

    const query = `
      INSERT INTO user_accounts (
        line_user_id, 
        line_display_name, 
        prima_username, 
        prima_phone,
        member_tier,
        credit_balance,
        last_sync,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (line_user_id)
      DO UPDATE SET 
        line_display_name = EXCLUDED.line_display_name,
        prima_username = EXCLUDED.prima_username,
        prima_phone = EXCLUDED.prima_phone,
        member_tier = EXCLUDED.member_tier,
        credit_balance = EXCLUDED.credit_balance,
        last_sync = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING 
        id,
        line_user_id,
        line_display_name,
        prima_username,
        prima_phone,
        member_tier,
        credit_balance,
        created_at,
        updated_at
    `;

    try {
      const result = await this.query(query, [
        line_user_id,
        line_display_name || null,
        prima_username,
        prima_phone || null,
        member_tier || "Standard",
        credit_balance || "0.00",
      ]);

      logger.info("User mapping upserted successfully", {
        lineUserId: line_user_id.substring(0, 10) + "***",
        primaUsername: prima_username.replace(/./g, "*"),
        memberTier: member_tier,
      });

      return result.rows[0];
    } catch (error) {
      logger.error("Failed to upsert user mapping", {
        lineUserId: line_user_id.substring(0, 10) + "***",
        primaUsername: prima_username.replace(/./g, "*"),
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete user mapping
   * @param {string} lineUserId - LINE User ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteUserMapping(lineUserId) {
    if (!lineUserId || typeof lineUserId !== "string") {
      throw new ValidationError("LINE User ID is required");
    }

    const query = "DELETE FROM user_accounts WHERE line_user_id = $1";

    try {
      const result = await this.query(query, [lineUserId]);
      const deleted = result.rowCount > 0;

      logger.info("User mapping deletion attempted", {
        lineUserId: lineUserId.substring(0, 10) + "***",
        deleted,
      });

      return deleted;
    } catch (error) {
      logger.error("Failed to delete user mapping", {
        lineUserId: lineUserId.substring(0, 10) + "***",
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Log session activity
   * @param {string} lineUserId - LINE User ID
   * @param {string} action - Action performed
   * @param {string} ipAddress - Client IP address
   * @param {string} userAgent - Client user agent
   * @returns {Promise<void>}
   */
  async logSession(lineUserId, action, ipAddress = null, userAgent = null) {
    const query = `
      INSERT INTO session_logs (line_user_id, action, ip_address, user_agent)
      VALUES ($1, $2, $3, $4)
    `;

    try {
      await this.query(query, [lineUserId, action, ipAddress, userAgent]);
    } catch (error) {
      // Log session errors but don't throw - this is non-critical
      logger.warn("Failed to log session activity", {
        lineUserId: lineUserId?.substring(0, 10) + "***",
        action,
        error: error.message,
      });
    }
  }

  /**
   * Get database statistics
   * @returns {Promise<Object>} Database statistics
   */
  async getStatistics() {
    const queries = {
      totalUsers: "SELECT COUNT(*) as count FROM user_accounts",
      recentUsers: `
        SELECT COUNT(*) as count 
        FROM user_accounts 
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `,
      recentSessions: `
        SELECT COUNT(*) as count 
        FROM session_logs 
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `,
      tierDistribution: `
        SELECT member_tier, COUNT(*) as count 
        FROM user_accounts 
        WHERE member_tier IS NOT NULL 
        GROUP BY member_tier
      `,
    };

    try {
      const results = {};

      for (const [key, query] of Object.entries(queries)) {
        const result = await this.query(query);

        if (key === "tierDistribution") {
          results[key] = result.rows.reduce((acc, row) => {
            acc[row.member_tier] = parseInt(row.count);
            return acc;
          }, {});
        } else {
          results[key] = parseInt(result.rows[0].count);
        }
      }

      logger.info("Database statistics retrieved", results);
      return results;
    } catch (error) {
      logger.error("Failed to get database statistics", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Setup database tables
   * @returns {Promise<void>}
   */
  async setupTables() {
    const userAccountsTable = `
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

    const sessionLogsTable = `
      CREATE TABLE IF NOT EXISTS session_logs (
        id SERIAL PRIMARY KEY,
        line_user_id VARCHAR(255) NOT NULL,
        action VARCHAR(100) NOT NULL,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const indexes = [
      "CREATE INDEX IF NOT EXISTS idx_user_accounts_line_user_id ON user_accounts(line_user_id);",
      "CREATE INDEX IF NOT EXISTS idx_user_accounts_prima_username ON user_accounts(prima_username);",
      "CREATE INDEX IF NOT EXISTS idx_session_logs_line_user_id ON session_logs(line_user_id);",
      "CREATE INDEX IF NOT EXISTS idx_session_logs_created_at ON session_logs(created_at);",
    ];

    try {
      await this.query(userAccountsTable);
      await this.query(sessionLogsTable);

      for (const indexQuery of indexes) {
        await this.query(indexQuery);
      }

      logger.info("Database tables setup completed successfully");
    } catch (error) {
      logger.error("Failed to setup database tables", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Health check for database
   * @returns {Promise<boolean>} True if database is healthy
   */
  async healthCheck() {
    try {
      const result = await this.query("SELECT 1 as health_check");
      return result.rows.length > 0 && result.rows[0].health_check === 1;
    } catch (error) {
      logger.error("Database health check failed", { error: error.message });
      return false;
    }
  }

  /**
   * Close database connection pool
   */
  async close() {
    try {
      await this.pool.end();
      logger.info("Database connection pool closed");
    } catch (error) {
      logger.error("Failed to close database connection pool", {
        error: error.message,
      });
    }
  }
}

// Export singleton instance
module.exports = new DatabaseService();
