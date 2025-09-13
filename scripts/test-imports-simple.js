// scripts/test-imports-simple.js - Simple import test

console.log('🧪 Testing Module Imports...\n');

const tests = [
  {
    name: "Utils/Errors",
    path: "../utils/errors",
    requiredExports: ["validatePhoneNumber", "validatePIN", "ValidationError"]
  },
  {
    name: "API Function",
    path: "../netlify/functions/api",
    requiredExports: ["handler"]
  }
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    console.log(`🔍 Testing ${test.name}...`);
    
    const module = require(test.path);
    
    // Check required exports
    const missing = [];
    for (const exportName of test.requiredExports) {
      if (typeof module[exportName] === "undefined") {
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
    
  } catch (error) {
    console.log(`  ❌ Import failed: ${error.message}`);
    failed++;
  }
}

console.log(`\n📊 Import Test Results:`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);

if (failed === 0) {
  console.log('🎉 All imports working correctly!');
  process.exit(0);
} else {
  console.log('🔧 Please fix import issues.');
  process.exit(1);
}
