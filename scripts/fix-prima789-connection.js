// scripts/fix-prima789-connection.js - Prima789 Connection Diagnostic & Fix
const fs = require("fs");
const path = require("path");

console.log("🔧 Prima789 Connection Diagnostic & Fix Tool");
console.log("=============================================\n");

async function diagnoseAndFix() {
  console.log("1️⃣ Checking Socket.IO Installation...");

  // Check if socket.io-client is installed
  const packageJsonPath = path.join(process.cwd(), "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  const hasSocketIO =
    packageJson.dependencies && packageJson.dependencies["socket.io-client"];

  if (!hasSocketIO) {
    console.log("❌ socket.io-client not found in dependencies");
    console.log("💡 Installing socket.io-client...");

    const { execSync } = require("child_process");
    try {
      execSync("npm install socket.io-client@4.7.5", { stdio: "inherit" });
      console.log("✅ socket.io-client installed successfully");
    } catch (error) {
      console.log("❌ Failed to install socket.io-client:", error.message);
    }
  } else {
    console.log("✅ socket.io-client found in dependencies");
  }

  console.log("\n2️⃣ Testing Network Connectivity...");

  // Test network connectivity to prima789.net
  try {
    const https = require("https");
    await new Promise((resolve, reject) => {
      const req = https.get(
        "https://prima789.net",
        { timeout: 10000 },
        (res) => {
          console.log(`✅ Prima789.net accessible (HTTP ${res.statusCode})`);
          resolve(res);
        }
      );

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Connection timeout"));
      });

      req.on("error", reject);
    });
  } catch (error) {
    console.log(`❌ Prima789.net not accessible: ${error.message}`);
    console.log(
      "💡 This might be due to network restrictions or server issues"
    );
  }

  console.log("\n3️⃣ Testing Socket.IO Connection...");

  // Test Socket.IO connection
  try {
    const io = require("socket.io-client").io;

    await new Promise((resolve, reject) => {
      const socket = io("https://prima789.net", {
        transports: ["polling"],
        timeout: 10000,
        forceNew: true,
      });

      const timeout = setTimeout(() => {
        socket.disconnect();
        reject(new Error("Socket.IO connection timeout"));
      }, 10000);

      socket.on("connect", () => {
        clearTimeout(timeout);
        console.log("✅ Socket.IO connection successful");
        socket.disconnect();
        resolve();
      });

      socket.on("connect_error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  } catch (error) {
    console.log(`❌ Socket.IO connection failed: ${error.message}`);
    console.log("💡 Will use fallback authentication method");
  }

  console.log("\n4️⃣ Testing API Endpoint...");

  // Test our API endpoint
  try {
    const testData = {
      phone: "0969174691",
      pin: "9999",
    };

    // Use fetch if available, otherwise use https
    let response;
    try {
      const fetch = require("node-fetch");
      response = await fetch(
        "https://slaczcardmem.netlify.app/.netlify/functions/api/test-prima789",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(testData),
          timeout: 20000,
        }
      );

      const result = await response.json();
      console.log("📊 API Response:", JSON.stringify(result, null, 2));
    } catch (fetchError) {
      console.log("⚠️ Using https module for API test...");

      const https = require("https");
      const postData = JSON.stringify(testData);

      const options = {
        hostname: "slaczcardmem.netlify.app",
        port: 443,
        path: "/.netlify/functions/api/test-prima789",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
      };

      await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let data = "";

          res.on("data", (chunk) => {
            data += chunk;
          });

          res.on("end", () => {
            try {
              const result = JSON.parse(data);
              console.log("📊 API Response:", JSON.stringify(result, null, 2));
              resolve();
            } catch (error) {
              console.log("❌ Failed to parse API response:", data);
              reject(error);
            }
          });
        });

        req.on("error", reject);
        req.write(postData);
        req.end();
      });
    }

    console.log("✅ API endpoint test completed");
  } catch (error) {
    console.log(`❌ API endpoint test failed: ${error.message}`);
  }

  console.log("\n5️⃣ Generating Fix Recommendations...");

  const recommendations = [];

  // Check if socket.io-client needs to be added
  if (!hasSocketIO) {
    recommendations.push({
      issue: "Missing Socket.IO Client",
      fix: "npm install socket.io-client@4.7.5",
      priority: "HIGH",
    });
  }

  // Check environment variables
  const requiredEnvVars = ["DATABASE_URL", "LIFF_ID"];
  const missingEnvVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );

  if (missingEnvVars.length > 0) {
    recommendations.push({
      issue: `Missing environment variables: ${missingEnvVars.join(", ")}`,
      fix: "Set these in Netlify dashboard: Site settings → Environment variables",
      priority: "HIGH",
    });
  }

  // General recommendations
  recommendations.push({
    issue: "Connection Reliability",
    fix: "Updated API includes fallback authentication when Socket.IO fails",
    priority: "INFO",
  });

  recommendations.push({
    issue: "Network Issues",
    fix: "If Prima789.net is not accessible, the system will use demo data",
    priority: "INFO",
  });

  console.log("\n📋 Recommendations:");
  console.log("===================");

  recommendations.forEach((rec, index) => {
    const priorityIcon =
      rec.priority === "HIGH" ? "🔴" : rec.priority === "MEDIUM" ? "🟡" : "🔵";

    console.log(`\n${index + 1}. ${priorityIcon} ${rec.issue}`);
    console.log(`   Fix: ${rec.fix}`);
  });

  console.log("\n6️⃣ Testing Current System...");

  // Test the actual API function locally if possible
  try {
    const apiModule = require("../netlify/functions/api.js");

    const mockEvent = {
      httpMethod: "POST",
      path: "/.netlify/functions/api/test-prima789",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        phone: "0969174691",
        pin: "9999",
      }),
    };

    console.log("🧪 Testing API function locally...");
    const result = await apiModule.handler(mockEvent, {});

    const responseBody = JSON.parse(result.body);
    console.log("📊 Local API Test Result:");
    console.log(`   Status: ${result.statusCode}`);
    console.log(`   Success: ${responseBody.success}`);
    console.log(`   Message: ${responseBody.message}`);

    if (responseBody.data) {
      console.log(
        `   Connection Method: ${responseBody.connectionMethod || "unknown"}`
      );
      console.log(
        `   User Data Source: ${responseBody.data.source || "unknown"}`
      );
    }
  } catch (error) {
    console.log(`❌ Local API test failed: ${error.message}`);
  }

  console.log("\n🎯 Summary:");
  console.log("===========");
  console.log("• The system now includes multiple connection strategies");
  console.log("• If Socket.IO fails, it falls back to demo/mock data");
  console.log(
    "• This ensures the system works even if Prima789 is unreachable"
  );
  console.log("• Users will see a note indicating if demo data is being used");

  console.log("\n✨ Next Steps:");
  console.log("=============");
  console.log("1. Deploy the updated API to Netlify");
  console.log("2. Test the /test-prima789 endpoint again");
  console.log("3. Monitor the logs for connection status");
  console.log("4. Consider adding more fallback strategies if needed");

  console.log("\n🚀 Deploy Command:");
  console.log("==================");
  console.log("npm run deploy");
  console.log("# or");
  console.log("netlify deploy --prod");
}

// Run diagnostic
if (require.main === module) {
  diagnoseAndFix().catch(console.error);
}

module.exports = { diagnoseAndFix };
