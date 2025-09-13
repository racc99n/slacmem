// netlify/functions/api.js - Fixed Production-ready API handler

const config = require("../../config/config");
const logger = require("../../utils/logger");
const rateLimiter = require("../../utils/rateLimiter");
const {
  asyncHandler,
  ValidationError,
  AuthenticationError,
  validateRequired,
  validatePhoneNumberOrThrow,
  validatePINOrThrow,
} = require("../../utils/errors");

// Services
const lineAuthService = require("../../services/lineAuthService");
const prima789Service = require("../../services/prima789Service");
const databaseService = require("../../services/databaseService");

/**
 * CORS headers for responses
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

/**
 * Handle preflight requests
 */
function handleOptions() {
  return {
    statusCode: 204,
    headers: corsHeaders,
    body: "",
  };
}

/**
 * Create success response
 */
function createResponse(data, statusCode = 200, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...corsHeaders, ...extraHeaders },
    body: JSON.stringify(data),
  };
}

/**
 * Main API handler
 */
const handler = asyncHandler(async (event, context) => {
  const startTime = Date.now();

  try {
    // Handle preflight requests
    if (event.httpMethod === "OPTIONS") {
      return handleOptions();
    }

    // Apply rate limiting
    const rateLimitResult = rateLimiter.middleware()(event);
    if (rateLimitResult) {
      return rateLimitResult;
    }

    // Get the API path
    const path =
      event.path.replace(/(\.netlify\/functions\/api|\/api)/, "") || "/";

    logger.info("API Request", {
      method: event.httpMethod,
      path,
      ip: event.headers["x-forwarded-for"] || "unknown",
      userAgent: event.headers["user-agent"] || "unknown",
    });

    // Route handling
    let response;

    if (event.httpMethod === "GET" && path.startsWith("/status")) {
      response = await handleStatusCheck(event);
    } else if (event.httpMethod === "POST" && path.startsWith("/sync")) {
      response = await handleSync(event);
    } else if (event.httpMethod === "GET" && path.startsWith("/health")) {
      response = await handleHealthCheck(event);
    } else {
      response = createResponse(
        {
          error: {
            message: "Route not found",
            code: "NOT_FOUND",
          },
        },
        404
      );
    }

    // Log response
    logger.logRequest(
      { method: event.httpMethod, url: path },
      { statusCode: response.statusCode },
      startTime
    );

    return response;
  } catch (error) {
    logger.error("Unhandled error in API handler", {
      error: error.message,
      stack: error.stack,
      path: event.path,
      method: event.httpMethod,
    });

    return createResponse(
      {
        error: {
          message: "Internal server error",
          code: "INTERNAL_ERROR",
        },
      },
      500
    );
  }
});

/**
 * Handle status check endpoint
 * GET /api/status
 */
async function handleStatusCheck(event) {
  // Authenticate request
  const lineUserId = await lineAuthService.authenticateRequest(event.headers);

  // Log session activity
  const clientIP = event.headers["x-forwarded-for"] || "unknown";
  const userAgent = event.headers["user-agent"] || "unknown";
  await databaseService.logSession(
    lineUserId,
    "status_check",
    clientIP,
    userAgent
  );

  // Check if user is synced
  const userMapping = await databaseService.findUserMapping(lineUserId);

  if (userMapping) {
    // User is synced - return member data
    const memberData = {
      phone: userMapping.prima_phone || userMapping.prima_username,
      primaUsername: userMapping.prima_username,
      memberTier: userMapping.member_tier || "Standard",
      creditBalance: userMapping.credit_balance || "0.00",
      syncedAt: userMapping.updated_at,
    };

    logger.info("Status check - user synced", {
      lineUserId: lineUserId.substring(0, 10) + "***",
      primaUsername: userMapping.prima_username?.replace(/./g, "*"),
    });

    return createResponse({
      synced: true,
      memberData,
    });
  } else {
    // User not synced
    logger.info("Status check - user not synced", {
      lineUserId: lineUserId.substring(0, 10) + "***",
    });

    return createResponse({
      synced: false,
    });
  }
}

/**
 * Handle sync endpoint
 * POST /api/sync
 */
async function handleSync(event) {
  // Parse and validate request body
  let requestData;
  try {
    requestData = JSON.parse(event.body || "{}");
  } catch (error) {
    throw new ValidationError("Invalid JSON in request body");
  }

  const {
    lineUserId,
    lineDisplayName,
    phone,
    primaUsername,
    memberTier,
    creditBalance,
  } = requestData;

  // Validate required fields
  validateRequired(lineUserId, "lineUserId");
  validateRequired(phone, "phone");
  validateRequired(primaUsername, "primaUsername");

  // Log sync attempt
  const clientIP = event.headers["x-forwarded-for"] || "unknown";
  const userAgent = event.headers["user-agent"] || "unknown";

  await databaseService.logSession(
    lineUserId,
    "sync_attempt",
    clientIP,
    userAgent
  );

  logger.info("Sync attempt started", {
    lineUserId: lineUserId.substring(0, 10) + "***",
    phone: phone.replace(/\d(?=\d{4})/g, "*"),
  });

  try {
    // Save user mapping to database with additional Prima789 data
    const mappingData = {
      line_user_id: lineUserId,
      line_display_name: lineDisplayName || "",
      prima_username: primaUsername,
      prima_phone: phone,
      member_tier: memberTier || "Standard",
      credit_balance: creditBalance || "0.00",
    };

    await databaseService.upsertUserMappingWithData(mappingData);

    // Log successful sync
    await databaseService.logSession(
      lineUserId,
      "sync_success",
      clientIP,
      userAgent
    );

    logger.info("Sync completed successfully", {
      lineUserId: lineUserId.substring(0, 10) + "***",
      primaUsername: primaUsername.replace(/./g, "*"),
    });

    return createResponse({
      synced: true,
      memberData: {
        phone: phone,
        primaUsername: primaUsername,
        memberTier: memberTier || "Standard",
        creditBalance: creditBalance || "0.00",
        syncedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    // Log failed sync
    await databaseService.logSession(
      lineUserId,
      "sync_failed",
      clientIP,
      userAgent
    );

    logger.warn("Sync failed", {
      lineUserId: lineUserId.substring(0, 10) + "***",
      phone: phone.replace(/\d(?=\d{4})/g, "*"),
      error: error.message,
    });

    // Re-throw to be handled by error middleware
    throw error;
  }
}

/**
 * Handle health check endpoint
 * GET /api/health
 */
async function handleHealthCheck(event) {
  const healthChecks = {
    database: false,
    lineAPI: false,
    prima789: false,
    overall: false,
  };

  try {
    // Check database health
    healthChecks.database = await databaseService.healthCheck();

    // Check LINE API health
    healthChecks.lineAPI = await lineAuthService.healthCheck();

    // Check Prima789 health
    healthChecks.prima789 = await prima789Service.healthCheck();

    // Overall health
    healthChecks.overall =
      healthChecks.database && healthChecks.lineAPI && healthChecks.prima789;

    const statusCode = healthChecks.overall ? 200 : 503;

    logger.info("Health check completed", {
      ...healthChecks,
      statusCode,
    });

    return createResponse(
      {
        status: healthChecks.overall ? "healthy" : "degraded",
        checks: healthChecks,
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        environment: process.env.NODE_ENV || "development",
      },
      statusCode
    );
  } catch (error) {
    logger.error("Health check failed", { error: error.message });

    return createResponse(
      {
        status: "unhealthy",
        checks: healthChecks,
        error: error.message,
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      },
      503
    );
  }
}

module.exports = { handler };
