import { Router } from "express";
import { findUserLink, createUserLink } from "./db.js";
import { authenticatePrimaUser } from "./prima789-api.js";
import { authMiddleware } from "./line-auth.js";

const router = Router();

// ใช้ authMiddleware กับทุก route ในไฟล์นี้
router.use(authMiddleware);

// GET /api/status
// เปลี่ยนจาก /user-status/{lineUserId} เป็น /status เพราะเราได้ lineUserId จาก token แล้ว
router.get("/status", async (req, res) => {
  try {
    const userLink = await findUserLink(req.lineUserId);

    if (userLink) {
      // **สำคัญ:** ในสถานการณ์จริง คุณควรดึงข้อมูลล่าสุดจาก prima789 ที่นี่
      // เพื่อให้ข้อมูลสมาชิกอัปเดตเสมอ
      const memberData = {
        primaUsername: userLink.prima_username,
        memberTier: "Gold", // (ข้อมูลจำลอง)
        creditBalance: "1,234.56", // (ข้อมูลจำลอง)
      };
      res.json({ synced: true, memberData });
    } else {
      res.json({ synced: false });
    }
  } catch (error) {
    console.error("Error checking sync status:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/sync
// เปลี่ยนจาก /sync-account เป็น /sync เพื่อความกระชับ
router.post("/sync", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required." });
  }

  try {
    // 1. ตรวจสอบ username/password กับระบบ prima789
    const memberData = await authenticatePrimaUser(username, password);

    // 2. ถ้าสำเร็จ, บันทึกการเชื่อมโยงลงฐานข้อมูล Neon
    await createUserLink(req.lineUserId, username);

    // 3. ส่งข้อมูลสมาชิกลับไปให้ Frontend
    res.status(200).json({ synced: true, memberData });
  } catch (error) {
    // ถ้า authenticatePrimaUser ไม่สำเร็จ จะเข้า catch นี้
    if (error.message === "Invalid prima789 credentials") {
      return res
        .status(401)
        .json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
    }
    console.error("Error syncing account:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
