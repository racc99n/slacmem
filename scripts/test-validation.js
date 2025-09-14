// scripts/test-validation.js - แก้ไข Test Script
const fs = require("fs");
const path = require("path");

console.log("🧪 Testing validation functions...");

try {
  // Import validation functions
  const {
    isValidPhoneNumber,
    isValidPIN,
    validatePhoneNumberOrThrow,
    validatePINOrThrow,
    ValidationError,
  } = require("../utils/validation");

  console.log("✅ Successfully imported validation functions");

  // Test phone number validation
  console.log("\n📱 Testing phone number validation:");

  const validPhones = ["0812345678", "0651234567", "0934567890"];
  const invalidPhones = ["123", "0512345678", "abc123", ""];

  validPhones.forEach((phone) => {
    const result = isValidPhoneNumber(phone);
    console.log(
      `${result ? "✅" : "❌"} ${phone} - ${result ? "Valid" : "Invalid"}`
    );
    if (!result) {
      throw new Error(`Phone ${phone} should be valid but was rejected`);
    }
  });

  invalidPhones.forEach((phone) => {
    const result = isValidPhoneNumber(phone);
    console.log(
      `${!result ? "✅" : "❌"} ${phone || "empty"} - ${
        result ? "Valid" : "Invalid"
      } ${!result ? "(correctly rejected)" : "(incorrectly accepted)"}`
    );
    if (result) {
      throw new Error(`Phone ${phone} should be invalid but was accepted`);
    }
  });

  // Test PIN validation
  console.log("\n🔐 Testing PIN validation:");

  const validPins = ["1234", "0000", "9999", "0001"];
  const invalidPins = ["123", "12345", "abc1", "", "99999", "ab12", "12a3"];

  validPins.forEach((pin) => {
    const result = isValidPIN(pin);
    console.log(
      `${result ? "✅" : "❌"} ${pin} - ${result ? "Valid" : "Invalid"}`
    );
    if (!result) {
      throw new Error(`PIN ${pin} should be valid but was rejected`);
    }
  });

  invalidPins.forEach((pin) => {
    const result = isValidPIN(pin);
    console.log(
      `${!result ? "✅" : "❌"} ${pin || "empty"} - ${
        result ? "Valid" : "Invalid"
      } ${!result ? "(correctly rejected)" : "(incorrectly accepted)"}`
    );
    if (result) {
      throw new Error(`PIN ${pin} should be invalid but was accepted`);
    }
  });

  // Test throwing validation functions
  console.log("\n🚫 Testing throwing validation functions:");

  // Test valid inputs don't throw
  try {
    validatePhoneNumberOrThrow("0812345678");
    console.log("✅ validatePhoneNumberOrThrow - Valid phone accepted");
  } catch (error) {
    throw new Error(
      "Valid phone number caused unexpected error: " + error.message
    );
  }

  try {
    validatePINOrThrow("1234");
    console.log("✅ validatePINOrThrow - Valid PIN accepted");
  } catch (error) {
    throw new Error("Valid PIN caused unexpected error: " + error.message);
  }

  // Test invalid inputs do throw
  try {
    validatePhoneNumberOrThrow("123");
    throw new Error("Invalid phone should have thrown error");
  } catch (error) {
    if (error.message.includes("Invalid phone number format")) {
      console.log("✅ validatePhoneNumberOrThrow - Invalid phone rejected");
    } else {
      throw error;
    }
  }

  try {
    validatePINOrThrow("abc");
    throw new Error("Invalid PIN should have thrown error");
  } catch (error) {
    if (error.message.includes("Invalid PIN format")) {
      console.log("✅ validatePINOrThrow - Invalid PIN rejected");
    } else {
      throw error;
    }
  }

  // Test static code analysis of API files
  console.log("\n🔗 Testing API file imports (static analysis):");

  try {
    const apiFilePath = path.join(
      __dirname,
      "..",
      "netlify",
      "functions",
      "api.js"
    );

    if (!fs.existsSync(apiFilePath)) {
      throw new Error("API file not found at: " + apiFilePath);
    }

    const apiContent = fs.readFileSync(apiFilePath, "utf8");

    // Check for required imports
    const requiredImports = [
      "validatePhoneNumberOrThrow",
      "validatePINOrThrow",
      "ValidationError",
    ];

    const missingImports = requiredImports.filter(
      (imp) => !apiContent.includes(imp)
    );

    if (missingImports.length > 0) {
      throw new Error(
        `Missing imports in API file: ${missingImports.join(", ")}`
      );
    }

    // Check for require statement
    if (
      !apiContent.includes("require('../../utils/validation')") &&
      !apiContent.includes('require("../../utils/validation")')
    ) {
      throw new Error(
        "Missing validation module require statement in API file"
      );
    }

    console.log("✅ API file validation imports look correct");
  } catch (error) {
    console.log("❌ Failed static code analysis:", error.message);
    throw new Error(
      "Missing or incorrect validation function imports in API code"
    );
  }

  console.log("\n🎉 All validation tests passed!");
} catch (error) {
  console.error("💥 Validation test failed:", error.message);
  if (error.stack) {
    console.error("Stack:", error.stack);
  }
  process.exit(1);
}

console.log("\n✅ Validation testing completed successfully!");
