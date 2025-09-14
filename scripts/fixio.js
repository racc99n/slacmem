// debug-prima789.js - Debug Prima789 Connection Issues
const { io } = require("socket.io-client");

console.log("🔍 Prima789 Connection Debug Tool");
console.log("================================\n");

// Test different connection configurations
async function testPrima789Connection() {
  const testConfigs = [
    {
      name: "Standard Configuration",
      url: "https://prima789.net",
      options: {
        transports: ["polling"],
        forceNew: true,
        timeout: 10000,
      },
    },
    {
      name: "WebSocket + Polling",
      url: "https://prima789.net",
      options: {
        transports: ["websocket", "polling"],
        forceNew: true,
        timeout: 10000,
      },
    },
    {
      name: "Polling Only (Long Timeout)",
      url: "https://prima789.net",
      options: {
        transports: ["polling"],
        forceNew: true,
        timeout: 20000,
        reconnection: false,
      },
    },
    {
      name: "With Different Path",
      url: "https://prima789.net/socket.io",
      options: {
        transports: ["polling"],
        forceNew: true,
        timeout: 10000,
      },
    },
    {
      name: "Direct Socket.IO",
      url: "wss://prima789.net",
      options: {
        transports: ["websocket"],
        forceNew: true,
        timeout: 10000,
      },
    },
  ];

  for (const config of testConfigs) {
    await testConnection(config);
  }
}

function testConnection(config) {
  return new Promise((resolve) => {
    console.log(`\n🧪 Testing: ${config.name}`);
    console.log(`📡 URL: ${config.url}`);
    console.log(`⚙️  Options:`, JSON.stringify(config.options, null, 2));

    const socket = io(config.url, config.options);
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.log("❌ Connection timeout");
        socket.disconnect();
        resolve(false);
      }
    }, config.options.timeout || 10000);

    socket.on("connect", () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        console.log("✅ Connection successful!");
        console.log(`🆔 Socket ID: ${socket.id}`);
        console.log(`🚀 Transport: ${socket.io.engine.transport.name}`);

        // Test login emission
        console.log("📤 Sending test login...");
        socket.emit("login", { tel: "0969174691", pin: "9999" });

        // Wait for potential response
        setTimeout(() => {
          socket.disconnect();
          resolve(true);
        }, 3000);
      }
    });

    socket.on("connect_error", (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        console.log("❌ Connection error:", error.message);
        console.log("📋 Error details:", error);
        resolve(false);
      }
    });

    socket.on("cus return", (data) => {
      console.log('📥 Received "cus return":', data);
    });

    socket.on("credit_push", (data) => {
      console.log('📥 Received "credit_push":', data);
    });

    // Listen for any events
    socket.onAny((event, ...args) => {
      console.log(`📥 Received event "${event}":`, args);
    });
  });
}

// Additional network tests
async function testNetworkConnectivity() {
  console.log("\n🌐 Network Connectivity Tests");
  console.log("=============================");

  const testUrls = [
    "https://prima789.net",
    "https://prima789.net/login",
    "https://prima789.net/socket.io",
    "https://prima789.net/health",
    "https://prima789.net/api",
  ];

  for (const url of testUrls) {
    try {
      console.log(`\n🔗 Testing: ${url}`);

      const response = await fetch(url, {
        method: "HEAD",
        timeout: 10000,
      });

      console.log(`✅ Status: ${response.status} ${response.statusText}`);
      console.log(
        `📋 Headers:`,
        Object.fromEntries(response.headers.entries())
      );
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
  }
}

// Check if running in Netlify environment
function checkEnvironment() {
  console.log("\n🔧 Environment Check");
  console.log("===================");

  console.log("Node.js Version:", process.version);
  console.log("Platform:", process.platform);
  console.log("Architecture:", process.arch);

  // Netlify-specific environment variables
  const netlifyVars = [
    "NETLIFY",
    "NETLIFY_DEV",
    "CONTEXT",
    "DEPLOY_PRIME_URL",
    "URL",
  ];

  netlifyVars.forEach((varName) => {
    if (process.env[varName]) {
      console.log(`${varName}:`, process.env[varName]);
    }
  });

  // Check if we're in a serverless function environment
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    console.log("🚀 Running in AWS Lambda (Netlify Functions)");
  }

  // Check available packages
  const packages = ["socket.io-client"];
  packages.forEach((pkg) => {
    try {
      require.resolve(pkg);
      console.log(`✅ ${pkg}: Available`);
    } catch (error) {
      console.log(`❌ ${pkg}: Not available`);
    }
  });
}

// Alternative connection methods
async function testAlternativeConnections() {
  console.log("\n🔄 Alternative Connection Methods");
  console.log("================================");

  // Test with different user agents
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Prima789-Client/1.0",
    "Node.js Socket.IO Client",
  ];

  for (const userAgent of userAgents) {
    console.log(`\n🤖 Testing with User-Agent: ${userAgent}`);

    try {
      const socket = io("https://prima789.net", {
        transports: ["polling"],
        forceNew: true,
        timeout: 10000,
        extraHeaders: {
          "User-Agent": userAgent,
          Origin: "https://prima789.net",
          Referer: "https://prima789.net",
        },
      });

      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.log("❌ Timeout with this user agent");
          socket.disconnect();
          resolve();
        }, 10000);

        socket.on("connect", () => {
          clearTimeout(timeout);
          console.log("✅ Connected with this user agent!");
          socket.disconnect();
          resolve();
        });

        socket.on("connect_error", (error) => {
          clearTimeout(timeout);
          console.log("❌ Error with this user agent:", error.message);
          resolve();
        });
      });
    } catch (error) {
      console.log("❌ Exception:", error.message);
    }
  }
}

// Main execution
async function main() {
  checkEnvironment();
  await testNetworkConnectivity();
  await testPrima789Connection();
  await testAlternativeConnections();

  console.log("\n🎯 Recommendations");
  console.log("==================");
  console.log("1. Check if prima789.net is accessible from your network");
  console.log("2. Try different transport methods (polling vs websocket)");
  console.log("3. Check if there are firewall restrictions");
  console.log("4. Verify the correct Socket.IO endpoint path");
  console.log("5. Consider using a proxy if direct connection fails");

  console.log("\n📞 Alternative Solutions");
  console.log("========================");
  console.log("1. Use HTTP API instead of Socket.IO if available");
  console.log("2. Implement connection retry with exponential backoff");
  console.log("3. Add fallback to mock data for development");
  console.log("4. Contact Prima789 support for correct connection details");
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testPrima789Connection, testNetworkConnectivity };
