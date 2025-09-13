const { Pool } = require("pg");
const { io } = require("socket.io-client");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

/**
 * ฟังก์ชันยืนยันตัวตนและดึงข้อมูลจาก Prima789 ผ่าน Socket.IO
 * @param {string} phone - เบอร์โทรศัพท์
 * @param {string} pin - PIN 4 ตัว
 * @returns {Promise<object>} - ข้อมูลสมาชิกที่สมบูรณ์
 */
function authenticateAndGetData(phone, pin) {
  return new Promise((resolve, reject) => {
    console.log(`Attempting to login via Socket.IO for phone: ${phone}`);

    // Prima789 ใช้ Socket.IO ที่ path หลัก ไม่ใช่ที่ api.prima789.net
    const socket = io("https://prima789.net", {
      transports: ["polling"],
    });

    let fullMemberData = {};
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        socket.disconnect();
        console.error("Socket.IO operation timed out.");
        reject({ success: false, message: "การเชื่อมต่อล้มเหลว (หมดเวลา)" });
      }
    }, 20000); // 20 วินาที

    socket.on("connect", () => {
      console.log("Socket.IO connected. Emitting login event.");
      // จากการวิเคราะห์ HTML, event login มักจะส่ง object ที่มี tel และ pin
      socket.emit("login", { tel: phone, pin: pin });
    });

    // รอรับข้อมูลผู้ใช้
    socket.on("cus return", (response) => {
      console.log('Received "cus return" event:', response);
      if (response.success) {
        const data = response.data;
        fullMemberData.primaUsername = data.mm_user;
        fullMemberData.firstName = data.first_name;
        fullMemberData.lastName = data.last_name;
      } else {
        // กรณี Login ผิด, server อาจจะส่ง success: false มา
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          socket.disconnect();
          reject({
            success: false,
            message:
              response.data.message || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
          });
        }
      }

      // เช็คว่าได้ข้อมูลเครดิตมาหรือยัง
      if (fullMemberData.creditBalance !== undefined && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        socket.disconnect();
        resolve({ success: true, data: fullMemberData });
      }
    });

    // รอรับข้อมูลเครดิต
    socket.on("credit_push", (response) => {
      console.log('Received "credit_push" event:', response);
      if (response.success) {
        fullMemberData.creditBalance = response.data.total_credit;
      }

      // เช็คว่าได้ข้อมูลผู้ใช้มาหรือยัง
      if (fullMemberData.primaUsername && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        socket.disconnect();
        resolve({ success: true, data: fullMemberData });
      }
    });

    // จัดการ Error อื่นๆ
    socket.on("disconnect", () => console.log("Socket.IO disconnected."));
    socket.on("connect_error", (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        console.error("Socket.IO connection error:", err.message);
        reject({
          success: false,
          message: "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้",
        });
      }
    });
  });
}

// =================================================================
//                 MAIN HANDLER (ส่วนนี้ไม่ต้องแก้)
// =================================================================
exports.handler = async (event, context) => {
  const path = event.path.replace(/\.netlify\/functions\/[^/]+/, "");
  const segments = path.split("/").filter(Boolean);
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
  };
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  try {
    if (
      event.httpMethod === "GET" &&
      segments[1] === "user-status" &&
      segments[2]
    ) {
      const lineUserId = segments[2];
      const { rows } = await pool.query(
        "SELECT prima_username FROM user_mappings WHERE line_user_id = $1",
        [lineUserId]
      );

      if (rows.length > 0) {
        // แค่เช็คว่าเคย Sync หรือยัง ไม่ต้องดึงข้อมูลจริง
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            synced: true,
            primaUsername: rows[0].prima_username,
          }),
        };
      } else {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ synced: false, message: "User not synced" }),
        };
      }
    }

    if (event.httpMethod === "POST" && segments[1] === "sync-account") {
      const { lineUserId, username, password } = JSON.parse(event.body); // username คือ เบอร์โทร, password คือ PIN
      if (!lineUserId || !username || !password) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ message: "Missing required fields" }),
        };
      }

      // 1. ยืนยันตัวตนและดึงข้อมูลในขั้นตอนเดียว
      const result = await authenticateAndGetData(username, password);
      if (!result.success) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ message: result.message }),
        };
      }
      const memberData = result.data;

      // 2. บันทึกการจับคู่ลง DB
      await pool.query(
        `INSERT INTO user_mappings (line_user_id, prima_username) VALUES ($1, $2)
                 ON CONFLICT (line_user_id) DO UPDATE SET prima_username = EXCLUDED.prima_username;`,
        [lineUserId, memberData.primaUsername]
      );

      // 3. ส่งข้อมูลที่ได้กลับไปให้ LIFF App
      const finalData = {
        primaUsername: memberData.primaUsername,
        memberTier: "Standard",
        creditBalance: memberData.creditBalance,
        firstName: memberData.firstName,
        lastName: memberData.lastName,
      };

      return { statusCode: 200, headers, body: JSON.stringify(finalData) };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: "Route not found" }),
    };
  } catch (error) {
    console.error("API Error:", error);
    // ถ้า error มาจาก promise reject ของเรา ให้ใช้ message นั้น
    const errorMessage = error.message || "Internal Server Error";
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: errorMessage }),
    };
  }
};
