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
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
};
const pool = mysql.createPool(dbConfig);
const db = pool; 
// ------------------------------


pool.query("SELECT 1")
    .then(() => console.log("✅ Database connected successfully!"))
    .catch(err => console.error("❌ Database connection failed:", err.message));


const JWT_SECRET = "MY_SUPER_SECRET_KEY_FOR_JWT_12345";

// +++++++++++++++++++++++ ค่าคงที่สำหรับ ESP8266 +++++++++++++++++++++++
//step1 setup MQTT Broker ใน server kob 
//step2 แก้ไข ESP8266 ให้เชื่อมต่อกับ MQTT Broker ของ Server แทนการรับคำสั่งผ่าน HTTP โดยตรง
//step3 ใน server.js ให้ใช้ MQTT Client (เช่น mqtt.js) เพื่อส่งคำสั่งไปยัง ESP8266 ผ่าน MQTT แทนการใช้ HTTP
//const ESP_IP = 'http://192.168.1.139'; 
const HARDCODED_USER_ID = 123464; // (ชั่วคราว)
const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://kob.vps.athichal.com:62279'); 
const SECRET_PASSKEY = "MEMS_AMKOB";
client.on('connect', () => {
    console.log('✅ Connected to MQTT Broker on VPS successfully!');
});

client.on('error', (err) => {
    console.error('❌ MQTT Connection Error:', err);
});
// -------------------------------------------------------------------


// +++++++++++++++++++++++ Middleware ตรวจสอบ Token +++++++++++++++++++++++
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401); 

    jwt.verify(token, JWT_SECRET, (err, userPayload) => {
        if (err) return res.sendStatus(403); 
        req.user = userPayload; // payload ประกอบด้วย userId
        next(); 
    });
}
// ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++


// --- Helper Functions สำหรับ ESP และ Log ---

/**
 * ฟังก์ชัน Helper สำหรับบันทึก Log ลง Database
 */
async function logActionToDB(userId, actionTypeId, transactionId = null) {
    const logId = `LOG-${Date.now().toString().slice(-10)}`; 
    const sql = `
        INSERT INTO accesslogs (log_id, user_id, action_type_id, transaction_id, date, time) 
        VALUES (?, ?, ?, ?, CURDATE(), CURTIME())
    `;
    try {   
        await db.query(sql, [logId, userId, actionTypeId, transactionId]);
        console.log(`[Log] บันทึกสำเร็จ: Action ${actionTypeId}, Tx: ${transactionId}`);
    } catch (dbError) {
        console.error('[Log Error]:', dbError.message);
    }
}

/**
 * ฟังก์ชัน MQTT Helper สำหรับส่งคำสั่งไปยัง ESP8266 (OPEN/CLOSE) ผ่าน MQTT Broker
 */
async function commandServo(action) { 
    const topic = "esp8266/test"; 
    const message = `${action.toUpperCase()}:${SECRET_PASSKEY}`; 
    try {
        client.publish(topic, message);
        console.log(`[MQTT] Verified command '${action}' sent`);
        return `Command sent`;
    } catch (error) {
        throw new Error('MQTT Publish failed');
    }
}


// --- API Endpoints สำหรับ ESP8266 ---

// --- API สำหรับสั่งเปิดประตูตู้ ---
app.get('/api/open', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const transactionId = req.query.transactionId || null;
    try {
        await commandServo('OPEN'); 
        
        await logActionToDB(userId, 'A-001', transactionId);
        res.status(200).send({ message: 'เปิดตู้สำเร็จ (MQTT)' });
    } catch (error) {
        res.status(500).send({ error: 'ไม่สามารถส่งคำสั่ง MQTT ได้' });
    }
});

// --- API สำหรับสั่งปิดประตูตู้ ---
app.post('/api/close-box', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { transactionId } = req.body;
    try {
        // เปลี่ยนจาก axios.get เป็นการเรียกใช้ helper MQTT
        await commandServo('CLOSE'); 
        
        await logActionToDB(userId, 'A-002', transactionId || null);
        res.status(200).send({ message: 'ปิดตู้สำเร็จ (MQTT)' });
    } catch (error) {
        res.status(500).send({ error: 'ไม่สามารถส่งคำสั่ง MQTT ได้' });
    }
});

// --- API Endpoints สำหรับ Withdrawal (เชื่อมต่อ DB) ---

// รวบรวมข้อมูลอะไหล่พร้อมรายละเอียดล็อตล่าสุดและจำนวนรวม
app.get('/api/manager/equipment-details', authenticateToken, async (req, res) => {
    try {
        const sql = `
            SELECT 
                et.equipment_type_id,
                et.equipment_name,
                et.unit,
                e.equipment_id,
                e.alert_quantity,
                -- นับจำนวนล็อตที่มีรายการนี้อยู่จริง
                COUNT(l.lot_id) AS total_lots,
                -- รวมจำนวนคงเหลือจากทุกล็อต
                COALESCE(SUM(l.current_quantity), 0) AS total_stock,
                -- หาราคาสูงสุดและต่ำสุดในคลัง
                MIN(l.price) AS min_price,
                MAX(l.price) AS max_price
            FROM equipment_type et
            JOIN equipment e ON et.equipment_type_id = e.equipment_type_id
            LEFT JOIN lot l ON e.equipment_id = l.equipment_id
            GROUP BY et.equipment_type_id, e.equipment_id
            ORDER BY et.equipment_type_id ASC
        `;
        const [rows] = await pool.query(sql);
        res.json(rows);
    } catch (error) {
        console.error("SQL Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// 1. API: Fetch Part Info (POST /api/withdraw/partInfo)
app.post('/api/withdraw/partInfo', async (req, res) => { 
    const { partId } = req.body; 

    if (!partId) {
        return res.status(400).json({ error: 'กรุณาระบุรหัสอะไหล่' });  
    }

    try {
        const sql = `
            SELECT 
                l.lot_id, 
                e.equipment_id, 
                et.equipment_name, 
                e.model_size, 
                et.unit, 
                et.img, 
                l.current_quantity
            FROM lot l
            JOIN equipment e ON l.equipment_id = e.equipment_id
            JOIN equipment_type et ON e.equipment_type_id = et.equipment_type_id
            WHERE l.lot_id = ? OR e.equipment_id = ?
            LIMIT 1
        `;
        
        const [rows] = await pool.query(sql, [partId, partId]);

        if (rows.length > 0) {
            const data = rows[0];
            // ส่ง Response กลับโดยเน้นให้ imageUrl เป็นเพียงชื่อไฟล์
            return res.json({
                partId: data.equipment_id,
                lotId: data.lot_id,
                partName: data.equipment_name,
                currentStock: data.current_quantity,
                unit: data.unit,
               
                imageUrl: data.img || null 
            });
        } else {
            return res.status(404).json({ error: 'ไม่พบข้อมูลอะไหล่' });
        }
    } catch (error) {
        console.error("Database error:", error);
        return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
    }
});


// 2. API: Confirm and Cut Stock (POST /api/withdraw/confirm)
app.post('/api/withdraw/confirm', authenticateToken, async (req, res) => {
    const { machine_SN, cartItems } = req.body;
    const userId = req.user.userId;
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const transactionId = `WTH-${Date.now()}`;

        // 1. บันทึกรายการหลักก่อนเสมอ เพื่อให้มี ID อ้างอิง (แก้ Error 500)
        await connection.query(
            "INSERT INTO transactions (transaction_id, transaction_type_id, date, time, user_id, machine_SN, is_pending) VALUES (?, 'T-WTH', CURDATE(), CURTIME(), ?, ?, 0)",
            [transactionId, userId, machine_SN]
        );

        // 2. ผูก ID กับเวลาเปิดจริง (UPDATE จาก Log ที่บันทึกไว้ตอนกดปุ่มเปิดประตูใน Step 1)
        await connection.query(
            `UPDATE accesslogs SET transaction_id = ? 
             WHERE user_id = ? AND transaction_id IS NULL AND action_type_id = 'A-001' 
             ORDER BY date DESC, time DESC LIMIT 1`,
            [transactionId, userId]
        );

        // 3. ตัดสต็อกและบันทึกรายละเอียดอะไหล่
        for (const item of cartItems) {
            await connection.query(
                "UPDATE lot SET current_quantity = current_quantity - ? WHERE lot_id = ? AND current_quantity >= ?",
                [item.quantity, item.lotId, item.quantity]
            );

            const listId = `ER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            await connection.query(
                "INSERT INTO equipment_list (equipment_list_id, transaction_id, quantity, lot_id) VALUES (?, ?, ?, ?)",
                [listId, transactionId, item.quantity, item.lotId]
            );
        }

        // 4. บันทึกเวลาปิดตู้ใหม่ (จะทำให้เวลาปิดต่างจากเวลาเปิดจริง)
        const closeLogId = `CL-${Date.now()}`; // ** อย่าลืมรัน SQL ขยายคอลัมน์ log_id เป็น 50 **
        await connection.query(
            "INSERT INTO accesslogs (log_id, time, date, action_type_id, transaction_id, user_id) VALUES (?, CURTIME(), CURDATE(), 'A-002', ?, ?)",
            [closeLogId, transactionId, userId]
        );

        await connection.commit();
        res.json({ success: true, message: "เบิกอะไหล่และบันทึกเวลาสำเร็จ" });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("❌ Confirm Error:", error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// API สำหรับยืนยันการคืน (Return Part) และเพิ่มสต็อก
app.post('/api/return-part', authenticateToken, async (req, res) => {
    const { returnDate, items } = req.body;
    const userId = req.user.userId;
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. สร้าง Transaction ID ใหม่สำหรับการคืนครั้งนี้ (RTN-xxxx)
        const transactionId = `RTN-${Date.now()}`;
        const parentId = items.find(i => i.borrowId)?.borrowId || null;

        // 2. บันทึกรายการคืนหลักลงตาราง transactions
        // ตั้งค่า is_pending = 0 เนื่องจากเป็นการคืนคลังโดยตรง
        await connection.query(
            "INSERT INTO transactions (transaction_id, parent_transaction_id, transaction_type_id, date, time, user_id, is_pending) VALUES (?, ?, 'T-RTN', ?, CURTIME(), ?, 0)",
            [transactionId, parentId, returnDate, userId]
        );

        // 3. ผูก Log เวลาเปิดตู้ (Action A-001) ล่าสุดเข้ากับ Transaction นี้
        await connection.query(
            `UPDATE accesslogs SET transaction_id = ? 
             WHERE user_id = ? AND transaction_id IS NULL AND action_type_id = 'A-001' 
             ORDER BY date DESC, time DESC LIMIT 1`,
            [transactionId, userId]
        );

        // 4. วนลูปจัดการสต็อกและการหักลดยอดตามรอบการเบิก (Borrow ID)
        for (const item of items) {
            // A. เพิ่มสต็อกกลับเข้าคลังกลาง (ตาราง lot)
            await connection.query(
                "UPDATE lot SET current_quantity = current_quantity + ? WHERE lot_id = ?", 
                [item.quantity, item.lotId]
            );

            // B. ตรวจสอบว่าเป็นการคืนจาก "รอบการเบิกล่วงหน้า" หรือไม่
            if (item.borrowId) {
                // หักลดยอดในมือออกจากรายการเบิกต้นทาง (transaction_id เดิม)
                await connection.query(
                    "UPDATE equipment_list SET quantity = quantity - ? WHERE transaction_id = ? AND lot_id = ?",
                    [item.quantity, item.borrowId, item.lotId]
                );

                // ตรวจสอบยอดคงเหลือในรายการนั้นหลังการหักลบ
                const [checkRows] = await connection.query(
                    "SELECT quantity FROM equipment_list WHERE transaction_id = ? AND lot_id = ?",
                    [item.borrowId, item.lotId]
                );

                // หากยอดเหลือ 0 ให้ลบรายการนั้นออกจากรายการค้างจ่าย
                if (!checkRows[0] || checkRows[0].quantity <= 0) {
                    await connection.query(
                        "DELETE FROM equipment_list WHERE transaction_id = ? AND lot_id = ?", 
                        [item.borrowId, item.lotId]
                    );
                    
                    // ตรวจสอบความสมบูรณ์ของทั้งใบเบิก (Borrow ID) ว่ายังมีอะไหล่ตัวอื่นเหลือค้างอีกไหม
                    const [remainingInTx] = await connection.query(
                        "SELECT * FROM equipment_list WHERE transaction_id = ?", 
                        [item.borrowId]
                    );
                    
                    // หากใบเบิกนี้ไม่มีของเหลือค้างแล้ว ให้ปิดสถานะ is_pending ของใบเบิกนั้นเป็น 0
                    if (remainingInTx.length === 0) {
                        await connection.query(
                            "UPDATE transactions SET is_pending = 0 WHERE transaction_id = ?", 
                            [item.borrowId]
                        );
                    }
                }
            }

            // C. บันทึกรายละเอียดการคืนลงใน equipment_list ของ Transaction RTN ใหม่
            const listId = `ELR-${Date.now().toString().slice(-5)}-${Math.floor(Math.random() * 1000)}`;
            await connection.query(
                "INSERT INTO equipment_list (equipment_list_id, transaction_id, quantity, lot_id) VALUES (?, ?, ?, ?)",
                [listId, transactionId, item.quantity, item.lotId]
            );
        }

        // 5. บันทึก Log เวลาปิดตู้ (Action A-002)
        const closeLogId = `RTN-CL-${Date.now().toString().slice(-8)}`;
        await connection.query(
            "INSERT INTO accesslogs (log_id, time, date, action_type_id, transaction_id, user_id) VALUES (?, CURTIME(), CURDATE(), 'A-002', ?, ?)",
            [closeLogId, transactionId, userId]
        );

        await connection.commit();
        res.json({ success: true, message: "คืนอะไหล่และเชื่อมโยงประวัติเรียบร้อย" });
    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});


// API สำหรับยืนยันการเบิกล่วงหน้า (pending) และเพิ่มสต็อก
// 1. API สำหรับบันทึกรายการเบิกล่วงหน้า (is_pending = 1)
// 1. API สำหรับบันทึกรายการเบิกล่วงหน้า (is_pending = 1)
app.post('/api/borrow/pending', authenticateToken, async (req, res) => {
    const { userId, borrowDate, items } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // สร้าง Transaction ID (PEND-xxxx)
        const transactionId = `PEND-${Date.now().toString().slice(-8)}`;

        // บันทึกรายการหลักลงตาราง transactions
        await connection.query(
            "INSERT INTO transactions (transaction_id, transaction_type_id, date, time, user_id, is_pending) VALUES (?, 'T-WTH', ?, CURTIME(), ?, 1)",
            [transactionId, borrowDate, userId]
        );

        let counter = 0;
        for (const item of items) {
            // 1. ตัดสต็อกออกจากตาราง lot
            const [updateLot] = await connection.query(
                "UPDATE lot SET current_quantity = current_quantity - ? WHERE lot_id = ? AND current_quantity >= ?",
                [item.quantity, item.lotId, item.quantity]
            );

            if (updateLot.affectedRows === 0) {
                throw new Error(`อะไหล่ใน Lot ${item.lotId} มีจำนวนไม่พอสำหรับเบิก`);
            }

            // 2. สร้าง ID สำหรับ equipment_list
            const listId = `ELP-${Date.now().toString().slice(-5)}${counter++}`;

            // 3. บันทึกรายการอะไหล่ (ลบ equipment_id ออกเพื่อให้ตรงกับโครงสร้างตารางของคุณ)
            await connection.query(
                "INSERT INTO equipment_list (equipment_list_id, transaction_id, quantity, lot_id) VALUES (?, ?, ?, ?)",
                [listId, transactionId, item.quantity, item.lotId]
            );
        }
        const logIdOpen = `LG-OP-${Date.now()}`;
        const logIdClose = `LG-CL-${Date.now() + 100}`;
        await connection.query(
            "INSERT INTO accesslogs (log_id, time, date, action_type_id, transaction_id, user_id) VALUES (?, CURTIME(), CURDATE(), 'A-001', ?, ?)",
            [logIdOpen, transactionId, userId]
        );

        await connection.query(
    "INSERT INTO accesslogs (log_id, time, date, action_type_id, transaction_id, user_id) VALUES (?, CURTIME(), CURDATE(), 'A-002', ?, ?)",
    [logIdClose, transactionId, userId]
);
        await connection.commit();
        res.json({ success: true, message: "บันทึกรายการเบิกล่วงหน้าและตัดสต็อกเรียบร้อย" });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Borrow Pending DB Error:", error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// 2. API สำหรับดึงรายการค้างสรุป
app.get('/api/borrow/pending/:userId', authenticateToken, async (req, res) => {
    try {
        const sql = `
            SELECT 
                t.transaction_id AS borrow_id,
                t.date AS borrow_date,
                et.equipment_name,
                el.quantity AS borrow_qty,
                l.equipment_id,
                el.lot_id
            FROM transactions t
            INNER JOIN equipment_list el ON t.transaction_id = el.transaction_id
            INNER JOIN lot l ON el.lot_id = l.lot_id
            INNER JOIN equipment e ON l.equipment_id = e.equipment_id
            INNER JOIN equipment_type et ON e.equipment_type_id = et.equipment_type_id
            WHERE t.user_id = ? 
            AND t.is_pending = 1
            ORDER BY t.date DESC, t.time DESC
        `;
        const [rows] = await pool.query(sql, [req.params.userId]);
        res.json(rows);
    } catch (error) {
        console.error("Fetch Pending Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// API สำหรับยืนยันการใช้จริงและสรุปรายการ (Finalize)
// API สำหรับสรุปยอดใช้จริงบางส่วน หรือ คืนทั้งหมด
app.post('/api/borrow/finalize-v2', authenticateToken, async (req, res) => {
    const { transactionId, machineSN, actionQty, actionType, lotId } = req.body; 
    // actionType: 'USE' (ใช้กับครุภัณฑ์), 'RETURN' (คืนคลังทั้งหมด)
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. ดึงข้อมูลจำนวนที่เหลืออยู่ในรายการยืมปัจจุบัน
        const [current] = await connection.query(
            "SELECT quantity, equipment_id FROM equipment_list WHERE transaction_id = ?", 
            [transactionId]
        );
        if (current.length === 0) throw new Error("ไม่พบรายการยืม");
        
        const remainingInList = current[0].quantity;
        const equipmentId = current[0].equipment_id;

        if (actionType === 'USE') {
            // --- กรณี: นำไปใช้จริงบางส่วน ---
            // สร้าง Transaction ใหม่สำหรับการใช้จริง (เพื่อเก็บประวัติแยกตามเลขครุภัณฑ์)
            const newTxId = `WTH-REAL-${Date.now().toString().slice(-8)}`;
            await connection.query(
                "INSERT INTO transactions (transaction_id, transaction_type_id, date, time, user_id, machine_SN, is_pending) VALUES (?, 'T-WTH', CURDATE(), CURTIME(), ?, ?, 0)",
                [newTxId, req.user.userId, machineSN]
            );
            await connection.query(
                "INSERT INTO equipment_list (equipment_list_id, transaction_id, equipment_id, quantity, lot_id) VALUES (?, ?, ?, ?, ?)",
                [`ELR-${Date.now().slice(-5)}`, newTxId, equipmentId, actionQty, lotId]
            );

            // ลดจำนวนในรายการยืมล่วงหน้า (Pending List)
            const updatedQty = remainingInList - actionQty;
            if (updatedQty <= 0) {
                await connection.query("UPDATE transactions SET is_pending = 0 WHERE transaction_id = ?", [transactionId]);
                await connection.query("DELETE FROM equipment_list WHERE transaction_id = ?", [transactionId]);
            } else {
                await connection.query("UPDATE equipment_list SET quantity = ? WHERE transaction_id = ?", [updatedQty, transactionId]);
            }

        } else if (actionType === 'RETURN') {
            // --- กรณี: คืนคลังทั้งหมดที่เหลืออยู่ ---
            await connection.query("UPDATE lot SET current_quantity = current_quantity + ? WHERE lot_id = ?", [remainingInList, lotId]);
            await connection.query("UPDATE transactions SET is_pending = 0 WHERE transaction_id = ?", [transactionId]);
        }

        await connection.commit();
        res.json({ success: true });
    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// ==========================================
// 📌 API สำหรับสรุปการใช้จริง (หักยอดในมือ + ปิด job เมื่อหมด)
// ==========================================
app.post('/api/borrow/finalize-partial', authenticateToken, async (req, res) => {
    const { transactionId, machineSN, usedQty, lotId } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. ตรวจสอบจำนวนคงเหลือในมือจากรายการเบิกต้นทาง
        const [rows] = await connection.query(
            "SELECT quantity FROM equipment_list WHERE transaction_id = ? AND lot_id = ?",
            [transactionId, lotId]
        );
        
        if (rows.length === 0) throw new Error("ไม่พบรายการยืมนี้ในระบบ");
        const currentInHand = rows[0].quantity;

        if (usedQty > currentInHand) {
            throw new Error(`จำนวนที่บันทึก (${usedQty}) มากกว่าจำนวนที่มีอยู่ในมือ (${currentInHand})`);
        }

        // 2. สร้าง Transaction ใหม่สำหรับการใช้จริง และผูก parent_transaction_id
        const realTxId = `W-REAL-${Date.now().toString().slice(-8)}`;
        await connection.query(
            "INSERT INTO transactions (transaction_id, parent_transaction_id, transaction_type_id, date, time, user_id, machine_SN, is_pending) VALUES (?, ?, 'T-WTH', CURDATE(), CURTIME(), ?, ?, 0)",
            [realTxId, transactionId, req.user.userId, machineSN]
        );

        // 3. บันทึกรายละเอียดอะไหล่ (ลบ equipment_id ออกเพื่อให้ตรงกับโครงสร้างตารางจริง)
        await connection.query(
            "INSERT INTO equipment_list (equipment_list_id, transaction_id, quantity, lot_id) VALUES (?, ?, ?, ?)",
            [`ELR-${Date.now().toString().slice(-5)}`, realTxId, usedQty, lotId]
        );

        // 4. บันทึก Log เวลาเปิด-ปิดอัตโนมัติสำหรับรายการสรุปผล
        await connection.query(
            "INSERT INTO accesslogs (log_id, time, date, action_type_id, transaction_id, user_id) VALUES (?, CURTIME(), CURDATE(), 'A-001', ?, ?)",
            [`LG-OP-${Date.now()}`, realTxId, req.user.userId]
        );
        await connection.query(
            "INSERT INTO accesslogs (log_id, time, date, action_type_id, transaction_id, user_id) VALUES (?, CURTIME(), CURDATE(), 'A-002', ?, ?)",
            [`LG-CL-${Date.now() + 500}`, realTxId, req.user.userId]
        );

        // 5. อัปเดตยอดคงเหลือในมือ หรือลบทิ้งหากใช้หมดแล้ว
        const newRemainingQty = currentInHand - usedQty;
        if (newRemainingQty > 0) {
            await connection.query(
                "UPDATE equipment_list SET quantity = ? WHERE transaction_id = ? AND lot_id = ?",
                [newRemainingQty, transactionId, lotId]
            );
        } else {
            await connection.query("DELETE FROM equipment_list WHERE transaction_id = ? AND lot_id = ?", [transactionId, lotId]);
        }

        // 6. ตรวจสอบว่าใบเบิกต้นทาง (Parent) เหลืออะไหล่อื่นอีกไหม ถ้าไม่มีให้ปิด is_pending
        const [check] = await connection.query("SELECT COUNT(*) as itemCount FROM equipment_list WHERE transaction_id = ?", [transactionId]);
        if (check[0].itemCount === 0) {
            await connection.query("UPDATE transactions SET is_pending = 0 WHERE transaction_id = ?", [transactionId]);
        }

        await connection.commit();
        res.json({ success: true, message: "บันทึกใช้จริงและเชื่อมโยงประวัติสำเร็จ" });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Finalize Partial Error:", error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// API สำหรับ "คืนคลังทั้งหมด" ที่เหลืออยู่
app.post('/api/borrow/return-all', authenticateToken, async (req, res) => {
    const { transactionId, equipmentId, lotId, qtyToReturn } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        await connection.query("UPDATE lot SET current_quantity = current_quantity + ? WHERE lot_id = ?", [qtyToReturn, lotId]);

        const returnTxId = `RTN-${Date.now().toString().slice(-8)}`;
        await connection.query(
            "INSERT INTO transactions (transaction_id, transaction_type_id, date, time, user_id, is_pending) VALUES (?, 'T-RTN', CURDATE(), CURTIME(), ?, 0)",
            [returnTxId, req.user.userId]
        );

        await connection.query(
            "INSERT INTO equipment_list (equipment_list_id, transaction_id, equipment_id, quantity, lot_id) VALUES (?, ?, ?, ?, ?)",
            [`ELR-${Date.now().toString().slice(-5)}`, returnTxId, equipmentId, qtyToReturn, lotId]
        );

        // 🟢 เพิ่ม: บันทึก Log เวลาสำหรับการคืนคลัง
        await connection.query(
            "INSERT INTO accesslogs (log_id, time, date, action_type_id, transaction_id, user_id) VALUES (?, CURTIME(), CURDATE(), 'A-001', ?, ?)",
            [`LG-OP-${Date.now()}`, returnTxId, req.user.userId]
        );
        await connection.query(
            "INSERT INTO accesslogs (log_id, time, date, action_type_id, transaction_id, user_id) VALUES (?, CURTIME(), CURDATE(), 'A-002', ?, ?)",
            [`LG-CL-${Date.now() + 500}`, returnTxId, req.user.userId]
        );

        await connection.query("DELETE FROM equipment_list WHERE transaction_id = ? AND lot_id = ?", [transactionId, lotId]);

        const [check] = await connection.query("SELECT COUNT(*) as itemCount FROM equipment_list WHERE transaction_id = ?", [transactionId]);
        if (check[0].itemCount === 0) {
            await connection.query("UPDATE transactions SET is_pending = 0 WHERE transaction_id = ?", [transactionId]);
        }

        await connection.commit();
        res.json({ success: true, message: "คืนอะไหล่เข้าคลังเรียบร้อย" });
    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
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
        if (users.length === 0) return res.status(401).json({ message: "Email หรือ Password ไม่ถูกต้อง" });

        const user = users[0];
        const isPasswordMatch = await bcrypt.compare(password, user.password_hash); //
        
        if (!isPasswordMatch) return res.status(401).json({ message: "Email หรือ Password ไม่ถูกต้อง" });
        
        if (user.totp_secret) {
            res.json({ status: "2fa_required", userId: user.user_id });
        } else {
            res.json({ status: "2fa_setup_required", userId: user.user_id });
        }
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
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
        const [users] = await pool.execute(
            "SELECT U.*, R.role_name FROM users U JOIN role R ON U.role_id = R.role_id WHERE U.user_id = ?", 
            [userId]
        );
        if (users.length === 0) return res.status(404).json({ message: "ไม่พบผู้ใช้งาน" });
        
        const user = users[0];
        const verified = speakeasy.totp.verify({
            secret: user.totp_secret,
            encoding: 'base32',
            token: token,
            window: 1 
        });

        if (verified) {
            const loginToken = jwt.sign(
                { userId: user.user_id, email: user.email, role: user.role_id, fullname: user.fullname },
                JWT_SECRET,
                { expiresIn: '8h' }
            );
            res.json({ message: "ล็อกอินสำเร็จ", token: loginToken, role: user.role_name });
        } else {
            res.status(401).json({ message: "รหัส 6 หลักไม่ถูกต้อง" });
        }
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
});


/**
 * Endpoint 5: Get Current User (Protected)
 */
app.get("/api/auth/me", authenticateToken, async (req, res) => {
    // req.user มาจาก middleware (มี userId, email, fullname, role)
    const userIdFromToken = req.user.userId; 

    try {
        const [users] = await pool.execute("SELECT * FROM users WHERE user_id = ?", [userIdFromToken]);
        if (users.length === 0) return res.status(404).json({ message: "User not found" });

        const user = users[0];

        // ส่งข้อมูลที่ครบถ้วนกลับไป
        res.json({
            user_id: user.user_id, 
            fullname: user.fullname,
            email: user.email,
            phone_number: user.phone_number,
            position: user.position,
            profile_img: user.profile_img,
            role: req.user.role 
        });

    } catch (error) {
        console.error("Get Me Error:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});


app.put("/api/profile-edit", authenticateToken, async (req, res) => {
    const userIdFromToken = req.user.userId; 
    const { fullname, email, phone_number, position, profile_img } = req.body;
    try {
        await pool.execute(
            "UPDATE users SET fullname = ?, email = ?, phone_number = ?, position = ?, profile_img = ? WHERE user_id = ?",
            [fullname, email, phone_number, position, profile_img || null, userIdFromToken]
        );
        res.json({ message: "Profile updated successfully!" });
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
});


app.get("/api/inventoryBalanceReportChart", async (req, res) => {
    try {
        const sql = `
            SELECT
                et.equipment_type_id,
                et.equipment_name,
                -- จำนวนคงเหลือในคลังปัจจุบัน (จากตาราง lot)
                COALESCE(SUM(l.current_quantity), 0) AS quantity,
                
                -- จำนวนทั้งหมด (ของในคลัง + ของที่ถูกเบิกไปแบบ Pending)
                COALESCE(SUM(l.current_quantity), 0) + COALESCE((
                    SELECT SUM(el_sub.quantity)
                    FROM equipment_list el_sub
                    INNER JOIN lot l_sub ON el_sub.lot_id = l_sub.lot_id
                    JOIN transactions t_sub ON el_sub.transaction_id = t_sub.transaction_id
                    WHERE l_sub.equipment_id = e.equipment_id 
                    AND t_sub.is_pending = 1
                ), 0) AS total_quantity,
                
                COALESCE(e.alert_quantity, 0) AS alert_quantity,
                
                -- จำนวนที่ใช้ไปจริง (หักจากรายการที่ปิด Job แล้ว)
                COALESCE((
                    SELECT SUM(el_used.quantity)
                    FROM equipment_list el_used
                    INNER JOIN lot l_used ON el_used.lot_id = l_used.lot_id
                    JOIN transactions t_used ON el_used.transaction_id = t_used.transaction_id
                    WHERE l_used.equipment_id = e.equipment_id 
                    AND t_used.transaction_type_id = 'T-WTH'
                    AND t_used.is_pending = 0
                ), 0) AS used_quantity
            FROM equipment_type et
            LEFT JOIN equipment e ON e.equipment_type_id = et.equipment_type_id
            LEFT JOIN lot l ON l.equipment_id = e.equipment_id
            GROUP BY et.equipment_type_id, et.equipment_name
        `;

        const [rows] = await pool.query(sql);
        res.json(rows);

    } catch (err) {
        console.error("Report Chart Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ดึงรายการอะไหล่ที่มีราคาต่อหน่วยมากกว่า 1,000 บาท
app.get('/api/alerts/high-value', async (req, res) => {
    try {
        const sql = `
            SELECT 
                l.lot_id,
                e.equipment_id, 
                et.equipment_name, 
                l.price, 
                l.current_quantity as total_quantity, 
                et.img,
                e.alert_quantity,
                et.unit as unit_name
            FROM lot l
            JOIN equipment e ON l.equipment_id = e.equipment_id
            JOIN equipment_type et ON e.equipment_type_id = et.equipment_type_id
            WHERE l.price > 1000
            ORDER BY l.price DESC
        `;

        const [results] = await db.query(sql);
        res.json(results);
    } catch (err) {
        console.error("Database Error:", err);
        res.status(500).json({ message: "Internal Server Error" });
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

// ค้นหาเลขครุภัณฑ์ (Machine)
app.get('/api/search/machines', async (req, res) => {
    const { term } = req.query;
    try {
        const [rows] = await pool.query(
            "SELECT machine_SN, machine_name FROM machine WHERE machine_SN LIKE ? OR machine_name LIKE ? LIMIT 10",
            [`%${term}%`, `%${term}%`]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// เพิ่มต่อจาก API อื่นๆ ใน server.js
app.get('/api/search/parts', authenticateToken, async (req, res) => {
    const { term } = req.query;
    try {
        const sql = `
            SELECT 
                e.equipment_id, 
                et.equipment_name, 
                e.model_size, 
                l.lot_id,
                et.img    /* เพิ่มบรรทัดนี้เข้ามาเพื่อให้ดึงชื่อไฟล์รูปมาด้วย */
            FROM equipment e
            JOIN equipment_type et ON e.equipment_type_id = et.equipment_type_id
            LEFT JOIN lot l ON e.equipment_id = l.equipment_id
            WHERE et.equipment_name LIKE ? OR e.equipment_id LIKE ? OR l.lot_id LIKE ?
            GROUP BY e.equipment_id
            LIMIT 20
        `;
        const [rows] = await pool.query(sql, [`%${term}%`, `%${term}%`, `%${term}%`]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// 📌 API สำหรับดึงประวัติ 
// server.js
app.get('/api/history/full', authenticateToken, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let sql = `
            SELECT 
                t.transaction_id, 
                t.parent_transaction_id, 
                tt.transaction_type_name as type_name,
                t.transaction_type_id,
                t.is_pending,
                t.date, 
                t.time,
                t.machine_SN,
                u.fullname, 
                -- ดึงรายการอะไหล่แบบ JSON โดยเชื่อมโยงผ่าน lot และ equipment ให้ครบถ้วน
                (SELECT JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'name', et.equipment_name, 
                        'qty', el.quantity
                    )
                )
                 FROM equipment_list el
                 INNER JOIN lot l ON el.lot_id = l.lot_id
                 INNER JOIN equipment e ON l.equipment_id = e.equipment_id
                 INNER JOIN equipment_type et ON e.equipment_type_id = et.equipment_type_id
                 WHERE el.transaction_id = t.transaction_id) as items_json,
                -- ดึงเวลาเปิด-ปิดจาก accesslogs
                (SELECT time FROM accesslogs WHERE transaction_id = t.transaction_id AND action_type_id = 'A-001' LIMIT 1) as open_time,
                (SELECT time FROM accesslogs WHERE transaction_id = t.transaction_id AND action_type_id = 'A-002' LIMIT 1) as close_time
            FROM transactions t
            LEFT JOIN transactions_type tt ON t.transaction_type_id = tt.transaction_type_id
            LEFT JOIN users u ON t.user_id = u.user_id
        `;

        const params = [];
        if (startDate && endDate) {
            sql += " WHERE t.date BETWEEN ? AND ? ";
            params.push(startDate, endDate);
        }
        sql += ` ORDER BY COALESCE(t.parent_transaction_id, t.transaction_id) DESC, t.date DESC, t.time DESC`;

        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (error) {
        console.error("Fetch History Error:", error.message);
        res.status(500).json({ error: error.message });
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
        // รับค่าวันที่จาก Frontend ถ้าไม่มีให้ใช้ CURDATE() (วันที่ปัจจุบัน)
        const targetDate = req.query.date || new Date().toISOString().split('T')[0];

        const sql = `
            SELECT
                tt.transaction_type_name,
                -- นับจำนวนเฉพาะวันที่ระบุ
                SUM(CASE WHEN DATE(t.date) = ? THEN el.quantity ELSE 0 END) AS selected_date_total,
                -- นับจำนวนของเดือนนั้นๆ (คงเดิมไว้เพื่อสถิติ)
                SUM(CASE WHEN MONTH(t.date) = MONTH(?) AND YEAR(t.date) = YEAR(?) THEN el.quantity ELSE 0 END) AS monthly_total
            FROM transactions t
            JOIN transactions_type tt ON tt.transaction_type_id = t.transaction_type_id
            JOIN equipment_list el ON el.transaction_id = t.transaction_id
            WHERE tt.transaction_type_name IN ('เบิกอะไหล่', 'คืนอะไหล่')
            GROUP BY tt.transaction_type_name
        `;

        const [rows] = await db.query(sql, [targetDate, targetDate, targetDate]);

        const result = {
            borrow: { daily: 0, monthly: 0 },
            return: { daily: 0, monthly: 0 }
        };

        rows.forEach(row => {
            // ปรับชื่อให้ตรงกับ transaction_type_name ในฐานข้อมูล
            if (row.transaction_type_name === "เบิกอะไหล่") {
                result.borrow.daily = row.selected_date_total;
                result.borrow.monthly = row.monthly_total;
            }
            if (row.transaction_type_name === "คืนอะไหล่") {
                result.return.daily = row.selected_date_total;
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

app.get("/api/alerts/expire", async (req, res) => {
    const sql = `
        SELECT 
            l.lot_id,
            l.equipment_id,
            et.equipment_name,
            et.img,
            s.supplier_name,
            l.expiry_date,
            l.current_quantity,
            DATEDIFF(l.expiry_date, CURDATE()) AS days_remaining
        FROM lot l
        JOIN equipment e ON l.equipment_id = e.equipment_id
        JOIN equipment_type et ON e.equipment_type_id = et.equipment_type_id
        LEFT JOIN supplier s ON l.supplier_id = s.supplier_id
        WHERE l.expiry_date IS NOT NULL
        AND l.current_quantity > 0
        AND l.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
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

app.get("/api/alerts/low-stock", async (req, res) => {
    const sql = `
        SELECT 
            e.equipment_id,
            et.equipment_name,
            et.img,
            e.alert_quantity,
            COALESCE(SUM(l.current_quantity), 0) as total_stock
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
app.use('/profile-img', express.static(path.join(__dirname, 'uploads')));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 2. ตั้งค่า Multer สำหรับ Save ไฟล์
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // มั่นใจว่าชื่อโฟลเดอร์ตรงกับที่คุณสร้างไว้จริง
        cb(null, 'uploads/'); 
    },
    filename: (req, file, cb) => {
        cb(null,  Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// 3. API สำหรับอัปโหลดรูป (แยกออกมาต่างหากเพื่อความง่าย)
app.post("/api/upload", upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
    }
    
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
            RIGHT JOIN equipment e ON e.equipment_id = l.equipment_id 
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
            [newLotId, finalEquipmentId, finalSupplierId, lotData.import_date, lotData.expiry_date, lotData.current_quantity, lotData.price]
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
            [lotData.import_date, lotData.expiry_date, lotData.current_quantity, lotData.price, lot_id]
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
        SELECT t.transaction_id, t.date,t.time, tt.transaction_type_name, u.fullname, m.machine_name, (SELECT COUNT(*) FROM equipment_list el WHERE el.transaction_id = t.transaction_id) as item_count FROM transactions t LEFT JOIN transactions_type tt ON t.transaction_type_id = tt.transaction_type_id LEFT JOIN users u ON t.user_id = u.user_id LEFT JOIN machine m ON t.machine_SN = m.machine_SN ORDER BY t.date DESC, t.transaction_id DESC;
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
        SELECT el.*, et.equipment_name,et.unit, e.model_size FROM equipment_list el JOIN equipment e ON el.equipment_id = e.equipment_id JOIN equipment_type et ON et.equipment_type_id = e.equipment_type_id
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
        const [types] = await db.query("SELECT transaction_type_id, transaction_type_name FROM transactions_type"); 
        const [equipments] = await db.query("SELECT equipment_id, model_size FROM equipment");
        
        res.json({ users, machines, types, equipments });
    } catch (err) {
        console.error(err);
        res.status(500).send(err);
    }
});

async function getNextTransactionId(prefix, connection) {
    // หา id ล่าสุดที่ขึ้นต้นด้วย prefix นั้นๆ
    const [rows] = await connection.query(
        "SELECT transaction_id FROM transactions WHERE transaction_id LIKE ? ORDER BY transaction_id DESC LIMIT 1",
        [`${prefix}-%`]
    );

    let nextNumber = 1;
    if (rows.length > 0) {
        // ถ้ามีข้อมูลเดิม: แยกเอาเฉพาะตัวเลขออกมาบวกหนึ่ง
        // เช่น WTH-00000005 -> 5 + 1 = 6
        const lastId = rows[0].transaction_id;
        const lastNum = parseInt(lastId.split('-')[1]);
        nextNumber = lastNum + 1;
    }

    // แปลงกลับเป็น Format เช่น WTH-00000006 (เติม 0 ให้ครบ 8 หลัก)
    const formattedNum = nextNumber.toString().padStart(8, '0');
    return `${prefix}-${formattedNum}`;
}

// 4. สร้าง Transaction ใหม่ (ใช้ SQL Transaction เพื่อความปลอดภัย)
app.post('/api/transactions', authenticateToken, async (req, res) => {
    const { type_mode, user_id, machine_SN, date, time, items } = req.body;
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        let prefix = '';
        let typeId = '';
        let is_pending = 0;
        let finalMachineSN = machine_SN;

        // เงื่อนไขตามที่คุณระบุ
        if (type_mode === 'withdraw') { // เบิกปกติ
            prefix = 'WTH';
            typeId = 'T-WTH';
        } else if (type_mode === 'return') { // คืน
            prefix = 'RTN';
            typeId = 'T-RTN';
            finalMachineSN = null; // ไม่ต้องกรอก machine_SN
        } else if (type_mode === 'borrow') { // เบิกสำหรับยืม (Pending)
            prefix = 'PEND';
            typeId = 'T-WTH';
            is_pending = 1;
            finalMachineSN = null; // ไม่ต้องกรอก machine_SN
        }

        const transactionId = await getNextTransactionId(prefix, 'transactions', 'transaction_id', connection);

        // บันทึกลงตาราง transactions
        await connection.query(
            "INSERT INTO transactions (transaction_id, transaction_type_id, date, time, user_id, machine_SN, is_pending) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [transactionId, typeId, date, time, user_id, finalMachineSN, is_pending]
        );

        for (const item of items) {
            const listId = await getNextTransactionId('EL', 'equipment_list', 'equipment_list_id', connection);
            
            // บันทึกลง equipment_list
            await connection.query(
                "INSERT INTO equipment_list (equipment_list_id, transaction_id, equipment_id, quantity, lot_id) VALUES (?, ?, ?, ?, ?)",
                [listId, transactionId, item.equipment_id, item.quantity, item.lot_id]
            );

            // อัปเดตสต็อกในตาราง lot (เบิก/ยืม = ลบ, คืน = บวก)
            const stockChange = (type_mode === 'return') ? item.quantity : -item.quantity;
            await connection.query(
                "UPDATE lot SET current_quantity = current_quantity + ? WHERE lot_id = ?",
                [stockChange, item.lot_id]
            );
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
        SELECT u.user_id, u.fullname,u.phone_number, u.email, u.role_id, r.role_name,u.profile_img 
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

// เปลี่ยน รหัสผ่าน (แก้ไขชื่อคอลัมน์ให้ตรงกับฐานข้อมูลจริง)
app.put('/api/change-passwordENG', authenticateToken, async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    // แก้ไขจาก user_id เป็น userId ให้ตรงกับ Payload ใน Token
    const userId = req.user.userId || req.user.user_id; 
    if(!userId){
        return res.status(400).json({ message: "ไม่พบข้อมูลผู้ใช้งาน" });
    }
    try {
        // 1. แก้ไขชื่อคอลัมน์เป็น password_hash ให้ตรงกับฐานข้อมูล
        const [users] = await pool.execute(
            'SELECT password_hash FROM users WHERE user_id = ?', 
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: "ไม่พบผู้ใช้งาน" });
        }

        const user = users[0];

        // 2. ใช้ password_hash ในการเปรียบเทียบ
        const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
        
        if (!isMatch) {
            return res.status(400).json({ message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });
        }

        // 3. เข้ารหัสรหัสผ่านใหม่
        const salt = await bcrypt.genSalt(10);
        const hashedNewPassword = await bcrypt.hash(newPassword, salt);

        // 4. อัปเดตกลับไปยังคอลัมน์ password_hash
        await pool.execute(
            'UPDATE users SET password_hash = ? WHERE user_id = ?', 
            [hashedNewPassword, userId]
        );

        res.json({ message: "เปลี่ยนรหัสผ่านสำเร็จ" });

    } catch (error) {
        console.error("Change Password Error:", error);
        res.status(500).json({ message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์", error: error.code });
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
            SELECT l.lot_id, e.equipment_id, et.equipment_name, et.unit, et.img, l.current_quantity
            FROM lot l
            JOIN equipment e ON l.equipment_id = e.equipment_id
            JOIN equipment_type et ON e.equipment_type_id = et.equipment_type_id
            WHERE l.lot_id = ? OR e.equipment_id = ?
            LIMIT 1
        `;
        const [rows] = await pool.query(sql, [partId, partId]);
        if (rows.length === 0) return res.status(404).json({ error: 'ไม่พบข้อมูลอะไหล่' });

        const item = rows[0]; // ใช้ชื่อตัวแปร item
        res.json({
            lotId: item.lot_id,
            partId: item.equipment_id,
            partName: item.equipment_name,
            unit: item.unit,
            imageUrl: item.img ? item.img : null 
        });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});


// 2. API: Confirm and Cut Stock (POST /api/withdraw/confirm)
app.post('/api/withdraw/confirm', authenticateToken, async (req, res) => {
    const { machine_SN, cartItems } = req.body;
    const userId = req.user.userId;
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const transactionId = `WTH-${Date.now()}`;

        // 🟢 ขั้นตอนที่ 1: บันทึกรายการหลักก่อน
        await connection.query(
            "INSERT INTO transactions (transaction_id, transaction_type_id, date, time, user_id, machine_SN, is_pending) VALUES (?, 'T-WTH', CURDATE(), CURTIME(), ?, ?, 0)",
            [transactionId, userId, machine_SN]
        );

        // 🟢 ขั้นตอนที่ 2: ผูกเวลาเปิดที่มีอยู่แล้ว (จากตอนเริ่ม Step 1)
        await connection.query(
            `UPDATE accesslogs 
             SET transaction_id = ? 
             WHERE user_id = ? AND transaction_id IS NULL AND action_type_id = 'A-001' 
             ORDER BY date DESC, time DESC LIMIT 1`,
            [transactionId, userId]
        );

        // ... (ส่วน Loop equipment_list คงเดิมตามโค้ดของคุณ) ...

        // 🟢 ขั้นตอนที่ 3: บันทึกเวลาปิดใหม่
        const closeLogId = `LG-CL-${Date.now()}`;
        await connection.query(
            "INSERT INTO accesslogs (log_id, time, date, action_type_id, transaction_id, user_id) VALUES (?, CURTIME(), CURDATE(), 'A-002', ?, ?)",
            [closeLogId, transactionId, userId]
        );

        await connection.commit();
        res.json({ success: true, transactionId });
    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});


app.get('/api/reports/equipment-usage', async (req, res) => {
    try {
        const sql = `
            SELECT et.equipment_name, SUM(el.quantity) as total_usage
            FROM equipment_list el
            JOIN lot l ON l.lot_id = el.lot_id
            JOIN equipment e ON l.equipment_id = e.equipment_id
            JOIN equipment_type et ON e.equipment_type_id = et.equipment_type_id
            GROUP BY et.equipment_name
            ORDER BY total_usage DESC;
        `;
        const [rows] = await pool.query(sql);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/reports/equipment-age', async (req, res) => {
    try {
        // คำนวณหาอายุเฉลี่ย (วันที่ปัจจุบัน - วันที่นำเข้า) เฉพาะ Lot ที่ยังมีของเหลือ (quantity > 0)
        const sql = `
            SELECT 
                et.equipment_name,
                AVG(DATEDIFF(NOW(), l.import_date)) as avg_age_days
            FROM lot l
            JOIN equipment e ON l.equipment_id = e.equipment_id
            JOIN equipment_type et ON e.equipment_type_id = et.equipment_type_id
            WHERE l.current_quantity > 0
            GROUP BY et.equipment_name
            ORDER BY avg_age_days DESC
        `;
        const [rows] = await pool.query(sql);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 📌 API สำหรับจัดการ Master Data (อะไหล่หลัก)
// ==========================================

// 1. API สำหรับเพิ่มข้อมูลอะไหล่ใหม่ (Add)
app.post('/api/equipment/add', async (req, res) => {
    const { equipment_id, equipment_type_id, equipment_name, model_size, alert_quantity, unit, img } = req.body;
    let connection;
    
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1.1 เช็คว่ามีรหัสประเภทอะไหล่ (equipment_type_id) นี้ในระบบหรือยัง
        const [existingType] = await connection.query("SELECT * FROM equipment_type WHERE equipment_type_id = ?", [equipment_type_id]);
        
        if (existingType.length === 0) {
            // ถ้ายังไม่มี ให้สร้างประเภทอะไหล่ใหม่
            await connection.query(
                "INSERT INTO equipment_type (equipment_type_id, equipment_name, unit, img) VALUES (?, ?, ?, ?)",
                [equipment_type_id, equipment_name, unit, img || null]
            );
        } else {
            // ถ้ามีอยู่แล้ว ให้อัปเดตข้อมูลให้ตรงกับที่ส่งมาใหม่
            await connection.query(
                "UPDATE equipment_type SET equipment_name = ?, unit = ?, img = COALESCE(?, img) WHERE equipment_type_id = ?",
                [equipment_name, unit, img || null, equipment_type_id]
            );
        }

        // 1.2 เช็คว่ามีรหัสอะไหล่ (equipment_id) นี้หรือยัง เพื่อป้องกันการเพิ่มซ้ำ
        const [existingEq] = await connection.query("SELECT * FROM equipment WHERE equipment_id = ?", [equipment_id]);
        if (existingEq.length > 0) {
            throw new Error(`รหัสอะไหล่ ${equipment_id} มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น`);
        }

        // 1.3 เพิ่มข้อมูลลงตาราง equipment
        await connection.query(
            "INSERT INTO equipment (equipment_id, equipment_type_id, model_size, alert_quantity) VALUES (?, ?, ?, ?)",
            [equipment_id, equipment_type_id, model_size, alert_quantity]
        );

        await connection.commit();
        res.status(201).json({ success: true, message: "เพิ่มข้อมูลอะไหล่สำเร็จ" });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Add Equipment Error:", error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// 2. API สำหรับแก้ไขข้อมูลอะไหล่ (Update)
app.put('/api/equipment/update/:id', async (req, res) => {
    const equipment_id_param = req.params.id;
    const { equipment_type_id, equipment_name, model_size, alert_quantity, unit, img } = req.body;
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 2.1 อัปเดตตาราง equipment
        await connection.query(
            "UPDATE equipment SET equipment_type_id = ?, model_size = ?, alert_quantity = ? WHERE equipment_id = ?",
            [equipment_type_id, model_size, alert_quantity, equipment_id_param]
        );

        // 2.2 อัปเดตตาราง equipment_type (ชื่อ, หน่วย, รูป)
        await connection.query(
            "UPDATE equipment_type SET equipment_name = ?, unit = ?, img = COALESCE(?, img) WHERE equipment_type_id = ?",
            [equipment_name, unit, img || null, equipment_type_id]
        );

        await connection.commit();
        res.json({ success: true, message: "แก้ไขข้อมูลสำเร็จ" });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Update Equipment Error:", error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// 3. API สำหรับลบข้อมูลอะไหล่ (Delete)
app.delete('/api/equipment/:id', async (req, res) => {
    const equipment_id = req.params.id;
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [rows] = await connection.query(
            "SELECT equipment_type_id FROM equipment WHERE equipment_id = ?", 
            [equipment_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: "ไม่พบข้อมูลอะไหล่ที่ต้องการลบ" });
        }

        const typeIdToDelete = rows[0].equipment_type_id;

        await connection.query("DELETE FROM equipment WHERE equipment_id = ?", [equipment_id]);

        const [remaining] = await connection.query(
            "SELECT COUNT(*) as count FROM equipment WHERE equipment_type_id = ?", 
            [typeIdToDelete]
        );

        if (remaining[0].count === 0) {
            await connection.query(
                "DELETE FROM equipment_type WHERE equipment_type_id = ?", 
                [typeIdToDelete]
            );
        }

        await connection.commit();
        res.json({ success: true, message: "ลบข้อมูลอะไหล่ (และประเภทอะไหล่ที่ว่าง) สำเร็จ" });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Delete Equipment Error:", error);
        
        if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451) {
            res.status(400).json({ error: "ไม่สามารถลบได้ เนื่องจากข้อมูลถูกใช้งานอยู่ในส่วนอื่น (เช่น ตาราง Stock/Lot)" });
        } else {
            res.status(500).json({ error: error.message });
        }
    } finally {
        if (connection) connection.release();
    }
});

app.get('/api/equipment-types', async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT equipment_type_id,equipment_name FROM equipment_type;");
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 📌 API สำหรับจัดการ Lot (สต็อกสินค้าเข้า)
// ==========================================

// 1. API สำหรับเพิ่ม Lot ใหม่
app.post('/api/inventory/add-lot', async (req, res) => {
    const { lot_id, equipment_id, supplier_id, import_date, expiry_date, current_quantity, price } = req.body;
    let connection;

    try {
        connection = await pool.getConnection();

        // 1. เช็คว่ามี lot_id นี้อยู่ในระบบหรือยัง
        const [existingLot] = await connection.query("SELECT * FROM lot WHERE lot_id = ?", [lot_id]);
        if (existingLot.length > 0) {
            return res.status(400).json({ error: `รหัส Lot ${lot_id} มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น` });
        }

        // 2. เช็คว่า supplier_id ที่ส่งมามีจริงในตาราง supplier หรือไม่ (ถ้าไม่มีต้องเตือน)
        if (supplier_id) {
            const [existingSupplier] = await connection.query("SELECT * FROM supplier WHERE supplier_id = ?", [supplier_id]);
            if (existingSupplier.length === 0) {
                 return res.status(400).json({ error: `ไม่พบข้อมูลบริษัทรหัส ${supplier_id} ในระบบ` });
            }
        }

        // 3. เพิ่มข้อมูลลงตาราง lot
        const sql = `
            INSERT INTO lot (lot_id, equipment_id, supplier_id, import_date, expiry_date, current_quantity, price) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        // ถ้า expiry_date เป็น string ว่าง ("") ให้เปลี่ยนเป็น null ลง DB
        const finalExpiryDate = expiry_date ? expiry_date : null;

        await connection.query(sql, [
            lot_id, 
            equipment_id, 
            supplier_id || null, 
            import_date, 
            finalExpiryDate, 
            current_quantity, 
            price
        ]);

        res.status(201).json({ success: true, message: "เพิ่ม Lot ใหม่สำเร็จ" });
    } catch (error) {
        console.error("Add Lot Error:", error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// 2. API สำหรับแก้ไขข้อมูล Lot
app.put('/api/inventory/update-lot/:id', async (req, res) => {
    const lot_id_param = req.params.id;
    const { supplier_id, import_date, expiry_date, current_quantity, price } = req.body;
    let connection;

    try {
        connection = await pool.getConnection();

        const sql = `
            UPDATE lot 
            SET supplier_id = ?, 
                import_date = ?, 
                expiry_date = ?, 
                current_quantity = ?, 
                price = ?
            WHERE lot_id = ?
        `;

        const finalExpiryDate = expiry_date ? expiry_date : null;

        const [result] = await connection.query(sql, [
            supplier_id || null, 
            import_date, 
            finalExpiryDate, 
            current_quantity, 
            price, 
            lot_id_param
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "ไม่พบข้อมูล Lot ที่ต้องการแก้ไข" });
        }

        res.json({ success: true, message: "แก้ไขข้อมูล Lot สำเร็จ" });
    } catch (error) {
        console.error("Update Lot Error:", error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// หมายเหตุ: API ลบ Lot (DELETE /api/inventory/:id) ของคุณมีอยู่ใน server.js อยู่แล้ว จึงไม่ต้องเขียนเพิ่ม

// 4. สั่งให้ Server รัน
// ✅ ใช้ server.listen เพื่อรันทั้ง Express และ Socket.IO
server.listen(PORT, () => {
    console.log(`🚀 Backend server is running on http://localhost:${PORT}`);
    console.log(`    (Ready to command ESP via MQTT Broker)`); // แก้เป็นข้อความนี้แทน
});