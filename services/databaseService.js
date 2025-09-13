// services/databaseService.js - Production-ready database service

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
        prima_username,
        created_at,
        updated_at
      FROM user_mappings 
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
   * Create or update user mapping
   * @param {string} lineUserId - LINE User ID
   * @param {string} primaUsername - Prima789 username
   * @returns {Promise<Object>} Created/updated mapping
   */
  async upsertUserMapping(lineUserId, primaUsername) {
    if (!lineUserId || typeof lineUserId !== "string") {
      throw new ValidationError("LINE User ID is required");
    }

    if (!primaUsername || typeof primaUsername !== "string") {
      throw new ValidationError("Prima username is required");
    }

    const query = `
      INSERT INTO user_mappings (line_user_id, prima_username, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (line_user_id)
      DO UPDATE SET 
        prima_username = EXCLUDED.prima_username,
        updated_at = CURRENT_TIMESTAMP
      RETURNING 
        id,
        line_user_id,
        prima_username,
        created_at,
        updated_at
    `;

    try {
      const result = await this.query(query, [lineUserId, primaUsername]);

      logger.info("User mapping upserted successfully", {
        lineUserId: lineUserId.substring(0, 10) + "***",
        primaUsername: primaUsername.replace(/./g, "*"),
      });

      return result.rows[0];
    } catch (error) {
      logger.error("Failed to upsert user mapping", {
        lineUserId: lineUserId.substring(0, 10) + "***",
        primaUsername: primaUsername.replace(/./g, "*"),
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

    const query = "DELETE FROM user_mappings WHERE line_user_id = $1";

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
      totalUsers: "SELECT COUNT(*) as count FROM user_mappings",
      recentUsers: `
        SELECT COUNT(*) as count 
        FROM user_mappings 
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `,
      recentSessions: `
        SELECT COUNT(*) as count 
        FROM session_logs 
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `,
    };

    try {
      const results = {};

      for (const [key, query] of Object.entries(queries)) {
        const result = await this.query(query);
        results[key] = parseInt(result.rows[0].count);
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
