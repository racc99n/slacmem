// scripts/fix-netlify.js - Fix common Netlify CLI issues

const { execSync } = require("child_process");

console.log("🔧 Netlify CLI Troubleshooter\n");

// Check current Netlify CLI version
try {
  const version = execSync("netlify --version", { encoding: "utf8" });
  console.log(`📋 Current Netlify CLI version: ${version.trim()}`);
} catch (error) {
  console.log("❌ Netlify CLI not found or not working");
  console.log("💡 Try installing: npm install -g netlify-cli");
  process.exit(1);
}

// Check for known problematic versions
const problematicVersions = ["23.5.1", "23.5.0"];
const currentVersion = execSync("netlify --version", {
  encoding: "utf8",
}).trim();

if (problematicVersions.some((v) => currentVersion.includes(v))) {
  console.log("⚠️  You have a problematic Netlify CLI version");
  console.log("🔄 Recommended fixes:");
  console.log("");

  // Option 1: Downgrade to stable version
  console.log("Option 1 - Downgrade to stable version:");
  console.log("npm uninstall -g netlify-cli");
  console.log("npm install -g netlify-cli@17.34.3");
  console.log("");

  // Option 2: Use latest stable
  console.log("Option 2 - Use latest stable:");
  console.log("npm uninstall -g netlify-cli");
  console.log("npm install -g netlify-cli@latest");
  console.log("");
} else {
  console.log("✅ Netlify CLI version looks OK");
}

// Check Node.js version compatibility
const nodeVersion = process.version;
console.log(`📋 Node.js version: ${nodeVersion}`);

const majorVersion = parseInt(nodeVersion.slice(1).split(".")[0]);
if (majorVersion < 18) {
  console.log("⚠️  Node.js version may be too old for latest Netlify CLI");
  console.log("🔄 Consider upgrading to Node.js 18 or 20");
} else if (majorVersion > 20) {
  console.log("⚠️  Node.js version is very new, may have compatibility issues");
  console.log("🔄 Consider using Node.js 18 or 20 for stability");
} else {
  console.log("✅ Node.js version is compatible");
}

console.log("\n🚀 Development Server Alternatives:");
console.log("");
console.log("If netlify dev continues to have issues, you can:");
console.log("");
console.log("1. Use a simple HTTP server for testing:");
console.log("   npm install -g http-server");
console.log("   cd public && http-server -p 3000 --cors");
console.log("");
console.log("2. Test functions individually:");
console.log(
  "   node -e \"console.log(require('./netlify/functions/api.js'))\""
);
console.log("");
console.log("3. Deploy directly to Netlify without local testing:");
console.log("   git push origin main (if auto-deploy is enabled)");
console.log("   OR");
console.log("   netlify deploy --prod");
console.log("");

console.log("🔍 Configuration Check:");
console.log("Run: npm run test:netlify");
console.log("This will verify your netlify.toml configuration");
console.log("");

console.log("📞 If issues persist:");
console.log("1. Check: https://github.com/netlify/cli/issues");
console.log("2. Try: netlify dev --debug for more info");
console.log("3. Use: netlify deploy for direct deployment");
console.log("");

console.log("🎯 Quick Start Commands:");
console.log("# Test configuration");
console.log("npm run test:netlify");
console.log("");
console.log("# Test all systems");
console.log("npm run test:fix");
console.log("");
console.log("# Deploy to production");
console.log("npm run deploy");
console.log("");
