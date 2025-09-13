import "dotenv/config"; // โหลด.env เข้า process.env
import express from "express";
import serverless from "serverless-http";
import cors from "cors";
import apiRoutes from "../../src/routes.js";

const app = express();

// Middleware
app.use(cors()); // อนุญาต Cross-Origin Requests
app.use(express.json()); // สำหรับอ่าน JSON body

// ใช้ routes ที่เราสร้างไว้
app.use("/api", apiRoutes);

// ส่งออก handler สำหรับ Netlify
export const handler = serverless(app);
