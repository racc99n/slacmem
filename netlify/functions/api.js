// netlify/functions/api.js - Final Version with Correct Socket Path
const { Pool } = require("@neondatabase/serverless");
const { io } = require("socket.io-client");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Database connection
let pool;
try {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
} catch (error) {
  console.error("Database initialization failed:", error);
  pool = null;
}

// ===== Prima789 Socket.IO Service with Correct Path =====
function getPrima789Data(phone, pin) {
  return new Promise((resolve, reject) => {
    // *** The KEY CHANGE is here: use the default path '/socket.io/' ***
    const socket = io("https://api.prima789.net", {
      transports: ["polling", "websocket"],
      path: "/socket.io/", // Corrected Path
    });

    let userData = {};
    let resolved = false;

    const operationTimeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        socket.disconnect();
        reject(new Error("การเชื่อมต่อหมดเวลา (Timeout) กรุณาลองใหม่อีกครั้ง"));
      }
    }, 25000); // 25 seconds

    socket.on("connect", () => {
      console.log("Socket connected successfully to api.prima789.net");
      socket.emit("login", { tel: phone, pin: pin });
    });

    socket.on("customer_data", (data) => {
      console.log("Received customer_data");
      userData.prima_username = data.mm_user;
      userData.first_name = data.first_name;
      userData.last_name = data.last_name;
      if (userData.credit_balance !== undefined && !resolved) {
        resolved = true;
        clearTimeout(operationTimeout);
        socket.disconnect();
        resolve(userData);
      }
    });

    socket.on("credit_push", (data) => {
      console.log("Received credit_push");
      if (data.success) {
        userData.credit_balance = parseFloat(data.data.total_credit) || 0;
      }
      if (userData.prima_username && !resolved) {
        resolved = true;
        clearTimeout(operationTimeout);
        socket.disconnect();
        resolve(userData);
      }
    });

    socket.on("login_status", (status) => {
      console.log("Received login_status:", status);
      if (status === false && !resolved) {
        resolved = true;
        clearTimeout(operationTimeout);
        socket.disconnect();
        reject(new Error("เบอร์โทรศัพท์หรือ PIN ไม่ถูกต้อง"));
      }
    });

    socket.on("connect_error", (err) => {
      console.error("Socket Connection Error:", err.message);
      if (!resolved) {
        resolved = true;
        clearTimeout(operationTimeout);
        reject(
          new Error(
            "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ Prima789 ได้: " + err.message
          )
        );
      }
    });
  });
}

// Response helper
function createResponse(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

// Main API Handler
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (event.path.endsWith("/user/verify") && event.httpMethod === "POST") {
    if (!pool) {
      return createResponse(500, { error: "Database not connected" });
    }

    try {
      const { phone, pin } = JSON.parse(event.body || "{}");
      if (!phone || !pin) {
        return createResponse(400, { error: "กรุณากรอกเบอร์โทรศัพท์และ PIN" });
      }

      const primaData = await getPrima789Data(phone, pin);

      const { rows } = await pool.query(
        "SELECT * FROM users WHERE phone = $1",
        [phone]
      );
      let user = rows[0];

      if (user) {
        const updateResult = await pool.query(
          `UPDATE users SET prima_username = $2, first_name = $3, last_name = $4, credit_balance = $5, updated_at = NOW() 
           WHERE phone = $1 RETURNING *`,
          [
            phone,
            primaData.prima_username,
            primaData.first_name,
            primaData.last_name,
            primaData.credit_balance,
          ]
        );
        user = updateResult.rows[0];
      } else {
        const insertResult = await pool.query(
          `INSERT INTO users (phone, prima_username, first_name, last_name, credit_balance, is_active) 
           VALUES ($1, $2, $3, $4, $5, true) RETURNING *`,
          [
            phone,
            primaData.prima_username,
            primaData.first_name,
            primaData.last_name,
            primaData.credit_balance,
          ]
        );
        user = insertResult.rows[0];
      }

      const responseData = {
        id: user.id,
        username: user.prima_username,
        phone: user.phone,
        firstName: user.first_name,
        lastName: user.last_name,
        balance: parseFloat(user.credit_balance),
        level: "SILVER",
        isActive: user.is_active,
        lastUpdated: new Date().toISOString(),
        source: "prima789",
      };

      return createResponse(200, {
        success: true,
        message: "เข้าสู่ระบบสำเร็จ",
        user: responseData,
      });
    } catch (error) {
      console.error("Handler Error:", error);
      return createResponse(500, {
        error: error.message || "เกิดข้อผิดพลาดในระบบ",
      });
    }
  }

  return createResponse(404, { error: "Endpoint not found" });
};
