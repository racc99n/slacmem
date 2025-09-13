// scripts/test-liff-csp.js - Test LIFF and CSP configuration

const fs = require("fs");
const path = require("path");

console.log("🔍 Testing LIFF and CSP Configuration...\n");

// Test 1: Check netlify.toml CSP configuration
console.log("1️⃣ Testing netlify.toml CSP...");
try {
  const netlifyToml = fs.readFileSync(
    path.join(__dirname, "../netlify.toml"),
    "utf8"
  );

  // Extract CSP header
  const cspMatch = netlifyToml.match(/Content-Security-Policy\s*=\s*"([^"]+)"/);
  if (!cspMatch) {
    throw new Error("CSP header not found in netlify.toml");
  }

  const csp = cspMatch[1];
  console.log("   ✅ CSP header found");

  // Check for required LIFF domains
  const requiredDomains = [
    "static.line-scdn.net",
    "liffsdk.line-scdn.net",
    "liff.line.me",
    "api.line.me",
  ];

  let allDomainsFound = true;
  for (const domain of requiredDomains) {
    if (!csp.includes(domain)) {
      console.log(`   ❌ Missing domain: ${domain}`);
      allDomainsFound = false;
    } else {
      console.log(`   ✅ Found domain: ${domain}`);
    }
  }

  // Check if Tailwind CDN is removed
  if (csp.includes("cdn.tailwindcss.com")) {
    console.log("   ⚠️  Still using Tailwind CDN (should use local CSS)");
  } else {
    console.log("   ✅ Tailwind CDN removed from CSP");
  }

  if (allDomainsFound) {
    console.log("   🎉 All required LIFF domains are in CSP");
  }
} catch (error) {
  console.log(`   ❌ Error testing CSP: ${error.message}`);
}

// Test 2: Check HTML file for local CSS
console.log("\n2️⃣ Testing HTML CSS configuration...");
try {
  const htmlFile = fs.readFileSync(
    path.join(__dirname, "../public/prima789-liff-member-card.html"),
    "utf8"
  );

  // Check if using local Tailwind CSS
  if (htmlFile.includes("assets/tailwind.min.css")) {
    console.log("   ✅ Using local Tailwind CSS");
  } else {
    console.log("   ❌ Local Tailwind CSS not found");
  }

  // Check if CDN is removed
  if (htmlFile.includes("cdn.tailwindcss.com")) {
    console.log("   ❌ Still using Tailwind CDN in HTML");
  } else {
    console.log("   ✅ Tailwind CDN removed from HTML");
  }

  // Check for LIFF SDK
  if (htmlFile.includes("static.line-scdn.net/liff/edge/versions")) {
    console.log("   ✅ LIFF SDK properly loaded");
  } else {
    console.log("   ❌ LIFF SDK not found");
  }
} catch (error) {
  console.log(`   ❌ Error testing HTML: ${error.message}`);
}

// Test 3: Check if local CSS file exists
console.log("\n3️⃣ Testing local CSS file...");
try {
  const cssPath = path.join(__dirname, "../public/assets/tailwind.min.css");

  if (fs.existsSync(cssPath)) {
    const cssContent = fs.readFileSync(cssPath, "utf8");
    const cssSize = (cssContent.length / 1024).toFixed(1);

    console.log(`   ✅ Local CSS file exists (${cssSize}KB)`);

    // Check for essential Tailwind classes
    const essentialClasses = [
      ".hidden",
      ".flex",
      ".text-white",
      ".bg-gray-800",
    ];
    let allClassesFound = true;

    for (const className of essentialClasses) {
      if (!cssContent.includes(className)) {
        console.log(`   ❌ Missing essential class: ${className}`);
        allClassesFound = false;
      }
    }

    if (allClassesFound) {
      console.log("   ✅ All essential Tailwind classes found");
    }
  } else {
    console.log("   ❌ Local CSS file not found");
    console.log("   💡 Create: public/assets/tailwind.min.css");
  }
} catch (error) {
  console.log(`   ❌ Error testing CSS file: ${error.message}`);
}

// Test 4: LIFF Configuration Test
console.log("\n4️⃣ Testing LIFF configuration...");
try {
  const htmlFile = fs.readFileSync(
    path.join(__dirname, "../public/prima789-liff-member-card.html"),
    "utf8"
  );

  // Extract LIFF_ID from HTML
  const liffIdMatch = htmlFile.match(/LIFF_ID:\s*['"`]([^'"`]+)['"`]/);
  if (liffIdMatch) {
    const liffId = liffIdMatch[1];
    if (liffId.match(/^\d{10}-[a-zA-Z0-9]+$/)) {
      console.log(`   ✅ LIFF ID format valid: ${liffId.substring(0, 10)}...`);
    } else {
      console.log(`   ❌ LIFF ID format invalid: ${liffId}`);
    }
  } else {
    console.log("   ❌ LIFF ID not found in HTML");
  }

  // Check API base URL
  const apiMatch = htmlFile.match(/API_BASE_URL:\s*['"`]([^'"`]+)['"`]/);
  if (apiMatch) {
    const apiUrl = apiMatch[1];
    console.log(`   ✅ API Base URL: ${apiUrl}`);
  } else {
    console.log("   ❌ API Base URL not found");
  }
} catch (error) {
  console.log(`   ❌ Error testing LIFF config: ${error.message}`);
}

console.log("\n" + "=".repeat(60));
console.log("🎯 LIFF CSP Test Summary");
console.log("=".repeat(60));
console.log("");
console.log("If all tests pass, try these commands:");
console.log("");
console.log("1. Test configuration:");
console.log("   npm run test:netlify");
console.log("");
console.log("2. Start development server:");
console.log("   netlify dev");
console.log("");
console.log("3. Access application:");
console.log("   http://localhost:8888/prima789-liff-member-card.html");
console.log("");
console.log("Expected: No more CSP errors, LIFF should initialize properly");
console.log("=".repeat(60));
