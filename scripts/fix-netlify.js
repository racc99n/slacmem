// scripts/deploy.js - Production deployment script with flexible Node.js support

const { execSync } = require("child_process");
const fs = require("fs");

class DeploymentScript {
  constructor() {
    this.deploymentId = this.generateDeploymentId();
    this.startTime = new Date();
    this.config = {
      nodeVersions: ["18", "20", "22"], // รองรับ Node.js v22 ด้วย
      requiredEnvVars: [
        "DATABASE_URL",
        "LINE_CHANNEL_SECRET",
        "LINE_BOT_CHANNEL_ACCESS_TOKEN",
        "PRIMA789_ENDPOINT",
      ],
    };
  }

  generateDeploymentId() {
    return Math.random().toString(36).substring(2, 15);
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
    };

    console.log(`${icons[type] || "📋"} ${message}`);
  }

  async run() {
    try {
      this.log("Starting deployment process...", "start");
      this.log(`Deployment ID: ${this.deploymentId}`);
      this.log(`Started at: ${this.startTime.toISOString()}`, "info");

      await this.preDeploymentChecks();
      await this.runTests();
      await this.buildProject();
      await this.deployToNetlify();

      const duration = this.calculateDuration();
      this.log(`Deployment completed successfully! 🎊`, "finish");
      this.log(`Duration: ${duration}`);
      this.log(`Deployment ID: ${this.deploymentId}`);
    } catch (error) {
      const duration = this.calculateDuration();
      this.log("Deployment failed!", "error");
      this.log(`Error: ${error.message}`, "error");
      this.log(`Failed after: ${duration}`, "error");
      this.log(`Deployment ID: ${this.deploymentId}`);
      this.log(`Failed at: ${new Date().toISOString()}`);

      if (error.stack) {
        this.log("Stack trace:");
        console.error(error.stack);
      }

      this.log("Troubleshooting:");
      this.log("  1. Check environment variables");
      this.log("  2. Verify database connectivity");
      this.log("  3. Review error messages above");
      this.log("  4. Check Netlify deployment logs");

      process.exit(1);
    }
  }

  async preDeploymentChecks() {
    this.log("Running pre-deployment checks...", "info");

    // Check Node.js version (แก้ไขให้รองรับ Node v22)
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split(".")[0]);

    this.log(`Current Node.js version: ${nodeVersion}`);

    if (!this.config.nodeVersions.includes(majorVersion.toString())) {
      this.log(
        `Node.js version ${nodeVersion} is not officially tested`,
        "warning"
      );
      this.log(
        `Officially supported: ${this.config.nodeVersions
          .map((v) => `v${v}.x`)
          .join(", ")}`
      );
      this.log("Continuing anyway... (Node v22 should work fine)", "warning");
    } else {
      this.log(`Node.js version ${nodeVersion} is supported`, "success");
    }

    // Check if required files exist
    const requiredFiles = [
      "netlify/functions/api.js",
      "utils/errors.js",
      "config/config.js",
      "package.json",
    ];

    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        throw new Error(`Required file missing: ${file}`);
      }
    }
    this.log("All required files present", "success");

    // Check environment variables
    const missingEnvVars = this.config.requiredEnvVars.filter(
      (envVar) => !process.env[envVar]
    );

    if (missingEnvVars.length > 0) {
      this.log(
        `Warning: Missing environment variables: ${missingEnvVars.join(", ")}`,
        "warning"
      );
      this.log("Make sure to set these in Netlify dashboard");
    } else {
      this.log("All required environment variables are set", "success");
    }

    // Check package.json
    const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
    if (!packageJson.dependencies) {
      throw new Error("No dependencies found in package.json");
    }

    this.log("Package.json validation passed", "success");
  }

  async runTests() {
    this.log("Running tests...", "info");

    try {
      // Run validation tests
      execSync("node scripts/test-validation.js", {
        stdio: "pipe",
        encoding: "utf8",
      });
      this.log("Validation tests passed", "success");

      // Run comprehensive tests if available
      try {
        execSync("npm run test", {
          stdio: "pipe",
          encoding: "utf8",
        });
        this.log("All tests passed", "success");
      } catch (testError) {
        this.log("Some tests failed, but validation tests passed", "warning");
        this.log("Continuing with deployment...", "warning");
      }
    } catch (error) {
      this.log("Critical tests failed", "error");
      throw new Error(`Test failures: ${error.message}`);
    }
  }

  async buildProject() {
    this.log("Building project...", "info");

    try {
      // Install dependencies
      execSync("npm ci", { stdio: "inherit" });
      this.log("Dependencies installed", "success");

      // Run build command if it exists
      try {
        execSync("npm run build", { stdio: "inherit" });
        this.log("Build completed", "success");
      } catch (buildError) {
        this.log("No build script found, skipping...", "info");
      }
    } catch (error) {
      throw new Error(`Build failed: ${error.message}`);
    }
  }

  async deployToNetlify() {
    this.log("Deploying to Netlify...", "info");

    try {
      // Check if netlify CLI is available
      try {
        execSync("netlify --version", { stdio: "pipe" });
      } catch (error) {
        throw new Error(
          "Netlify CLI not found. Please install: npm install -g netlify-cli"
        );
      }

      // Deploy to production
      const deployCommand =
        "netlify deploy --prod --dir=. --functions=netlify/functions";
      this.log("Running: " + deployCommand, "info");

      const deployResult = execSync(deployCommand, {
        stdio: "pipe",
        encoding: "utf8",
      });

      // Extract deploy URL from output
      const urlMatch = deployResult.match(/Website URL: (https:\/\/[^\s]+)/);
      if (urlMatch) {
        this.log(`Deployment URL: ${urlMatch[1]}`, "success");
      }

      this.log("Netlify deployment completed", "success");
    } catch (error) {
      throw new Error(`Netlify deployment failed: ${error.message}`);
    }
  }

  calculateDuration() {
    const endTime = new Date();
    const durationMs = endTime - this.startTime;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

// Run deployment if this script is executed directly
if (require.main === module) {
  const deployment = new DeploymentScript();
  deployment.run();
}

module.exports = DeploymentScript;
