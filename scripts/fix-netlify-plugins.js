// scripts/fix-netlify-plugins.js - Fix Netlify plugin dependency issues

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("🔧 Fixing Netlify plugin dependency issues...\n");

// Step 1: Clear Netlify plugins cache
console.log("1️⃣ Clearing Netlify plugins cache...");
try {
  const netlifyDir = path.join(process.cwd(), ".netlify");
  if (fs.existsSync(netlifyDir)) {
    // Remove entire .netlify directory
    execSync("rm -rf .netlify", { stdio: "inherit" });
    console.log("   ✅ Cleared .netlify directory");
  } else {
    console.log("   ✅ No .netlify directory found");
  }
} catch (error) {
  console.log(`   ⚠️  Could not clear .netlify directory: ${error.message}`);
}

// Step 2: Clear npm cache
console.log("\n2️⃣ Clearing npm cache...");
try {
  execSync("npm cache clean --force", { stdio: "inherit" });
  console.log("   ✅ npm cache cleared");
} catch (error) {
  console.log(`   ⚠️  Could not clear npm cache: ${error.message}`);
}

// Step 3: Check netlify.toml for plugins
console.log("\n3️⃣ Checking netlify.toml for plugins...");
try {
  const netlifyTomlPath = path.join(process.cwd(), "netlify.toml");
  if (fs.existsSync(netlifyTomlPath)) {
    const content = fs.readFileSync(netlifyTomlPath, "utf8");

    if (content.includes("[plugins]") || content.includes("[[plugins]]")) {
      console.log("   ⚠️  Found plugins section in netlify.toml");
      console.log("   💡 Consider removing plugins if not essential");
    } else {
      console.log("   ✅ No plugins section found in netlify.toml");
    }

    // Check for neon references
    if (content.includes("neon")) {
      console.log("   ⚠️  Found neon references in netlify.toml");
    } else {
      console.log("   ✅ No neon plugin references");
    }
  }
} catch (error) {
  console.log(`   ❌ Error checking netlify.toml: ${error.message}`);
}

// Step 4: Check package.json for netlify plugins
console.log("\n4️⃣ Checking package.json for Netlify plugins...");
try {
  const packageJsonPath = path.join(process.cwd(), "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  const netlifyPlugins = [];
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  for (const [name, version] of Object.entries(allDeps)) {
    if (name.includes("netlify-plugin") || name.includes("neon")) {
      netlifyPlugins.push(`${name}@${version}`);
    }
  }

  if (netlifyPlugins.length > 0) {
    console.log("   ⚠️  Found Netlify-related packages:");
    netlifyPlugins.forEach((pkg) => console.log(`      - ${pkg}`));
  } else {
    console.log("   ✅ No Netlify plugin packages found");
  }
} catch (error) {
  console.log(`   ❌ Error checking package.json: ${error.message}`);
}

// Step 5: Provide solutions
console.log("\n" + "=".repeat(60));
console.log("🔧 SOLUTIONS");
console.log("=".repeat(60));

console.log("\n💡 Option 1: Clean restart");
console.log("rm -rf .netlify");
console.log("rm -rf node_modules");
console.log("npm install");
console.log("netlify dev");

console.log("\n💡 Option 2: Use correct command format");
console.log("npm run test:liff    # ← Correct");
console.log("netlify test:liff    # ← Wrong");

console.log("\n💡 Option 3: Skip plugin installation");
console.log("netlify dev --skip-install");

console.log("\n💡 Option 4: Use simple dev server");
console.log("# Install simple HTTP server");
console.log("npm install -g http-server");
console.log("cd public && http-server -p 3000 --cors");

console.log("\n💡 Option 5: Deploy directly (skip local dev)");
console.log("npm run test:liff  # Test configurations first");
console.log("npm run deploy     # Deploy to production");

console.log("\n🎯 Recommended next steps:");
console.log("1. Run: npm run test:liff (not netlify test:liff)");
console.log("2. Clear cache: rm -rf .netlify");
console.log("3. Try: netlify dev --skip-install");
console.log("4. If still fails: npm run deploy");

console.log("\n🔍 Debug information:");
console.log(`Node.js: ${process.version}`);
console.log(`Working directory: ${process.cwd()}`);

try {
  const netlifyVersion = execSync("netlify --version", { encoding: "utf8" });
  console.log(`Netlify CLI: ${netlifyVersion.trim()}`);
} catch (error) {
  console.log("Netlify CLI: Not found or error");
}
