// scripts/deploy.js - Production deployment script

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

class DeploymentScript {
  constructor() {
    this.startTime = Date.now();
    this.deploymentId = this.generateDeploymentId();

    console.log("🚀 Starting deployment process...");
    console.log(`📋 Deployment ID: ${this.deploymentId}`);
    console.log(`🕐 Started at: ${new Date().toISOString()}`);
  }

  generateDeploymentId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
  }

  log(message, type = "info") {
    const icons = {
      info: "ℹ️",
      success: "✅",
      warning: "⚠️",
      error: "❌",
      step: "🔄",
    };

    console.log(`${icons[type]} ${message}`);
  }

  async run() {
    try {
      // Pre-deployment checks
      await this.preDeploymentChecks();

      // Environment validation
      await this.validateEnvironment();

      // Database checks
      await this.checkDatabase();

      // Build verification
      await this.verifyBuild();

      // Run tests
      await this.runTests();

      // Deploy to Netlify
      await this.deployToNetlify();

      // Post-deployment verification
      await this.postDeploymentChecks();

      // Success
      this.logSuccess();
    } catch (error) {
      this.logError(error);
      process.exit(1);
    }
  }

  async preDeploymentChecks() {
    this.log("Running pre-deployment checks...", "step");

    // Check Node.js version
    const nodeVersion = process.version;
    if (!nodeVersion.startsWith("v18.") && !nodeVersion.startsWith("v20.")) {
      throw new Error(
        `Unsupported Node.js version: ${nodeVersion}. Required: v18.x or v20.x`
      );
    }
    this.log(`Node.js version: ${nodeVersion}`, "success");

    // Check if git is clean
    try {
      const gitStatus = execSync("git status --porcelain", {
        encoding: "utf8",
      });
      if (gitStatus.trim()) {
        this.log("Git working directory is not clean", "warning");
        this.log("Uncommitted changes detected", "warning");
      } else {
        this.log("Git working directory is clean", "success");
      }
    } catch (error) {
      this.log("Could not check Git status", "warning");
    }

    // Check package.json
    if (!fs.existsSync("package.json")) {
      throw new Error("package.json not found");
    }
    this.log("package.json found", "success");

    // Check critical files
    const criticalFiles = [
      "netlify.toml",
      "netlify/functions/api.js",
      "public/prima789-liff-member-card.html",
      "config/config.js",
    ];

    for (const file of criticalFiles) {
      if (!fs.existsSync(file)) {
        throw new Error(`Critical file missing: ${file}`);
      }
    }
    this.log("All critical files present", "success");
  }

  async validateEnvironment() {
    this.log("Validating environment configuration...", "step");

    const requiredEnvVars = ["DATABASE_URL", "LIFF_ID"];

    const missingVars = [];

    for (const varName of requiredEnvVars) {
      if (!process.env[varName]) {
        missingVars.push(varName);
      }
    }

    if (missingVars.length > 0) {
      throw new Error(
        `Missing environment variables: ${missingVars.join(", ")}`
      );
    }

    // Validate LIFF_ID format
    const liffId = process.env.LIFF_ID;
    if (!liffId.match(/^\d{10}-[a-zA-Z0-9]+$/)) {
      throw new Error("Invalid LIFF_ID format");
    }

    // Validate DATABASE_URL
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl.startsWith("postgresql://")) {
      throw new Error("DATABASE_URL must be a PostgreSQL connection string");
    }

    this.log("Environment variables validated", "success");
  }

  async checkDatabase() {
    this.log("Checking database connectivity...", "step");

    try {
      const { Pool } = require("@neondatabase/serverless");
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });

      // Test connection
      const result = await pool.query("SELECT 1 as test");
      if (result.rows[0].test !== 1) {
        throw new Error("Database test query failed");
      }

      // Check if tables exist
      const tables = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('user_mappings', 'session_logs')
      `);

      const existingTables = tables.rows.map((row) => row.table_name);
      const requiredTables = ["user_mappings", "session_logs"];
      const missingTables = requiredTables.filter(
        (table) => !existingTables.includes(table)
      );

      if (missingTables.length > 0) {
        this.log(
          `Missing database tables: ${missingTables.join(", ")}`,
          "warning"
        );
        this.log('Run "npm run setup-db" to create missing tables', "info");
      } else {
        this.log("All required database tables exist", "success");
      }

      await pool.end();
      this.log("Database connectivity verified", "success");
    } catch (error) {
      throw new Error(`Database check failed: ${error.message}`);
    }
  }

  async verifyBuild() {
    this.log("Verifying build configuration...", "step");

    // Check if functions directory exists
    if (!fs.existsSync("netlify/functions")) {
      throw new Error("netlify/functions directory not found");
    }

    // Check API function
    const apiFunction = "netlify/functions/api.js";
    if (!fs.existsSync(apiFunction)) {
      throw new Error("API function not found");
    }

    // Try to require API function (syntax check)
    try {
      require(path.resolve(apiFunction));
      this.log("API function syntax validated", "success");
    } catch (error) {
      throw new Error(`API function syntax error: ${error.message}`);
    }

    // Check HTML file
    const htmlFile = "public/prima789-liff-member-card.html";
    const htmlContent = fs.readFileSync(htmlFile, "utf8");

    // Check for required elements
    const requiredElements = [
      "LIFF_ID",
      "API_BASE_URL",
      "loading-view",
      "login-view",
      "card-view",
      "error-view",
    ];

    for (const element of requiredElements) {
      if (!htmlContent.includes(element)) {
        throw new Error(`Required element missing in HTML: ${element}`);
      }
    }

    this.log("HTML file validated", "success");
    this.log("Build configuration verified", "success");
  }

  async runTests() {
    this.log("Running deployment tests...", "step");

    // Test configuration loading
    try {
      const config = require("../config/config");
      this.log("Configuration loaded successfully", "success");
    } catch (error) {
      throw new Error(`Configuration test failed: ${error.message}`);
    }

    // Test service imports
    try {
      require("../services/lineAuthService");
      require("../services/prima789Service");
      require("../services/databaseService");
      this.log("All services imported successfully", "success");
    } catch (error) {
      throw new Error(`Service import test failed: ${error.message}`);
    }

    // Test utilities
    try {
      require("../utils/logger");
      require("../utils/errors");
      require("../utils/rateLimiter");
      this.log("All utilities imported successfully", "success");
    } catch (error) {
      throw new Error(`Utility import test failed: ${error.message}`);
    }

    this.log("All tests passed", "success");
  }

  async deployToNetlify() {
    this.log("Deploying to Netlify...", "step");

    try {
      // Check if Netlify CLI is available
      execSync("netlify --version", { stdio: "ignore" });
    } catch (error) {
      throw new Error(
        "Netlify CLI not found. Install with: npm install -g netlify-cli"
      );
    }

    // Deploy
    try {
      this.log("Starting Netlify deployment...", "info");

      const deployCmd =
        process.env.NODE_ENV === "production"
          ? "netlify deploy --prod --timeout 300"
          : "netlify deploy --timeout 300";

      const output = execSync(deployCmd, {
        encoding: "utf8",
        stdio: "pipe",
      });

      // Extract deployment URL from output
      const urlMatch = output.match(/Website URL:\s+(https:\/\/[^\s]+)/);
      if (urlMatch) {
        this.deploymentUrl = urlMatch[1];
        this.log(`Deployment URL: ${this.deploymentUrl}`, "success");
      }

      this.log("Netlify deployment completed", "success");
    } catch (error) {
      throw new Error(`Netlify deployment failed: ${error.message}`);
    }
  }

  async postDeploymentChecks() {
    this.log("Running post-deployment checks...", "step");

    if (!this.deploymentUrl) {
      this.log(
        "Deployment URL not available, skipping health check",
        "warning"
      );
      return;
    }

    try {
      // Wait a bit for deployment to be ready
      await this.delay(10000);

      // Check health endpoint
      const healthUrl = `${this.deploymentUrl}/api/health`;
      const response = await fetch(healthUrl);

      if (!response.ok) {
        throw new Error(`Health check failed: HTTP ${response.status}`);
      }

      const healthData = await response.json();

      if (healthData.status !== "healthy" && healthData.status !== "degraded") {
        throw new Error(`Health check failed: ${healthData.status}`);
      }

      this.log(`Health check passed: ${healthData.status}`, "success");

      // Check main page
      const pageResponse = await fetch(
        `${this.deploymentUrl}/prima789-liff-member-card.html`
      );
      if (!pageResponse.ok) {
        throw new Error(`Main page check failed: HTTP ${pageResponse.status}`);
      }

      this.log("Main page accessible", "success");
      this.log("Post-deployment checks completed", "success");
    } catch (error) {
      this.log(`Post-deployment check failed: ${error.message}`, "warning");
      this.log("Deployment completed but some checks failed", "warning");
    }
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  logSuccess() {
    const duration = Date.now() - this.startTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    console.log("\n🎉 Deployment completed successfully!");
    console.log(`⏱️  Total time: ${minutes}m ${seconds}s`);
    console.log(`📋 Deployment ID: ${this.deploymentId}`);

    if (this.deploymentUrl) {
      console.log(`🌐 URL: ${this.deploymentUrl}`);
      console.log(`🔍 Health: ${this.deploymentUrl}/api/health`);
    }

    console.log(`🕐 Completed at: ${new Date().toISOString()}`);
    console.log("\n📝 Next steps:");
    console.log("  1. Test the application in LINE");
    console.log("  2. Monitor logs for any issues");
    console.log("  3. Update LINE LIFF settings if needed");
  }

  logError(error) {
    const duration = Date.now() - this.startTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    console.log("\n💥 Deployment failed!");
    console.log(`❌ Error: ${error.message}`);
    console.log(`⏱️  Failed after: ${minutes}m ${seconds}s`);
    console.log(`📋 Deployment ID: ${this.deploymentId}`);
    console.log(`🕐 Failed at: ${new Date().toISOString()}`);

    if (error.stack) {
      console.log("\n📋 Stack trace:");
      console.log(error.stack);
    }

    console.log("\n🔧 Troubleshooting:");
    console.log("  1. Check environment variables");
    console.log("  2. Verify database connectivity");
    console.log("  3. Review error messages above");
    console.log("  4. Check Netlify deployment logs");
  }
}

// Run deployment if called directly
if (require.main === module) {
  const deployment = new DeploymentScript();
  deployment.run();
}

module.exports = DeploymentScript;
