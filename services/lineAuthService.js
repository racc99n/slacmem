const axios = require("axios");

const LINE_API_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";
const LIFF_CHANNEL_ID = process.env.LIFF_CHANNEL_ID; // เก็บเป็น Environment Variable

async function verifyLineIdToken(idToken) {
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
    // LINE API จะตอบกลับด้วยข้อมูลโปรไฟล์ถ้า token ถูกต้อง
    // 'sub' คือ lineUserId
    return response.data;
  } catch (error) {
    // ถ้า API ตอบกลับด้วย status ที่ไม่ใช่ 2xx, axios จะ throw error
    console.error("LINE ID Token verification failed:", error.response?.data);
    throw new Error("Invalid ID Token.");
  }
}

module.exports = { verifyLineIdToken };
