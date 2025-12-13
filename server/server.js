
const express = require('express');
const mysql = require("mysql2/promise"); // โค้ดเดิมใช้ mysql2/promise
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const cors = require('cors');
const axios = require('axios'); // สำหรับเชื่อมต่อ ESP8266

const app = express();
const PORT = 3001; // Port สำหรับ Backend

// 1. ตั้งค่า Middlewares
app.use(cors());
app.use(express.json());

require('dotenv').config()

// --- โค้ดส่วน Database Configuration เดิม ---
const dbConfig = {
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    port: process.env.DATABASE_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 20000, 
};
const pool = mysql.createPool(dbConfig);
// เปลี่ยน 'db' ที่ใช้ในส่วน ESP เป็น 'pool' เพื่อให้สอดคล้องกับโค้ดด้านบน
const db = pool; 
// ------------------------------------------


pool.query("SELECT 1")
    .then(() => console.log("✅ Database connected successfully!"))
    .catch(err => console.error("❌ Database connection failed:", err.message));


const JWT_SECRET = "MY_SUPER_SECRET_KEY_FOR_JWT_12345";

// +++++++++++++++++++++++ ค่าคงที่สำหรับ ESP8266 +++++++++++++++++++++++
// ‼️ (สำคัญ) ใส่ IP ของ ESP8266 ที่ได้จาก Serial Monitor
const ESP_IP = 'http://192.168.1.139'; 
// (ชั่วคราว) User ID ที่จะใช้บันทึก Log (จากตาราง user)
const HARDCODED_USER_ID = 123464;
// -------------------------------------------------------------------


// +++++++++++++++++++++++ Middleware ตรวจสอบ Token +++++++++++++++++++++++
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.sendStatus(401); 
    }

    jwt.verify(token, JWT_SECRET, (err, userPayload) => {
        if (err) {
            console.error("JWT Verification Error:", err.message);
            return res.sendStatus(403); 
        }
        
        req.user = userPayload; 
        next(); 
    });
}
// ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++


// --- Helper Functions สำหรับ ESP และ Log ---

/**
 * ฟังก์ชัน Helper สำหรับบันทึก Log ลง Database
 */
async function logActionToDB(userId, actionTypeId) {
    const sql = `
        INSERT INTO accesslogs (user_id, action_type_id, access_date, access_time) 
        VALUES (?, ?, CURDATE(), CURTIME())
    `;
    try {
        await db.query(sql, [userId, actionTypeId]);
        console.log(`[Database] Logged action: User ${userId}, ActionType ${actionTypeId}`);
    } catch (dbError) {
        console.error('[Database] Error logging action:', dbError.message);
        throw new Error('Failed to log action to database');
    }
}

/**
 * ฟังก์ชัน Helper สำหรับสั่งงาน ESP8266
 */
async function commandServo(action) { // action คือ 'open' หรือ 'close'
    const url = `${ESP_IP}/${action}`;
    try {
        const response = await axios.get(url, { timeout: 3000 }); 
        console.log(`[ESP8266] Commanded '${action}'. Response: ${response.data}`);
        return response.data;
    } catch (espError) {
        console.error(`[ESP8266] Error commanding '${action}' at ${url}:`, espError.message);
        throw new Error('Failed to command ESP8266 (Check if ESP is online)');
    }
}

// --- API Endpoints สำหรับ ESP8266 (ส่วนใหม่) ---

// 📌 API: สำหรับ "เปิด" Servo
app.get('/api/open', async (req, res) => {
    // ‼️ ควรใช้ req.user.userId แทน HARDCODED_USER_ID ใน Production
    const userId = HARDCODED_USER_ID; 
    const ACTION_TYPE_ID = 1; // ID 1 คือ 'Servo Open' 
    
    try {
        await commandServo('open');
        await logActionToDB(userId, ACTION_TYPE_ID);
        res.status(200).send({ message: 'Servo Opened and action logged.' });

    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// 📌 API: สำหรับ "ปิด" Servo
app.get('/api/close', async (req, res) => {
    // ‼️ ควรใช้ req.user.userId แทน HARDCODED_USER_ID ใน Production
    const userId = HARDCODED_USER_ID; 
    const ACTION_TYPE_ID = 2; // ID 2 คือ 'Servo Close'

    try {
        await commandServo('close');
        await logActionToDB(userId, ACTION_TYPE_ID);
        res.status(200).send({ message: 'Servo Closed and action logged.' });

    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// --- API Endpoints เดิม (Login, Register, 2FA, Profile) ---

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
 * Endpoint 2: Register (สร้างผู้ใช้งานใหม่)
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


/**
 * Endpoint 3: สร้าง QR Code สำหรับผู้ใช้ครั้งแรก
 */
app.post("/api/setup-2fa", async (req, res) => {
    const { userId } = req.body;

    try {
        const secret = speakeasy.generateSecret({
            name: `MEMS Project (${userId})`,
        });

        await pool.execute(
            "UPDATE users SET totp_secret = ? WHERE user_id = ?",
            [secret.base32, userId]
        );
        
        qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
            if (err) {
                console.error("QR code generation error: ", err);
                return res.status(500).json({ message: "Error generating QR code" });
            }
            res.json({
                qrCodeDataUrl: data_url,
                otpauth_url: secret.otpauth_url,
                secret: secret.base32    
            });
        });

    } catch (error) {
        console.error("Setup 2FA Error:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});



/**
 * Endpoint 4: ตรวจสอบรหัส 6 หลัก (Verify)
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
                    role: user.role_id,
                    fullname: user.fullname
                },
                JWT_SECRET,
                { expiresIn: '8h' }
            );
            
            res.json({ 
                message: "ล็อกอินสำเร็จ", 
                token: loginToken,
                role: user.role_name
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
 */
app.get("/api/auth/me", authenticateToken, async (req, res) => {
    const userIdFromToken = req.user.userId; 

    try {
        const [users] = await pool.execute("SELECT * FROM users WHERE user_id = ?", [userIdFromToken]);
        
        if (users.length === 0) {
            return res.status(404).json({ message: "User not found in database" });
        }

        const user = users[0];

        res.json({
            user_id: user.user_id, 
            fullname: user.fullname,
            email: user.email,
            phone_number: user.phone_number,
            position: user.position,
            role: req.user.role 
        });

    } catch (error) {
        console.error("Get Me Error:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});


/**
 * Endpoint 6: Update User Profile (Protected)
 */
app.put("/api/profile-edit", authenticateToken, async (req, res) => {
    const userIdFromToken = req.user.userId;
    const { fullname, email, phone_number, position } = req.body;

    if (!fullname || !email) {
        return res.status(400).json({ message: "Fullname and Email are required." });
    }

    try {
        await pool.execute(
            "UPDATE users SET fullname = ?, email = ?, phone_number = ?, position = ? WHERE user_id = ?",
            [fullname, email, phone_number, position, userIdFromToken]
        );

        res.json({ message: "Profile updated successfully!" });

    } catch (error) {
        console.error("Update Profile Error:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: "This email is already in use." });
        }
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
app.listen(PORT, () => {
    console.log(`🚀 Backend server is running on http://localhost:${PORT}`);
    console.log(`   (Ready to command ESP at ${ESP_IP})`);
});