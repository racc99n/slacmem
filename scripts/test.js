// scripts/test.js - Comprehensive testing script for Prima789 LIFF

require("dotenv").config();

class TestRunner {
  constructor() {
    this.tests = [];
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
    };
    this.startTime = Date.now();
  }

  log(message, type = "info") {
    const icons = {
      info: "ℹ️",
      success: "✅",
      warning: "⚠️",
      error: "❌",
      test: "🧪",
    };

    console.log(`${icons[type]} ${message}`);
  }

  async test(name, testFn, options = {}) {
    this.results.total++;
    const testStart = Date.now();

    try {
      this.log(`Running: ${name}`, "test");

      if (options.skip) {
        this.log(`Skipped: ${name} (${options.skip})`, "warning");
        this.results.skipped++;
        return;
      }

      await testFn();

      const duration = Date.now() - testStart;
      this.log(`Passed: ${name} (${duration}ms)`, "success");
      this.results.passed++;
    } catch (error) {
      const duration = Date.now() - testStart;
      this.log(`Failed: ${name} (${duration}ms)`, "error");
      this.log(`  Error: ${error.message}`, "error");

      if (options.debug && error.stack) {
        console.log(`  Stack: ${error.stack}`);
      }

      this.results.failed++;

      if (options.critical) {
        throw new Error(`Critical test failed: ${name}`);
      }
    }
  }

  async testConfigurationLoading() {
    await this.test(
      "Configuration Loading",
      async () => {
        const config = require("../config/config");

        if (!config.database?.url) {
          throw new Error("Database configuration missing");
        }

        if (!config.line?.liffId) {
          throw new Error("LINE configuration missing");
        }

        if (!config.security?.jwtSecret) {
          throw new Error("Security configuration missing");
        }
      },
      { critical: true }
    );
  }

  async testServiceImports() {
    await this.test(
      "Service Imports",
      async () => {
        // Test LINE Auth Service
        const lineAuth = require("../services/lineAuthService");
        if (typeof lineAuth.verifyIdToken !== "function") {
          throw new Error(
            "LINE auth service verifyIdToken not properly exported"
          );
        }
        if (typeof lineAuth.authenticateRequest !== "function") {
          throw new Error(
            "LINE auth service authenticateRequest not properly exported"
          );
        }

        // Test Prima789 Service
        const prima789 = require("../services/prima789Service");
        if (typeof prima789.authenticateUser !== "function") {
          throw new Error(
            "Prima789 service authenticateUser not properly exported"
          );
        }
        if (typeof prima789.validateCredentials !== "function") {
          throw new Error(
            "Prima789 service validateCredentials not properly exported"
          );
        }

        // Test Database Service
        const database = require("../services/databaseService");
        if (typeof database.findUserMapping !== "function") {
          throw new Error(
            "Database service findUserMapping not properly exported"
          );
        }
        if (typeof database.upsertUserMapping !== "function") {
          throw new Error(
            "Database service upsertUserMapping not properly exported"
          );
        }
        if (typeof database.healthCheck !== "function") {
          throw new Error("Database service healthCheck not properly exported");
        }

        // Test that Prima789 service can access validation functions
        try {
          // This should not throw an error for valid credentials
          prima789.validateCredentials("0812345678", "1234");
        } catch (error) {
          // This is expected for this test, just checking if function exists and runs
          if (error.message.includes("not defined")) {
            throw new Error(
              "Prima789 service cannot access validation functions"
            );
          }
        }
      },
      { critical: true }
    );
  }

  async testUtilityImports() {
    await this.test(
      "Utility Imports",
      async () => {
        const logger = require("../utils/logger");
        const errors = require("../utils/errors");
        const rateLimiter = require("../utils/rateLimiter");

        if (typeof logger.info !== "function") {
          throw new Error("Logger not properly exported");
        }

        if (typeof errors.AppError !== "function") {
          throw new Error("Error classes not properly exported");
        }

        if (typeof rateLimiter.isAllowed !== "function") {
          throw new Error("Rate limiter not properly exported");
        }
      },
      { critical: true }
    );
  }

  async testDatabaseConnection() {
    const shouldSkip = !process.env.DATABASE_URL
      ? "DATABASE_URL not set"
      : null;

    await this.test(
      "Database Connection",
      async () => {
        const database = require("../services/databaseService");
        const healthy = await database.healthCheck();

        if (!healthy) {
          throw new Error("Database health check failed");
        }
      },
      { skip: shouldSkip }
    );
  }

  async testDatabaseOperations() {
    const shouldSkip = !process.env.DATABASE_URL
      ? "DATABASE_URL not set"
      : null;

    await this.test(
      "Database Operations",
      async () => {
        const database = require("../services/databaseService");

        // Test with dummy data
        const testUserId = "test_user_" + Date.now();
        const testUsername = "test_username_" + Date.now();

        try {
          // Test upsert
          const mapping = await database.upsertUserMapping(
            testUserId,
            testUsername
          );
          if (!mapping || mapping.line_user_id !== testUserId) {
            throw new Error("Upsert operation failed");
          }

          // Test find
          const found = await database.findUserMapping(testUserId);
          if (!found || found.prima_username !== testUsername) {
            throw new Error("Find operation failed");
          }

          // Test delete
          const deleted = await database.deleteUserMapping(testUserId);
          if (!deleted) {
            throw new Error("Delete operation failed");
          }

          // Verify deletion
          const notFound = await database.findUserMapping(testUserId);
          if (notFound) {
            throw new Error("User mapping still exists after deletion");
          }
        } catch (error) {
          // Cleanup in case of failure
          try {
            await database.deleteUserMapping(testUserId);
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
          throw error;
        }
      },
      { skip: shouldSkip }
    );
  }

  async testValidationFunctions() {
    await this.test("Validation Functions", async () => {
      const {
        validatePhoneNumber,
        validatePIN,
        validatePhoneNumberOrThrow,
        validatePINOrThrow,
        ValidationError,
      } = require("../utils/errors");

      // Test boolean validation functions
      // Test valid phone numbers
      if (!validatePhoneNumber("0812345678")) {
        throw new Error("Valid phone number rejected");
      }

      if (!validatePhoneNumber("0651234567")) {
        throw new Error("Valid phone number (06x) rejected");
      }

      // Test invalid phone numbers
      if (validatePhoneNumber("123")) {
        throw new Error("Invalid phone number accepted");
      }

      if (validatePhoneNumber("0512345678")) {
        throw new Error("Invalid phone number (05x) accepted");
      }

      // Test valid PIN
      if (!validatePIN("1234")) {
        throw new Error("Valid PIN rejected");
      }

      // Test invalid PIN
      if (validatePIN("abc")) {
        throw new Error("Invalid PIN accepted");
      }

      if (validatePIN("12345")) {
        throw new Error("5-digit PIN accepted");
      }

      // Test throwing validation functions
      try {
        validatePhoneNumberOrThrow("0812345678");
        // Should not throw for valid phone
      } catch (error) {
        throw new Error("Valid phone number caused exception");
      }

      try {
        validatePhoneNumberOrThrow("invalid");
        throw new Error("Invalid phone number should have thrown");
      } catch (error) {
        if (!(error instanceof ValidationError)) {
          throw new Error("Wrong error type for invalid phone");
        }
      }

      try {
        validatePINOrThrow("1234");
        // Should not throw for valid PIN
      } catch (error) {
        throw new Error("Valid PIN caused exception");
      }

      try {
        validatePINOrThrow("abc");
        throw new Error("Invalid PIN should have thrown");
      } catch (error) {
        if (!(error instanceof ValidationError)) {
          throw new Error("Wrong error type for invalid PIN");
        }
      }
    });
  }

  async testRateLimiting() {
    await this.test("Rate Limiting", async () => {
      const rateLimiter = require("../utils/rateLimiter");

      // Mock event object
      const mockEvent = {
        headers: {
          "x-forwarded-for": "127.0.0.1",
          "user-agent": "test-agent",
        },
      };

      // Test normal operation
      const result1 = rateLimiter.isAllowed(mockEvent);
      if (!result1.allowed) {
        throw new Error("Rate limiter incorrectly blocked request");
      }

      // Test that remaining count decreases
      const result2 = rateLimiter.isAllowed(mockEvent);
      if (result2.remaining >= result1.remaining) {
        throw new Error("Rate limiter not tracking requests");
      }
    });
  }

  async testErrorHandling() {
    await this.test("Error Handling", async () => {
      const {
        AppError,
        ValidationError,
        AuthenticationError,
        handleError,
      } = require("../utils/errors");

      // Test error creation
      const appError = new AppError("Test error", 500, "TEST_ERROR");
      if (appError.statusCode !== 500 || appError.code !== "TEST_ERROR") {
        throw new Error("AppError not working correctly");
      }

      // Test validation error
      const validationError = new ValidationError("Invalid input", "testField");
      if (
        validationError.statusCode !== 400 ||
        validationError.field !== "testField"
      ) {
        throw new Error("ValidationError not working correctly");
      }

      // Test error handling
      const mockEvent = {
        httpMethod: "GET",
        path: "/test",
        headers: {},
      };

      const response = handleError(appError, mockEvent);
      if (response.statusCode !== 500) {
        throw new Error("Error handler not working correctly");
      }
    });
  }

  async testLogging() {
    await this.test("Logging System", async () => {
      const logger = require("../utils/logger");

      // Test different log levels
      logger.debug("Debug message");
      logger.info("Info message");
      logger.warn("Warning message");
      logger.error("Error message");

      // Test structured logging
      logger.info("Structured log test", {
        userId: "test123",
        action: "test",
        metadata: { key: "value" },
      });

      // If we get here without errors, logging is working
    });
  }

  async testSecurityUtils() {
    await this.test("Security Utilities", async () => {
      const security = require("../utils/security");

      // Test input sanitization
      const sanitized = security.sanitizeInput('<script>alert("xss")</script>');
      if (sanitized.includes("<") || sanitized.includes(">")) {
        throw new Error("Input sanitization failed");
      }

      // Test phone validation
      if (!security.validatePhoneNumber("0812345678")) {
        throw new Error("Phone validation failed for valid number");
      }

      if (security.validatePhoneNumber("invalid")) {
        throw new Error("Phone validation failed for invalid number");
      }

      // Test PIN validation
      if (!security.validatePIN("1234")) {
        throw new Error("PIN validation failed for valid PIN");
      }

      if (security.validatePIN("abc")) {
        throw new Error("PIN validation failed for invalid PIN");
      }
    });
  }

  async testAPIFunctionStructure() {
    await this.test("API Function Structure", async () => {
      const apiModule = require("../netlify/functions/api");

      if (typeof apiModule.handler !== "function") {
        throw new Error("API handler not exported");
      }

      // Test that handler can be called (mock event)
      const mockEvent = {
        httpMethod: "OPTIONS",
        path: "/api/test",
        headers: {},
        body: null,
      };

      const response = await apiModule.handler(mockEvent, {});

      if (!response || typeof response.statusCode !== "number") {
        throw new Error("API handler not returning proper response");
      }
    });
  }

  async testHTMLFileStructure() {
    await this.test("HTML File Structure", async () => {
      const fs = require("fs");
      const path = require("path");

      const htmlFile = path.join(
        __dirname,
        "../public/prima789-liff-member-card.html"
      );

      if (!fs.existsSync(htmlFile)) {
        throw new Error("HTML file not found");
      }

      const content = fs.readFileSync(htmlFile, "utf8");

      // Check for required elements
      const requiredElements = [
        "loading-view",
        "login-view",
        "card-view",
        "error-view",
        "LIFF_ID",
        "API_BASE_URL",
        "initializeApp",
        "checkSyncStatus",
      ];

      for (const element of requiredElements) {
        if (!content.includes(element)) {
          throw new Error(`Required element missing: ${element}`);
        }
      }

      // Check for security headers
      if (
        !content.includes("Content-Security-Policy") &&
        !content.includes("CSP")
      ) {
        console.log("Warning: No CSP headers detected in HTML");
      }
    });
  }

  async testNetlifyConfiguration() {
    await this.test("Netlify Configuration", async () => {
      const fs = require("fs");
      const path = require("path");

      const netlifyFile = path.join(__dirname, "../netlify.toml");

      if (!fs.existsSync(netlifyFile)) {
        throw new Error("netlify.toml not found");
      }

      const content = fs.readFileSync(netlifyFile, "utf8");

      // Check for required sections
      const requiredSections = [
        "[build]",
        "[[redirects]]",
        "[[headers]]",
        'functions = "netlify/functions"',
        'publish = "public"',
      ];

      for (const section of requiredSections) {
        if (!content.includes(section)) {
          throw new Error(`Required section missing: ${section}`);
        }
      }
    });
  }

  generateReport() {
    const duration = Date.now() - this.startTime;
    const passRate =
      this.results.total > 0
        ? ((this.results.passed / this.results.total) * 100).toFixed(1)
        : 0;

    console.log("\n" + "=".repeat(60));
    console.log("🧪 TEST RESULTS SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total Tests: ${this.results.total}`);
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`⚠️  Skipped: ${this.results.skipped}`);
    console.log(`📊 Pass Rate: ${passRate}%`);
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log("=".repeat(60));

    if (this.results.failed === 0) {
      console.log("🎉 All tests passed! System is ready for deployment.");
    } else {
      console.log(
        `🚫 ${this.results.failed} test(s) failed. Please fix issues before deploying.`
      );
    }

    return {
      success: this.results.failed === 0,
      ...this.results,
      passRate: parseFloat(passRate),
      duration,
    };
  }

  async runAll() {
    console.log("🧪 Prima789 LIFF Test Suite\n");

    try {
      // Core functionality tests
      await this.testConfigurationLoading();
      await this.testServiceImports();
      await this.testUtilityImports();

      // Database tests
      await this.testDatabaseConnection();
      await this.testDatabaseOperations();

      // Component tests
      await this.testValidationFunctions();
      await this.testRateLimiting();
      await this.testErrorHandling();
      await this.testLogging();
      await this.testSecurityUtils();

      // Integration tests
      await this.testAPIFunctionStructure();
      await this.testHTMLFileStructure();
      await this.testNetlifyConfiguration();
    } catch (error) {
      console.log(`\n💥 Critical test failure: ${error.message}`);
      this.results.failed++;
    }

    return this.generateReport();
  }
}

// Export for use in other scripts
module.exports = TestRunner;

// Run if called directly
if (require.main === module) {
  const runner = new TestRunner();

  runner
    .runAll()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Test runner failed:", error.message);
      process.exit(1);
    });
}
