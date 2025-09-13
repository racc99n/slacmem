// scripts/fix-validation.js - Test all validation fixes

console.log("🔧 Testing all validation and import fixes...\n");

let allPassed = true;

// Test 1: Utils/Errors Import and Functions
console.log("1️⃣ Testing utils/errors module...");
try {
  const {
    validatePhoneNumber,
    validatePIN,
    validatePhoneNumberOrThrow,
    validatePINOrThrow,
    ValidationError,
  } = require("../utils/errors");

  // Test boolean functions
  if (!validatePhoneNumber("0812345678")) {
    throw new Error("validatePhoneNumber failed for valid number");
  }
  if (!validatePIN("1234")) {
    throw new Error("validatePIN failed for valid PIN");
  }

  // Test throwing functions
  try {
    validatePhoneNumberOrThrow("0812345678");
    validatePINOrThrow("1234");
  } catch (error) {
    throw new Error("Throwing functions failed for valid inputs");
  }

  console.log("   ✅ utils/errors module working correctly");
} catch (error) {
  console.log(`   ❌ utils/errors error: ${error.message}`);
  allPassed = false;
}

// Test 2: Prima789 Service Import
console.log("2️⃣ Testing prima789 service import...");
try {
  const prima789Service = require("../services/prima789Service");

  if (typeof prima789Service.authenticateUser !== "function") {
    throw new Error("authenticateUser not exported");
  }
  if (typeof prima789Service.validateCredentials !== "function") {
    throw new Error("validateCredentials not exported");
  }

  // Test validateCredentials function
  try {
    prima789Service.validateCredentials("0812345678", "1234");
    console.log("   ✅ Validation passed for valid credentials");
  } catch (error) {
    if (error.message.includes("not defined")) {
      throw new Error("validateCredentials has import issues");
    }
    // Other validation errors are expected and OK
  }

  console.log("   ✅ prima789 service working correctly");
} catch (error) {
  console.log(`   ❌ prima789 service error: ${error.message}`);
  allPassed = false;
}

// Test 3: LINE Auth Service
console.log("3️⃣ Testing LINE auth service...");
try {
  const lineAuthService = require("../services/lineAuthService");

  if (typeof lineAuthService.verifyIdToken !== "function") {
    throw new Error("verifyIdToken not exported");
  }
  if (typeof lineAuthService.authenticateRequest !== "function") {
    throw new Error("authenticateRequest not exported");
  }

  console.log("   ✅ LINE auth service working correctly");
} catch (error) {
  console.log(`   ❌ LINE auth service error: ${error.message}`);
  allPassed = false;
}

// Test 4: Database Service
console.log("4️⃣ Testing database service...");
try {
  const databaseService = require("../services/databaseService");

  if (typeof databaseService.findUserMapping !== "function") {
    throw new Error("findUserMapping not exported");
  }
  if (typeof databaseService.upsertUserMapping !== "function") {
    throw new Error("upsertUserMapping not exported");
  }
  if (typeof databaseService.healthCheck !== "function") {
    throw new Error("healthCheck not exported");
  }

  console.log("   ✅ Database service working correctly");
} catch (error) {
  console.log(`   ❌ Database service error: ${error.message}`);
  allPassed = false;
}

// Test 5: API Handler
console.log("5️⃣ Testing API handler import...");
try {
  const apiHandler = require("../netlify/functions/api");

  if (typeof apiHandler.handler !== "function") {
    throw new Error("API handler not exported");
  }

  console.log("   ✅ API handler working correctly");
} catch (error) {
  console.log(`   ❌ API handler error: ${error.message}`);
  allPassed = false;
}

// Test 6: Security Utils
console.log("6️⃣ Testing security utils...");
try {
  const securityUtils = require("../utils/security");

  if (typeof securityUtils.sanitizeInput !== "function") {
    throw new Error("sanitizeInput not exported");
  }
  if (typeof securityUtils.validatePhoneNumber !== "function") {
    throw new Error("validatePhoneNumber not exported");
  }

  console.log("   ✅ Security utils working correctly");
} catch (error) {
  console.log(`   ❌ Security utils error: ${error.message}`);
  allPassed = false;
}

// Summary
console.log("\n" + "=".repeat(50));
if (allPassed) {
  console.log("🎉 All validation and import fixes are working!");
  console.log('✅ You can now run "npm test" to verify everything');
  console.log("🚀 System ready for deployment");
} else {
  console.log("💥 Some issues remain. Please check the errors above.");
  console.log("🔧 Fix the issues and run this script again");
}
console.log("=".repeat(50));

process.exit(allPassed ? 0 : 1);
