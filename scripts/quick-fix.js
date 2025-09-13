// scripts/quick-fix.js - Quick validation fix verification

console.log("🔧 Verifying validation function fixes...\n");

try {
  // Test the fixed validation functions
  const {
    validatePhoneNumber,
    validatePIN,
    validatePhoneNumberOrThrow,
    validatePINOrThrow,
    ValidationError,
  } = require("../utils/errors");

  console.log("✅ Imports successful");

  // Test boolean functions
  console.log("📱 Testing phone number validation...");

  // Valid phone numbers
  const validPhones = ["0812345678", "0651234567", "0991234567"];
  for (const phone of validPhones) {
    if (!validatePhoneNumber(phone)) {
      throw new Error(`Valid phone ${phone} was rejected`);
    }
    console.log(`  ✅ ${phone} - Valid`);
  }

  // Invalid phone numbers
  const invalidPhones = ["123", "0512345678", "1234567890", "abc"];
  for (const phone of invalidPhones) {
    if (validatePhoneNumber(phone)) {
      throw new Error(`Invalid phone ${phone} was accepted`);
    }
    console.log(`  ❌ ${phone} - Correctly rejected`);
  }

  console.log("🔢 Testing PIN validation...");

  // Valid PINs
  const validPins = ["1234", "0000", "9999"];
  for (const pin of validPins) {
    if (!validatePIN(pin)) {
      throw new Error(`Valid PIN ${pin} was rejected`);
    }
    console.log(`  ✅ ${pin} - Valid`);
  }

  // Invalid PINs
  const invalidPins = ["abc", "12345", "123", ""];
  for (const pin of invalidPins) {
    if (validatePIN(pin)) {
      throw new Error(`Invalid PIN ${pin} was accepted`);
    }
    console.log(`  ❌ ${pin} - Correctly rejected`);
  }

  console.log("💥 Testing throwing validation functions...");

  // Test throwing functions
  try {
    validatePhoneNumberOrThrow("0812345678");
    console.log("  ✅ Valid phone number did not throw");
  } catch (error) {
    throw new Error("Valid phone number should not throw");
  }

  try {
    validatePhoneNumberOrThrow("invalid");
    throw new Error("Invalid phone number should have thrown");
  } catch (error) {
    if (error instanceof ValidationError) {
      console.log("  ✅ Invalid phone number correctly threw ValidationError");
    } else {
      throw new Error("Wrong error type thrown for invalid phone");
    }
  }

  try {
    validatePINOrThrow("1234");
    console.log("  ✅ Valid PIN did not throw");
  } catch (error) {
    throw new Error("Valid PIN should not throw");
  }

  try {
    validatePINOrThrow("abc");
    throw new Error("Invalid PIN should have thrown");
  } catch (error) {
    if (error instanceof ValidationError) {
      console.log("  ✅ Invalid PIN correctly threw ValidationError");
    } else {
      throw new Error("Wrong error type thrown for invalid PIN");
    }
  }

  console.log("\n🎉 All validation function fixes verified successfully!");
  console.log('✅ You can now run "npm test" again to verify all tests pass');
} catch (error) {
  console.error("❌ Validation fix verification failed:", error.message);
  process.exit(1);
}
