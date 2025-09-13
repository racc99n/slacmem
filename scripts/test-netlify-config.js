// scripts/test-netlify-config.js - Test Netlify configuration

const fs = require("fs");
const path = require("path");

console.log("🔍 Testing Netlify configuration...\n");

const netlifyTomlPath = path.join(__dirname, "../netlify.toml");

try {
  // Check if file exists
  if (!fs.existsSync(netlifyTomlPath)) {
    throw new Error("netlify.toml file not found");
  }

  const content = fs.readFileSync(netlifyTomlPath, "utf8");

  console.log("✅ netlify.toml file exists");

  // Check for required sections
  const requiredSections = [
    "[build]",
    "[[redirects]]",
    "[[headers]]",
    'functions = "netlify/functions"',
    'publish = "public"',
  ];

  let allSectionsFound = true;
  for (const section of requiredSections) {
    if (!content.includes(section)) {
      console.log(`❌ Missing section: ${section}`);
      allSectionsFound = false;
    } else {
      console.log(`✅ Found: ${section}`);
    }
  }

  // Check CSP header format
  const cspMatch = content.match(/Content-Security-Policy\s*=\s*"([^"]+)"/);
  if (cspMatch) {
    const cspValue = cspMatch[1];

    // Check if CSP is single line (no \n in the value)
    if (cspValue.includes("\n")) {
      console.log(
        "❌ CSP header contains line breaks (will cause header error)"
      );
      allSectionsFound = false;
    } else {
      console.log("✅ CSP header is properly formatted (single line)");
    }

    // Check CSP length
    if (cspValue.length > 4000) {
      console.log("⚠️  CSP header is very long, might cause issues");
    } else {
      console.log(
        `✅ CSP header length is acceptable (${cspValue.length} chars)`
      );
    }
  } else {
    console.log("⚠️  No Content-Security-Policy header found");
  }

  // Check for invalid characters in headers
  const headerLines = content
    .split("\n")
    .filter(
      (line) =>
        line.trim().includes("=") && line.trim().match(/^\s*[A-Za-z-]+\s*=/)
    );

  let invalidHeaders = false;
  for (const line of headerLines) {
    const match = line.match(/^\s*([A-Za-z-]+)\s*=\s*"([^"]+)"/);
    if (match) {
      const [, headerName, headerValue] = match;

      // Check for common invalid characters
      const invalidChars = /[\r\n\x00-\x1f\x7f]/;
      if (invalidChars.test(headerValue)) {
        console.log(`❌ Invalid characters in header "${headerName}"`);
        invalidHeaders = true;
      }
    }
  }

  if (!invalidHeaders) {
    console.log("✅ No invalid characters found in headers");
  }

  // Check redirects
  const redirectMatches = content.match(/\[\[redirects\]\]/g);
  if (redirectMatches && redirectMatches.length > 0) {
    console.log(`✅ Found ${redirectMatches.length} redirect rule(s)`);
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  if (allSectionsFound && !invalidHeaders) {
    console.log("🎉 Netlify configuration looks good!");
    console.log('✅ You can now try running "netlify dev" again');
  } else {
    console.log("💥 Configuration has issues that need fixing");
  }
  console.log("=".repeat(50));
} catch (error) {
  console.error("❌ Error reading netlify.toml:", error.message);
  process.exit(1);
}
