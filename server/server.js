const express = require('express');
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const cors = require('cors');
const axios = require('axios'); // สำหรับเชื่อมต่อ ESP8266
const multer = require('multer'); 
const path = require('path'); 

// ++++++++++ แก้ไข: นำเข้า http และ socket.io ++++++++++
const http = require('http'); 
const { Server } = require("socket.io"); 
// +++++++++++++++++++++++++++++++++++++++++++++++++++++


const app = express();
// ++++++++++ แก้ไข: สร้าง HTTP Server และผูก Socket.IO ++++++++++
const server = http.createServer(app); 
const io = new Server(server, { 
    cors: {
        origin: "*", // ควรระบุ origin ที่แน่นอนใน Production
        methods: ["GET", "POST"]
    }
}); 
const PORT = 3001; // Port สำหรับ Backend
// ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++


// 1. ตั้งค่า Middlewares
app.use(cors());
app.use(express.json());

require('dotenv').config()

// --- Database Configuration ---
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
const db = pool; 
// ------------------------------


pool.query("SELECT 1")
    .then(() => console.log("✅ Database connected successfully!"))
    .catch(err => console.error("❌ Database connection failed:", err.message));


const JWT_SECRET = "MY_SUPER_SECRET_KEY_FOR_JWT_12345";

// +++++++++++++++++++++++ ค่าคงที่สำหรับ ESP8266 +++++++++++++++++++++++
const ESP_IP = 'http://192.168.1.139'; 
const HARDCODED_USER_ID = 123464; // (ชั่วคราว)
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
    // ✅ แก้ไข: เพิ่ม Backticks ล้อมรอบ SQL Query
    // สร้าง ID เอง เพราะใน DB เป็น varchar(20) ไม่ใช่ Auto Increment
    const logId = `LOG-${Date.now().toString().slice(-10)}`; 

    const sql = `
        INSERT INTO accesslogs (log_id, user_id, action_type_id, date, time) 
        VALUES (?, ?, ?, CURDATE(), CURTIME())
    `;
    try {   
        await db.query(sql, [logId, userId, actionTypeId]);
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
// --- Helper function สำหรับสร้าง ID ---
function generateTransactionId(prefix = 'TX') {
    return `${prefix}-${Date.now().toString().slice(-10)}`;
}

// --- API Endpoints สำหรับ ESP8266 ---

// 📌 API: สำหรับ "เปิด" Servo
app.get('/api/open', authenticateToken, async (req, res) => {
    const ACTION_TYPE_ID = 'A-001'; // 'เปิดประตู'

    try {
         // await commandServo('open'); // 🚨 เปิดใช้เมื่อเชื่อมต่อ ESP จริง
        await logActionToDB(req.user.userId, ACTION_TYPE_ID);
        res.status(200).send({ message: 'Servo Opened and action logged.' });

    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// 📌 API: สำหรับ "ปิด" Servo
app.get('/api/close', authenticateToken, async (req, res) => {
    const ACTION_TYPE_ID = 'A-002'; // 'ปิดประตู'

    try {
        // await commandServo('close'); // 🚨 เปิดใช้เมื่อเชื่อมต่อ ESP จริง
        await logActionToDB(req.user.userId, ACTION_TYPE_ID);
         res.status(200).send({ message: 'Servo Closed and action logged.' });

    } catch (error) {
    res.status(500).send({ error: error.message });
    }
});

// --- API Endpoints สำหรับ Withdrawal (เชื่อมต่อ DB) ---

// 1. API: Fetch Part Info (POST /api/withdraw/partInfo)
app.post('/api/withdraw/partInfo', async (req, res) => {
    // partId ที่ส่งมาใน body จะเท่ากับ equipment_type_id (เช่น 'ABU-001')
    const { partId } = req.body; 

    if (!partId) {
        return res.status(400).json({ error: 'Part ID is required.' });
    }

    try {
        // Query: รวมสต็อก (current_quantity) จากทุก Lot สำหรับ Part Type นั้น
        const sql = `
            SELECT
                ET.equipment_type_id AS partId,
                ET.Equipment_name AS partName,
                ET.unit,
                COALESCE(SUM(L.current_quantity), 0) AS currentStock,
                ET.img AS imageUrl
            FROM equipment_type ET
            LEFT JOIN equipment E ON ET.equipment_type_id = E.equipment_type_id
            LEFT JOIN lot L ON E.equipment_id = L.equipment_id
            WHERE ET.equipment_type_id = ?
            GROUP BY ET.equipment_type_id, ET.Equipment_name, ET.unit, ET.img
         `;
        
        const [rows] = await pool.query(sql, [partId]);

        if (rows.length === 0 || rows[0].currentStock === 0) {
            return res.status(404).json({ error: 'ไม่พบรายการอะไหล่หรือไม่มีสต็อก' });
        }
        
        // จัดการ URL รูปภาพที่อาจเป็น NULL ใน DB
        rows[0].imageUrl = rows[0].imageUrl === 'NULL' || !rows[0].imageUrl ? '' : rows[0].imageUrl;

        res.json(rows[0]);

    } catch (error) {
        console.error("DB Error fetching part info:", error.message);
        res.status(500).json({ error: 'Server error while fetching part details.' });
    }
});


// 2. API: Confirm and Cut Stock (POST /api/withdraw/confirm)
app.post('/api/withdraw/confirm', authenticateToken, async (req, res) => {
    const { machine_SN, cartItems } = req.body;
    const userId = req.user.userId; // ดึง user ID จาก Token

    if (!machine_SN || !cartItems || cartItems.length === 0) {
        return res.status(400).json({ error: 'Machine SN และรายการเบิกเป็นสิ่งจำเป็น' });
    }
     
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction(); // เริ่ม Transaction
        
        const transactionId = generateTransactionId('WTH');
        const transactionTypeId = 'T-WTH'; // 🚨 สมมติให้ T-WTH เป็น ID สำหรับ Transaction Type 'เบิก'

        // 1. ตรวจสอบ/สร้าง Machine (ถ้าไม่มีในตาราง machine)
        const [machineCheck] = await connection.query("SELECT machine_SN FROM machine WHERE machine_SN = ?", [machine_SN]);
        if (machineCheck.length === 0) {
            await connection.query("INSERT INTO machine (machine_SN, machine_name) VALUES (?, ?)", [machine_SN, `Machine ${machine_SN} (Created by Withdrawal)`]);
    }

        // 2. สร้าง Transaction หลัก
        const insertTransactionSql = `
            INSERT INTO transactions (transaction_id, transaction_type_id, date, time, user_id, machine_SN)
            VALUES (?, ?, CURDATE(), CURTIME(), ?, ?)
        `;
        await connection.query(insertTransactionSql, [transactionId, transactionTypeId, userId, machine_SN]);

        // 3. วนลูปเพื่อตัดสต็อกและบันทึกรายการอะไหล่
        for (const item of cartItems) {
            const { partId, quantity } = item; // partId = equipment_type_id (e.g., 'ABU-001')

            // 3a. ค้นหา Lot ที่พร้อมใช้งาน (เรียงตามวันหมดอายุ/นำเข้า เพื่อให้เป็น FIFO)
            const [lotRows] = await connection.query(`
                SELECT 
                    L.lot_id, L.current_quantity, E.equipment_id, ET.Equipment_name
                FROM lot L
                JOIN equipment E ON L.equipment_id = E.equipment_id
                JOIN equipment_type ET ON E.equipment_type_id = ET.equipment_type_id
                WHERE E.equipment_type_id = ? AND L.current_quantity > 0
                ORDER BY L.expiry_date ASC, L.import_date ASC
            `, [partId]);

            let requiredQty = quantity;
            let totalAvailable = lotRows.reduce((sum, lot) => sum + lot.current_quantity, 0);

            if (totalAvailable < requiredQty) {
                throw new Error(`สต็อกไม่เพียงพอสำหรับ ${lotRows[0]?.Equipment_name || partId} (ต้องการ ${requiredQty} มีเพียง ${totalAvailable})`);
            }

            // 3b. Logic ตัดสต็อก
            for (const lot of lotRows) {
                if (requiredQty <= 0) break;

                 // ตัดสต็อกจาก Lot นั้น
                await connection.query(
                    "UPDATE lot SET current_quantity = current_quantity - ? WHERE lot_id = ?",
                    [deductAmount, lot.lot_id]
                );

                // บันทึกรายการอะไหล่ที่เบิก (equipment_list)
                const listId = generateTransactionId('EL');
                await connection.query(
                    "INSERT INTO equipment_list (equipment_list_id, transaction_id, equipment_id, quantity) VALUES (?, ?, ?, ?)",
                    [listId, transactionId, lot.equipment_id, deductAmount]
                );
                
                requiredQty -= deductAmount;
             }
        }

        // 4. บันทึก Log การทำรายการปิดประตู (A-002)
        await connection.query(
            "INSERT INTO accesslogs (log_id, time, date, action_type_id, transaction_id) VALUES (?, CURTIME(), CURDATE(), ?, ?)",
            [generateTransactionId('LG'), 'A-002', transactionId]
        );

        await connection.commit(); // ยืนยันการทำรายการทั้งหมด
        res.json({ success: true, transactionId: transactionId, message: 'บันทึกการเบิกและตัดสต็อกสำเร็จ' });

    } catch (error) {
        if (connection) {
            await connection.rollback(); // ยกเลิกการทำรายการทั้งหมดหากเกิดข้อผิดพลาด
        }
        console.error("Withdrawal Transaction Failed:", error.message);
        res.status(500).json({ error: error.message || 'เกิดข้อผิดพลาดในการทำรายการตัดสต็อก' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});
// --- API Endpoints เดิม (Login, Register, 2FA, Profile) ---

/**
 * Endpoint 1: Login (ตรวจสอบ Email + Password)
 */
app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        // ใช้ pool.execute แทนการสร้าง connection ใหม่
        const [users] = await pool.execute("SELECT * FROM users WHERE email = ?", [email]);

        if (users.length === 0) {
            return res.status(401).json({ message: "Email หรือ Password ไม่ถูกต้อง" });
        }

        const user = users[0];
        const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
        
        if (!isPasswordMatch) {
            return res.status(401).json({ message: "Email หรือ Password ไม่ถูกต้อง" });
        }
        
        // ✅ เปิดใช้การตรวจสอบ 2FA/Setup 2FA
        if (user.totp_secret) {
            // ต้องยืนยัน 2FA
            res.json({ 
                status: "2fa_required", 
                userId: user.user_id 
            });
        } else {
            // ถ้ายังไม่มี 2FA ให้แจ้งว่าต้องตั้งค่าก่อน
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
        // 1. ตรวจสอบ Email ซ้ำ
        const [existingUsers] = await pool.execute("SELECT user_id FROM users WHERE email = ?", [email]);
        if (existingUsers.length > 0) {
            return res.status(409).json({ message: "Email นี้ถูกใช้งานแล้ว" });
        }

        // 2. Hashing รหัสผ่าน
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        const newUserId = `U-${Date.now().toString().slice(-10)}`;

        // 3. บันทึกผู้ใช้ใหม่
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
 * Endpoint 3: สร้าง QR Code สำหรับผู้ใช้ครั้งแรก (Setup 2FA)
 */
app.post("/api/setup-2fa", async (req, res) => {
    const { userId } = req.body;

    try {
        // 1. สร้าง Secret
        const secret = speakeasy.generateSecret({
            name: `MEMS Project (${userId})`,
        });

        // 2. บันทึก Secret ลง DB
        await pool.execute(
            "UPDATE users SET totp_secret = ? WHERE user_id = ?",
            [secret.base32, userId]
        );
        
        // 3. สร้าง QR Code Data URL
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
 * Endpoint 4: ตรวจสอบรหัส 6 หลัก (Verify 2FA)
 */
app.post("/api/verify-2fa", async (req, res) => {
    const { userId, token } = req.body;

    try {
        // 1. ดึง Secret และ Role name
        const [users] = await pool.execute(
            "SELECT U.*, R.role_name FROM users U JOIN role R ON U.role_id = R.role_id WHERE U.user_id = ?", 
            [userId]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ message: "ไม่พบผู้ใช้งาน" });
        }
        
        const user = users[0];
        const { totp_secret, role_name } = user;

        // 2. ตรวจสอบรหัส 6 หลัก
        const verified = speakeasy.totp.verify({
            secret: totp_secret,
            encoding: 'base32',
            token: token,
            window: 1 // อนุญาตให้รหัสถูกหรือผิดไป 1 ช่วงเวลา (30 วินาที)
        });

        if (verified) {
            // 3. สร้าง JWT (Token ล็อกอิน)
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
        // ✅ SQL Query ใช้ Backticks แล้ว
        const sql = `
            SELECT
            et.equipment_type_id,
            et.equipment_name,
            COALESCE(SUM(l.current_quantity), 0) AS current_quantity,
            COALESCE(SUM(e.alert_quantity), 0) AS alert_quantity
            FROM equipment_type et
            LEFT JOIN equipment e
            ON e.equipment_type_id = et.equipment_type_id
            LEFT JOIN lot l
            ON l.equipment_id = e.equipment_id
            GROUP BY
            et.equipment_type_id,
            et.equipment_name;
        `;

        const [rows] = await pool.query(sql);
        res.json(rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err });
    }
});

// ================== ALERTS ==================

// 1. อะไหล่ที่ใกล้หมดอายุ (เช็คจาก Lot, < 100 วัน)
app.get("/api/alerts/expire", async (req, res) => {
    try {
        const sql = `
            SELECT 
                l.lot_id,
                l.expiry_date,
                l.current_quantity,
                et.equipment_name,
                e.equipment_id,
                et.img,
                s.supplier_name,
                DATEDIFF(l.expiry_date, CURDATE()) as days_remaining
            FROM lot l
            JOIN equipment e ON l.equipment_id = e.equipment_id
            LEFT JOIN supplier s ON l.supplier_id = s.supplier_id
            JOIN equipment_type et ON e.equipment_type_id = et.equipment_type_id
            WHERE l.expiry_date IS NOT NULL 
            AND DATEDIFF(l.expiry_date, CURDATE()) < 100
            AND l.current_quantity > 0
            ORDER BY days_remaining ASC
        `;
        const [rows] = await db.query(sql);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error fetching expire alerts" });
    }
});

// 2. อะไหล่ที่ใกล้หมดสต็อก (รวม Lot ตาม Equipment ID แล้วเทียบ Alert Quantity)
app.get("/api/alerts/low-stock", async (req, res) => {
    try {
        const sql = `
            SELECT e.equipment_id, et.equipment_name, et.img, e.alert_quantity, SUM(l.current_quantity) as total_quantity FROM equipment e LEFT JOIN lot l ON e.equipment_id = l.equipment_id JOIN equipment_type et ON e.equipment_type_id = et.equipment_type_id GROUP BY e.equipment_id HAVING total_quantity <= e.alert_quantity OR total_quantity IS NULL;
        `;
        // หมายเหตุ: OR total_quantity IS NULL เพื่อดักจับกรณีไม่มีของใน Lot เลย (รวมได้ 0 หรือ null)
        
        const [rows] = await db.query(sql);
        
        // แปลงค่า null ให้เป็น 0 เพื่อความสวยงาม
        const formattedRows = rows.map(row => ({
            ...row,
            total_quantity: row.total_quantity || 0
        }));

        res.json(formattedRows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error fetching low stock alerts" });
    }
});

// GET /api/machine
app.get('/api/machine', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM machine");
        res.json(rows);
    } catch (err) {
        console.log(err);
        res.status(500).send("Error retrieving machines");
    }
});

// POST /api/machine
app.post('/api/machine', async (req, res) => {
    try {
        const { machine_SN, machine_name } = req.body;
        console.log("BODY:", req.body);

        // ตรวจสอบซ้ำ
        const [existing] = await db.query("SELECT * FROM machine WHERE machine_SN = ?", [machine_SN]);
        if (existing.length > 0) {
            return res.status(400).send("รหัสครุภัณฑ์นี้มีอยู่แล้ว");
        }

        // เพิ่มเครื่อง
        await db.query(
            "INSERT INTO machine (machine_SN, machine_name) VALUES (?, ?)",
            [machine_SN, machine_name]
        );
        res.send("Machine added successfully");

    } catch (err) {
        console.log(err);
        res.status(500).send("Error adding machine");
    }
});

// PUT /api/machine/:sn
app.put('/api/machine/:sn', async (req, res) => {
    try {
        const sn = req.params.sn;
        const { machine_name } = req.body;

        await db.query("UPDATE machine SET machine_name = ? WHERE machine_SN = ?", [machine_name, sn]);
        res.send("Machine updated successfully");

    } catch (err) {
        console.log(err);
        res.status(500).send("Error updating machine");
    }
});

// DELETE /api/machine/:sn
app.delete('/api/machine/:sn', async (req, res) => {
    try {
        const sn = req.params.sn;
        await db.query("DELETE FROM machine WHERE machine_SN = ?", [sn]);
        res.send("Machine deleted successfully");

    } catch (err) {
        console.log(err);
        res.status(500).send("Error deleting machine");
    }
});

// ================== REPORT SUMMARY ==================
app.get("/api/report/summary", async (req, res) => {
    try {
        const nearExpireDays = 30;

        const sql = `
            SELECT
                SUM(l.current_quantity) AS total_quantity,

                SUM(
                    CASE 
                        WHEN l.expiry_date IS NOT NULL
                        AND l.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 100 DAY)
                        THEN l.current_quantity
                        ELSE 0
                    END
                ) AS near_expire_quantity,

                SUM(
                    CASE
                        WHEN l.current_quantity <= e.alert_quantity
                        THEN l.current_quantity
                        ELSE 0
                    END
                ) AS near_out_of_stock_quantity
            FROM lot l
            JOIN equipment e ON e.equipment_id = l.equipment_id
        `;

        const [[result]] = await db.query(sql, [nearExpireDays]);

        res.json({
            total: result.total_quantity || 0,
            nearExpire: result.near_expire_quantity || 0,
            nearOutOfStock: result.near_out_of_stock_quantity || 0
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to load report summary" });
    }
});

// ================== REPORT USAGE ==================
app.get("/api/report/usage", async (req, res) => {
    try {
        const sql = `
            SELECT
                tt.transaction_type_name,
                SUM(
                    CASE WHEN DATE(t.date) = CURDATE()
                    THEN el.quantity ELSE 0 END
                ) AS daily_total,

                SUM(
                    CASE WHEN MONTH(t.date) = MONTH(CURDATE())
                    AND YEAR(t.date) = YEAR(CURDATE())
                    THEN el.quantity ELSE 0 END
                ) AS monthly_total
            FROM transactions t
            JOIN transactions_type tt
                ON tt.transaction_type_id = t.transaction_type_id
            JOIN equipment_list el
                ON el.transaction_id = t.transaction_id
            WHERE tt.transaction_type_name IN ('เบิก', 'คืน')
            GROUP BY tt.transaction_type_name
        `;

        const [rows] = await db.query(sql);

        const result = {
            borrow: { daily: 0, monthly: 0 },
            return: { daily: 0, monthly: 0 }
        };

        rows.forEach(row => {
            if (row.transaction_type_name === "เบิก") {
                result.borrow.daily = row.daily_total;
                result.borrow.monthly = row.monthly_total;
            }
            if (row.transaction_type_name === "คืน") {
                result.return.daily = row.daily_total;
                result.return.monthly = row.monthly_total;
            }
        });

        res.json(result);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to load usage report" });
    }
});

// ================== REPORT transactions DETAIL ==================
app.get("/api/report/transactions-detail", async (req, res) => {
    try {
        const sql = `
            SELECT
                t.transaction_id,
                tt.transaction_type_name,
                t.date,
                t.time,
                SUM(el.quantity) AS total_quantity
            FROM transactions t
            JOIN transactions_type tt
                ON tt.transaction_type_id = t.transaction_type_id
            JOIN equipment_list el
                ON el.transaction_id = t.transaction_id
            GROUP BY t.transaction_id
            ORDER BY t.date DESC, t.time DESC
        `;

        const [rows] = await db.query(sql);
        res.json(rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to load transaction detail" });
    }
});

// ==========================================
// 🔔 ส่วนแจ้งเตือน (Alerts) - แก้ไขแล้ว
// ==========================================

// 1. แจ้งเตือนของหมดอายุ (Expire)
app.get("/api/alerts/expire", async (req, res) => {
    const sql = `
        SELECT l.lot_id, l.equipment_id, et.equipment_name, l.expiry_date, l.current_quantity 
        FROM lot l 
        JOIN equipment e ON l.equipment_id = e.equipment_id 
        JOIN equipment_type et ON e.equipment_type_id = et.equipment_type_id 
        WHERE l.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) 
        ORDER BY l.expiry_date ASC
    `;
    try {
        const [results] = await db.query(sql);
        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).send(err);
    }
});

// 2. แจ้งเตือนของใกล้หมด (Low Stock)
app.get("/api/alerts/low-stock", async (req, res) => {
    const sql = `
        SELECT e.equipment_id, et.equipment_name, e.alert_quantity, COALESCE(SUM(l.current_quantity), 0) as total_stock 
        FROM equipment e 
        LEFT JOIN lot l ON e.equipment_id = l.equipment_id 
        JOIN equipment_type et ON e.equipment_type_id = et.equipment_type_id 
        GROUP BY e.equipment_id 
        HAVING total_stock <= e.alert_quantity
    `;
    try {
        const [results] = await db.query(sql);
        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).send(err);
    }
});

// =======================================================
// 📦 MANAGEMENT: INVENTORY (LOT + EQUIPMENT + TYPE + SUPPLIER)
// =======================================================

// 1. เปิดให้เข้าถึงรูปภาพในโฟลเดอร์ uploads ได้ผ่าน URL
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ... (code config อื่นๆ) ...

// 2. ตั้งค่า Multer สำหรับ Save ไฟล์
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // เก็บลง folder uploads
    },
    filename: (req, file, cb) => {
        // ตั้งชื่อไฟล์ใหม่ป้องกันชื่อซ้ำ: equip-เวลาปัจจุบัน.นามสกุลไฟล์
        cb(null, 'equip-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// 3. API สำหรับอัปโหลดรูป (แยกออกมาต่างหากเพื่อความง่าย)
app.post("/api/upload", upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
    }
    // สร้าง URL เพื่อส่งกลับไปให้ Frontend มาแก้ตรงนี้ด้วยจ้าาา เสียวรูปไม่ขึ้น
    res.json({ filename: req.file.filename });
});

// 1. ดึงข้อมูลทั้งหมด 4 ตารางมาแสดง (READ)
app.get("/api/inventory", async (req, res) => {
    try {
        const sql = `
            SELECT 
                l.lot_id, l.import_date, l.expiry_date, l.current_quantity, l.price,
                s.supplier_id, s.supplier_name, s.contact,
                e.equipment_id, e.model_size, e.alert_quantity,
                et.equipment_type_id, et.equipment_name, et.img, et.unit
            FROM lot l
            JOIN supplier s ON l.supplier_id = s.supplier_id
            JOIN equipment e ON l.equipment_id = e.equipment_id
            JOIN equipment_type et ON e.equipment_type_id = et.equipment_type_id
            ORDER BY l.lot_id DESC
        `;
        const [results] = await db.query(sql);
        res.json(results);
    } catch (err) {
        console.error("Error fetching inventory:", err);
        res.status(500).send(err);
    }
});

// 2. ดึง Master Data สำหรับ Dropdown (แบบย่อ)
app.get("/api/master-data", async (req, res) => {
    try {
        const [suppliers] = await db.query("SELECT * FROM supplier");
        const [equipmentTypes] = await db.query("SELECT * FROM equipment_type");
        const [equipments] = await db.query("SELECT * FROM equipment");
        res.json({ suppliers, equipmentTypes, equipments });
    } catch (err) {
        res.status(500).send(err);
    }
});

// 3. เพิ่มข้อมูลใหม่ (CREATE - Transaction)
app.post("/api/inventory/add", async (req, res) => {
    const conn = await db.getConnection(); // ขอ Connection พิเศษสำหรับ Transaction
    try {
        await conn.beginTransaction(); // เริ่ม Transaction

        const { 
            // Flags เพื่อบอกว่าส่วนไหนสร้างใหม่ (True/False)
            isNewSupplier, isNewType, isNewEquipment,
            // Data Objects
            lotData, supplierData, typeData, equipmentData 
        } = req.body;

        let finalSupplierId = supplierData.supplier_id;
        let finalTypeId = typeData.equipment_type_id;
        let finalEquipmentId = equipmentData.equipment_id;

        // --- STEP 1: Handle Supplier ---
        if (isNewSupplier) {
            // เช็คก่อนว่า ID ซ้ำไหม
            const [dupSup] = await conn.query("SELECT supplier_id FROM supplier WHERE supplier_id = ?", [supplierData.supplier_id]);
            if (dupSup.length > 0) throw new Error(`Supplier ID ${supplierData.supplier_id} มีอยู่แล้ว`);

            await conn.query(
                "INSERT INTO supplier (supplier_id, supplier_name, contact) VALUES (?, ?, ?)",
                [supplierData.supplier_id, supplierData.supplier_name, supplierData.contact]
            );
        }

        // --- STEP 2: Handle Equipment Type ---
        if (isNewType) {
            const [dupType] = await conn.query("SELECT equipment_type_id FROM equipment_type WHERE equipment_type_id = ?", [typeData.equipment_type_id]);
            if (dupType.length > 0) throw new Error(`Type ID ${typeData.equipment_type_id} มีอยู่แล้ว`);

            await conn.query(
                "INSERT INTO equipment_type (equipment_type_id, equipment_name, img, unit) VALUES (?, ?, ?, ?)",
                [typeData.equipment_type_id, typeData.equipment_name, typeData.img, typeData.unit]
            );
        }

        // --- STEP 3: Handle Equipment ---
        if (isNewEquipment) {
            const [dupEq] = await conn.query("SELECT equipment_id FROM equipment WHERE equipment_id = ?", [equipmentData.equipment_id]);
            if (dupEq.length > 0) throw new Error(`Equipment ID ${equipmentData.equipment_id} มีอยู่แล้ว`);

            await conn.query(
                "INSERT INTO equipment (equipment_id, alert_quantity, model_size, equipment_type_id) VALUES (?, ?, ?, ?)",
                [equipmentData.equipment_id, equipmentData.alert_quantity, equipmentData.model_size, finalTypeId]
            );
        }

        // --- STEP 4: Generate LOT ID (lot-00001) ---
        const [lastLot] = await conn.query("SELECT lot_id FROM lot ORDER BY lot_id DESC LIMIT 1");
        let newLotId = "lot-00001";
        if (lastLot.length > 0) {
            const lastId = lastLot[0].lot_id; // e.g., lot-00005
            const numPart = parseInt(lastId.split('-')[1]); // 5
            newLotId = `lot-${String(numPart + 1).padStart(5, '0')}`; // lot-00006
        }

        // --- STEP 5: Insert LOT ---
        await conn.query(
            "INSERT INTO lot (lot_id, equipment_id, supplier_id, import_date, expiry_date, current_quantity, price) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [newLotId, finalEquipmentId, finalSupplierId, lotData.import_date, lotData.expire_date, lotData.current_quantity, lotData.price]
        );

        await conn.commit(); // บันทึกทุกอย่าง
        res.json({ message: "Success", lot_id: newLotId });

    } catch (err) {
        await conn.rollback(); // ยกเลิกทั้งหมดถ้ามีอะไรพลาด
        console.error("Transaction Error:", err);
        res.status(500).json({ message: err.message });
    } finally {
        conn.release(); // คืน Connection
    }
});

// 4. แก้ไขข้อมูล (UPDATE - แก้ไขทุกตารางตาม Form)
app.put("/api/inventory/update/:lot_id", async (req, res) => {
    const lot_id = req.params.lot_id;
    const conn = await db.getConnection();
    
    try {
        await conn.beginTransaction();

        const { lotData, supplierData, typeData, equipmentData } = req.body;

        // Update Supplier
        await conn.query(
            "UPDATE supplier SET supplier_name=?, contact=? WHERE supplier_id=?",
            [supplierData.supplier_name, supplierData.contact, supplierData.supplier_id]
        );

        // Update Type
        await conn.query(
            "UPDATE equipment_type SET equipment_name=?, img=?, unit=? WHERE equipment_type_id=?",
            [typeData.equipment_name, typeData.img, typeData.unit, typeData.equipment_type_id]
        );

        // Update Equipment
        await conn.query(
            "UPDATE equipment SET alert_quantity=?, model_size=? WHERE equipment_id=?",
            [equipmentData.alert_quantity, equipmentData.model_size, equipmentData.equipment_id]
        );

        // Update Lot
        await conn.query(
            "UPDATE lot SET import_date=?, expiry_date=?, current_quantity=?, price=? WHERE lot_id=?",
            [lotData.import_date, lotData.expire_date, lotData.current_quantity, lotData.price, lot_id]
        );

        await conn.commit();
        res.json({ message: "Updated successfully" });

    } catch (err) {
        await conn.rollback();
        res.status(500).json({ message: err.message });
    } finally {
        conn.release();
    }
});

// 5. ลบข้อมูล (DELETE - ลบแค่ Lot)
app.delete("/api/inventory/:id", async (req, res) => {
    try {
        await db.query("DELETE FROM lot WHERE lot_id = ?", [req.params.id]);
        res.json({ message: "Lot deleted successfully" });
    } catch (err) {
        res.status(500).send(err);
    }
});

// ==========================================
// 📦 ส่วนจัดการ Supplier (บริษัทคู่ค้า)
// ==========================================

// 1. ดึงข้อมูล Supplier ทั้งหมด
app.get("/api/supplier", async (req, res) => {
    try {
        const [results] = await db.query("SELECT * FROM supplier ORDER BY supplier_id ASC");
        res.json(results);
    } catch (err) {
        console.log(err);
        res.status(500).send("Error retrieving machines");
    }
});

// 2. เพิ่ม Supplier ใหม่
app.post("/api/supplier", async (req, res) => {
    const { supplier_id, supplier_name, contact } = req.body;
    
    // ตรวจสอบค่าว่าง
    if (!supplier_id || !supplier_name) {
        return res.status(400).json({ message: "Please provide Supplier ID and Name" });
    }

    try {
        // เช็คก่อนว่า ID ซ้ำไหม
        const [existing] = await db.query("SELECT supplier_id FROM supplier WHERE supplier_id = ?", [supplier_id]);
        if (existing.length > 0) {
            return res.status(400).json({ message: "Supplier ID นี้มีอยู่ในระบบแล้ว" });
        }

        const sql = "INSERT INTO supplier (supplier_id, supplier_name, contact) VALUES (?, ?, ?)";
        await db.query(sql, [supplier_id, supplier_name, contact]);
        res.json({ message: "Supplier added successfully", id: supplier_id });
    } catch (err) {
        console.log(err);
        res.status(500).send("Error adding machine");
    }
});

// 3. แก้ไขข้อมูล Supplier
app.put("/api/supplier/:id", async (req, res) => {
    const { id } = req.params;
    const { supplier_name, contact } = req.body;

    try {
        const sql = "UPDATE supplier SET supplier_name = ?, contact = ? WHERE supplier_id = ?";
        await db.query(sql, [supplier_name, contact, id]);
        res.json({ message: "Supplier updated successfully" });
    } catch (err) {
        console.log(err);
        res.status(500).send("Error updating machine");
    }
});

// 4. ลบ Supplier
app.delete("/api/supplier/:id", async (req, res) => {
    const { id } = req.params;
    try {
        await db.query("DELETE FROM supplier WHERE supplier_id = ?", [id]);
        res.json({ message: "Supplier deleted successfully" });
    } catch (err) {
        // กรณีลบไม่ได้เพราะถูกใช้งานอยู่ในตาราง Lot
        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
             return res.status(400).json({ message: "ไม่สามารถลบได้ เนื่องจาก Supplier นี้มีประวัติการส่งสินค้า (Lot)" });
        }
        console.log(err);
        res.status(500).send("Error deleting machine");
    }
});

// ==========================================
// 📜 ส่วนจัดการ Transaction (เบิก-จ่าย)
// ==========================================

// 1. ดึงประวัติ Transaction ทั้งหมด (พร้อมชื่อคน, ชื่อเครื่อง, ประเภท)
app.get("/api/transactions", async (req, res) => {
    const sql = `
        SELECT t.transaction_id, t.date, tt.transaction_type_name, u.fullname, m.machine_name, (SELECT COUNT(*) FROM equipment_list el WHERE el.transaction_id = t.transaction_id) as item_count FROM transactions t LEFT JOIN transactions_type tt ON t.transaction_type_id = tt.transaction_type_id LEFT JOIN users u ON t.user_id = u.user_id LEFT JOIN machine m ON t.machine_SN = m.machine_SN ORDER BY t.date DESC, t.transaction_id DESC;
    `;
    try {
        const [results] = await db.query(sql);
        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).send(err);
    }
});

// 2. ดึงรายละเอียดของ Transaction นั้นๆ (รายการของที่เบิก)
app.get("/api/transactions/:id/items", async (req, res) => {
    const sql = `
        SELECT el.*, et.equipment_name, e.model_size FROM equipment_list el JOIN equipment e ON el.equipment_id = e.equipment_id JOIN equipment_type et ON et.equipment_type_id = e.equipment_type_id
        WHERE el.transaction_id = ?
    `;
    try {
        const [results] = await db.query(sql, [req.params.id]);
        res.json(results);
    } catch (err) {
        res.status(500).send(err);
    }
});

// 3. ดึง Master Data สำหรับฟอร์ม Transaction (Users, Machines, Types, Equipments)
app.get("/api/transaction-options", async (req, res) => {
    try {
        const [users] = await db.query("SELECT user_id, fullname FROM users");
        const [machines] = await db.query("SELECT machine_SN, machine_name FROM machine");
        const [types] = await db.query("SELECT transaction_type_id, transaction_type_name FROM transactions_type"); // ต้องมีตารางนี้
        const [equipments] = await db.query("SELECT equipment_id, model_size FROM equipment");
        
        res.json({ users, machines, types, equipments });
    } catch (err) {
        console.error(err);
        res.status(500).send(err);
    }
});

// 4. สร้าง Transaction ใหม่ (ใช้ SQL Transaction เพื่อความปลอดภัย)
app.post("/api/transactions", async (req, res) => {
    const { transaction_type_id, user_id, machine_SN, notes, items } = req.body;
    // items คาดหวังรูปแบบ: [{ equipment_id: 1, quantity: 5 }, ...]

    if (!items || items.length === 0) {
        return res.status(400).json({ message: "กรุณาระบุรายการอุปกรณ์อย่างน้อย 1 รายการ" });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction(); // เริ่มต้นกระบวนการ

        // 4.1 สร้าง Header ของ Transaction
        // สร้าง ID อัตโนมัติแบบง่าย (หรือจะใช้ Auto Increment ก็ได้)
        const transaction_id = 'TX-' + Date.now(); 
        const date = new Date();

        await connection.query(
            "INSERT INTO transactions (transaction_id, transaction_date, transaction_type_id, user_id, machine_SN, notes) VALUES (?, ?, ?, ?, ?, ?)",
            [transaction_id, date, transaction_type_id, user_id, machine_SN || null, notes]
        );

        // 4.2 วนลูปบันทึกรายการสินค้า (Equipment List)
        for (const item of items) {
            await connection.query(
                "INSERT INTO equipment_list (transaction_id, equipment_id, quantity) VALUES (?, ?, ?)",
                [transaction_id, item.equipment_id, item.quantity]
            );
            
            // --- ตรงนี้คือจุดตัดสต็อก (Inventory Logic) ---
            // หมายเหตุ: การตัดสต็อกจริงต้องดูว่า เป็นการ 'รับเข้า' หรือ 'เบิกออก'
            // และต้องจัดการเรื่อง Lot (FIFO/LIFO) ซึ่งซับซ้อน
            // ในที่นี้ผมจะบันทึก Transaction ไว้ก่อน ส่วน Logic ตัดสต็อกขอละไว้ตาม Scope หน้าบ้านครับ
        }

        await connection.commit(); // ยืนยันข้อมูลทั้งหมด
        res.json({ message: "บันทึกรายการสำเร็จ", transaction_id });

    } catch (err) {
        await connection.rollback(); // ถ้าพัง ให้ยกเลิกทั้งหมด
        console.error("Transaction Error:", err);
        res.status(500).send(err);
    } finally {
        connection.release();
    }
});

// ==========================================
// 👤 ส่วนจัดการ Users & Roles
// ==========================================

// 1. ดึงข้อมูล Roles ทั้งหมด (สำหรับ Dropdown)
app.get("/api/roles", async (req, res) => {
    try {
        const [results] = await db.query("SELECT * FROM role");
        res.json(results);
    } catch (err) {
        res.status(500).send(err);
    }
});

// 2. ดึงข้อมูล Users ทั้งหมด (ไม่ส่ง Password กลับไปเพื่อความปลอดภัย)
app.get("/api/users", async (req, res) => {
    const sql = `
        SELECT u.user_id, u.fullname,u.phone_number, u.email, u.role_id, r.role_name 
        FROM users u 
        LEFT JOIN role r ON u.role_id = r.role_id
    `;
    try {
        const [results] = await db.query(sql);
        res.json(results);
    } catch (err) {
        res.status(500).send(err);
    }
});

// 3. สร้าง User ใหม่ (Hash Password ก่อนบันทึก)
app.post("/api/users", async (req, res) => {
    const { fullname, password_hash,position, phone_number, email, role_id } = req.body;
    
    try {
        // 3.1 เช็คก่อนว่า username ซ้ำไหม
        const [existing] = await db.query("SELECT user_id FROM users WHERE email = ?", [email]);
        if (existing.length > 0) {
            return res.status(400).json({ message: "มีผู้ใช้งานแล้ว" });
        }

        // 3.2 เข้ารหัสรหัสผ่าน
        const hashedPassword = await bcrypt.hash(password_hash, 10);

        // 3.3 สร้าง user_id (หรือจะใช้ Auto Increment ก็ได้ แล้วแต่ DB)
        // สมมติถ้า DB เป็น Auto Increment ไม่ต้องใส่ user_id ใน INSERT
        // แต่ถ้าต้องเจนเอง:
        const user_id = 'U-' + Date.now(); 

        const sql = `INSERT INTO users (user_id, email, password_hash, fullname, position, phone_number, role_id) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        await db.query(sql, [ user_id, email,hashedPassword, fullname, position, phone_number, role_id]);

        res.json({ message: "สร้างผู้ใช้งานสำเร็จ" });
    } catch (err) {
        console.error(err);
        res.status(500).send(err);
    }
});

// 4. แก้ไข User (ถ้ากรอก password มาใหม่ให้เปลี่ยนด้วย ถ้าไม่กรอกให้ใช้ของเดิม)
app.put("/api/users/:id", async (req, res) => {
    const { fullname, position , phone_number, role_id } = req.body;
    const user_id = req.params.id;

    try {
        let sql = "UPDATE users SET fullname=?, position=?, phone_number=?, role_id=? WHERE user_id=?";
        let params = [fullname, position , phone_number, role_id];

        // ถ้ามีการส่ง password มาใหม่ ให้ Hash แล้วอัปเดตด้วย
        if (password && password.trim() !== "") {
            const hashedPassword = await bcrypt.hash(password_hash, 10);
            sql = "UPDATE users SET fullname=?, position=?, phone_number=?, role_id=? WHERE user_id=?";
            params = [fullname, position , phone_number, role_id, hashedPassword, user_id];
        }

        await db.query(sql, params);
        res.json({ message: "แก้ไขข้อมูลสำเร็จ" });
    } catch (err) {
        console.error(err);
        res.status(500).send(err);
    }
});

// 5. ลบ User
app.delete("/api/users/:id", async (req, res) => {
    try {
        await db.query("DELETE FROM users WHERE user_id = ?", [req.params.id]);
        res.json({ message: "ลบผู้ใช้งานสำเร็จ" });
    } catch (err) {
        // ระวังเรื่อง Foreign Key constraint ถ้า user เคยทำ transaction อาจจะลบไม่ได้
        res.status(500).send({ message: "ไม่สามารถลบได้ เนื่องจากผู้ใช้นี้มีประวัติการใช้งานในระบบ" });
    }
});


// -----------------------------------------------------------------------------------

// ==========================================
// 1. API สำหรับดึงข้อมูลอะไหล่ (ใช้ตอนสแกนบาร์โค้ด)
// ==========================================
app.post('/api/withdraw/partInfo', async (req, res) => {
    const { partId } = req.body; 
    try {
        const sql = `
            SELECT
                e.equipment_id AS partId,
                et.Equipment_name AS partName,
                et.unit,
                e.\`model/size\` AS model,
                et.img AS imageUrl,
                COALESCE((SELECT SUM(current_quantity) FROM lot WHERE equipment_id = e.equipment_id), 0) AS currentStock
            FROM equipment e
            JOIN equipment_type et ON e.equipment_type_id = et.equipment_type_id
            WHERE e.equipment_id = ?
        `;
        const [rows] = await pool.query(sql, [partId]);

        if (rows.length > 0) {
            // ปรับแต่ง imageUrl ถ้าใน DB เป็นคำว่า 'NULL'
            if (rows[0].imageUrl === 'NULL' || !rows[0].imageUrl) {
                rows[0].imageUrl = 'https://via.placeholder.com/100x100?text=No+Image';
            }
            res.json(rows[0]);
        } else {
            res.status(404).json({ error: 'ไม่พบข้อมูลอะไหล่รหัสนี้ในระบบ' });
        }
    } catch (error) {
        console.error("Fetch Part Error:", error);
        res.status(500).json({ error: 'Database error' });
    }
});

// ==========================================
// 2. API สำหรับยืนยันการเบิก (Withdraw) และตัดสต็อกแบบ FIFO
// ==========================================
app.post('/api/withdraw/confirm', authenticateToken, async (req, res) => {
    const { machine_SN, cartItems } = req.body;
    const userId = req.user.userId;
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const transactionId = 'WTH-' + Date.now();

        // 1. บันทึกลงตาราง transactions
        await connection.query(
            "INSERT INTO transactions (transaction_id, transaction_type_id, date, time, user_id, machine_SN) VALUES (?, 'T-WTH', CURDATE(), CURTIME(), ?, ?)",
            [transactionId, userId, machine_SN]
        );

        for (const item of cartItems) {
            let requiredQty = item.quantity;
            
            // 2. ดึง Lot ที่มีของ โดยเรียงตามวันที่นำเข้า (FIFO)
            const [lots] = await connection.query(
                "SELECT lot_id, current_quantity FROM lot WHERE equipment_id = ? AND current_quantity > 0 ORDER BY import_date ASC",
                [item.partId]
            );

            for (const lot of lots) {
                if (requiredQty <= 0) break;

                // คำนวณจำนวนที่จะหักจาก Lot นี้ (แก้ไขจุดที่เคยผิดพลาด)
                let deductAmount = Math.min(lot.current_quantity, requiredQty);
                
                // หักสต็อกใน Lot
                await connection.query(
                    "UPDATE lot SET current_quantity = current_quantity - ? WHERE lot_id = ?",
                    [deductAmount, lot.lot_id]
                );

                // บันทึกรายการลง equipment_list
                const listId = 'EL-' + Math.random().toString(36).substr(2, 9);
                await connection.query(
                    "INSERT INTO equipment_list (equipment_list_id, transaction_id, equipment_id, quantity) VALUES (?, ?, ?, ?)",
                    [listId, transactionId, item.partId, deductAmount]
                );

                requiredQty -= deductAmount;
            }

            if (requiredQty > 0) {
                throw new Error(`สต็อกอะไหล่ ${item.partId} ไม่เพียงพอสำหรับการเบิก`);
            }
        }

        await connection.commit();
        res.json({ success: true, transactionId });

    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// 4. สั่งให้ Server รัน
// ✅ ใช้ server.listen เพื่อรันทั้ง Express และ Socket.IO
server.listen(PORT, () => {
    console.log(`🚀 Backend server is running on http://localhost:${PORT}`);
    console.log(`   (Ready to command ESP at ${ESP_IP})`);
});