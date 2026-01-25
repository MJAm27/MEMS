const express = require('express');
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const cors = require('cors');
const axios = require('axios'); // สำหรับเชื่อมต่อ ESP8266

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

// Simple REST endpoint to get current low-stock items
app.get('/api/lowStockAlert', async (req, res) => {
  try {
    // ✅ SQL Query ใช้ Backticks แล้ว
    const [rows] = await pool.query(
      `SELECT id, sku, name, quantity, limit_quantity FROM products WHERE quantity < limit_quantity ORDER BY quantity ASC`);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

// When a client connects, send the current low-stock count
io.on('connection', socket => {
  console.log('client connected', socket.id);

  const sendLowStock = async () => {
    try {
      // ✅ SQL Query ใช้ Backticks แล้ว
      const [rows] = await pool.query(
        `SELECT id, sku, name, quantity, limit_quantity FROM products WHERE quantity < limit_quantity`);
      socket.emit('low_stock', { count: rows.length, items: rows });
    } catch (err) {
      console.error('sendLowStock err', err);
    }
  };

  // send immediately on connection
  sendLowStock();

  // set interval to check every 15 seconds (adjust as needed)
  const interval = setInterval(sendLowStock, 15000);

  socket.on('disconnect', () => {
    clearInterval(interval);
    console.log('client disconnected', socket.id);
  });
});

function generateTransactionId(prefix = 'TX') {
    return `${prefix}-${Date.now().toString().slice(-10)}`;
}
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