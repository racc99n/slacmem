// netlify/functions/api.js - API with proper validation imports

// Import validation functions (required for static analysis)
const {
  validatePhoneNumberOrThrow,
  validatePINOrThrow,
  ValidationError,
  AuthenticationError,
  createErrorResponse,
} = require("../../utils/errors");

/**
 * CORS headers for responses
 */
const corsHeaders = {
  "Access-Control-Allow-Origin":
    process.env.NODE_ENV === "production"
      ? "https://prima168.online,https://liff.line.me,https://slaczcardmem.netlify.app"
      : "*",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Requested-With, X-LINE-ChannelId, X-LINE-ChannelSecret",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
};

/**
 * Create success response
 */
function createResponse(data, statusCode = 200) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(data),
  };
}

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
 * Main API handler
 */
async function handler(event, context) {
  const startTime = Date.now();

  try {
    // Handle preflight requests
    if (event.httpMethod === "OPTIONS") {
      return handleOptions();
    }

    // Get the API path
    const path =
      event.path.replace(/(\.netlify\/functions\/api|\/api)/, "") || "/";

    console.log("API Request:", {
      method: event.httpMethod,
      path: path,
      ip: event.headers["x-forwarded-for"] || "unknown",
      userAgent: event.headers["user-agent"]
        ? event.headers["user-agent"].substring(0, 50) + "..."
        : "unknown",
    });

    // Route handling
    if (event.httpMethod === "GET" && path.startsWith("/health")) {
      return handleHealthCheck(event);
    } else if (event.httpMethod === "GET" && path.startsWith("/status")) {
      return handleStatusCheck(event);
    } else if (event.httpMethod === "POST" && path.startsWith("/sync")) {
      return handleSync(event);
    } else {
      return createResponse(
        {
          error: {
            message: "Route not found",
            code: "NOT_FOUND",
            availableRoutes: ["/health", "/status", "/sync"],
          },
        },
        404
      );
    }
  } catch (error) {
    console.error("API Error:", {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });

    return createResponse(
      {
        error: {
          message: "Internal server error",
          code: "INTERNAL_ERROR",
          debug:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        },
      },
      500
    );
  }
}

/**
 * Handle health check endpoint
 * GET /api/health
 */
async function handleHealthCheck(event) {
  const healthChecks = {
    api: true,
    database: false,
    lineAPI: false,
    prima789: false,
    validation: false,
  };

  // Test validation functions
  try {
    validatePhoneNumberOrThrow("0812345678");
    validatePINOrThrow("1234");
    healthChecks.validation = true;
  } catch (error) {
    console.error("Validation function test failed:", error.message);
  }

  // Try to check database if available
  try {
    if (process.env.DATABASE_URL) {
      healthChecks.database = true; // Assume working for now
    }
  } catch (error) {
    console.error("Database health check failed:", error.message);
  }

  // Check LINE API availability
  try {
    if (process.env.LIFF_ID) {
      healthChecks.lineAPI = true; // Assume working for now
    }
  } catch (error) {
    console.error("LINE API health check failed:", error.message);
  }

  // Check Prima789 availability
  try {
    if (process.env.PRIMA789_API_URL) {
      healthChecks.prima789 = true; // Assume working for now
    }
  } catch (error) {
    console.error("Prima789 health check failed:", error.message);
  }

  const overall = healthChecks.api && healthChecks.validation;
  const statusCode = overall ? 200 : 503;

  return createResponse(
    {
      status: overall ? "healthy" : "degraded",
      checks: healthChecks,
      timestamp: new Date().toISOString(),
      version: "2.0.0",
      environment: process.env.NODE_ENV || "development",
      nodeVersion: process.version,
      validationFunctionsWorking: healthChecks.validation,
    },
    statusCode
  );
}

/**
 * Handle status check endpoint
 * GET /api/status
 */
async function handleStatusCheck(event) {
  const authHeader = event.headers.authorization;

  if (!authHeader) {
    return createResponse(
      {
        error: {
          message: "Authorization header is missing",
          code: "AUTH_REQUIRED",
        },
      },
      401
    );
  }

  if (!authHeader.startsWith("Bearer ")) {
    return createResponse(
      {
        error: {
          message: "Authorization header must use Bearer token",
          code: "AUTH_INVALID",
        },
      },
      401
    );
  }

  // For now, return not synced (would check database in production)
  return createResponse({
    synced: false,
    message: "User not found in database",
  });
}

/**
 * Handle sync endpoint
 * POST /api/sync
 */
async function handleSync(event) {
  try {
    // Parse request body
    const requestData = JSON.parse(event.body || "{}");
    const {
      lineUserId,
      lineDisplayName,
      phone,
      primaUsername,
      memberTier,
      creditBalance,
    } = requestData;

    // Validate required fields using imported functions
    if (!phone) {
      throw new ValidationError("Phone number is required", "phone");
    }

    if (!primaUsername) {
      throw new ValidationError("Prima username is required", "primaUsername");
    }

    // Validate phone format
    validatePhoneNumberOrThrow(phone);

    // For now, just return success (would save to database in production)
    return createResponse({
      synced: true,
      memberData: {
        phone: phone,
        primaUsername: primaUsername,
        memberTier: memberTier || "Standard",
        creditBalance: creditBalance || "0.00",
        syncedAt: new Date().toISOString(),
      },
      message: "Sync successful (demo mode)",
    });
  } catch (error) {
    console.error("Sync error:", error.message);

    if (error instanceof ValidationError) {
      return createResponse(
        {
          error: {
            message: error.message,
            code: "VALIDATION_ERROR",
            field: error.field,
          },
        },
        400
      );
    }

    return createResponse(
      {
        error: {
          message: "Sync failed",
          code: "SYNC_ERROR",
        },
      },
      500
    );
  }
}

// Main handler function
exports.handler = async (event, context) => {
  // Handle OPTIONS preflight requests
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  try {
    // ตรวจสอบ Origin ที่อนุญาต
    const origin = event.headers.origin || event.headers.Origin;
    const allowedOrigins = [
      "https://prima168.online",
      "https://liff.line.me",
      "https://slaczcardmem.netlify.app",
      "http://localhost:8888", // สำหรับ development
    ];

    let responseHeaders = { ...corsHeaders };

    if (allowedOrigins.includes(origin)) {
      responseHeaders["Access-Control-Allow-Origin"] = origin;
    }

    // ส่วนที่เหลือของ API logic
    const path = event.path.replace("/.netlify/functions/api", "");
    const method = event.httpMethod;

    // Route handling
    if (path === "/health" && method === "GET") {
      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          status: "ok",
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV || "development",
        }),
      };
    }

    // Other API routes...

    return {
      statusCode: 404,
      headers: responseHeaders,
      body: JSON.stringify({ error: "Endpoint not found" }),
    };
  } catch (error) {
    console.error("API Error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Internal server error",
        message:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      }),
    };
  }
};
