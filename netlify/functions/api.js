// netlify/functions/api.js - Production-ready API handler with Mock Mode

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

// Check if we're in mock mode (no database available)
const MOCK_MODE = !process.env.DATABASE_URL;

// Services (only import if not in mock mode)
let lineAuthService, prima789Service, databaseService;

if (!MOCK_MODE) {
  lineAuthService = require("../../services/lineAuthService");
  prima789Service = require("../../services/prima789Service");
  databaseService = require("../../services/databaseService");
}

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
 * Mock Authentication (for demo purposes)
 */
function mockAuthenticate(headers) {
  const authHeader = headers.authorization || headers.Authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AuthenticationError("Missing or invalid authorization header");
  }

  // In mock mode, return a fake user ID
  return "mock-line-user-" + Math.random().toString(36).substring(2, 8);
}

/**
 * Mock Member Data Generator
 */
function generateMockMemberData(phoneNumber) {
  const mockUsernames = [
    "MEMBER001",
    "PRIMA789VIP",
    "GOLDMEMBER",
    "SILVERMEMBER",
  ];

  const mockTiers = ["Bronze", "Silver", "Gold", "Platinum", "VIP"];
  const mockBalances = ["฿1,250", "฿5,680", "฿12,450", "฿25,800", "฿50,000"];

  // Generate consistent data based on phone number
  const phoneHash = phoneNumber
    .split("")
    .reduce((a, b) => a + b.charCodeAt(0), 0);

  return {
    primaUsername: mockUsernames[phoneHash % mockUsernames.length],
    memberTier: mockTiers[phoneHash % mockTiers.length],
    creditBalance: mockBalances[phoneHash % mockBalances.length],
    syncedAt: new Date().toISOString(),
    lastLogin: new Date(Date.now() - Math.random() * 86400000).toISOString(),
    totalGames: Math.floor(phoneHash % 1000) + 100,
    winRate: (65 + (phoneHash % 30)).toFixed(1) + "%",
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

    // Apply rate limiting (skip in mock mode)
    if (!MOCK_MODE) {
      const rateLimitResult = rateLimiter.middleware()(event);
      if (rateLimitResult) {
        return rateLimitResult;
      }
    }

    // Get the API path
    const path =
      event.path.replace(/(\.netlify\/functions\/api|\/api)/, "") || "/";

    // Log request (simplified in mock mode)
    const clientInfo = {
      method: event.httpMethod,
      path,
      ip: event.headers["x-forwarded-for"] || "unknown",
      userAgent: event.headers["user-agent"] || "unknown",
      mockMode: MOCK_MODE,
    };

    console.log("API Request:", JSON.stringify(clientInfo));

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
    const duration = Date.now() - startTime;
    console.log("API Response:", {
      statusCode: response.statusCode,
      duration: `${duration}ms`,
      mockMode: MOCK_MODE,
    });

    return response;
  } catch (error) {
    console.error("Unhandled API error:", {
      error: error.message,
      stack: error.stack,
      path: event.path,
      method: event.httpMethod,
      mockMode: MOCK_MODE,
    });

    return createResponse(
      {
        error: {
          message: MOCK_MODE ? "Demo mode error" : "Internal server error",
          code: "INTERNAL_ERROR",
          ...(MOCK_MODE && { note: "Running in demo mode without database" }),
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
  let lineUserId;

  // Authentication
  if (MOCK_MODE) {
    lineUserId = mockAuthenticate(event.headers);
  } else {
    lineUserId = await lineAuthService.authenticateRequest(event.headers);
  }

  console.log("Status check for user:", lineUserId.substring(0, 10) + "***");

  if (MOCK_MODE) {
    // Mock response - no user is synced initially
    return createResponse({
      synced: false,
      mockMode: true,
      note: "Demo mode - use any valid phone number and PIN to test",
    });
  }

  // Real database logic (when not in mock mode)
  const clientIP = event.headers["x-forwarded-for"] || "unknown";
  const userAgent = event.headers["user-agent"] || "unknown";

  await databaseService.logSession(
    lineUserId,
    "status_check",
    clientIP,
    userAgent
  );

  const userMapping = await databaseService.findUserMapping(lineUserId);

  if (userMapping) {
    const memberData = {
      primaUsername: userMapping.prima_username,
      memberTier: "Standard",
      creditBalance: "N/A",
      syncedAt: userMapping.updated_at,
    };

    return createResponse({
      synced: true,
      memberData,
    });
  } else {
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
  let lineUserId;

  // Authentication
  if (MOCK_MODE) {
    lineUserId = mockAuthenticate(event.headers);
  } else {
    lineUserId = await lineAuthService.authenticateRequest(event.headers);
  }

  // Parse and validate request body
  let requestData;
  try {
    requestData = JSON.parse(event.body || "{}");
  } catch (error) {
    throw new ValidationError("Invalid JSON in request body");
  }

  const { username, password } = requestData;

  // Validate required fields
  validateRequired(username, "username");
  validateRequired(password, "password");

  // Validate field formats
  validatePhoneNumberOrThrow(username);
  validatePINOrThrow(password);

  console.log("Sync attempt:", {
    user: lineUserId.substring(0, 10) + "***",
    phone: username.replace(/\d(?=\d{4})/g, "*"),
    mockMode: MOCK_MODE,
  });

  if (MOCK_MODE) {
    // Mock sync logic
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate processing time

    // Generate mock member data
    const memberData = generateMockMemberData(username);

    console.log("Mock sync successful:", {
      user: lineUserId.substring(0, 10) + "***",
      member: memberData.primaUsername,
    });

    return createResponse({
      synced: true,
      memberData,
      mockMode: true,
      note: "Demo mode - this is simulated data",
    });
  }

  // Real sync logic (when not in mock mode)
  const clientIP = event.headers["x-forwarded-for"] || "unknown";
  const userAgent = event.headers["user-agent"] || "unknown";

  await databaseService.logSession(
    lineUserId,
    "sync_attempt",
    clientIP,
    userAgent
  );

  try {
    const memberData = await prima789Service.authenticateUser(
      username,
      password
    );

    await databaseService.upsertUserMapping(
      lineUserId,
      memberData.primaUsername
    );

    await databaseService.logSession(
      lineUserId,
      "sync_success",
      clientIP,
      userAgent
    );

    return createResponse({
      synced: true,
      memberData,
    });
  } catch (error) {
    await databaseService.logSession(
      lineUserId,
      "sync_failed",
      clientIP,
      userAgent
    );

    throw error;
  }
}

/**
 * Handle health check endpoint
 * GET /api/health
 */
async function handleHealthCheck(event) {
  const healthChecks = {
    api: true,
    database: MOCK_MODE ? "mock" : false,
    lineAPI: MOCK_MODE ? "mock" : false,
    prima789: MOCK_MODE ? "mock" : false,
    mockMode: MOCK_MODE,
    overall: MOCK_MODE ? "demo" : false,
  };

  try {
    if (MOCK_MODE) {
      // Mock health check
      healthChecks.overall = "demo";
    } else {
      // Real health checks
      healthChecks.database = await databaseService.healthCheck();
      healthChecks.lineAPI = await lineAuthService.healthCheck();
      healthChecks.prima789 = await prima789Service.healthCheck();
      healthChecks.overall =
        healthChecks.database && healthChecks.lineAPI && healthChecks.prima789;
    }

    const statusCode =
      healthChecks.overall === true || healthChecks.overall === "demo"
        ? 200
        : 503;

    return createResponse(
      {
        status: MOCK_MODE
          ? "demo"
          : healthChecks.overall
          ? "healthy"
          : "degraded",
        checks: healthChecks,
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        note: MOCK_MODE
          ? "Running in demo mode without external dependencies"
          : undefined,
      },
      statusCode
    );
  } catch (error) {
    console.error("Health check failed:", error.message);

    return createResponse(
      {
        status: "unhealthy",
        checks: healthChecks,
        error: error.message,
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        mockMode: MOCK_MODE,
      },
      503
    );
  }
}

module.exports = { handler };
