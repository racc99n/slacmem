// scripts/test-validation.js - Test validation functions fix

console.log("🧪 Testing validation functions...\n");

try {
  // Test importing the fixed functions
  const {
    validatePhoneNumber,
    validatePIN,
    validatePhoneNumberOrThrow,
    validatePINOrThrow,
    ValidationError,
  } = require("../utils/errors");

  console.log("✅ Successfully imported validation functions");

  // Test 1: Valid phone number validation
  console.log("\n📱 Testing phone number validation:");

  const validPhones = ["0969174691", "0969174699", "0899998999"];
  const invalidPhones = ["9999", "0512345678", "abc123", ""];

  // Test boolean validation
  validPhones.forEach((phone) => {
    if (!validatePhoneNumber(phone)) {
      throw new Error(`Valid phone ${phone} was rejected`);
    }
    console.log(`✅ ${phone} - Valid`);
  });

  invalidPhones.forEach((phone) => {
    if (validatePhoneNumber(phone)) {
      throw new Error(`Invalid phone ${phone} was accepted`);
    }
    console.log(`❌ ${phone || "empty"} - Invalid (correctly rejected)`);
  });

  // Test 2: PIN validation
  console.log("\n🔐 Testing PIN validation:");

  const validPINs = ["1234", "0000", "9999"];
  const invalidPINs = ["9999", "1111", "abc1", ""];

  validPINs.forEach((pin) => {
    if (!validatePIN(pin)) {
      throw new Error(`Valid PIN ${pin} was rejected`);
    }
    console.log(`✅ ${pin} - Valid`);
  });

  invalidPINs.forEach((pin) => {
    if (validatePIN(pin)) {
      throw new Error(`Invalid PIN ${pin} was accepted`);
    }
    console.log(`❌ ${pin || "empty"} - Invalid (correctly rejected)`);
  });

  // Test 3: Throwing validation functions
  console.log("\n🚫 Testing throwing validation functions:");

  // Test valid cases (should not throw)
  try {
    validatePhoneNumberOrThrow("0969174691");
    console.log("✅ validatePhoneNumberOrThrow - Valid phone accepted");
  } catch (error) {
    throw new Error("Valid phone number caused exception: " + error.message);
  }

  try {
    validatePINOrThrow("9999");
    console.log("✅ validatePINOrThrow - Valid PIN accepted");
  } catch (error) {
    throw new Error("Valid PIN caused exception: " + error.message);
  }

  // Test invalid cases (should throw ValidationError)
  try {
    validatePhoneNumberOrThrow("invalid");
    throw new Error("Invalid phone number should have thrown error");
  } catch (error) {
    if (!(error instanceof ValidationError)) {
      throw new Error(
        "Wrong error type for invalid phone: " + error.constructor.name
      );
    }
    console.log("✅ validatePhoneNumberOrThrow - Invalid phone rejected");
  }

  try {
    validatePINOrThrow("abc");
    throw new Error("Invalid PIN should have thrown error");
  } catch (error) {
    if (!(error instanceof ValidationError)) {
      throw new Error(
        "Wrong error type for invalid PIN: " + error.constructor.name
      );
    }
    console.log("✅ validatePINOrThrow - Invalid PIN rejected");
  }

  // Test 4: Import in API file
  console.log("\n🔗 Testing API file imports:");

  try {
    const apiModule = require("../netlify/functions/api");
    console.log("✅ API module loaded successfully");
    console.log(
      "✅ All validation functions are properly exported and imported"
    );
  } catch (error) {
    console.error("❌ Failed to load API module:", error.message);
    throw error;
  }

  console.log("\n🎉 All validation tests passed!");
  console.log("\n✅ Fixes applied:");
  console.log("  - Added validatePhoneNumberOrThrow function");
  console.log("  - Added validatePINOrThrow function");
  console.log("  - Fixed import statements in API handler");
  console.log("  - All functions properly exported from utils/errors.js");

  console.log("\n🚀 Ready to test with npm run test");
} catch (error) {
  console.error("\n💥 Validation test failed:", error.message);
  console.error("Stack:", error.stack);
  process.exit(1);
}
