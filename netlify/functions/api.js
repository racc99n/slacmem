// netlify/functions/api.js - Production API with Real Prima789 Socket.IO Integration
const {
  validatePhoneNumber,
  validatePIN,
  validatePhoneNumberOrThrow,
  validatePINOrThrow,
  ValidationError,
  createErrorResponse,
} = require("../../utils/errors");

// Database connection helper
let pool;
async function getPool() {
  if (!pool) {
    let Pool;
    try {
      // Try @neondatabase/serverless first (for production)
      const pg = require("@neondatabase/serverless");
      Pool = pg.Pool;
    } catch (error) {
      // Fallback to regular pg
      const pg = require("pg");
      Pool = pg.Pool;
    }

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
    });
  }
  return pool;
}

// Database query helper with error handling
async function queryDatabase(query, params = []) {
  if (!process.env.DATABASE_URL) {
    console.warn("Database not configured, skipping database operation");
    return { rows: [], rowCount: 0 };
  }

  const pool = await getPool();
  let client;

  try {
    client = await pool.connect();
    const result = await client.query(query, params);
    return result;
  } catch (error) {
    console.error("Database query error:", error);
    throw new Error(`Database error: ${error.message}`);
  } finally {
    if (client) client.release();
  }
}

// Real Prima789 authentication using Socket.IO (your provided code)
async function authenticateWithPrima789(phone, pin) {
  return new Promise((resolve, reject) => {
    console.log(
      `🎰 Authenticating with Prima789: ${phone.replace(/\d(?=\d{4})/g, "*")}`
    );

    // Dynamic import for Socket.IO client
    let io;
    try {
      io = require("socket.io-client").io;
    } catch (error) {
      console.error("Socket.IO client not available:", error);
      reject(new Error("Socket.IO client not available"));
      return;
    }

    const socket = io(process.env.PRIMA789_API_URL || "https://prima789.net", {
      transports: ["polling"],
      forceNew: true,
    });

    let fullMemberData = {};
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        socket.disconnect();
        console.log("❌ Prima789 connection timeout");
        reject(new Error("การเชื่อมต่อหมดเวลา"));
      }
    }, parseInt(process.env.PRIMA789_TIMEOUT) || 20000);

    socket.on("connect", () => {
      console.log("✅ Prima789 socket connected, sending login...");
      socket.emit("login", { tel: phone, pin: pin });
    });

    socket.on("cus return", (res) => {
      console.log("📋 Prima789 cus return received:", res?.success);

      if (res && res.success) {
        fullMemberData.primaUsername = res.data.mm_user;
        fullMemberData.firstName = res.data.first_name;
        fullMemberData.lastName = res.data.last_name;
        fullMemberData.phone = phone;

        console.log(`✅ User authenticated: ${fullMemberData.primaUsername}`);

        // Check if we have all data needed
        if (fullMemberData.creditBalance !== undefined && !resolved) {
          resolved = true;
          clearTimeout(timeout);
          socket.disconnect();
          resolve(formatUserData(fullMemberData));
        }
      } else {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          socket.disconnect();
          console.log("❌ Prima789 authentication failed");
          reject(
            new Error(
              res?.data?.message || "เบอร์โทรศัพท์หรือรหัส PIN ไม่ถูกต้อง"
            )
          );
        }
      }
    });

    socket.on("credit_push", (res) => {
      console.log("💰 Prima789 credit_push received:", res?.success);

      if (res && res.success) {
        fullMemberData.creditBalance = parseFloat(res.data.total_credit) || 0;
        console.log(`💰 Credit balance: ${fullMemberData.creditBalance}`);
      }

      // Check if we have all data needed
      if (fullMemberData.primaUsername && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        socket.disconnect();
        resolve(formatUserData(fullMemberData));
      }
    });

    socket.on("connect_error", (error) => {
      console.error("❌ Prima789 connection error:", error.message);
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(new Error("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ Prima789 ได้"));
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("📴 Prima789 disconnected:", reason);
      if (!resolved && reason !== "io client disconnect") {
        resolved = true;
        clearTimeout(timeout);
        reject(new Error("การเชื่อมต่อกับ Prima789 ถูกตัดขาด"));
      }
    });
  });
}

// Format user data helper
function formatUserData(userData) {
  const balance = userData.creditBalance || 0;

  return {
    username: userData.primaUsername,
    phone: userData.phone,
    firstName: userData.firstName || "",
    lastName: userData.lastName || "",
    balance: balance,
    level: determineMemberTier(balance),
    lastUpdated: new Date().toISOString(),
  };
}

// Determine member tier based on balance
function determineMemberTier(balance) {
  const numBalance = parseFloat(balance) || 0;
  if (numBalance >= 100000) return "PLATINUM";
  if (numBalance >= 50000) return "GOLD";
  if (numBalance >= 10000) return "SILVER";
  return "BRONZE";
}

// CORS Headers
const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGINS || "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-LINE-User-ID",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function createResponse(statusCode, data, headers = {}) {
  return {
    statusCode,
    headers: { ...corsHeaders, ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

// Main API handler
exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return createResponse(200, {});
  }

  try {
    const path = event.path.replace("/.netlify/functions/api", "");
    const method = event.httpMethod;

    console.log(`🚀 API Request: ${method} ${path}`);
    console.log(`📍 Origin: ${event.headers.origin || "unknown"}`);

    // Health check endpoint
    if (path === "/health" && method === "GET") {
      let databaseStatus = "not configured";
      let prima789Status = "not configured";

      // Test database connection
      if (process.env.DATABASE_URL) {
        try {
          await queryDatabase("SELECT 1 as health_check");
          databaseStatus = "connected";
        } catch (error) {
          databaseStatus = `error: ${error.message}`;
        }
      }

      // Test Prima789 connection
      if (process.env.PRIMA789_API_URL) {
        prima789Status = "configured";
      }

      return createResponse(200, {
        status: "ok",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
        version: "3.0.0",
        services: {
          database: databaseStatus,
          prima789: prima789Status,
        },
        config: {
          hasDatabase: !!process.env.DATABASE_URL,
          hasPrima789: !!process.env.PRIMA789_API_URL,
          allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",").length || 0,
        },
      });
    }

    // Get user profile
    if (path === "/user/profile" && method === "GET") {
      const lineUserId =
        event.headers["X-LINE-User-ID"] || event.headers["x-line-user-id"];

      if (!lineUserId) {
        return createResponse(401, {
          error: {
            message: "LINE User ID is required",
            code: "MISSING_LINE_USER_ID",
          },
        });
      }

      try {
        // Try to get from database
        if (process.env.DATABASE_URL) {
          const result = await queryDatabase(
            "SELECT * FROM user_accounts WHERE line_user_id = $1",
            [lineUserId]
          );

          if (result.rows.length > 0) {
            const user = result.rows[0];
            return createResponse(200, {
              username: user.prima_username,
              phone: user.prima_phone,
              balance: parseFloat(user.credit_balance) || 0,
              level: user.member_tier || "BRONZE",
              lastUpdated: user.updated_at || user.created_at,
              source: "database",
            });
          }
        }

        // Return 404 if not found
        return createResponse(404, {
          error: {
            message: "User profile not found. Please sync your account first.",
            code: "USER_NOT_FOUND",
          },
        });
      } catch (error) {
        console.error("Get profile error:", error);
        return createResponse(500, {
          error: {
            message: "Failed to retrieve user profile",
            code: "PROFILE_ERROR",
          },
        });
      }
    }

    // Sync user with Prima789 (MAIN INTEGRATION ENDPOINT)
    if (path === "/user/sync" && method === "POST") {
      try {
        const body = JSON.parse(event.body || "{}");
        const { lineUserId, primaPhone, primaPin } = body;

        // Validate required fields
        if (!lineUserId || !primaPhone || !primaPin) {
          return createResponse(400, {
            error: {
              message:
                "Missing required fields: lineUserId, primaPhone, primaPin",
              code: "MISSING_FIELDS",
            },
          });
        }

        // Validate formats
        try {
          validatePhoneNumberOrThrow(primaPhone);
          validatePINOrThrow(primaPin);
        } catch (validationError) {
          return createResponse(400, {
            error: {
              message: validationError.message,
              code: "VALIDATION_ERROR",
            },
          });
        }

        console.log(
          `🔄 Syncing user ${lineUserId.substring(0, 10)}*** with Prima789...`
        );

        // Authenticate with Prima789 using real Socket.IO connection
        let primaUserData;
        try {
          primaUserData = await authenticateWithPrima789(primaPhone, primaPin);
          console.log("✅ Prima789 authentication successful");
        } catch (prima789Error) {
          console.error(
            "❌ Prima789 authentication failed:",
            prima789Error.message
          );

          // Log failed attempt
          if (process.env.DATABASE_URL) {
            try {
              await queryDatabase(
                "INSERT INTO session_logs (line_user_id, action, ip_address, created_at) VALUES ($1, $2, $3, NOW())",
                [
                  lineUserId,
                  "sync_failed",
                  event.headers["x-forwarded-for"] || "unknown",
                ]
              );
            } catch (logError) {
              console.warn("Failed to log sync failure:", logError.message);
            }
          }

          return createResponse(401, {
            error: {
              message: prima789Error.message,
              code: "PRIMA789_AUTH_FAILED",
            },
          });
        }

        // Save/update user in database
        if (process.env.DATABASE_URL) {
          try {
            const upsertQuery = `
                          INSERT INTO user_accounts 
                          (line_user_id, prima_username, prima_phone, member_tier, credit_balance, last_sync, created_at, updated_at)
                          VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NOW())
                          ON CONFLICT (line_user_id) 
                          DO UPDATE SET 
                              prima_username = EXCLUDED.prima_username,
                              prima_phone = EXCLUDED.prima_phone,
                              member_tier = EXCLUDED.member_tier,
                              credit_balance = EXCLUDED.credit_balance,
                              last_sync = NOW(),
                              updated_at = NOW()
                          RETURNING *
                      `;

            const dbResult = await queryDatabase(upsertQuery, [
              lineUserId,
              primaUserData.username,
              primaUserData.phone,
              primaUserData.level,
              primaUserData.balance,
            ]);

            console.log("✅ User data saved to database");

            // Log successful sync
            await queryDatabase(
              "INSERT INTO session_logs (line_user_id, action, ip_address, created_at) VALUES ($1, $2, $3, NOW())",
              [
                lineUserId,
                "sync_success",
                event.headers["x-forwarded-for"] || "unknown",
              ]
            );
          } catch (dbError) {
            console.warn(
              "Database save failed, but Prima789 auth succeeded:",
              dbError.message
            );
            // Continue with response even if database save fails
          }
        }

        // Return successful sync response
        return createResponse(200, {
          success: true,
          message: "Account synchronized successfully with Prima789",
          user: {
            username: primaUserData.username,
            phone: primaUserData.phone,
            balance: primaUserData.balance,
            level: primaUserData.level,
            firstName: primaUserData.firstName,
            lastName: primaUserData.lastName,
            lastUpdated: primaUserData.lastUpdated,
          },
          source: "prima789_real",
        });
      } catch (error) {
        console.error("Sync error:", error);

        // Log error if possible
        if (event.body) {
          const body = JSON.parse(event.body || "{}");
          if (body.lineUserId && process.env.DATABASE_URL) {
            try {
              await queryDatabase(
                "INSERT INTO session_logs (line_user_id, action, ip_address, created_at) VALUES ($1, $2, $3, NOW())",
                [
                  body.lineUserId,
                  "sync_error",
                  event.headers["x-forwarded-for"] || "unknown",
                ]
              );
            } catch (logError) {
              console.warn("Failed to log sync error:", logError.message);
            }
          }
        }

        return createResponse(500, {
          error: {
            message: error.message || "Sync operation failed",
            code: "SYNC_ERROR",
          },
        });
      }
    }

    // Get usage statistics (if database available)
    if (path === "/stats" && method === "GET") {
      if (!process.env.DATABASE_URL) {
        return createResponse(200, {
          totalUsers: 0,
          memberTiers: { bronze: 0, silver: 0, gold: 0, platinum: 0 },
          averageBalance: 0,
          recentSyncs: 0,
          message: "Database not configured",
        });
      }

      try {
        const statsQuery = `
                  SELECT 
                      COUNT(*) as total_users,
                      COUNT(CASE WHEN member_tier = 'PLATINUM' THEN 1 END) as platinum_users,
                      COUNT(CASE WHEN member_tier = 'GOLD' THEN 1 END) as gold_users,
                      COUNT(CASE WHEN member_tier = 'SILVER' THEN 1 END) as silver_users,
                      COUNT(CASE WHEN member_tier = 'BRONZE' THEN 1 END) as bronze_users,
                      COALESCE(AVG(credit_balance), 0) as avg_balance
                  FROM user_accounts
              `;

        const recentSyncsQuery = `
                  SELECT COUNT(*) as recent_syncs
                  FROM session_logs
                  WHERE action = 'sync_success' 
                  AND created_at >= NOW() - INTERVAL '24 hours'
              `;

        const [statsResult, syncsResult] = await Promise.all([
          queryDatabase(statsQuery),
          queryDatabase(recentSyncsQuery),
        ]);

        const stats = statsResult.rows[0];
        const syncs = syncsResult.rows[0];

        return createResponse(200, {
          totalUsers: parseInt(stats.total_users),
          memberTiers: {
            platinum: parseInt(stats.platinum_users),
            gold: parseInt(stats.gold_users),
            silver: parseInt(stats.silver_users),
            bronze: parseInt(stats.bronze_users),
          },
          averageBalance: parseFloat(stats.avg_balance) || 0,
          recentSyncs: parseInt(syncs.recent_syncs),
          lastUpdated: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Stats error:", error);
        return createResponse(500, {
          error: {
            message: "Failed to get statistics",
            code: "STATS_ERROR",
          },
        });
      }
    }

    // Test Prima789 connection endpoint (for debugging)
    if (path === "/test-prima789" && method === "POST") {
      try {
        const body = JSON.parse(event.body || "{}");
        const { phone, pin } = body;

        if (!phone || !pin) {
          return createResponse(400, {
            error: { message: "Phone and PIN required for test" },
          });
        }

        const result = await authenticateWithPrima789(phone, pin);

        return createResponse(200, {
          success: true,
          message: "Prima789 connection test successful",
          data: result,
        });
      } catch (error) {
        return createResponse(400, {
          success: false,
          message: "Prima789 connection test failed",
          error: error.message,
        });
      }
    }

    // Route not found
    return createResponse(404, {
      error: {
        message: "API route not found",
        code: "NOT_FOUND",
        availableRoutes: [
          "/health",
          "/user/profile",
          "/user/sync",
          "/stats",
          "/test-prima789",
        ],
      },
    });
  } catch (error) {
    console.error("API Error:", error);
    return createResponse(500, {
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    });
  }
};
