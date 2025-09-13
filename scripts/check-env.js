// scripts/check-env.js - Environment validation script

const path = require("path");

// Load environment variables from .env file if it exists
try {
  require("dotenv").config({ path: path.join(__dirname, "../.env") });
} catch (error) {
  // dotenv not available, continue without it
  console.log(
    "ℹ️ dotenv not available, using system environment variables only"
  );
}

class EnvironmentChecker {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.info = [];
  }

  log(message, type = "info") {
    const icons = {
      info: "ℹ️",
      success: "✅",
      warning: "⚠️",
      error: "❌",
    };

    console.log(`${icons[type]} ${message}`);

    switch (type) {
      case "error":
        this.errors.push(message);
        break;
      case "warning":
        this.warnings.push(message);
        break;
      default:
        this.info.push(message);
    }
  }

  checkRequiredVariables() {
    this.log("Checking required environment variables...", "info");

    const required = [
      {
        name: "DATABASE_URL",
        description: "Neon PostgreSQL connection string",
        validator: (value) => value && value.startsWith("postgresql://"),
        example: "postgresql://user:pass@host/db",
      },
      {
        name: "LIFF_ID",
        description: "LINE LIFF Application ID",
        validator: (value) => value && /^\d{10}-[a-zA-Z0-9]+$/.test(value),
        example: "1234567890-abcdefgh",
      },
    ];

    const optional = [
      {
        name: "JWT_SECRET",
        description: "JWT signing secret (auto-generated if not provided)",
        default: "auto-generated",
      },
      {
        name: "NODE_ENV",
        description: "Node.js environment",
        default: "development",
        values: ["development", "staging", "production"],
      },
      {
        name: "LOG_LEVEL",
        description: "Logging level",
        default: "info",
        values: ["error", "warn", "info", "debug"],
      },
      {
        name: "API_RATE_LIMIT",
        description: "API rate limit (requests per window)",
        default: "100",
        validator: (value) => !value || (!isNaN(value) && parseInt(value) > 0),
      },
      {
        name: "PRIMA789_TIMEOUT",
        description: "Prima789 API timeout in milliseconds",
        default: "20000",
        validator: (value) => !value || (!isNaN(value) && parseInt(value) > 0),
      },
      {
        name: "ALLOWED_ORIGINS",
        description: "CORS allowed origins (comma-separated)",
        default: "https://liff.line.me",
      },
    ];

    // Check required variables
    for (const env of required) {
      const value = process.env[env.name];

      if (!value) {
        this.log(`Missing required variable: ${env.name}`, "error");
        this.log(`  Description: ${env.description}`, "error");
        this.log(`  Example: ${env.example}`, "error");
      } else if (env.validator && !env.validator(value)) {
        this.log(`Invalid format for ${env.name}`, "error");
        this.log(`  Expected format: ${env.example}`, "error");
        this.log(`  Current value: ${value.substring(0, 20)}...`, "error");
      } else {
        this.log(`${env.name}: ✓ Valid`, "success");
      }
    }

    // Check optional variables
    for (const env of optional) {
      const value = process.env[env.name];

      if (!value) {
        this.log(`${env.name}: Using default (${env.default})`, "info");
      } else if (env.validator && !env.validator(value)) {
        this.log(`Invalid value for ${env.name}: ${value}`, "warning");
        if (env.values) {
          this.log(`  Valid values: ${env.values.join(", ")}`, "warning");
        }
      } else if (env.values && !env.values.includes(value)) {
        this.log(`Unusual value for ${env.name}: ${value}`, "warning");
        this.log(`  Common values: ${env.values.join(", ")}`, "warning");
      } else {
        this.log(`${env.name}: ✓ ${value}`, "success");
      }
    }
  }

  async checkDatabaseConnection() {
    this.log("Checking database connection...", "info");

    if (!process.env.DATABASE_URL) {
      this.log("DATABASE_URL not set, skipping database check", "warning");
      return;
    }

    try {
      const { Pool } = require("@neondatabase/serverless");
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 10000,
      });

      const result = await pool.query(
        "SELECT NOW() as current_time, version() as pg_version"
      );
      const { current_time, pg_version } = result.rows[0];

      this.log("Database connection: ✓ Connected", "success");
      this.log(`  Server time: ${current_time}`, "info");
      this.log(
        `  PostgreSQL version: ${pg_version.split(" ")[0]} ${
          pg_version.split(" ")[1]
        }`,
        "info"
      );

      // Check tables
      const tables = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);

      const tableNames = tables.rows.map((row) => row.table_name);
      const requiredTables = ["user_mappings", "session_logs"];
      const missingTables = requiredTables.filter(
        (table) => !tableNames.includes(table)
      );

      if (missingTables.length > 0) {
        this.log(`Missing tables: ${missingTables.join(", ")}`, "warning");
        this.log("Run: npm run setup-db", "warning");
      } else {
        this.log("Required tables: ✓ All present", "success");
      }

      await pool.end();
    } catch (error) {
      this.log(`Database connection failed: ${error.message}`, "error");

      if (error.message.includes("timeout")) {
        this.log(
          "  Possible causes: Network issues, incorrect host/port",
          "error"
        );
      } else if (error.message.includes("authentication")) {
        this.log("  Possible causes: Incorrect username/password", "error");
      } else if (
        error.message.includes("database") &&
        error.message.includes("does not exist")
      ) {
        this.log("  Possible causes: Database name incorrect", "error");
      }
    }
  }

  checkNodeEnvironment() {
    this.log("Checking Node.js environment...", "info");

    const nodeVersion = process.version;
    const npmVersion = process.env.npm_version || "unknown";

    this.log(`Node.js version: ${nodeVersion}`, "info");
    this.log(`NPM version: ${npmVersion}`, "info");

    // Check Node.js version
    const majorVersion = parseInt(nodeVersion.slice(1).split(".")[0]);
    if (majorVersion < 18) {
      this.log(
        `Node.js ${nodeVersion} is not supported. Required: >= 18.0.0`,
        "error"
      );
    } else {
      this.log("Node.js version: ✓ Supported", "success");
    }

    // Check memory and other limits
    const memoryUsage = process.memoryUsage();
    this.log(
      `Memory usage: ${Math.round(
        memoryUsage.heapUsed / 1024 / 1024
      )}MB / ${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      "info"
    );

    // Check for required files
    const fs = require("fs");
    const requiredFiles = [
      "package.json",
      "netlify.toml",
      "netlify/functions/api.js",
      "public/prima789-liff-member-card.html",
      "config/config.js",
    ];

    const missingFiles = requiredFiles.filter((file) => !fs.existsSync(file));
    if (missingFiles.length > 0) {
      this.log(`Missing files: ${missingFiles.join(", ")}`, "error");
    } else {
      this.log("Required files: ✓ All present", "success");
    }
  }

  checkNetworkConnectivity() {
    this.log("Checking network connectivity...", "info");

    const testUrls = [
      { name: "LINE API", url: "https://api.line.me" },
      { name: "Prima789", url: "https://prima789.net" },
      { name: "Netlify", url: "https://netlify.com" },
    ];

    // Note: In a real environment, you might want to implement actual network checks
    // For now, we'll just log the URLs that should be accessible
    testUrls.forEach((test) => {
      this.log(`Should be accessible: ${test.name} (${test.url})`, "info");
    });

    this.log(
      "Network connectivity check requires manual verification",
      "warning"
    );
  }

  generateSummary() {
    console.log("\n" + "=".repeat(60));
    console.log("🔍 ENVIRONMENT CHECK SUMMARY");
    console.log("=".repeat(60));

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log("🎉 All checks passed! Environment is ready for deployment.");
    } else {
      if (this.errors.length > 0) {
        console.log(`❌ ${this.errors.length} error(s) found:`);
        this.errors.forEach((error) => console.log(`   • ${error}`));
        console.log("");
      }

      if (this.warnings.length > 0) {
        console.log(`⚠️  ${this.warnings.length} warning(s):`);
        this.warnings.forEach((warning) => console.log(`   • ${warning}`));
        console.log("");
      }

      if (this.errors.length > 0) {
        console.log(
          "🚫 Environment has critical issues. Please fix errors before deploying."
        );
      } else {
        console.log(
          "⚠️  Environment has warnings but should work. Consider fixing warnings."
        );
      }
    }

    console.log("=".repeat(60));

    return {
      success: this.errors.length === 0,
      errors: this.errors.length,
      warnings: this.warnings.length,
      details: {
        errors: this.errors,
        warnings: this.warnings,
        info: this.info,
      },
    };
  }

  async run() {
    console.log("🔍 Prima789 LIFF Environment Check\n");

    this.checkNodeEnvironment();
    console.log("");

    this.checkRequiredVariables();
    console.log("");

    await this.checkDatabaseConnection();
    console.log("");

    this.checkNetworkConnectivity();

    return this.generateSummary();
  }
}

// Export for use in other scripts
module.exports = EnvironmentChecker;

// Run if called directly
if (require.main === module) {
  const checker = new EnvironmentChecker();

  checker
    .run()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Environment check failed:", error.message);
      process.exit(1);
    });
}
