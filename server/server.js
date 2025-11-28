const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const cors = require("cors");

const app = express();

// 1. ตั้งค่า Middlewares
app.use(cors());
app.use(express.json());

require('dotenv').config()

const dbConfig = {
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    port: process.env.DATABASE_PORT,
    waitForConnections: true,
    connectionLimit: 10, // สามารถปรับจำนวนได้ตามความเหมาะสม
    queueLimit: 0
};

// สร้าง Connection Pool เพื่อจัดการการเชื่อมต่ออย่างมีประสิทธิภาพ
const pool = mysql.createPool(dbConfig);

pool.query("SELECT 1")
  .then(() => console.log("✅ Database connected successfully!"))
  .catch(err => console.error("❌ Database connection failed:", err.message));


const JWT_SECRET = "MY_SUPER_SECRET_KEY_FOR_JWT_12345";

// +++++++++++++++++++++++ Middleware ตรวจสอบ Token +++++++++++++++++++++++
/**
 * Middleware สำหรับตรวจสอบ JWT (Token)
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // แยก "Bearer <TOKEN>"

    if (token == null) {
        return res.sendStatus(401); // 401 Unauthorized (ไม่มี Token)
    }

    jwt.verify(token, JWT_SECRET, (err, userPayload) => {
        if (err) {
            console.error("JWT Verification Error:", err.message);
            return res.sendStatus(403); // 403 Forbidden (Token ไม่ถูกต้อง หรือหมดอายุ)
        }
        
        // Token ถูกต้อง, เก็บข้อมูล user ที่ถอดรหัสได้ไว้ใน req
        req.user = userPayload; 
        next(); // ไปยัง Endpoint ถัดไป
    });
}
// ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++


// --- API Endpoints ---

/**
 * Endpoint 1: Login (ตรวจสอบ Email + Password)
 */
app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const [users] = await pool.execute("SELECT * FROM users WHERE email = ?", [email]);

        if (users.length === 0) {
            return res.status(401).json({ message: "Email หรือ Password ไม่ถูกต้อง" });
        }

        const user = users[0];
        const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
        
        if (!isPasswordMatch) {
            return res.status(401).json({ message: "Email หรือ Password ไม่ถูกต้อง" });
        }

        if (user.totp_secret) {
            res.json({ 
                status: "2fa_required", 
                userId: user.user_id 
            });
        } else {
            res.json({ 
                status: "2fa_setup_required", 
                userId: user.user_id 
            });
        }
        
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});

/**
 * Endpoint 2: สร้าง QR Code สำหรับผู้ใช้ครั้งแรก
 */
app.post("/api/setup-2fa", async (req, res) => {
    const { userId } = req.body;

    try {
        const secret = speakeasy.generateSecret({
            name: `MEMS Project (${userId})`,
        });

        await pool.execute("UPDATE users SET totp_secret = ? WHERE user_id = ?", [
            secret.base32,
            userId
        ]);

        qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
            if (err) {
                return res.status(500).json({ message: "ไม่สามารถสร้าง QR Code" });
            }
            res.json({ qrCodeUrl: data_url });
        });

    } catch (error) {
        console.error("Setup 2FA Error:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});

/**
 * Endpoint 3: ตรวจสอบรหัส 6 หลัก (Verify)
 */
app.post("/api/verify-2fa", async (req, res) => {
    const { userId, token } = req.body;

    try {
        const [users] = await pool.execute(
            "SELECT U.*, R.role_name FROM users U JOIN role R ON U.role_id = R.role_id WHERE U.user_id = ?", 
            [userId]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ message: "ไม่พบผู้ใช้งาน" });
        }
        
        const user = users[0];
        const { totp_secret, role_name } = user;

        const verified = speakeasy.totp.verify({
            secret: totp_secret,
            encoding: 'base32',
            token: token,
            window: 1 
        });

        if (verified) {
            const loginToken = jwt.sign(
                { 
                    userId: user.user_id, 
                    email: user.email,
                    role: role_name,
                    fullname: user.fullname
                },
                JWT_SECRET,
                { expiresIn: '8h' }
            );
            
            res.json({ 
                message: "ล็อกอินสำเร็จ", 
                token: loginToken 
            });
        } else {
            res.status(401).json({ message: "รหัส 6 หลักไม่ถูกต้อง" });
        }
        
    } catch (error) {
        console.error("Verify 2FA Error:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});


/**
 * Endpoint 5: Get Current User (Protected)
 * (แก้ไข: ให้ค้นหาข้อมูลล่าสุดจาก DB)
 */
app.get("/api/auth/me", authenticateToken, async (req, res) => {
    // req.user มาจาก middleware (มี userId, email, fullname, role)
    const userIdFromToken = req.user.userId; 

    try {
        // ใช้ userId จาก Token ไปค้นหาข้อมูลทั้งหมดใน DB
        const [users] = await pool.execute("SELECT * FROM users WHERE user_id = ?", [userIdFromToken]);
        
        if (users.length === 0) {
            return res.status(404).json({ message: "User not found in database" });
        }

        const user = users[0];

        // ส่งข้อมูลที่ครบถ้วนกลับไป
        res.json({
            user_id: user.user_id, // ส่งเป็น snake_case ให้ตรงกับ DB และ React
            fullname: user.fullname,
            email: user.email,
            phone_number: user.phone_number,
            position: user.position,
            role: req.user.role // 'role' มาจาก token
        });

    } catch (error) {
        console.error("Get Me Error:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});


// +++++++++++++++++++++++ (ส่วนที่เพิ่มเข้ามา) +++++++++++++++++++++++
/**
 * Endpoint 6: Update User Profile (Protected)
 * (Endpoint ใหม่สำหรับหน้า ProfileEditENG.js)
 */
app.put("/api/profile-edit", authenticateToken, async (req, res) => {
    // 1. ดึง ID ผู้ใช้จาก Token ที่ตรวจสอบแล้ว (ปลอดภัย)
    const userIdFromToken = req.user.userId;

    // 2. ดึงข้อมูลที่ส่งมาจาก Form
    const { fullname, email, phone_number, position } = req.body;

    // 3. ตรวจสอบข้อมูล
    if (!fullname || !email) {
        return res.status(400).json({ message: "Fullname and Email are required." });
    }

    try {
        // 4. อัปเดตข้อมูลในฐานข้อมูล
        await pool.execute(
            "UPDATE users SET fullname = ?, email = ?, phone_number = ?, position = ? WHERE user_id = ?",
            [fullname, email, phone_number, position, userIdFromToken]
        );

        // 5. ส่งคำตอบว่าสำเร็จ
        res.json({ message: "Profile updated successfully!" });

    } catch (error) {
        console.error("Update Profile Error:", error);
        // ตรวจสอบ lỗi email ซ้ำ
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: "This email is already in use." });
        }
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});
// ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++


/**
 * Endpoint 4: Register (สร้างผู้ใช้งานใหม่)
 */
app.post("/api/register", async (req, res) => {
    const { email, password, fullname, position, phone_number, role_id } = req.body;
    
    if (!email || !password || !fullname || !role_id) {
        return res.status(400).json({ message: "กรุณากรอก Email, Password, Fullname และ Role ID" });
    }

    try {
        const [existingUsers] = await pool.execute("SELECT user_id FROM users WHERE email = ?", [email]);
        if (existingUsers.length > 0) {
            return res.status(409).json({ message: "Email นี้ถูกใช้งานแล้ว" });
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        const newUserId = `U-${Date.now().toString().slice(-10)}`;

        // console.log("password_input = [" + password + "]");
        // console.log("password_from_db =", user.password_hash);

        await pool.execute(
            "INSERT INTO users (user_id, email, password_hash, fullname, position, phone_number, role_id, totp_secret) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)",
            [newUserId, email, passwordHash, fullname, position, phone_number, role_id]
        );
        
        res.status(201).json({ message: "ลงทะเบียนสำเร็จ กรุณาเข้าสู่ระบบ" });

    } catch (error) {
        console.error("Register Error:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});

app.get("/api/inventoryBalanceReportChart", async (req, res) => {
    try {
        const sql = `
            SELECT 
                et.Equipment_name AS name, 
                COALESCE(SUM(l.current_quantity), 0) as quantity
            FROM equipment_type et
            LEFT JOIN equipment e ON et.equipment_type_id = e.equipment_type_id
            LEFT JOIN lot l ON e.equipment_id = l.equipment_id
            GROUP BY et.equipment_type_id, et.Equipment_name
        `;

        const [rows] = await pool.query(sql);
        res.json(rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err });
    }
});


// 4. สั่งให้ Server รัน
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
});
