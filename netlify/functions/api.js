const { Pool } = require("@neondatabase/serverless");
const { io } = require("socket.io-client");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// =================================================================
//                 ส่วนของ Middleware และ API Logic
// =================================================================

/**
 * TODO: Implement your real LINE Token validation logic here.
 * นี่คือ Middleware จำลองสำหรับตรวจสอบ LINE ID Token
 * @param {object} headers - Headers จาก request ของ Netlify Function
 * @returns {Promise<string>} - คืนค่า lineUserId ถ้า Token ถูกต้อง
 * @throws {Error} - ถ้า Token ไม่ถูกต้องหรือไม่พบ
 */
async function authMiddleware(headers) {
  // ในสถานการณ์จริง คุณต้องดึง 'Authorization' header มา
  // const token = headers.authorization?.split(' ')[1];
  // if (!token) {
  //     throw new Error('No authorization token provided');
  // }
  //
  // ... ทำการ verify token กับ LINE ...
  // const decoded = await verifyLineToken(token);
  // return decoded.sub; // .sub คือ lineUserId

  // ---- สำหรับการทดสอบตอนนี้, เราจะใช้ค่าจำลองไปก่อน ----
  // ดึง lineUserId จาก header พิเศษที่เราจะส่งจาก Frontend
  const mockLineUserId = headers["x-mock-line-user-id"];
  if (!mockLineUserId) {
    // ถ้าเป็นการเรียกจริงที่ไม่มี header นี้ ให้โยน error
    // ในอนาคตเมื่อใช้ Token จริง ให้ลบส่วนนี้ออก
    throw new Error("Authorization required");
  }
  console.log(`Authenticated mock user: ${mockLineUserId}`);
  return mockLineUserId;
}

/**
 * ฟังก์ชันยืนยันตัวตนและดึงข้อมูลจาก Prima789 ผ่าน Socket.IO
 * @param {string} phone - เบอร์โทรศัพท์
 * @param {string} pin - PIN 4 ตัว
 * @returns {Promise<object>} - ข้อมูลสมาชิกที่สมบูรณ์
 */
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
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, x-mock-line-user-id",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  try {
    // --- เรียกใช้ Middleware ของเราก่อน ---
    // เราจะส่ง lineUserId ผ่าน header ชื่อ 'x-mock-line-user-id' จาก Frontend เพื่อทดสอบ
    const lineUserId = await authMiddleware(event.headers);

    // --- เริ่มการ Routing แบบ Manual ---
    const path = event.path.replace(/\.netlify\/functions\/[^/]+/, "");

    // GET /api/status (เปลี่ยนจาก user-status)
    if (event.httpMethod === "GET" && path.startsWith("/status")) {
      const { rows } = await pool.query(
        "SELECT prima_username FROM user_mappings WHERE line_user_id = $1",
        [lineUserId]
      );

      if (rows.length > 0) {
        // **สำคัญ:** ในอนาคตคุณสามารถเพิ่มการดึงข้อมูลล่าสุดจาก prima789 ที่นี่ได้
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
          statusCode: 200,
          headers,
          body: JSON.stringify({ synced: false }),
        };
      }
    }

    // POST /api/sync (เปลี่ยนจาก sync-account)
    if (event.httpMethod === "POST" && path.startsWith("/sync")) {
      const { username, password } = JSON.parse(event.body);
      if (!username || !password) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ message: "Missing required fields" }),
        };
      }

      const result = await authenticateAndGetData(username, password);
      if (!result.success) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ message: result.message }),
        };
      }
      const memberData = result.data;

      await pool.query(
        `INSERT INTO user_mappings (line_user_id, prima_username) VALUES ($1, $2)
                 ON CONFLICT (line_user_id) DO UPDATE SET prima_username = EXCLUDED.prima_username;`,
        [lineUserId, memberData.primaUsername]
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          synced: true,
          memberData: {
            primaUsername: memberData.primaUsername,
            creditBalance: memberData.creditBalance,
            firstName: memberData.firstName,
            lastName: memberData.lastName,
          },
        }),
      };
    }

    // ถ้าไม่มี Route ไหนตรงเลย
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ message: "Route not found" }),
    };
  } catch (error) {
    console.error("API Handler Error:", error);
    const errorMessage = error.message || "Internal Server Error";
    // ถ้าเป็น Error จาก Middleware
    if (error.message === "Authorization required") {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: errorMessage }),
      };
    }
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: errorMessage }),
    };
  }
};
