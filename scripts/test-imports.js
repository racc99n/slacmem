// scripts/test-imports.js - Test all imports to find issues

console.log("🧪 Testing all module imports...\n");

const tests = [
  {
    name: "Config",
    path: "../config/config",
    requiredExports: ["database", "line", "security"],
  },
  {
    name: "Logger",
    path: "../utils/logger",
    requiredExports: ["info", "error", "warn", "debug"],
  },
  {
    name: "Errors",
    path: "../utils/errors",
    requiredExports: [
      "AppError",
      "ValidationError",
      "validatePhoneNumber",
      "validatePIN",
      "validatePhoneNumberOrThrow",
      "validatePINOrThrow",
    ],
  },
  {
    name: "Rate Limiter",
    path: "../utils/rateLimiter",
    requiredExports: ["isAllowed", "middleware"],
  },
  {
    name: "Security Utils",
    path: "../utils/security",
    requiredExports: ["sanitizeInput", "validatePhoneNumber", "validatePIN"],
  },
  {
    name: "LINE Auth Service",
    path: "../services/lineAuthService",
    requiredExports: ["verifyIdToken", "authenticateRequest"],
  },
  {
    name: "Prima789 Service",
    path: "../services/prima789Service",
    requiredExports: ["authenticateUser", "validateCredentials"],
  },
  {
    name: "Database Service",
    path: "../services/databaseService",
    requiredExports: ["findUserMapping", "upsertUserMapping", "healthCheck"],
  },
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    console.log(`🔍 Testing ${test.name}...`);

    const module = require(test.path);

    // Check if it's a function (class instance) or object
    const moduleExports = typeof module === "function" ? module : module;

    // Check required exports
    const missing = [];
    for (const exportName of test.requiredExports) {
      if (typeof moduleExports[exportName] === "undefined") {
        missing.push(exportName);
      }
    }

    if (missing.length > 0) {
      console.log(`  ❌ Missing exports: ${missing.join(", ")}`);
      failed++;
    } else {
      console.log(`  ✅ All required exports present`);
      passed++;
    }

    // Additional validation for specific modules
    if (test.name === "Errors") {
      // Test that validation functions work
      try {
        const result = moduleExports.validatePhoneNumber("0812345678");
        if (typeof result !== "boolean") {
          throw new Error("validatePhoneNumber should return boolean");
        }

        moduleExports.validatePhoneNumberOrThrow("0812345678");
        console.log(`  ✅ Validation functions working correctly`);
      } catch (error) {
        console.log(`  ❌ Validation function error: ${error.message}`);
        failed++;
        passed--;
      }
    }
  } catch (error) {
    console.log(`  ❌ Import failed: ${error.message}`);
    failed++;
  }
}

console.log(`\n${passed === tests.length ? "🎉" : "💥"} Import Test Results:`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📊 Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%`);

if (failed === 0) {
  console.log(
    "\n🚀 All imports working correctly! You can now run the full test suite."
  );
  process.exit(0);
} else {
  console.log("\n🔧 Please fix import issues before running tests.");
  process.exit(1);
}
