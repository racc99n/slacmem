// netlify/functions/api.js - Minimal working API for testing

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
    const path = event.path.replace(/(\.netlify\/functions\/api|\/api)/, "") || "/";

    console.log("API Request:", {
      method: event.httpMethod,
      path: path,
      ip: event.headers["x-forwarded-for"] || "unknown",
    });

    // Route handling
    if (event.httpMethod === "GET" && path.startsWith("/health")) {
      return handleHealthCheck(event);
    } else if (event.httpMethod === "GET" && path.startsWith("/status")) {
      return handleStatusCheck(event);
    } else if (event.httpMethod === "POST" && path.startsWith("/sync")) {
      return handleSync(event);
    } else {
      return createResponse({
        error: {
          message: "Route not found",
          code: "NOT_FOUND",
          availableRoutes: ["/health", "/status", "/sync"]
        },
      }, 404);
    }

  } catch (error) {
    console.error("API Error:", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });

    return createResponse({
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
        debug: process.env.NODE_ENV === "development" ? error.message : undefined
      },
    }, 500);
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
  };

  // Try to check database if available
  try {
    if (process.env.DATABASE_URL) {
      // Minimal database check
      healthChecks.database = true; // We'll assume it's working for now
    }
  } catch (error) {
    console.error("Database health check failed:", error.message);
  }

  // Check LINE API availability  
  try {
    if (process.env.LIFF_ID) {
      healthChecks.lineAPI = true; // We'll assume it's working for now
    }
  } catch (error) {
    console.error("LINE API health check failed:", error.message);
  }

  // Check Prima789 availability
  try {
    if (process.env.PRIMA789_API_URL) {
      healthChecks.prima789 = true; // We'll assume it's working for now
    }
  } catch (error) {
    console.error("Prima789 health check failed:", error.message);
  }

  const overall = healthChecks.api && (healthChecks.database || healthChecks.lineAPI);
  const statusCode = overall ? 200 : 503;

  return createResponse({
    status: overall ? "healthy" : "degraded",
    checks: healthChecks,
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    nodeVersion: process.version
  }, statusCode);
}

/**
 * Handle status check endpoint
 * GET /api/status
 */
async function handleStatusCheck(event) {
  // For now, just return not authenticated
  return createResponse({
    error: {
      message: "Authentication required",
      code: "AUTH_REQUIRED"
    }
  }, 401);
}

/**
 * Handle sync endpoint  
 * POST /api/sync
 */
async function handleSync(event) {
  // For now, just return not implemented
  return createResponse({
    error: {
      message: "Sync functionality not yet implemented",
      code: "NOT_IMPLEMENTED"
    }
  }, 501);
}

// Export handler
module.exports = { handler };
