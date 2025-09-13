// config/config.js - Production-ready configuration management

const requiredEnvVars = ["DATABASE_URL", "LIFF_ID"];

const config = {
  // Database
  database: {
    url: process.env.DATABASE_URL,
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS) || 10,
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 30000,
  },

  // LINE Configuration
  line: {
    liffId: process.env.LIFF_ID,
    verifyUrl: "https://api.line.me/oauth2/v2.1/verify",
  },

  // Security
  security: {
    jwtSecret:
      process.env.JWT_SECRET || "default-jwt-secret-change-in-production",
    rateLimitRequests: parseInt(process.env.API_RATE_LIMIT) || 100,
    rateLimitWindow: parseInt(process.env.API_RATE_WINDOW) || 15 * 60 * 1000, // 15 minutes
  },

  // Prima789 Integration
  prima789: {
    apiUrl: process.env.PRIMA789_API_URL || "https://prima789.net",
    timeout: parseInt(process.env.PRIMA789_TIMEOUT) || 20000,
    retryAttempts: parseInt(process.env.PRIMA789_RETRY_ATTEMPTS) || 3,
    retryDelay: parseInt(process.env.PRIMA789_RETRY_DELAY) || 1000,
  },

  // Application
  app: {
    environment: process.env.NODE_ENV || "development",
    logLevel: process.env.LOG_LEVEL || "info",
    allowedOrigins: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : ["https://liff.line.me"],
  },
};

// Validation function
function validateConfig() {
  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}`
    );
  }

  // Additional validations
  if (!config.line.liffId.match(/^\d{10}-[a-zA-Z0-9]+$/)) {
    throw new Error("Invalid LIFF_ID format");
  }

  if (
    !config.database.url.startsWith(
      "postgresql://neondb_owner:npg_vnxlqOo5h6Ek@ep-green-union-a1wh8z25-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    )
  ) {
    throw new Error(
      "DATABASE_URL must be a valid PostgreSQL connection string"
    );
  }

  console.log("✅ Configuration validation passed");
}

// Initialize and validate configuration
try {
  validateConfig();
} catch (error) {
  console.error("❌ Configuration validation failed:", error.message);
  process.exit(1);
}

module.exports = config;
