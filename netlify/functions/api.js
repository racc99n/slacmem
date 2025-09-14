// netlify/functions/api.js - Final Production Version
const { Pool } = require("@neondatabase/serverless");
const { io } = require("socket.io-client");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Database connection (เหมือนเดิม)
let pool;
try {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
} catch (error) {
  console.error("Database initialization failed:", error);
  pool = null;
}

// ===== NEW: Prima789 Socket.IO Service =====
function getPrima789Data(phone, pin) {
  return new Promise((resolve, reject) => {
    const socket = io("https://api.prima789.net", {
      transports: ["polling", "websocket"],
      path: "/api/", // Path สำหรับ Socket.IO ของ Prima789
    });

    let userData = {};
    let resolved = false;

    const operationTimeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        socket.disconnect();
        reject(new Error("การเชื่อมต่อหมดเวลา กรุณาลองใหม่อีกครั้ง"));
      }
    }, 25000); // 25 วินาที

    socket.on("connect", () => {
      console.log("Socket connected to api.prima789.net");
      // ส่ง event login ไปที่ server จริง
      socket.emit("login", { tel: phone, pin: pin });
    });

    // ดักฟัง event ที่มีข้อมูลผู้ใช้
    socket.on("customer_data", (data) => {
      console.log("Received customer_data:", data);
      userData.prima_username = data.mm_user;
      userData.first_name = data.first_name;
      userData.last_name = data.last_name;
      // หากได้รับข้อมูลครบแล้ว ให้ resolve
      if (userData.credit_balance !== undefined && !resolved) {
        resolved = true;
        clearTimeout(operationTimeout);
        socket.disconnect();
        resolve(userData);
      }
    });

    // ดักฟัง event ที่มีข้อมูลเครดิต
    socket.on("credit_push", (data) => {
      console.log("Received credit_push:", data);
      if (data.success) {
        userData.credit_balance = parseFloat(data.data.total_credit) || 0;
      }
      // หากได้รับข้อมูลครบแล้ว ให้ resolve
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

// Response helper (เหมือนเดิม)
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

  if (event.path.endsWith("/user/sync") && event.httpMethod === "POST") {
    if (!pool) {
      return createResponse(500, { error: "Database not connected" });
    }

    try {
      const { phone, pin } = JSON.parse(event.body || "{}");
      if (!phone || !pin) {
        return createResponse(400, { error: "กรุณากรอกเบอร์โทรศัพท์และ PIN" });
      }

      // 1. Get fresh data from Prima789 using Socket.IO
      console.log(`Fetching data for phone: ${phone}`);
      const primaData = await getPrima789Data(phone, pin);
      console.log("Successfully fetched Prima789 data:", primaData);

      // 2. Check if user exists in our DB
      const { rows } = await pool.query(
        "SELECT * FROM users WHERE phone = $1",
        [phone]
      );
      let user = rows[0];

      if (user) {
        // 3a. User exists, UPDATE their data
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
        console.log("User updated:", user.id);
      } else {
        // 3b. User does not exist, INSERT new record
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
        console.log("User created:", user.id);
      }

      // 4. Format and return user data to the client
      const responseData = {
        id: user.id,
        username: user.prima_username,
        phone: user.phone,
        firstName: user.first_name,
        lastName: user.last_name,
        balance: parseFloat(user.credit_balance),
        level: "SILVER", // You can add your tier logic back here
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
      console.error("Verification error:", error);
      return createResponse(500, {
        error: error.message || "เกิดข้อผิดพลาดในระบบ",
      });
    }
  }

  return createResponse(404, { error: "Endpoint not found" });
};
