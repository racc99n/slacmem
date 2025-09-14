// netlify/functions/api.js - แก้ไข CORS Headers
const corsHeaders = {
  "Access-Control-Allow-Origin":
    process.env.NODE_ENV === "production"
      ? "https://prima168.online,https://liff.line.me,https://slaczcardmem.netlify.app"
      : "*",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Requested-With, X-LINE-ChannelId, X-LINE-ChannelSecret",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
};

// Main handler function
exports.handler = async (event, context) => {
  // Handle OPTIONS preflight requests
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  try {
    // ตรวจสอบ Origin ที่อนุญาต
    const origin = event.headers.origin || event.headers.Origin;
    const allowedOrigins = [
      "https://prima168.online",
      "https://liff.line.me",
      "https://slaczcardmem.netlify.app",
      "http://localhost:8888", // สำหรับ development
    ];

    let responseHeaders = { ...corsHeaders };

    if (allowedOrigins.includes(origin)) {
      responseHeaders["Access-Control-Allow-Origin"] = origin;
    }

    // ส่วนที่เหลือของ API logic
    const path = event.path.replace("/.netlify/functions/api", "");
    const method = event.httpMethod;

    // Route handling
    if (path === "/health" && method === "GET") {
      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          status: "ok",
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV || "development",
        }),
      };
    }

    // Other API routes...

    return {
      statusCode: 404,
      headers: responseHeaders,
      body: JSON.stringify({ error: "Endpoint not found" }),
    };
  } catch (error) {
    console.error("API Error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Internal server error",
        message:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      }),
    };
  }
};
