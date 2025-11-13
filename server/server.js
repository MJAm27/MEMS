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

// 2. ตั้งค่าการเชื่อมต่อฐานข้อมูล
const dbConfig = {
    host: 'localhost',
    user: 'myuser', // User ที่คุณสร้างใน MySQL
    password: 'emailkmutnb', // รหัสผ่านของ User นั้น
    database: 'projectmems' 
};

// 3. ตั้งค่าคีย์ลับสำหรับ JWT
// ⚠️ เปลี่ยนเป็นคีย์ลับของคุณ (ห้ามซ้ำกับใคร)
const JWT_SECRET = "MY_SUPER_SECRET_KEY_FOR_JWT_12345";

// --- API Endpoints ---

/**
 * Endpoint 1: Login (ตรวจสอบ Email + Password)
 */
app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    let connection; // ประกาศ Connection ภายนอก try

    try {
        connection = await mysql.createConnection(dbConfig);
        const [users] = await connection.execute("SELECT * FROM Users WHERE email = ?", [email]);

        if (users.length === 0) {
            await connection.end(); // ปิด Connection ก่อน return
            return res.status(401).json({ message: "Email หรือ Password ไม่ถูกต้อง" });
        }

        const user = users[0];

        // 1. ตรวจสอบ Password
        const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordMatch) {
            await connection.end(); // ปิด Connection ก่อน return
            return res.status(401).json({ message: "Email หรือ Password ไม่ถูกต้อง" });
        }

        // 2. ตรวจสอบสถานะ 2FA
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
        
        await connection.end(); // ปิด Connection เมื่อทำงานสำเร็จ

    } catch (error) {
        console.error("Login Error:", error);
        if (connection) await connection.end(); // (สำคัญ) ปิด Connection ถ้าเกิด Error
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});

/**
 * Endpoint 2: สร้าง QR Code สำหรับผู้ใช้ครั้งแรก
 */
app.post("/api/setup-2fa", async (req, res) => {
    const { userId } = req.body;
    let connection;

    try {
        // 1. สร้าง Secret ใหม่
        const secret = speakeasy.generateSecret({
            name: `MEMS Project (${userId})`,
        });

        // 2. บันทึก secret (base32) ลง DB
        connection = await mysql.createConnection(dbConfig);
        await connection.execute("UPDATE Users SET totp_secret = ? WHERE user_id = ?", [
            secret.base32,
            userId
        ]);
        await connection.end(); // ปิด Connection หลังทำงาน DB เสร็จ

        // 3. สร้าง QR Code
        qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
            if (err) {
                return res.status(500).json({ message: "ไม่สามารถสร้าง QR Code" });
            }
            res.json({ qrCodeUrl: data_url });
        });

    } catch (error) {
        console.error("Setup 2FA Error:", error);
        if (connection) await connection.end(); // (สำคัญ) ปิด Connection ถ้าเกิด Error
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});

/**
 * Endpoint 3: ตรวจสอบรหัส 6 หลัก (Verify)
 */
app.post("/api/verify-2fa", async (req, res) => {
    const { userId, token } = req.body;
    let connection;

    try {
        connection = await mysql.createConnection(dbConfig);
        
        // 1. ดึง secret ที่เก็บไว้ (JOIN กับ Role)
        const [users] = await connection.execute(
            "SELECT U.*, R.role_name FROM Users U JOIN Role R ON U.role_id = R.role_id WHERE U.user_id = ?", 
            [userId]
        );
        
        if (users.length === 0) {
            await connection.end();
            return res.status(404).json({ message: "ไม่พบผู้ใช้งาน" });
        }
        
        const user = users[0];
        const { totp_secret, role_name } = user;

        // 2. ตรวจสอบรหัส 6 หลัก
        const verified = speakeasy.totp.verify({
            secret: totp_secret,
            encoding: 'base32',
            token: token,
            window: 1 
        });

        if (verified) {
            // 3. ถ้าสำเร็จ: สร้าง JWT (Token ล็อกอิน)
            const loginToken = jwt.sign(
                { 
                    userId: user.user_id, 
                    email: user.email,
                    role: role_name
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
        
        await connection.end(); // ปิด Connection เมื่อทำงานสำเร็จ

    } catch (error) {
        console.error("Verify 2FA Error:", error);
        if (connection) await connection.end(); // (สำคัญ) ปิด Connection ถ้าเกิด Error
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});

/**
 * Endpoint 4: Register (สร้างผู้ใช้งานใหม่)
 */
app.post("/api/register", async (req, res) => {
    const { email, password, fullname, position, phone_number, role_id } = req.body;
    
    // ⚠️ ----------------------------------------------------
    // ⚠️ !! สำคัญ !! ตรวจสอบว่า 'R-ENG' มีในตาราง Role
    // ⚠️ ----------------------------------------------------
    //const defaultRole = 'R-ENG'; // สมมติให้เป็น 'engineer'

    // 1. ตรวจสอบข้อมูลพื้นฐาน
    if (!email || !password || !fullname || !role_id) {
        return res.status(400).json({ message: "กรุณากรอก Email, Password, และ Fullname" });
    }

    let connection;

    try {
        connection = await mysql.createConnection(dbConfig);

        // 2. ตรวจสอบว่า Email นี้ถูกใช้ไปแล้วหรือยัง
        const [existingUsers] = await connection.execute("SELECT user_id FROM Users WHERE email = ?", [email]);
        if (existingUsers.length > 0) {
            await connection.end();
            return res.status(409).json({ message: "Email นี้ถูกใช้งานแล้ว" });
        }

        // 3. (สำคัญ) เข้ารหัสรหัสผ่าน (Hashing)
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // 4. สร้าง User ID ใหม่ (ตัวอย่างแบบง่าย)
        const newUserId = `U-${Date.now().toString().slice(-10)}`;

        // 5. บันทึกผู้ใช้ใหม่ลงฐานข้อมูล
        await connection.execute(
            "INSERT INTO Users (user_id, email, password_hash, fullname, position, phone_number, role_id, totp_secret) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)",
            [newUserId, email, passwordHash, fullname, position, phone_number, role_id]
        );
        
        await connection.end(); // ปิด Connection เมื่อทำงานสำเร็จ

        // 6. ส่งการตอบกลับว่าสำเร็จ
        res.status(201).json({ message: "ลงทะเบียนสำเร็จ กรุณาเข้าสู่ระบบ" });

    } catch (error) {
        console.error("Register Error:", error);
        if (connection) await connection.end(); // (สำคัญ) ปิด Connection ถ้าเกิด Error
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});

// 4. สั่งให้ Server รัน
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
});