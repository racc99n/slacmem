const { Pool } = require("@neondatabase/serverless");
const { io } = require("socket.io-client");
const axios = require("axios"); // เราจะใช้ axios ในการตรวจสอบ Token

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// =================================================================
//                 ส่วนของ Middleware และ API Logic
// =================================================================

/**
 * Middleware จริงสำหรับตรวจสอบ LINE ID Token
 * @param {object} headers - Headers จาก request ของ Netlify Function
 * @returns {Promise<string>} - คืนค่า lineUserId ถ้า Token ถูกต้อง
 * @throws {Error} - ถ้า Token ไม่ถูกต้องหรือไม่พบ
 */
async function authMiddleware(headers) {
  const authHeader = headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Authorization header is missing or invalid");
  }

  const idToken = authHeader.split(" ")[1];
  const liffId = process.env.LIFF_ID; // ดึง LIFF ID จาก Environment Variables

  if (!liffId) {
    console.error("LIFF_ID environment variable is not set!");
    throw new Error("Server configuration error");
  }

  try {
    const response = await axios.post(
      "https://api.line.me/oauth2/v2.1/verify",
      new URLSearchParams({
        id_token: idToken,
        client_id: liffId,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    // 'sub' คือ property ที่เก็บ Line User ID ใน token ที่ verified แล้ว
    const lineUserId = response.data.sub;
    console.log(`Successfully verified token for user: ${lineUserId}`);
    return lineUserId;
  } catch (error) {
    console.error(
      "LINE token verification failed:",
      error.response ? error.response.data : error.message
    );
    throw new Error("Invalid or expired token");
  }
}

function authenticateAndGetData(phone, pin) {
  return new Promise((resolve, reject) => {
    console.log(`Attempting to login via Socket.IO for phone: ${phone}`);
    const socket = io("https://prima789.net", {
      transports: ["polling"],
    });

    let fullMemberData = {};
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        socket.disconnect();
        reject({ success: false, message: "การเชื่อมต่อล้มเหลว (หมดเวลา)" });
      }
    }, 20000);

    socket.on("connect", () => {
      console.log("Socket.IO connected. Emitting login event.");
      socket.emit("login", { tel: phone, pin: pin });
    });

    socket.on("cus return", (response) => {
      if (response.success) {
        const data = response.data;
        fullMemberData.primaUsername = data.mm_user;
        fullMemberData.firstName = data.first_name;
        fullMemberData.lastName = data.last_name;
      } else {
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
      if (fullMemberData.creditBalance !== undefined && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        socket.disconnect();
        resolve({ success: true, data: fullMemberData });
      }
    });

    socket.on("credit_push", (response) => {
      if (response.success) {
        fullMemberData.creditBalance = response.data.total_credit;
      }
      if (fullMemberData.primaUsername && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        socket.disconnect();
        resolve({ success: true, data: fullMemberData });
      }
    });

    socket.on("disconnect", () => console.log("Socket.IO disconnected."));
    socket.on("connect_error", (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
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
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  try {
    const lineUserId = await authMiddleware(event.headers);
    const path = event.path.replace(/(\.netlify\/functions\/api|\/api)/, "");

    if (event.httpMethod === "GET" && path.startsWith("/status")) {
      const { rows } = await pool.query(
        "SELECT prima_username FROM user_mappings WHERE line_user_id = $1",
        [lineUserId]
      );

      if (rows.length > 0) {
        const memberData = {
          primaUsername: rows[0].prima_username,
          memberTier: "Standard", // ข้อมูลจำลอง
          creditBalance: "N/A", // ดึงข้อมูลล่าสุดเมื่อจำเป็น
        };
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ synced: true, memberData: memberData }),
        };
      } else {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ synced: false }),
        };
      }
    }

    if (event.httpMethod === "POST" && path.startsWith("/sync")) {
      const { username, password } = JSON.parse(event.body);
      if (!username || !password) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Missing required fields" }),
        };
      }

      const result = await authenticateAndGetData(username, password);
      if (!result.success) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: result.message }),
        };
      }

      const memberData = result.data;
      await pool.query(
        `INSERT INTO user_mappings (line_user_id, prima_username) VALUES ($1, $2)
                 ON CONFLICT (line_user_id) DO UPDATE SET prima_username = EXCLUDED.prima_username;`,
        [lineUserId, memberData.primaUsername]
      );

      const finalData = {
        primaUsername: memberData.primaUsername,
        memberTier: "Standard",
        creditBalance: memberData.creditBalance,
        firstName: memberData.firstName,
        lastName: memberData.lastName,
      };

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ synced: true, memberData: finalData }),
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: "Route not found" }),
    };
  } catch (error) {
    console.error("API Handler Error:", error);
    const errorMessage = error.message || "Internal Server Error";
    if (error.message.includes("token")) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: errorMessage }),
      };
    }
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: errorMessage }),
    };
  }
};
