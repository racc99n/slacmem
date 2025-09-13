// scripts/test-validation.js - Pure validation functions test (no dependencies)

console.log("🧪 Testing validation functions...\n");

try {
  // Test importing the validation functions only (no other dependencies)
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

  const validPhones = ["0812345678", "0651234567", "0934567890"];
  const invalidPhones = ["123", "0512345678", "abc123", ""];

  // Test boolean validation - valid phones
  validPhones.forEach((phone) => {
    if (!validatePhoneNumber(phone)) {
      throw new Error(`Valid phone ${phone} was rejected`);
    }
    console.log(`✅ ${phone} - Valid`);
  });

  // Test boolean validation - invalid phones
  invalidPhones.forEach((phone) => {
    if (validatePhoneNumber(phone)) {
      throw new Error(`Invalid phone ${phone} was accepted`);
    }
    console.log(`❌ ${phone || "empty"} - Invalid (correctly rejected)`);
  });

  // Test 2: PIN validation
  console.log("\n🔐 Testing PIN validation:");

  const validPINs = ["1234", "0000", "9999", "0001"];
  const invalidPINs = ["123", "12345", "abc1", "", "99999", "ab12", "12a3"];

  // Test valid PINs
  validPINs.forEach((pin) => {
    if (!validatePIN(pin)) {
      throw new Error(`Valid PIN ${pin} was rejected`);
    }
    console.log(`✅ ${pin} - Valid`);
  });

  // Test invalid PINs
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
    validatePhoneNumberOrThrow("0812345678");
    console.log("✅ validatePhoneNumberOrThrow - Valid phone accepted");
  } catch (error) {
    throw new Error("Valid phone number caused exception: " + error.message);
  }

  try {
    validatePINOrThrow("1234");
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

  // Test 4: Code structure validation (no actual module loading)
  console.log("\n🔗 Testing API file imports (static analysis):");

  try {
    // Read API file and check import statements
    const fs = require("fs");
    const apiCode = fs.readFileSync("netlify/functions/api.js", "utf8");

    // Check if our functions are properly imported
    const hasValidatePhoneImport = apiCode.includes(
      "validatePhoneNumberOrThrow"
    );
    const hasValidatePINImport = apiCode.includes("validatePINOrThrow");
    const hasCorrectImport = apiCode.includes('require("../../utils/errors")');

    if (hasValidatePhoneImport && hasValidatePINImport && hasCorrectImport) {
      console.log("✅ Validation function imports found in API code");
      console.log("✅ Import statement structure is correct");
    } else {
      throw new Error(
        "Missing or incorrect validation function imports in API code"
      );
    }

    console.log("✅ Static code analysis passed");
  } catch (error) {
    console.error("❌ Failed static code analysis:", error.message);
    throw error;
  }

  console.log("\n🎉 All validation tests passed!");
  console.log("\n✅ Validated functions:");
  console.log("  - validatePhoneNumber()");
  console.log("  - validatePIN()");
  console.log("  - validatePhoneNumberOrThrow()");
  console.log("  - validatePINOrThrow()");
  console.log("  - ValidationError class");
  console.log("  - API import structure");

  console.log("\n🚀 Validation functions are ready for production!");
} catch (error) {
  console.error("\n💥 Validation test failed:", error.message);
  console.error("Stack:", error.stack);
  process.exit(1);
}
