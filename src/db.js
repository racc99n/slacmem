import { neon } from "@neondatabase/serverless";

// สร้างการเชื่อมต่อฐานข้อมูลจาก environment variable
const sql = neon(process.env.DATABASE_URL);

// ฟังก์ชันสำหรับค้นหาข้อมูลการเชื่อมโยงจาก line_user_id
export async function findUserLink(lineUserId) {
  const result =
    await sql`SELECT * FROM user_links WHERE line_user_id = ${lineUserId}`;
  return result; // คืนค่า record แรกที่เจอ หรือ undefined ถ้าไม่เจอ
}

// ฟังก์ชันสำหรับสร้างหรืออัปเดตข้อมูลการเชื่อมโยง
export async function createUserLink(lineUserId, primaUsername) {
  // ใช้ ON CONFLICT เพื่อจัดการทั้งการ INSERT ใหม่ และ UPDATE กรณีมีข้อมูลอยู่แล้ว
  return await sql`
    INSERT INTO user_links (line_user_id, prima_username)
    VALUES (${lineUserId}, ${primaUsername})
    ON CONFLICT (line_user_id)
    DO UPDATE SET prima_username = EXCLUDED.prima_username;
  `;
}
