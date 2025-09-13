// scripts/quick-deploy.js - Quick deployment script for updated files

const { execSync } = require("child_process");

console.log("🚀 Quick Deploy - Updated API and HTML");
console.log("=====================================\n");

try {
  // 1. Test validation functions
  console.log("1. 🧪 Testing validation functions...");
  execSync("node scripts/test-validation.js", { stdio: "inherit" });
  console.log("✅ Validation tests passed\n");

  // 2. Deploy to Netlify
  console.log("2. 🌐 Deploying to Netlify...");
  console.log("Files being updated:");
  console.log("  - netlify/functions/api.js (with mock mode)");
  console.log("  - prima789-liff-member-card.html (with user input form)\n");

  execSync("netlify deploy --prod --dir=. --functions=netlify/functions", {
    stdio: "inherit",
  });

  console.log("\n🎉 Quick deploy completed!");
  console.log("📱 App URL: https://prima168.online");
  console.log(
    "🧪 Test API: https://prima168.online/.netlify/functions/api/health"
  );
  console.log("\n📋 Features deployed:");
  console.log("  ✅ User input form for phone/PIN");
  console.log("  ✅ Mock mode API (works without database)");
  console.log("  ✅ Phone number validation");
  console.log("  ✅ PIN validation");
  console.log("  ✅ Responsive design");
  console.log("  ✅ Real-time input feedback");

  console.log("\n🔧 Next steps:");
  console.log("  1. Test the app at https://prima168.online");
  console.log("  2. Try entering any valid Thai phone number (08X, 09X, 06X)");
  console.log("  3. Try entering any 4-digit PIN");
  console.log("  4. Set up database in Netlify dashboard when ready");
} catch (error) {
  console.error("\n💥 Quick deploy failed:", error.message);
  process.exit(1);
}
