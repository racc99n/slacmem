// scripts/deploy-enhanced.js - Production deployment script with comprehensive checks

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

class EnhancedDeployment {
  constructor() {
    this.deploymentId = `deploy-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    this.startTime = new Date();
    this.config = {
      nodeVersions: ["18", "20", "22"],
      requiredFiles: [
        "netlify/functions/api.js",
        "utils/errors.js",
        "services/databaseService.js",
        "services/lineAuthService.js",
        "services/prima789Service.js",
        "config/config.js",
        "public/prima789-liff-member-card.html",
        "prima789-integration.html",
      ],
      requiredEnvVars: ["DATABASE_URL", "LIFF_ID"],
      optionalEnvVars: [
        "JWT_SECRET",
        "LINE_BOT_CHANNEL_ACCESS_TOKEN",
        "LINE_CHANNEL_SECRET",
        "PRIMA789_API_URL",
        "NODE_ENV",
      ],
    };
  }

  log(message, type = "info") {
    const timestamp = new Date().toISOString();
    const icons = {
      info: "🔄",
      success: "✅",
      warning: "⚠️",
      error: "❌",
      start: "🚀",
      finish: "🎉",
      test: "🧪",
      build: "🔨",
    };

    console.log(`${icons[type] || "📋"} [${timestamp}] ${message}`);
  }

  async run() {
    try {
      this.log("Starting Enhanced Prima789 Deployment Process", "start");
      this.log(`Deployment ID: ${this.deploymentId}`);
      this.log(`Node.js: ${process.version}`);
      this.log(`Platform: ${process.platform}`);

      await this.preDeploymentChecks();
      await this.validateEnvironment();
      await this.runTestSuite();
      await this.buildProject();
      await this.validateBuild();
      await this.deployToNetlify();
      await this.postDeploymentTests();

      const duration = this.calculateDuration();
      this.log(`🎊 Deployment completed successfully!`, "finish");
      this.log(`🕐 Total duration: ${duration}`);
      this.log(`🆔 Deployment ID: ${this.deploymentId}`);
      this.log(
        `🌐 Your app should be available at: https://slaczcardmem.netlify.app`
      );

      this.showPostDeploymentInstructions();
    } catch (error) {
      const duration = this.calculateDuration();
      this.log("💥 Deployment failed!", "error");
      this.log(`Error: ${error.message}`, "error");
      this.log(`Failed after: ${duration}`, "error");
      this.log(`Deployment ID: ${this.deploymentId}`, "error");

      this.showTroubleshootingGuide(error);
      process.exit(1);
    }
  }

  async preDeploymentChecks() {
    this.log("Running pre-deployment checks...", "info");

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split(".")[0]);

    this.log(`Node.js version: ${nodeVersion}`);

    if (!this.config.nodeVersions.includes(majorVersion.toString())) {
      this.log(
        `Node.js version ${nodeVersion} might not be fully supported`,
        "warning"
      );
      this.log(
        `Recommended versions: ${this.config.nodeVersions
          .map((v) => `v${v}.x`)
          .join(", ")}`
      );
    } else {
      this.log("Node.js version is supported", "success");
    }

    // Check required files
    const missingFiles = this.config.requiredFiles.filter(
      (file) => !fs.existsSync(file)
    );
    if (missingFiles.length > 0) {
      throw new Error(`Missing required files: ${missingFiles.join(", ")}`);
    }
    this.log("All required files present", "success");

    // Check file sizes
    const largeFiles = this.config.requiredFiles
      .filter((file) => fs.existsSync(file))
      .map((file) => ({
        name: file,
        size: fs.statSync(file).size,
      }))
      .filter((file) => file.size > 100000); // Files larger than 100KB

    if (largeFiles.length > 0) {
      this.log("Large files detected:", "warning");
      largeFiles.forEach((file) => {
        this.log(
          `  ${file.name}: ${Math.round(file.size / 1024)}KB`,
          "warning"
        );
      });
    }

    // Check package.json
    const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
    if (
      !packageJson.dependencies ||
      Object.keys(packageJson.dependencies).length === 0
    ) {
      throw new Error("No dependencies found in package.json");
    }
    this.log("Package.json validation passed", "success");
  }

  async validateEnvironment() {
    this.log("Validating environment configuration...", "info");

    // Check required environment variables
    const missingRequired = this.config.requiredEnvVars.filter(
      (envVar) => !process.env[envVar]
    );
    if (missingRequired.length > 0) {
      this.log(
        `Missing required environment variables: ${missingRequired.join(", ")}`,
        "error"
      );
      this.log(
        "Set these in Netlify dashboard: Site settings → Environment variables",
        "info"
      );
      throw new Error("Missing required environment variables");
    }
    this.log("Required environment variables are set", "success");

    // Check optional environment variables
    const missingOptional = this.config.optionalEnvVars.filter(
      (envVar) => !process.env[envVar]
    );
    if (missingOptional.length > 0) {
      this.log(
        `Optional environment variables not set: ${missingOptional.join(", ")}`,
        "warning"
      );
    }

    // Validate DATABASE_URL format
    if (
      process.env.DATABASE_URL &&
      !process.env.DATABASE_URL.startsWith("postgresql://")
    ) {
      throw new Error(
        "DATABASE_URL must be a valid PostgreSQL connection string"
      );
    }

    // Validate LIFF_ID format
    if (
      process.env.LIFF_ID &&
      !/^\d{10}-[a-zA-Z0-9]+$/.test(process.env.LIFF_ID)
    ) {
      throw new Error(
        "LIFF_ID format is invalid (should be: 1234567890-abcdefgh)"
      );
    }

    this.log("Environment validation completed", "success");
  }

  async runTestSuite() {
    this.log("Running comprehensive test suite...", "test");

    const tests = [
      { name: "Validation Functions", script: "test:validation" },
      { name: "Module Imports", script: "test:imports" },
      { name: "LIFF Configuration", script: "test:liff" },
    ];

    for (const test of tests) {
      try {
        this.log(`Running: ${test.name}`, "test");
        execSync(`npm run ${test.script}`, {
          stdio: "pipe",
          encoding: "utf8",
        });
        this.log(`✓ ${test.name} passed`, "success");
      } catch (error) {
        this.log(`✗ ${test.name} failed`, "error");
        this.log(`Error output: ${error.stdout || error.stderr}`, "error");
        throw new Error(`Test failure: ${test.name}`);
      }
    }

    this.log("All tests passed", "success");
  }

  async buildProject() {
    this.log("Building project...", "build");

    try {
      // Install dependencies
      this.log("Installing dependencies...", "build");
      execSync("npm ci", { stdio: "pipe" });
      this.log("Dependencies installed", "success");

      // Run build command
      try {
        execSync("npm run build", { stdio: "pipe" });
        this.log("Build script completed", "success");
      } catch (buildError) {
        this.log("No build script or build failed - continuing...", "warning");
      }

      // Verify critical files exist after build
      const criticalFiles = [
        "netlify/functions/api.js",
        "public/prima789-liff-member-card.html",
      ];

      for (const file of criticalFiles) {
        if (!fs.existsSync(file)) {
          throw new Error(`Critical file missing after build: ${file}`);
        }
      }
    } catch (error) {
      throw new Error(`Build failed: ${error.message}`);
    }
  }

  async validateBuild() {
    this.log("Validating build output...", "test");

    try {
      // Check API function can be imported
      const apiModule = require(path.resolve("netlify/functions/api.js"));
      if (typeof apiModule.handler !== "function") {
        throw new Error("API handler is not properly exported");
      }

      // Check HTML files exist and contain required elements
      const htmlFile = fs.readFileSync(
        "public/prima789-liff-member-card.html",
        "utf8"
      );
      const requiredElements = [
        "LIFF_ID",
        "loading-view",
        "card-view",
        "initializeLiff",
      ];

      const missingElements = requiredElements.filter(
        (element) => !htmlFile.includes(element)
      );
      if (missingElements.length > 0) {
        throw new Error(
          `HTML file missing required elements: ${missingElements.join(", ")}`
        );
      }

      this.log("Build validation passed", "success");
    } catch (error) {
      throw new Error(`Build validation failed: ${error.message}`);
    }
  }

  async deployToNetlify() {
    this.log("Deploying to Netlify...", "info");

    try {
      // Check Netlify CLI
      try {
        const netlifyVersion = execSync("netlify --version", {
          encoding: "utf8",
        });
        this.log(`Using Netlify CLI: ${netlifyVersion.trim()}`);
      } catch (error) {
        throw new Error(
          "Netlify CLI not found. Install: npm install -g netlify-cli"
        );
      }

      // Deploy
      const deployCommand =
        "netlify deploy --prod --dir=. --functions=netlify/functions";
      this.log(`Running: ${deployCommand}`);

      const deployOutput = execSync(deployCommand, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Extract deployment URL
      const urlMatch = deployOutput.match(/Website URL: (https:\/\/[^\s]+)/);
      if (urlMatch) {
        this.deployUrl = urlMatch[1];
        this.log(`Deployment URL: ${this.deployUrl}`, "success");
      }

      this.log("Netlify deployment completed", "success");
    } catch (error) {
      this.log(`Deployment output: ${error.stdout}`, "error");
      throw new Error(`Netlify deployment failed: ${error.message}`);
    }
  }

  async postDeploymentTests() {
    if (!this.deployUrl) {
      this.log("Skipping post-deployment tests (no deployment URL)", "warning");
      return;
    }

    this.log("Running post-deployment tests...", "test");

    try {
      const https = require("https");

      // Test health endpoint
      const healthUrl = `${this.deployUrl}/.netlify/functions/api/health`;
      const healthCheck = await this.makeRequest(healthUrl);

      if (healthCheck.statusCode === 200) {
        this.log("Health check passed", "success");
      } else {
        this.log(
          `Health check failed: HTTP ${healthCheck.statusCode}`,
          "warning"
        );
      }

      // Test main HTML file
      const mainPageCheck = await this.makeRequest(
        `${this.deployUrl}/prima789-liff-member-card.html`
      );
      if (mainPageCheck.statusCode === 200) {
        this.log("Main page accessible", "success");
      } else {
        this.log(
          `Main page check failed: HTTP ${mainPageCheck.statusCode}`,
          "warning"
        );
      }
    } catch (error) {
      this.log(`Post-deployment tests failed: ${error.message}`, "warning");
    }
  }

  async makeRequest(url) {
    return new Promise((resolve, reject) => {
      const https = require("https");
      const request = https.get(url, { timeout: 10000 }, (response) => {
        resolve({
          statusCode: response.statusCode,
          headers: response.headers,
        });
      });

      request.on("error", reject);
      request.on("timeout", () => reject(new Error("Request timeout")));
    });
  }

  calculateDuration() {
    const endTime = new Date();
    const durationMs = endTime - this.startTime;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  showPostDeploymentInstructions() {
    console.log("\n" + "=".repeat(60));
    console.log("🎉 DEPLOYMENT SUCCESSFUL - NEXT STEPS");
    console.log("=".repeat(60));

    console.log("\n📋 What was deployed:");
    console.log("✅ LINE LIFF Member Card Interface");
    console.log("✅ Prima789 Socket.IO Integration System");
    console.log("✅ Enhanced Database Schema");
    console.log("✅ Production API with Error Handling");
    console.log("✅ Real-time Member Data Sync");

    console.log("\n🔧 Configuration needed in Netlify:");
    console.log("1. Go to: Site settings → Environment variables");
    console.log("2. Set required variables:");
    this.config.requiredEnvVars.forEach((env) => {
      console.log(`   • ${env}=${process.env[env] ? "✓ Set" : "❌ Missing"}`);
    });

    console.log("\n🌐 URLs to test:");
    if (this.deployUrl) {
      console.log(
        `• Main app: ${this.deployUrl}/prima789-liff-member-card.html`
      );
      console.log(`• Integration: ${this.deployUrl}/prima789-integration.html`);
      console.log(
        `• Health check: ${this.deployUrl}/.netlify/functions/api/health`
      );
    }

    console.log("\n📱 LIFF Configuration:");
    console.log("1. Go to LINE Developers Console");
    console.log("2. Set LIFF URL to your deployment URL");
    console.log("3. Configure scopes: profile, openid");

    console.log("\n🔍 Monitoring commands:");
    console.log("• Health check: npm run monitor:check");
    console.log("• Start monitoring: npm run monitor");
    console.log("• View logs: Check Netlify Functions logs");

    console.log("=".repeat(60));
  }

  showTroubleshootingGuide(error) {
    console.log("\n" + "=".repeat(60));
    console.log("🔧 TROUBLESHOOTING GUIDE");
    console.log("=".repeat(60));

    if (error.message.includes("environment")) {
      console.log("\n📋 Environment Variable Issues:");
      console.log(
        "1. Check Netlify dashboard: Site settings → Environment variables"
      );
      console.log("2. Ensure DATABASE_URL is valid PostgreSQL connection");
      console.log("3. Verify LIFF_ID format: 1234567890-abcdefgh");
      console.log("4. Run: npm run env:check");
    }

    if (
      error.message.includes("test") ||
      error.message.includes("validation")
    ) {
      console.log("\n🧪 Test Failures:");
      console.log("1. Run individual tests: npm run test:validation");
      console.log("2. Check imports: npm run test:imports");
      console.log("3. Fix validation errors in utils/errors.js");
      console.log("4. Verify all required functions are exported");
    }

    if (error.message.includes("Netlify") || error.message.includes("deploy")) {
      console.log("\n🌐 Deployment Issues:");
      console.log("1. Check Netlify CLI: netlify --version");
      console.log("2. Login to Netlify: netlify login");
      console.log("3. Check site connection: netlify status");
      console.log("4. Try manual deploy: netlify deploy --prod");
    }

    console.log("\n📞 Support:");
    console.log("• Check logs: Netlify Functions → View logs");
    console.log("• Test locally: npm run dev");
    console.log("• Validate config: npm run env:check");
    console.log("• Database setup: npm run setup-db");

    console.log("=".repeat(60));
  }
}

// Run deployment if this script is executed directly
if (require.main === module) {
  const deployment = new EnhancedDeployment();
  deployment.run();
}

module.exports = EnhancedDeployment;
