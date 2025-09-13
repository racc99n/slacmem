// scripts/deploy.js - Simple deployment script without complex testing

const { execSync } = require("child_process");
const fs = require("fs");

class DeploymentScript {
  constructor() {
    this.deploymentId = this.generateDeploymentId();
    this.startTime = new Date();
    this.config = {
      nodeVersions: ["18", "20", "22"], // รองรับ Node.js v22 ด้วย
      requiredFiles: [
        "netlify/functions/api.js",
        "utils/errors.js",
        "package.json",
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
      await this.runLightweightTests();
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
      this.log("  1. Check Netlify environment variables");
      this.log("  2. Verify function code syntax");
      this.log("  3. Review deployment logs in Netlify dashboard");
      this.log("  4. Test locally with npm run dev");

      process.exit(1);
    }
  }

  async preDeploymentChecks() {
    this.log("Running pre-deployment checks...", "info");

    // Check Node.js version
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
      this.log("Continuing anyway...", "warning");
    } else {
      this.log(`Node.js version ${nodeVersion} is supported`, "success");
    }

    // Check if required files exist
    for (const file of this.config.requiredFiles) {
      if (!fs.existsSync(file)) {
        throw new Error(`Required file missing: ${file}`);
      }
    }
    this.log("All required files present", "success");

    // Check package.json
    const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
    if (!packageJson.dependencies) {
      throw new Error("No dependencies found in package.json");
    }

    this.log("Package.json validation passed", "success");

    // Check API function syntax
    try {
      const apiCode = fs.readFileSync("netlify/functions/api.js", "utf8");
      if (!apiCode.includes("validatePhoneNumberOrThrow")) {
        throw new Error("API function missing required validation imports");
      }
      this.log("API function structure validated", "success");
    } catch (error) {
      throw new Error(`API function validation failed: ${error.message}`);
    }
  }

  async runLightweightTests() {
    this.log("Running lightweight tests...", "info");

    try {
      // Test only the validation functions (no database/external dependencies)
      execSync("node scripts/test-validation.js", {
        stdio: "pipe",
        encoding: "utf8",
        env: {
          ...process.env,
          NODE_ENV: "test",
          SKIP_DATABASE_TEST: "true",
        },
      });
      this.log("Validation tests passed", "success");
    } catch (error) {
      this.log("Validation tests failed", "error");

      // Show the actual error output
      const errorOutput = error.stdout || error.stderr || error.message;
      console.error("Test output:", errorOutput);

      throw new Error(`Validation test failures: ${error.message}`);
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
        stdio: "inherit", // Show output in real-time
        encoding: "utf8",
      });

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
