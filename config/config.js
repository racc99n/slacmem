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
    // เพิ่ม configuration สำหรับ LIFF
    channelAccessToken: process.env.LINE_BOT_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
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
      ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
      : [
          "https://liff.line.me",
          "https://prima168.online",
          "https://slaczcardmem.netlify.app",
        ],
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
  if (
    !config.line.liffId ||
    !config.line.liffId.match(/^\d{10}-[a-zA-Z0-9]+$/)
  ) {
    throw new Error(
      "Invalid LIFF_ID format. Expected format: 1234567890-abcdef123"
    );
  }

  // แก้ไข: ตรวจสอบ DATABASE_URL แบบ flexible แทน hardcoded
  if (
    !config.database.url ||
    !config.database.url.startsWith("postgresql://")
  ) {
    throw new Error(
      "DATABASE_URL must be a valid PostgreSQL connection string"
    );
  }

  // ตรวจสอบ LINE credentials สำหรับ production
  if (config.app.environment === "production") {
    if (!config.line.channelAccessToken) {
      console.warn("⚠️  LINE_BOT_CHANNEL_ACCESS_TOKEN is not set");
    }
    if (!config.line.channelSecret) {
      console.warn("⚠️  LINE_CHANNEL_SECRET is not set");
    }
  }

  console.log("✅ Configuration validation passed");
  console.log(`🌐 Environment: ${config.app.environment}`);
  console.log(`📱 LIFF ID: ${config.line.liffId}`);
  console.log(`🔗 Allowed Origins: ${config.app.allowedOrigins.join(", ")}`);
}

// Initialize and validate configuration
try {
  validateConfig();
} catch (error) {
  console.error("❌ Configuration validation failed:", error.message);

  // ในกรณี development ให้แสดงข้อมูลเพิ่มเติม
  if (process.env.NODE_ENV !== "production") {
    console.error("📋 Current environment variables:");
    console.error(
      "- DATABASE_URL:",
      process.env.DATABASE_URL ? "✅ Set" : "❌ Missing"
    );
    console.error("- LIFF_ID:", process.env.LIFF_ID ? "✅ Set" : "❌ Missing");
    console.error("- NODE_ENV:", process.env.NODE_ENV || "development");
  }

  process.exit(1);
}

module.exports = config;
