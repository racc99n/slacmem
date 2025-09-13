// scripts/monitor.js - Health monitoring and alerting script

const https = require("https");
const fs = require("fs");
const path = require("path");

class HealthMonitor {
  constructor(config = {}) {
    this.config = {
      url: config.url || "https://slaczcardmem.netlify.app",
      interval: config.interval || 5 * 60 * 1000, // 5 minutes
      timeout: config.timeout || 30000, // 30 seconds
      retries: config.retries || 3,
      logFile: config.logFile || "logs/monitor.log",
      alertThreshold: config.alertThreshold || 3, // consecutive failures
      ...config,
    };

    this.state = {
      isMonitoring: false,
      consecutiveFailures: 0,
      lastHealthy: null,
      lastCheck: null,
      history: [],
    };

    this.endpoints = [
      { path: "/api/health", name: "API Health", critical: true },
      {
        path: "/prima789-liff-member-card.html",
        name: "Main Page",
        critical: true,
      },
      {
        path: "/api/status",
        name: "Status Endpoint",
        critical: false,
        requiresAuth: true,
      },
    ];

    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    const logDir = path.dirname(this.config.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  log(message, level = "info") {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;

    console.log(logEntry.trim());

    try {
      fs.appendFileSync(this.config.logFile, logEntry);
    } catch (error) {
      console.error("Failed to write to log file:", error.message);
    }
  }

  async makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const req = https.request(
        url,
        {
          timeout: this.config.timeout,
          ...options,
        },
        (res) => {
          let data = "";

          res.on("data", (chunk) => {
            data += chunk;
          });

          res.on("end", () => {
            const duration = Date.now() - startTime;
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              data,
              duration,
            });
          });
        }
      );

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });

      req.on("error", (error) => {
        reject(error);
      });

      req.end();
    });
  }

  async checkEndpoint(endpoint) {
    const url = `${this.config.url}${endpoint.path}`;
    const result = {
      endpoint: endpoint.name,
      path: endpoint.path,
      success: false,
      statusCode: null,
      duration: null,
      error: null,
      timestamp: new Date().toISOString(),
    };

    try {
      const response = await this.makeRequest(url, {
        headers: endpoint.requiresAuth
          ? {
              Authorization: "Bearer dummy_token_for_test",
            }
          : {},
      });

      result.statusCode = response.statusCode;
      result.duration = response.duration;

      // Check if response is acceptable
      if (endpoint.requiresAuth && response.statusCode === 401) {
        // 401 is expected for auth-required endpoints without valid token
        result.success = true;
      } else if (response.statusCode >= 200 && response.statusCode < 400) {
        result.success = true;

        // Additional checks for API health endpoint
        if (endpoint.path === "/api/health") {
          try {
            const healthData = JSON.parse(response.data);
            result.healthData = healthData;

            // Check if all critical services are healthy
            if (healthData.status === "unhealthy") {
              result.success = false;
              result.error = "Service unhealthy";
            }
          } catch (error) {
            result.success = false;
            result.error = "Invalid health response format";
          }
        }
      } else {
        result.success = false;
        result.error = `HTTP ${response.statusCode}`;
      }
    } catch (error) {
      result.error = error.message;
    }

    return result;
  }

  async performHealthCheck() {
    this.log("Starting health check...");
    this.state.lastCheck = new Date().toISOString();

    const results = [];

    for (const endpoint of this.endpoints) {
      const result = await this.checkEndpoint(endpoint);
      results.push(result);

      const status = result.success ? "✅" : "❌";
      const duration = result.duration ? `${result.duration}ms` : "N/A";

      this.log(
        `${status} ${result.endpoint}: ${
          result.statusCode || "N/A"
        } (${duration})`,
        result.success ? "info" : "error"
      );

      if (!result.success && result.error) {
        this.log(`   Error: ${result.error}`, "error");
      }
    }

    // Determine overall health
    const criticalFailures = results.filter(
      (r) =>
        !r.success && this.endpoints.find((e) => e.path === r.path)?.critical
    );

    const overallHealth = {
      healthy: criticalFailures.length === 0,
      timestamp: this.state.lastCheck,
      results,
      criticalFailures: criticalFailures.length,
      totalEndpoints: this.endpoints.length,
    };

    // Update state
    if (overallHealth.healthy) {
      this.state.consecutiveFailures = 0;
      this.state.lastHealthy = this.state.lastCheck;
      this.log("✅ Overall health: HEALTHY");
    } else {
      this.state.consecutiveFailures++;
      this.log(
        `❌ Overall health: UNHEALTHY (${criticalFailures.length} critical failures)`
      );
      this.log(`   Consecutive failures: ${this.state.consecutiveFailures}`);
    }

    // Add to history (keep last 100 checks)
    this.state.history.push(overallHealth);
    if (this.state.history.length > 100) {
      this.state.history.shift();
    }

    // Check if alert should be sent
    if (this.state.consecutiveFailures >= this.config.alertThreshold) {
      await this.sendAlert(overallHealth);
    }

    return overallHealth;
  }

  async sendAlert(healthResult) {
    const message = this.buildAlertMessage(healthResult);

    this.log("🚨 ALERT: Service degradation detected", "error");
    this.log(message, "error");

    // Here you could integrate with external alerting services:
    // - Slack webhook
    // - Email service
    // - SMS service
    // - Discord webhook
    // - PagerDuty

    // Example Slack webhook (uncomment and configure):
    // await this.sendSlackAlert(message);

    // Example email alert (uncomment and configure):
    // await this.sendEmailAlert(message);
  }

  buildAlertMessage(healthResult) {
    const failedEndpoints = healthResult.results
      .filter((r) => !r.success)
      .map((r) => `- ${r.endpoint}: ${r.error || "Unknown error"}`)
      .join("\n");

    return `
🚨 PRIMA789 SERVICE ALERT 🚨

Service: ${this.config.url}
Status: UNHEALTHY
Consecutive failures: ${this.state.consecutiveFailures}
Timestamp: ${healthResult.timestamp}

Failed endpoints:
${failedEndpoints}

Last healthy: ${this.state.lastHealthy || "Unknown"}
    `.trim();
  }

  // Example Slack integration (configure webhook URL)
  async sendSlackAlert(message) {
    if (!process.env.SLACK_WEBHOOK_URL) {
      this.log("Slack webhook URL not configured", "warning");
      return;
    }

    try {
      const payload = {
        text: message,
        username: "Prima789 Monitor",
        icon_emoji: ":warning:",
        channel: "#alerts",
      };

      await this.makeRequest(process.env.SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      this.log("Alert sent to Slack", "info");
    } catch (error) {
      this.log(`Failed to send Slack alert: ${error.message}`, "error");
    }
  }

  generateReport() {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recent = this.state.history.filter(
      (h) => new Date(h.timestamp) > last24h
    );

    const totalChecks = recent.length;
    const healthyChecks = recent.filter((h) => h.healthy).length;
    const uptime =
      totalChecks > 0 ? ((healthyChecks / totalChecks) * 100).toFixed(2) : 0;

    const report = {
      period: "24 hours",
      totalChecks,
      healthyChecks,
      failedChecks: totalChecks - healthyChecks,
      uptime: `${uptime}%`,
      lastCheck: this.state.lastCheck,
      lastHealthy: this.state.lastHealthy,
      consecutiveFailures: this.state.consecutiveFailures,
      currentStatus:
        this.state.consecutiveFailures === 0 ? "HEALTHY" : "UNHEALTHY",
    };

    return report;
  }

  start() {
    if (this.state.isMonitoring) {
      this.log("Monitor is already running", "warning");
      return;
    }

    this.state.isMonitoring = true;
    this.log(`Starting health monitor (interval: ${this.config.interval}ms)`);

    // Initial check
    this.performHealthCheck();

    // Set up interval
    this.monitorInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.interval);

    // Set up report interval (every hour)
    this.reportInterval = setInterval(() => {
      const report = this.generateReport();
      this.log(
        `📊 24h Report: ${report.uptime} uptime (${report.healthyChecks}/${report.totalChecks} checks)`
      );
    }, 60 * 60 * 1000);
  }

  stop() {
    if (!this.state.isMonitoring) {
      this.log("Monitor is not running", "warning");
      return;
    }

    this.state.isMonitoring = false;

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    if (this.reportInterval) {
      clearInterval(this.reportInterval);
    }

    this.log("Health monitor stopped");
  }

  async runOnce() {
    const result = await this.performHealthCheck();
    const report = this.generateReport();

    console.log("\n📊 Health Check Report:");
    console.log(`Status: ${result.healthy ? "✅ HEALTHY" : "❌ UNHEALTHY"}`);
    console.log(`Timestamp: ${result.timestamp}`);
    console.log(`Critical failures: ${result.criticalFailures}`);

    if (this.state.history.length > 0) {
      console.log(`\n📈 24h Statistics:`);
      console.log(`Uptime: ${report.uptime}`);
      console.log(`Total checks: ${report.totalChecks}`);
      console.log(`Failed checks: ${report.failedChecks}`);
    }

    console.log("\n🔍 Endpoint Details:");
    result.results.forEach((r) => {
      const status = r.success ? "✅" : "❌";
      const duration = r.duration ? `${r.duration}ms` : "N/A";
      console.log(
        `  ${status} ${r.endpoint}: ${r.statusCode || "N/A"} (${duration})`
      );
      if (!r.success && r.error) {
        console.log(`     Error: ${r.error}`);
      }
    });

    return result;
  }
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const monitor = new HealthMonitor({
    url: process.env.MONITOR_URL || "https://slaczcardmem.netlify.app",
  });

  switch (command) {
    case "start":
      monitor.start();

      // Graceful shutdown
      process.on("SIGINT", () => {
        console.log("\nShutting down monitor...");
        monitor.stop();
        process.exit(0);
      });

      process.on("SIGTERM", () => {
        console.log("\nShutting down monitor...");
        monitor.stop();
        process.exit(0);
      });

      break;

    case "check":
      monitor
        .runOnce()
        .then(() => {
          process.exit(0);
        })
        .catch((error) => {
          console.error("Health check failed:", error.message);
          process.exit(1);
        });
      break;

    case "report":
      const report = monitor.generateReport();
      console.log("📊 Health Report:");
      console.log(JSON.stringify(report, null, 2));
      break;

    default:
      console.log("Usage: node monitor.js <command>");
      console.log("Commands:");
      console.log("  start  - Start continuous monitoring");
      console.log("  check  - Run single health check");
      console.log("  report - Generate health report");
      process.exit(1);
  }
}

module.exports = HealthMonitor;
