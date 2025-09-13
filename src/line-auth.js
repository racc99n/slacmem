import axios from "axios";

const LINE_API_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";
const LIFF_CHANNEL_ID = process.env.LIFF_CHANNEL_ID;

// ฟังก์ชันสำหรับตรวจสอบ ID Token
export async function verifyLineIdToken(idToken) {
  if (!idToken) {
    throw new Error("ID Token is required.");
  }

  const params = new URLSearchParams();
  params.append("id_token", idToken);
  params.append("client_id", LIFF_CHANNEL_ID);

  try {
    const response = await axios.post(LINE_API_VERIFY_URL, params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    // ถ้า token ถูกต้อง LINE API จะตอบกลับข้อมูลโปรไฟล์
    // 'sub' คือ lineUserId
    return response.data;
  } catch (error) {
    console.error("LINE ID Token verification failed:", error.response?.data);
    throw new Error("Invalid ID Token.");
  }
}

// Middleware สำหรับ Express เพื่อตรวจสอบ Token ในทุก request
export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Authorization header is missing or invalid." });
  }

  const idToken = authHeader.split(" ")[1];

  try {
    const decodedToken = await verifyLineIdToken(idToken);
    req.lineUserId = decodedToken.sub; // เก็บ lineUserId ไว้ใน request object
    next(); // ไปยัง route handler ถัดไป
  } catch (error) {
    return res.status(401).json({ error: "Invalid ID Token." });
  }
};
