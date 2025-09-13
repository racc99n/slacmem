// scripts/quick-test.js - Quick validation test
console.log("🧪 Testing Prima789 System Components...\n");

try {
  // Test 1: Validation Functions
  console.log("1️⃣ Testing Validation Functions:");
  const {
    validatePhoneNumber,
    validatePIN,
    validatePhoneNumberOrThrow,
    validatePINOrThrow,
  } = require("../utils/errors");

  // Test phone validation
  console.log("✅ Phone 0812345678:", validatePhoneNumber("0812345678"));
  console.log("❌ Phone 123:", validatePhoneNumber("123"));
  console.log("✅ Phone 0651234567:", validatePhoneNumber("0651234567"));
  console.log("❌ Phone 0512345678:", validatePhoneNumber("0512345678"));

  // Test PIN validation
  console.log("✅ PIN 1234:", validatePIN("1234"));
  console.log("❌ PIN abc:", validatePIN("abc"));
  console.log("❌ PIN 12345:", validatePIN("12345"));

  console.log("\n2️⃣ Testing Throwing Functions:");

  try {
    validatePhoneNumberOrThrow("0812345678");
    console.log("✅ Valid phone accepted");
  } catch (e) {
    console.log("❌ Valid phone rejected:", e.message);
  }

  try {
    validatePhoneNumberOrThrow("123");
    console.log("❌ Invalid phone accepted");
  } catch (e) {
    console.log("✅ Invalid phone rejected:", e.message);
  }

  try {
    validatePINOrThrow("1234");
    console.log("✅ Valid PIN accepted");
  } catch (e) {
    console.log("❌ Valid PIN rejected:", e.message);
  }

  try {
    validatePINOrThrow("abc");
    console.log("❌ Invalid PIN accepted");
  } catch (e) {
    console.log("✅ Invalid PIN rejected:", e.message);
  }
} catch (error) {
  console.error("❌ Test failed:", error.message);
  console.error("Stack:", error.stack);
  process.exit(1);
}

// Test 2: Check Environment
console.log("\n3️⃣ Environment Check:");
const requiredEnvs = ["DATABASE_URL", "LIFF_ID"];
const optionalEnvs = ["JWT_SECRET", "NODE_ENV", "PRIMA789_API_URL"];

requiredEnvs.forEach((env) => {
  if (process.env[env]) {
    console.log(`✅ ${env}: ${process.env[env].substring(0, 20)}...`);
  } else {
    console.log(`❌ ${env}: Missing`);
  }
});

optionalEnvs.forEach((env) => {
  if (process.env[env]) {
    console.log(`✅ ${env}: ${process.env[env]}`);
  } else {
    console.log(`⚠️  ${env}: Not set`);
  }
});

// Test 3: File Structure
console.log("\n4️⃣ File Structure:");
const fs = require("fs");
const requiredFiles = [
  "netlify/functions/api.js",
  "utils/errors.js",
  "config/config.js",
  "public/prima789-liff-member-card.html",
  "prima789-integration.html",
  "package.json",
];

requiredFiles.forEach((file) => {
  if (fs.existsSync(file)) {
    const stat = fs.statSync(file);
    const size = Math.round(stat.size / 1024);
    console.log(`✅ ${file} (${size}KB)`);
  } else {
    console.log(`❌ ${file}: Missing`);
  }
});

// Test 4: API Function Import
console.log("\n5️⃣ API Function Import:");
try {
  const api = require("../netlify/functions/api.js");
  if (typeof api.handler === "function") {
    console.log("✅ API handler imported successfully");
  } else {
    console.log("❌ API handler not properly exported");
  }
} catch (error) {
  console.log("❌ API import failed:", error.message);
}

console.log("\n🎉 Quick test completed!");
console.log("📝 Summary: If all tests show ✅, your system is ready!");
console.log("🌐 Open: http://localhost:8888 to test in browser");
