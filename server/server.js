const express = require('express');
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const cors = require('cors');
const axios = require('axios'); 
const multer = require('multer'); 
const path = require('path'); 

const http = require('http'); 
const { Server } = require("socket.io");


const app = express();

const server = http.createServer(app); 
const io = new Server(server, { 
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
}); 

//กันเบิกชนกัน
let cabinetState = {
    isBusy: false,
    userId: null,
    userName: null
};

io.on('connection', (socket) => {
    socket.emit('cabinet_status', cabinetState);
});

const PORT = 3001; // Port สำหรับ Backend


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


pool.query("SELECT 1")
    .then(() => console.log("✅ Database connected successfully!"))
    .catch(err => console.error("❌ Database connection failed:", err.message));


const JWT_SECRET = "MY_SUPER_SECRET_KEY_FOR_JWT_12345";

//ค่าคงที่สำหรับ ESP8266 
//step1 setup MQTT Broker ใน server kob 
//step2 แก้ไข ESP8266 ให้เชื่อมต่อกับ MQTT Broker ของ Server แทนการรับคำสั่งผ่าน HTTP โดยตรง
//step3 ใน server.js ให้ใช้ MQTT Client (เช่น mqtt.js) เพื่อส่งคำสั่งไปยัง ESP8266 ผ่าน MQTT แทนการใช้ HTTP
//const ESP_IP = 'http://192.168.1.139'; 

const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://kob.vps.athichal.com:62279'); 
const SECRET_PASSKEY = "MEMS_AMKOB";

let deviceStatus = "offline";
let lastLoggedStatus = ""; 

client.on('connect', () => {
    console.log('✅ Connected to MQTT Broker');
    client.subscribe("esp8266/status");
});

client.on('message', (topic, message) => {
    if (topic === "esp8266/status") {
        const newStatus = message.toString();
        deviceStatus = newStatus;
        if (newStatus !== lastLoggedStatus) {
            console.log(`[Device] Status changed to: ${newStatus}`);
            lastLoggedStatus = newStatus; 
        }
    }
});
client.on('error', (err) => {
    console.error('❌ MQTT Connection Error:', err);
});

app.get('/api/device-check', authenticateToken, (req, res) => {
    if (deviceStatus === "online") {
        res.status(200).json({ status: "online" });
    } else {
        res.status(503).json({ 
            status: "offline", 
            message: "ตู้ไม่พร้อมใช้งาน กรุณาตรวจสอบการเสียบปลั๊กหรือการเชื่อมต่ออินเทอร์เน็ตของตู้" 
        });
    }
});



// Middleware ตรวจสอบ Token 
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


// --- API สำหรับสั่งเปิดประตูตู้ ---
app.get('/api/open', authenticateToken, async (req, res) => {

    if (deviceStatus !== "online") {
        return res.status(503).json({ 
            status: "offline",
            message: 'ตู้ไม่พร้อมใช้งาน (ไม่มีไฟเลี้ยง) กรุณาเสียบปลั๊กก่อนสั่งเปิดประตู' 
        });
    }

    const userId = req.user.userId;
    if (cabinetState.isBusy && cabinetState.userId !== userId) {
        return res.status(409).json({ 
            message: `ตู้กำลังถูกใช้งานโดย ${cabinetState.userName || 'ผู้ใช้อื่น'} โปรดรอจนกว่าจะปิดประตู` 
        });
    }

    const transactionId = req.query.transactionId || null;
    try {
        await commandServo('OPEN'); 
        await logActionToDB(userId, 'A-001', transactionId);

        cabinetState = { isBusy: true, userId: userId, userName: req.user.fullname };
        io.emit('cabinet_status', cabinetState);

        res.status(200).send({ message: 'เปิดตู้สำเร็จ' });
    } catch (error) {
        res.status(500).send({ error: 'ไม่สามารถส่งคำสั่งได้' });
    }
});

// --- API สำหรับสั่งปิดประตูตู้ ---
app.post('/api/close-box', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { transactionId } = req.body;
    try {
        await commandServo('CLOSE'); 
        await logActionToDB(userId, 'A-002', transactionId || null);

        cabinetState = { isBusy: false, userId: null, userName: null };
        io.emit('cabinet_status', cabinetState);

        res.status(200).send({ message: 'ปิดตู้สำเร็จ (MQTT)' });
    } catch (error) {
        res.status(500).send({ error: 'ไม่สามารถส่งคำสั่ง MQTT ได้' });
    }
});

//API สำหรับ Withdrawal (เชื่อมต่อ DB) 

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
            LEFT JOIN lot l ON e.equipment_id = l.equipment_id  WHERE l.current_quantity > 0
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
            ORDER BY l.current_quantity DESC
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


// API สำหรับดึงข้อมูลอะไหล่เพื่อ "คืน" (เช็คประวัติว่าเคยเบิกไหมก่อนให้เพิ่มลงตะกร้า)
app.post('/api/return/partInfo', authenticateToken, async (req, res) => {
    const { partId } = req.body;
    const userId = req.user.userId; // ดึง User ID ของคนที่กำลังใช้งาน

    if (!partId) return res.status(400).json({ error: 'กรุณาระบุรหัสอะไหล่' });

    try {
        // 1. หาข้อมูลอะไหล่พื้นฐานก่อน
        const sql = `
            SELECT 
                l.lot_id, e.equipment_id, et.equipment_name, 
                e.model_size, et.unit, et.img, l.current_quantity
            FROM lot l
            JOIN equipment e ON l.equipment_id = e.equipment_id
            JOIN equipment_type et ON e.equipment_type_id = et.equipment_type_id
            WHERE l.lot_id = ? OR e.equipment_id = ?
            ORDER BY l.current_quantity DESC LIMIT 1
        `;
        const [rows] = await pool.query(sql, [partId, partId]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'ไม่พบข้อมูลอะไหล่ในระบบ' });
        }

        const data = rows[0];

        // 2. ตรวจสอบประวัติการเบิก-คืน ว่า User คนนี้มีของชิ้นนี้ค้างอยู่กี่ชิ้น
        const [withdrawResult] = await pool.query(`
            SELECT COALESCE(SUM(el.quantity), 0) AS total_withdrawn
            FROM equipment_list el
            JOIN transactions t ON el.transaction_id = t.transaction_id
            WHERE el.lot_id = ? AND t.user_id = ? 
            AND t.transaction_type_id = 'T-WTH' AND t.parent_transaction_id IS NULL
        `, [data.lot_id, userId]);

        const [returnResult] = await pool.query(`
            SELECT COALESCE(SUM(el.quantity), 0) AS total_returned
            FROM equipment_list el
            JOIN transactions t ON el.transaction_id = t.transaction_id
            WHERE el.lot_id = ? AND t.user_id = ? AND t.transaction_type_id = 'T-RTN'
        `, [data.lot_id, userId]);

        const maxReturnable = Number(withdrawResult[0].total_withdrawn) - Number(returnResult[0].total_returned);

        // 3. ถ้าคำนวณแล้ว ยอดที่คืนได้ <= 0 แปลว่าไม่เคยเบิก หรือ คืนครบไปแล้ว
        if (maxReturnable <= 0) {
            return res.status(400).json({ 
                error: `ไม่อนุญาต: คุณไม่มีประวัติการเบิกอะไหล่นี้ (หรือคืนครบแล้ว)` 
            });
        }

        // 4. ถ้าผ่าน ให้ส่งข้อมูลอะไหล่ พร้อมยอดสูงสุดที่คืนได้กลับไป
        return res.json({
            partId: data.equipment_id,
            lotId: data.lot_id,
            partName: data.equipment_name,
            unit: data.unit,
            imageUrl: data.img || null,
            maxReturnable: maxReturnable 
        });

    } catch (error) {
        console.error("Return PartInfo Error:", error);
        return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
    }
});

// Confirm and Cut Stock ตัดสต็อก
app.post('/api/withdraw/confirm', authenticateToken, async (req, res) => {
    const { machine_id, machine_number, machine_SN, department_id, repair_type_id, cartItems } = req.body;
    const userId = req.user.userId;
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
        return res.status(400).json({ 
            success: false, 
            error: "ไม่พบรายการอะไหล่ที่ต้องการเบิก หรือรูปแบบข้อมูลไม่ถูกต้อง" 
        });
    }
    for (let i = 0; i < cartItems.length; i++) {
        const item = cartItems[i];

        // เช็คว่ามี lotId หรือไม่
        if (!item.lotId || String(item.lotId).trim() === '') {
            return res.status(400).json({ 
                success: false, 
                error: `ข้อมูลรายการที่ ${i + 1} ไม่ถูกต้อง (ไม่พบรหัส Lot)` 
            });
        }

        // ห้ามเบิกติดลบ หรือเบิก 0 ชิ้น
        if (item.quantity === undefined || item.quantity === null || isNaN(item.quantity) || item.quantity <= 0) {
            return res.status(400).json({ 
                success: false, 
                error: `จำนวนอะไหล่ของ Lot: ${item.lotId} ไม่ถูกต้อง (ต้องมากกว่า 0)` 
            });
        }
    }

    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. สร้าง ID ให้สั้นลง ป้องกัน Error Data too long (หั่นเหลือ 8 ตัวท้าย)
        const transactionId = `WTH-${Date.now().toString().slice(-8)}`;

        // 2. แปลงค่าว่าง ("") ให้เป็น null เพื่อป้องกัน Foreign Key Error
        const finalMachineId = machine_id || null;
        const finalMachineNumber = machine_number || null;
        const finalMachineSN = machine_SN || null;
        const finalDeptId = department_id || null;
        const finalRepairTypeId = repair_type_id || null;

        // 3. บันทึกรายการหลัก
        const insertTxSql = `
            INSERT INTO transactions 
            (transaction_id, transaction_type_id, date, time, user_id, 
            machine_id, machine_number, machine_SN, department_id, repair_type_id, is_pending) 
            VALUES (?, 'T-WTH', CURDATE(), CURTIME(), ?, ?, ?, ?, ?, ?, 0)
        `;
        await connection.query(insertTxSql, [
            transactionId, userId, finalMachineId, finalMachineNumber, finalMachineSN, finalDeptId, finalRepairTypeId
        ]);

        // 4. ผูกเวลาเปิดประตู
        await connection.query(
            `UPDATE accesslogs 
             SET transaction_id = ? 
             WHERE user_id = ? AND transaction_id IS NULL AND action_type_id = 'A-001' 
             ORDER BY date DESC, time DESC LIMIT 1`,
            [transactionId, userId]
        );

        // 5. บันทึกรายการอะไหล่ที่เบิก
        let counter = 0;
        for (const item of cartItems) {
            
            const [updateLotResult] = await connection.query(
                "UPDATE lot SET current_quantity = current_quantity - ? WHERE lot_id = ? AND current_quantity >= ?",
                [item.quantity, item.lotId, item.quantity]
            );
            
            if (updateLotResult.affectedRows === 0) {
                throw new Error(`อะไหล่ใน Lot: ${item.lotId} มีจำนวนไม่เพียงพอ (ต้องการ ${item.quantity} ชิ้น)`);
            }
            
            const listId = `EL-${Date.now().toString().slice(-5)}${counter++}`;
            await connection.query(
                "INSERT INTO equipment_list (equipment_list_id, transaction_id, quantity, lot_id) VALUES (?, ?, ?, ?)",
                [listId, transactionId, item.quantity, item.lotId]
            );
        }

        // 6. บันทึกเวลาปิดตู้ใหม่
        const closeLogId = `LG-CL-${Date.now().toString().slice(-8)}`;
        await connection.query(
            "INSERT INTO accesslogs (log_id, time, date, action_type_id, transaction_id, user_id) VALUES (?, CURTIME(), CURDATE(), 'A-002', ?, ?)",
            [closeLogId, transactionId, userId]
        );

        await connection.commit();
        res.json({ success: true, message: "เบิกอะไหล่เรียบร้อยแล้ว", transactionId });
        
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Confirm Withdraw Error:", error.message); 
        
        if (error.message.includes('ไม่เพียงพอ')) {
            return res.status(400).json({ error: error.message });
        }
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

        // 1. Validation: ป้องกันการคืนเกินจำนวนที่เคยเบิก (หรือของที่ไม่เคยเบิก)
        for (const item of items) {
            const [withdrawResult] = await connection.query(`
                SELECT COALESCE(SUM(el.quantity), 0) AS total_withdrawn
                FROM equipment_list el
                JOIN transactions t ON el.transaction_id = t.transaction_id
                WHERE el.lot_id = ? AND t.user_id = ? AND t.transaction_type_id = 'T-WTH'
            `, [item.lotId, userId]);

            const [returnResult] = await connection.query(`
                SELECT COALESCE(SUM(el.quantity), 0) AS total_returned
                FROM equipment_list el
                JOIN transactions t ON el.transaction_id = t.transaction_id
                WHERE el.lot_id = ? AND t.user_id = ? AND t.transaction_type_id = 'T-RTN'
            `, [item.lotId, userId]);

            const totalWithdrawn = Number(withdrawResult[0].total_withdrawn);
            const totalReturned = Number(returnResult[0].total_returned);
            const maxReturnable = totalWithdrawn - totalReturned;
            const reqQty = Number(item.quantity);

            // ถ้าพยายามคืนมากกว่ายอดที่เหลือในมือ (หรือพยายามคืนทั้งที่ไม่เคยเบิก)
            if (reqQty > maxReturnable) {
                await connection.rollback(); // ยกเลิกการบันทึกทันที
                connection.release();
                // ส่ง Status 400 ให้ Frontend จับ Error ได้ชัวร์ๆ
                return res.status(400).json({ 
                    error: `ไม่อนุญาตให้ทำรายการ: คุณไม่สามารถคืนอะไหล่ Lot: ${item.lotId} ได้ (ยอดที่คืนได้สูงสุดคือ ${maxReturnable} ชิ้น)` 
                });
            }
        }

        const transactionId = `RTN-${Date.now().toString().slice(-8)}`;
        const parentId = items.find(i => i.borrowId)?.borrowId || null;

        // 2. บันทึก Transaction หลัก (แก้ไขบัค Insert ซ้ำซ้อนแล้ว)
        await connection.query(
            "INSERT INTO transactions (transaction_id, parent_transaction_id, transaction_type_id, date, time, user_id, is_pending) VALUES (?, ?, 'T-RTN', ?, CURTIME(), ?, 0)",
            [transactionId, parentId, returnDate, userId]
        );

        // 3. ผูก Log เวลาเปิดตู้
        await connection.query(
            `UPDATE accesslogs SET transaction_id = ? 
             WHERE user_id = ? AND transaction_id IS NULL AND action_type_id = 'A-001' 
             ORDER BY date DESC, time DESC LIMIT 1`,
            [transactionId, userId]
        );

        // 4. วนลูปจัดการสต็อกและการหักลดยอด
        for (const item of items) {
            await connection.query(
                "UPDATE lot SET current_quantity = current_quantity + ? WHERE lot_id = ?", 
                [item.quantity, item.lotId]
            );

            if (item.borrowId) {
                await connection.query(
                    "UPDATE equipment_list SET quantity = quantity - ? WHERE transaction_id = ? AND lot_id = ?",
                    [item.quantity, item.borrowId, item.lotId]
                );

                const [checkRows] = await connection.query(
                    "SELECT quantity FROM equipment_list WHERE transaction_id = ? AND lot_id = ?",
                    [item.borrowId, item.lotId]
                );

                if (!checkRows[0] || checkRows[0].quantity <= 0) {
                    await connection.query(
                        "DELETE FROM equipment_list WHERE transaction_id = ? AND lot_id = ?", 
                        [item.borrowId, item.lotId]
                    );
                    
                    const [remainingInTx] = await connection.query(
                        "SELECT * FROM equipment_list WHERE transaction_id = ?", 
                        [item.borrowId]
                    );
                    
                    if (remainingInTx.length === 0) {
                        await connection.query(
                            "UPDATE transactions SET is_pending = 0 WHERE transaction_id = ?", 
                            [item.borrowId]
                        );
                    }
                }
            }

            const listId = `ELR-${Date.now().toString().slice(-5)}-${Math.floor(Math.random() * 1000)}`;
            await connection.query(
                "INSERT INTO equipment_list (equipment_list_id, transaction_id, quantity, lot_id) VALUES (?, ?, ?, ?)",
                [listId, transactionId, item.quantity, item.lotId]
            );
        }

        // 5. บันทึก Log เวลาปิดตู้
        const closeLogId = `RTN-CL-${Date.now().toString().slice(-8)}`;
        await connection.query(
            "INSERT INTO accesslogs (log_id, time, date, action_type_id, transaction_id, user_id) VALUES (?, CURTIME(), CURDATE(), 'A-002', ?, ?)",
            [closeLogId, transactionId, userId]
        );

        await connection.commit();
        res.json({ success: true, message: "คืนอะไหล่และเชื่อมโยงประวัติเรียบร้อย" });
    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: "เกิดข้อผิดพลาดในการคืนอะไหล่: " + error.message });
    } finally {
        if (connection) connection.release();
    }
});

// API ตึกและแผนก 
app.get('/api/departments', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.query("SELECT * FROM department ORDER BY buildings ASC, department_name ASC");
        res.json(rows);
    } catch (error) {
        console.error("Fetch Departments Error:", error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// API ประเภทงาน
app.get('/api/repair-types', async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM repair_type");
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API สำหรับบันทึกรายการเบิกล่วงหน้า
app.post('/api/borrow/pending', authenticateToken, async (req, res) => {
    const { 
        userId, borrowDate, items, 
        machine_id, machine_number, machine_SN, 
        department_id, repair_type_id 
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: "ไม่พบรายการอะไหล่ที่ต้องการเบิก หรือรูปแบบข้อมูลไม่ถูกต้อง" });
    }
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.lotId || String(item.lotId).trim() === '') {
            return res.status(400).json({ success: false, error: `ข้อมูลรายการที่ ${i + 1} ไม่ถูกต้อง (ไม่พบรหัส Lot)` });
        }
        if (item.quantity === undefined || item.quantity === null || isNaN(item.quantity) || item.quantity <= 0) {
            return res.status(400).json({ success: false, error: `จำนวนอะไหล่ของ Lot: ${item.lotId} ไม่ถูกต้อง (ต้องมากกว่า 0)` });
        }
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const transactionId = `PEND-${Date.now().toString().slice(-8)}`;

        await connection.query(
            `INSERT INTO transactions 
            (transaction_id, transaction_type_id, date, time, user_id, 
             machine_id, machine_number, machine_SN, department_id, repair_type_id, is_pending) 
            VALUES (?, 'T-WTH', ?, CURTIME(), ?, ?, ?, ?, ?, ?, 1)`,
            [
                transactionId, borrowDate, userId, 
                machine_id || null, machine_number || null, machine_SN || null, 
                department_id || null, repair_type_id || null
            ]
        );
        let counter = 0;
        for (const item of items) {
            // ตัดสต็อกออกจากตาราง lot
            const [updateLot] = await connection.query(
                "UPDATE lot SET current_quantity = current_quantity - ? WHERE lot_id = ? AND current_quantity >= ?",
                [item.quantity, item.lotId, item.quantity]
            );

            if (updateLot.affectedRows === 0) {
                throw new Error(`อะไหล่ใน Lot ${item.lotId} มีจำนวนไม่พอสำหรับเบิก`);
            }

            const listId = `ELP-${Date.now().toString().slice(-5)}${counter++}`;

            // บันทึกรายการอะไหล่ 
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

// 2. API สำหรับดึงรายการค้างเบิก
app.get('/api/borrow/pending/:userId', authenticateToken, async (req, res) => {
    try {
        const sql = `
            SELECT 
                t.transaction_id AS borrow_id,
                t.date AS borrow_date,
                et.equipment_name,
                el.quantity AS borrow_qty,
                l.equipment_id,
                el.lot_id,
                t.machine_id,
                t.machine_number,
                t.machine_SN
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

app.get('/api/borrow/pending-details-all', authenticateToken, async (req, res) => {
    try {
        const sql = `
            SELECT 
                u.fullname,
                t.date AS borrow_date,
                et.equipment_name,
                el.quantity AS borrow_qty
            FROM transactions t
            INNER JOIN users u ON t.user_id = u.user_id
            INNER JOIN equipment_list el ON t.transaction_id = el.transaction_id
            INNER JOIN lot l ON el.lot_id = l.lot_id
            INNER JOIN equipment e ON l.equipment_id = e.equipment_id
            INNER JOIN equipment_type et ON e.equipment_type_id = et.equipment_type_id
            WHERE t.is_pending = 1
            ORDER BY t.date DESC
        `;
        const [rows] = await pool.query(sql);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// API สำหรับสรุปการใช้จริง
app.post('/api/borrow/finalize-partial', authenticateToken, async (req, res) => {
    const { 
        transactionId, 
        machineId,      
        machineNumber,  
        machineSN, 
        usedQty, 
        lotId,
        repairTypeId,   
        departmentId    
    } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // ตรวจสอบจำนวน
        const [rows] = await connection.query(
            "SELECT quantity FROM equipment_list WHERE transaction_id = ? AND lot_id = ?",
            [transactionId, lotId]
        );
        
        if (rows.length === 0) throw new Error("ไม่พบรายการอะไหล่ในมือ");
        const currentInHand = rows[0].quantity;
        if (usedQty > currentInHand) throw new Error(`ยอดไม่พอ (มี ${currentInHand} ต้องการใช้ ${usedQty})`);

        // สร้าง Transaction 
        const realTxId = `W-REAL-${Date.now().toString().slice(-6)}`;
        await connection.query(
            `INSERT INTO transactions 
            (transaction_id, parent_transaction_id, transaction_type_id, date, time, user_id, 
            machine_id, machine_number, machine_SN, repair_type_id, department_id, is_pending) 
            VALUES (?, ?, 'T-WTH', CURDATE(), CURTIME(), ?, ?, ?, ?, ?, ?, 0)`,
            [
                realTxId, 
                transactionId, 
                req.user.userId, 
                machineId || null,
                machineNumber || null, 
                machineSN || null, 
                repairTypeId || null, 
                departmentId || null
            ]
        );

        // บันทึกรายละเอียดอะไหล่ 
        const elId = `ELR-${Math.floor(Math.random() * 100000)}`;
        await connection.query(
            "INSERT INTO equipment_list (equipment_list_id, transaction_id, quantity, lot_id) VALUES (?, ?, ?, ?)",
            [elId, realTxId, usedQty, lotId]
        );

        // บันทึก Logs
        await connection.query(
            "INSERT INTO accesslogs (log_id, time, date, action_type_id, transaction_id, user_id) VALUES (?, CURTIME(), CURDATE(), 'A-001', ?, ?)",
            [`LG-OP-${Date.now()}`, realTxId, req.user.userId]
        );

        // อัปเดตยอดคงเหลือในมือ (Parent)
        const newRemainingQty = currentInHand - usedQty;
        if (newRemainingQty > 0) {
            await connection.query(
                "UPDATE equipment_list SET quantity = ? WHERE transaction_id = ? AND lot_id = ?",
                [newRemainingQty, transactionId, lotId]
            );
        } else {
            await connection.query("DELETE FROM equipment_list WHERE transaction_id = ? AND lot_id = ?", [transactionId, lotId]);
        }

        const [check] = await connection.query("SELECT COUNT(*) as itemCount FROM equipment_list WHERE transaction_id = ?", [transactionId]);
        if (check[0].itemCount === 0) {
            await connection.query("UPDATE transactions SET is_pending = 0 WHERE transaction_id = ?", [transactionId]);
        }

        await connection.commit();
        res.json({ success: true, message: "บันทึกสำเร็จ" });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("DEBUG ERROR:", error); 
        res.status(500).json({ error: error.sqlMessage || error.message });
    } finally {
        if (connection) connection.release();
    }
});

// API สำหรับ "คืนคลังทั้งหมด" ที่เหลืออยู่
app.post('/api/borrow/return-all', authenticateToken, async (req, res) => {
    // รับค่าที่จำเป็นเพิ่ม: equipmentId (เพื่อบันทึกประวัติการคืน)
    const { transactionId, lotId, qtyToReturn, equipmentId } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();

        const [txCheck] = await connection.query(
            "SELECT user_id FROM transactions WHERE transaction_id = ?", 
            [transactionId]
        );
        if (txCheck.length === 0 || txCheck[0].user_id !== req.user.userId) {
             throw new Error("ไม่อนุญาตให้ทำรายการ: คุณไม่ได้เป็นผู้ทำการเบิกรายการนี้");
        }

        await connection.beginTransaction();

        // 1. เพิ่มสต็อกกลับเข้าคลังกลาง (ตาราง lot)
        await connection.query(
            "UPDATE lot SET current_quantity = current_quantity + ? WHERE lot_id = ?", 
            [qtyToReturn, lotId]
        );

        // 2. บันทึกธุรกรรมการคืนใหม่ (RTN) เพื่อเก็บประวัติลง transactions
        const returnTxId = `RTN-${Date.now().toString().slice(-8)}`;
        await connection.query(
            `INSERT INTO transactions 
            (transaction_id, parent_transaction_id, transaction_type_id, date, time, user_id, is_pending) 
            VALUES (?, ?, 'T-RTN', CURDATE(), CURTIME(), ?, 0)`,
            [returnTxId, transactionId, req.user.userId]
        );

        // 3. บันทึกรายละเอียดการคืนลงใน equipment_list ของรายการคืนใหม่ (RTN)
        await connection.query(
            "INSERT INTO equipment_list (equipment_list_id, transaction_id, quantity, lot_id) VALUES (?, ?, ?, ?)",
            [`ELR-${Date.now().toString().slice(-5)}`, returnTxId, qtyToReturn, lotId]
        );

        // 4. บันทึก Log เวลาเปิด-ปิดตู้สำหรับการคืน
        await connection.query(
            "INSERT INTO accesslogs (log_id, time, date, action_type_id, transaction_id, user_id) VALUES (?, CURTIME(), CURDATE(), 'A-001', ?, ?)",
            [`LG-OP-${Date.now()}`, returnTxId, req.user.userId]
        );
        await connection.query(
            "INSERT INTO accesslogs (log_id, time, date, action_type_id, transaction_id, user_id) VALUES (?, CURTIME(), CURDATE(), 'A-002', ?, ?)",
            [`LG-CL-${Date.now() + 500}`, returnTxId, req.user.userId]
        );

        // อัปเดตยอดคงเหลือในมือของรายการเดิม
        await connection.query(
            "UPDATE equipment_list SET quantity = quantity - ? WHERE transaction_id = ? AND lot_id = ?",
            [qtyToReturn, transactionId, lotId]
        );

        // ถ้าเหลือ 0 หรือน้อยกว่า ให้ลบรายการเดิมทิ้ง
        const [checkRemaining] = await connection.query(
            "SELECT quantity FROM equipment_list WHERE transaction_id = ? AND lot_id = ?",
            [transactionId, lotId]
        );

        if (checkRemaining.length > 0 && checkRemaining[0].quantity <= 0) {
            await connection.query(
                "DELETE FROM equipment_list WHERE transaction_id = ? AND lot_id = ?",
                [transactionId, lotId]
            );
        }

        // ถ้าไม่มีอะไหล่เหลือค้างแล้ว ให้ปิดสถานะ is_pending เป็น 0
        const [checkTotal] = await connection.query(
            "SELECT COUNT(*) as itemCount FROM equipment_list WHERE transaction_id = ?", 
            [transactionId]
        );
        if (checkTotal[0].itemCount === 0) {
            await connection.query("UPDATE transactions SET is_pending = 0 WHERE transaction_id = ?", [transactionId]);
        }

        await connection.commit();
        res.json({ success: true, message: "คืนอะไหล่และอัปเดตยอดในมือเรียบร้อย" });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Return Error:", error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// Login (ตรวจสอบ Email + Password)
app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const [users] = await pool.execute("SELECT * FROM users WHERE email = ?", [email]);
        if (users.length === 0) return res.status(401).json({ message: "Email หรือ Password ไม่ถูกต้อง" });

        const user = users[0];
        const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
        
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

app.post("/api/register", async (req, res) => {
    const { email, password, fullname, position, phone_number, role_id } = req.body;
    
    if (!email || !password || !fullname || !role_id) {
        return res.status(400).json({ message: "กรุณากรอก Email, Password, Fullname และ Role ID" });
    }

    try {
        // ตรวจสอบ Email ซ้ำ
        const [existingUsers] = await pool.execute("SELECT user_id FROM users WHERE email = ?", [email]);
        if (existingUsers.length > 0) {
            return res.status(409).json({ message: "Email นี้ถูกใช้งานแล้ว" });
        }

        // Hashing รหัสผ่าน
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        const newUserId = `U-${Date.now().toString().slice(-10)}`;

        // บันทึกผู้ใช้ใหม่
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

// สร้าง QR Code สำหรับผู้ใช้ครั้งแรก (Setup 2FA)
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

// ตรวจสอบรหัส 6 หลัก 
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

app.get("/api/auth/me", authenticateToken, async (req, res) => {
    try {
        // req.user ได้มาจาก middleware authenticateToken
        const userIdFromToken = req.user.userId; 

        const [users] = await pool.execute(
            "SELECT user_id, email, fullname, position, phone_number, profile_img FROM users WHERE user_id = ?", 
            [userIdFromToken]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: "ไม่พบผู้ใช้งาน" });
        }

        const user = users[0];
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
        res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
    }
});

// Get Current User (Protected)
// API ตรวจสอบว่ามีอีเมลในระบบหรือไม่
app.post("/api/forgot-password/check", async (req, res) => {
    const { email } = req.body;
    try {
        const [users] = await pool.execute("SELECT email FROM users WHERE email = ?", [email]);
        if (users.length === 0) return res.status(404).json({ message: "ไม่พบผู้ใช้งานนี้ในระบบ" });
        res.json({ message: "พบบัญชีผู้ใช้" });
    } catch (error) {
        res.status(500).json({ message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
    }
});

// API ตรวจสอบรหัส OTP และสร้าง Reset Token ชั่วคราว
app.post("/api/forgot-password/verify-otp", async (req, res) => {
    const { email, token } = req.body;
    try {
        const [users] = await pool.execute("SELECT user_id, totp_secret FROM users WHERE email = ?", [email]);
        if (users.length === 0) return res.status(404).json({ message: "ไม่พบผู้ใช้งาน" });

        const user = users[0];
        
        // ตรวจสอบรหัส 6 หลักจากแอป Authenticator
        const verified = speakeasy.totp.verify({
            secret: user.totp_secret,
            encoding: 'base32',
            token: token,
            window: 1 
        });

        if (verified) {
            const resetToken = Buffer.from(`${user.user_id}-${Date.now()}`).toString('base64');
            res.json({ resetToken });
        } else {
            res.status(401).json({ message: "รหัส OTP ไม่ถูกต้อง" });
        }
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
});

// Reset Password 
app.post("/api/reset-password", async (req, res) => {
    const { token, newPassword } = req.body;
    try {
        const decoded = Buffer.from(token, 'base64').toString();
        
        const userId = decoded.slice(0, decoded.lastIndexOf('-')); 

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(newPassword, saltRounds);

        // อัปเดตลงคอลัมน์ password_hash 
        const [result] = await pool.execute(
            "UPDATE users SET password_hash = ? WHERE user_id = ?",
            [passwordHash, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "ไม่พบผู้ใช้งานหรือลิงก์ไม่ถูกต้อง" });
        }

        res.json({ message: "เปลี่ยนรหัสผ่านสำเร็จ" });
    } catch (error) {
        console.error("Reset Password Error:", error);
        res.status(500).json({ message: "ไม่สามารถเปลี่ยนรหัสผ่านได้" });
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
                e.equipment_id,
                et.equipment_name,
                et.unit,
                e.alert_quantity,
                -- 1. จำนวนคงเหลือจริงในคลัง (Lot)
                COALESCE(SUM(l.current_quantity), 0) AS quantity,
                
                -- 2. จำนวนทั้งหมด (คงเหลือ + ที่เบิกค้าง Pending ไว้)
                COALESCE(SUM(l.current_quantity), 0) + COALESCE((
                    SELECT SUM(el_sub.quantity)
                    FROM equipment_list el_sub
                    INNER JOIN transactions t_sub ON el_sub.transaction_id = t_sub.transaction_id
                    INNER JOIN lot l_sub ON el_sub.lot_id = l_sub.lot_id
                    WHERE l_sub.equipment_id = e.equipment_id 
                    AND t_sub.is_pending = 1
                ), 0) AS total_quantity,

                -- 3. จำนวนที่ใช้ไปแล้ว (Transaction ที่ปิด Job แล้ว)
                COALESCE((
                    SELECT SUM(el_used.quantity)
                    FROM equipment_list el_used
                    INNER JOIN transactions t_used ON el_used.transaction_id = t_used.transaction_id
                    INNER JOIN lot l_used ON el_used.lot_id = l_used.lot_id
                    WHERE l_used.equipment_id = e.equipment_id 
                    AND t_used.transaction_type_id = 'T-WTH'
                    AND t_used.is_pending = 0
                ), 0) AS used_quantity
            FROM equipment e
            JOIN equipment_type et ON e.equipment_type_id = et.equipment_type_id
            LEFT JOIN lot l ON e.equipment_id = l.equipment_id
            GROUP BY e.equipment_id, et.equipment_name, et.unit, e.alert_quantity
            ORDER BY et.equipment_name ASC
        `;

        const [rows] = await pool.query(sql);
        res.json(rows);

    } catch (err) {
        console.error("Report Chart Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// 1. API ดึงรายการเบิกอะไหล่ราคาสูงที่ยังไม่ได้กดรับทราบ
app.get('/api/alerts/high-value', async (req, res) => {
    try {
        const sql = `
            SELECT 
                t.transaction_id,
                t.transaction_type_id,
                tt.transaction_type_name,
                t.date,
                t.time,
                u.fullname as user_name,

                IF(m.machine_id IS NOT NULL, 
                    CONCAT(IFNULL(mt.machine_type_name, ''), ' - ', IFNULL(m.machine_supplier, ''), ' - ', IFNULL(m.machine_model, '')),
                    NULL
                ) as machine_name,

                t.machine_SN,         
                t.machine_number,     
                et.equipment_name,
                et.img,
                et.unit,
                el.quantity,
                l.price,
                (el.quantity * l.price) as total_value
            FROM transactions t
            JOIN transactions_type tt ON t.transaction_type_id = tt.transaction_type_id
            JOIN users u ON t.user_id = u.user_id
            LEFT JOIN machine m ON t.machine_id = m.machine_id 
            
            LEFT JOIN machine_type mt ON m.machine_type_id = mt.machine_type_id 

            JOIN equipment_list el ON t.transaction_id = el.transaction_id
            JOIN lot l ON el.lot_id = l.lot_id
            JOIN equipment e ON l.equipment_id = e.equipment_id
            JOIN equipment_type et ON e.equipment_type_id = et.equipment_type_id
            WHERE l.price > 5000 
              AND t.manager_acknowledged = 0
            ORDER BY t.date DESC, t.time DESC
        `;

        const [results] = await db.query(sql);
        res.json(results);
    } catch (err) {
        console.error("Database Error:", err);
        res.status(500).json({ message: "Internal Server Error", error: err.message });
    }
});

// 2. API สำหรับกดปุ่มติ๊กถูกเพื่อรับทราบรายการ
app.post('/api/alerts/acknowledge-high-value', async (req, res) => {
    const { transaction_id } = req.body;
    try {
        const sql = `UPDATE transactions SET manager_acknowledged = 1 WHERE transaction_id = ?`;
        await db.query(sql, [transaction_id]);
        res.json({ message: "Acknowledge successful" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.get('/api/machine', async (req, res) => {
    try {
        const sql = `
            SELECT 
                m.machine_id, 
                m.machine_supplier, 
                m.machine_model, 
                t.machine_type_name,
                t.machine_type_id
            FROM machine m
            LEFT JOIN machine_type t ON m.machine_type_id = t.machine_type_id
        `;
        const [rows] = await db.query(sql);
        res.json(rows);
    } catch (err) {
        console.log(err);
        res.status(500).send("Error retrieving machines");
    }
});

app.post('/api/machine', async (req, res) => {
    try {
        const { machine_id, machine_type_id, machine_supplier, machine_model } = req.body;

        const [existing] = await db.query("SELECT * FROM machine WHERE machine_id = ?", [machine_id]);
        if (existing.length > 0) {
            return res.status(400).send("รหัสเครื่องนี้มีอยู่แล้ว");
        }

        await db.query(
            "INSERT INTO machine (machine_id, machine_type_id, machine_supplier, machine_model) VALUES (?, ?, ?, ?)",
            [machine_id, machine_type_id, machine_supplier, machine_model]
        );
        res.send("Machine added successfully");
    } catch (err) {
        console.log(err);
        res.status(500).send("Error adding machine");
    }
});

app.get('/api/search/machines', async (req, res) => {
    const { term } = req.query;
    try {
        const sql = `
            SELECT m.machine_id, t.machine_type_name, m.machine_supplier, m.machine_model 
            FROM machine m
            JOIN machine_type t ON m.machine_type_id = t.machine_type_id
            WHERE m.machine_id LIKE ? 
               OR t.machine_type_name LIKE ? 
               OR m.machine_supplier LIKE ?
            LIMIT 10
        `;
        const [rows] = await db.query(sql, [`%${term}%`, `%${term}%`, `%${term}%`]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

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

app.get('/api/history/full', authenticateToken, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const userIdFromToken = req.user.userId;

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
                t.machine_number,
                t.machine_id,       
                t.repair_type_id,   
                t.department_id,
                rt.repair_type_name,
                
                IF(m.machine_id IS NOT NULL, 
                    CONCAT(IFNULL(mt.machine_type_name, ''), ' - ', IFNULL(m.machine_supplier, ''), ' - ', IFNULL(m.machine_model, '')),
                    NULL
                ) as machine_name,

                d.buildings,
                d.department_name,
                u.fullname, 
                u.profile_img, 
                t.user_id,
                (SELECT JSON_ARRAYAGG(
                    JSON_OBJECT('name', et.equipment_name, 'qty', el.quantity)
                )
                 FROM equipment_list el
                 INNER JOIN lot l ON el.lot_id = l.lot_id
                 INNER JOIN equipment e ON l.equipment_id = e.equipment_id
                 INNER JOIN equipment_type et ON e.equipment_type_id = et.equipment_type_id
                 WHERE el.transaction_id = t.transaction_id) as items_json,
                (SELECT time FROM accesslogs WHERE transaction_id = t.transaction_id AND action_type_id = 'A-001' LIMIT 1) as open_time,
                (SELECT time FROM accesslogs WHERE transaction_id = t.transaction_id AND action_type_id = 'A-002' LIMIT 1) as close_time
            FROM transactions t
            LEFT JOIN transactions_type tt ON t.transaction_type_id = tt.transaction_type_id
            LEFT JOIN users u ON t.user_id = u.user_id
            LEFT JOIN repair_type rt ON t.repair_type_id = rt.repair_type_id
            
            -- JOIN ตารางเครื่องมือ
            LEFT JOIN machine m ON t.machine_id = m.machine_id
            LEFT JOIN machine_type mt ON m.machine_type_id = mt.machine_type_id
            
            LEFT JOIN department d ON t.department_id = d.department_id
            WHERE t.user_id = ? `;

        const params = [userIdFromToken];
        if (startDate && endDate) {
            sql += " AND t.date BETWEEN ? AND ? ";
            params.push(startDate, endDate);
        }
        sql += ` ORDER BY t.date DESC, t.time DESC`;

        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (error) {
        console.error("Fetch History Error:", error.message);
        res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลประวัติ" });
    }
});

app.get('/api/history/manager/full', authenticateToken, async (req, res) => {
    try {
        let { startDate, endDate } = req.query;
        let sql = `
            SELECT 
                t.*, 
                tt.transaction_type_name as type_name, 
                rt.repair_type_name,
                
                -- รวมชื่อเครื่องมือ (Type - Supplier - Model) ให้แสดงผลสวยงามบน Dashboard
                IF(m.machine_id IS NOT NULL, 
                    CONCAT(IFNULL(mt.machine_type_name, ''), ' - ', IFNULL(m.machine_supplier, ''), ' - ', IFNULL(m.machine_model, '')),
                    NULL
                ) as machine_name,

                d.buildings,
                d.department_name,
                u.fullname, 
                u.profile_img,
                
                -- ดึงรายการอะไหล่เป็น JSON และจัดการกรณี NULL ให้เป็น Array ว่าง [] เสมอ
                IFNULL((
                    SELECT JSON_ARRAYAGG(
                        JSON_OBJECT('name', et.equipment_name, 'qty', el.quantity)
                    )
                    FROM equipment_list el
                    INNER JOIN lot l ON el.lot_id = l.lot_id
                    INNER JOIN equipment e ON l.equipment_id = e.equipment_id
                    INNER JOIN equipment_type et ON e.equipment_type_id = et.equipment_type_id
                    WHERE el.transaction_id = t.transaction_id
                ), '[]') as items_json,
                
                -- ดึงเวลาเปิด-ปิดตู้จากตาราง accesslogs
                (SELECT time FROM accesslogs WHERE transaction_id = t.transaction_id AND action_type_id = 'A-001' LIMIT 1) as open_time,
                (SELECT time FROM accesslogs WHERE transaction_id = t.transaction_id AND action_type_id = 'A-002' LIMIT 1) as close_time
                
            FROM transactions t
            LEFT JOIN transactions_type tt ON t.transaction_type_id = tt.transaction_type_id
            LEFT JOIN users u ON t.user_id = u.user_id
            LEFT JOIN repair_type rt ON t.repair_type_id = rt.repair_type_id
            LEFT JOIN machine m ON t.machine_id = m.machine_id
            LEFT JOIN machine_type mt ON m.machine_type_id = mt.machine_type_id 
            LEFT JOIN department d ON t.department_id = d.department_id
            WHERE 1=1 `; 

        const params = [];
        
        if (startDate && endDate && 
            startDate !== 'undefined' && endDate !== 'undefined' && 
            startDate !== 'null' && endDate !== 'null' && startDate.trim() !== '') {
            
            sql += " AND DATE(t.date) BETWEEN ? AND ? "; 
            params.push(startDate, endDate);
        }
        
        sql += ` ORDER BY t.date DESC, t.time DESC`;

        const [rows] = await pool.query(sql, params);
        
        res.json(rows);
        
    } catch (error) { 
        console.error("Backend Error:", error.message);
        res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลสำหรับผู้บริหาร" }); 
    }
});

app.get('/api/history/manager/daily', authenticateToken, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        let sql = `
            SELECT 
                t.transaction_id, 
                tt.transaction_type_name as type_name,
                t.transaction_type_id,
                t.date, 
                t.time,
                u.fullname, 
                t.machine_SN,
                rt.repair_type_name, 
                d.buildings,         
                (SELECT JSON_ARRAYAGG(
                    JSON_OBJECT('name', et.equipment_name, 'qty', el.quantity)
                )
                 FROM equipment_list el
                 INNER JOIN lot l ON el.lot_id = l.lot_id
                 INNER JOIN equipment e ON l.equipment_id = e.equipment_id
                 INNER JOIN equipment_type et ON e.equipment_type_id = et.equipment_type_id
                 WHERE el.transaction_id = t.transaction_id) as items_json
            FROM transactions t
            LEFT JOIN transactions_type tt ON t.transaction_type_id = tt.transaction_type_id
            LEFT JOIN users u ON t.user_id = u.user_id
            LEFT JOIN repair_type rt ON t.repair_type_id = rt.repair_type_id 
            LEFT JOIN department d ON t.department_id = d.department_id    
            WHERE t.date BETWEEN ? AND ?
            ORDER BY t.date DESC, t.time DESC
        `;

        const [rows] = await pool.query(sql, [startDate, endDate]);
        res.json(rows);
    } catch (error) {
        console.error("Fetch Manager Daily Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/machine/:sn', async (req, res) => {
    try {
        const sn = req.params.sn;
        const { machine_type_id, machine_supplier, machine_model } = req.body;

        await db.query(
            "UPDATE machine SET machine_type_id = ?, machine_supplier = ?, machine_model = ? WHERE machine_id = ?", 
            [machine_type_id, machine_supplier, machine_model, sn]
        );
        res.send("Machine updated successfully");
    } catch (err) {
        console.log(err);
        res.status(500).send("Error updating machine");
    }
});

app.delete('/api/machine/:sn', async (req, res) => {
    try {
        const sn = req.params.sn;
        await db.query("DELETE FROM machine WHERE machine_id = ?", [sn]);
        res.send("Machine deleted successfully");

    } catch (err) {
        console.log(err);
        res.status(500).send("Error deleting machine");
    }
});

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

app.get("/api/report/usage", async (req, res) => {
    try {
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

app.get("/api/alerts/expire", async (req, res) => {
    const sql = `
        SELECT 
            l.lot_id,
            l.equipment_id,
            et.equipment_name,
            e.model_size,
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
            e.model_size,
            e.alert_quantity,
            COALESCE(SUM(l.current_quantity), 0) as total_stock
        FROM equipment e
        LEFT JOIN lot l ON e.equipment_id = l.equipment_id
        JOIN equipment_type et ON e.equipment_type_id = et.equipment_type_id
        WHERE l.current_quantity > 0
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

// 1. เปิดให้เข้าถึงรูปภาพในโฟลเดอร์ uploads ได้ผ่าน URL
app.use('/profile-img', express.static(path.join(__dirname, 'uploads')));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 2. ตั้งค่า Multer สำหรับ Save ไฟล์
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); 
    },
    filename: (req, file, cb) => {
        cb(null,  Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// 3. API สำหรับอัปโหลดรูป 
app.post("/api/upload", upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
    }
    
    res.json({ filename: req.file.filename });
});

app.get("/api/inventory", async (req, res) => {
    try {
        const sql = `
            SELECT 
                l.lot_id, l.import_date, l.expiry_date, l.current_quantity, l.price,
                s.supplier_id, s.supplier_name, s.contact,
                e.equipment_id, e.model_size, e.alert_quantity,
                et.equipment_type_id, et.equipment_name, et.img, et.unit
            FROM equipment e
            JOIN equipment_type et ON e.equipment_type_id = et.equipment_type_id
            LEFT JOIN lot l ON e.equipment_id = l.equipment_id AND l.current_quantity > 0
            LEFT JOIN supplier s ON l.supplier_id = s.supplier_id
            ORDER BY e.equipment_id DESC, l.lot_id DESC
        `;
        const [results] = await db.query(sql);
        res.json(results);
    } catch (err) {
        console.error("Error fetching inventory:", err);
        res.status(500).send(err);
    }
});

// API สำหรับเช็คอะไหล่ซ้ำ
app.post("/api/equipment/check-duplicate", async (req, res) => {
    const { equipment_name, model_size } = req.body;

    try {
        const sql = `
            SELECT e.equipment_id, et.equipment_name, e.model_size
            FROM equipment e
            JOIN equipment_type et ON e.equipment_type_id = et.equipment_type_id
            WHERE et.equipment_name = ? AND e.model_size = ?
        `;
        const [results] = await db.query(sql, [equipment_name, model_size]);

        if (results.length > 0) {
            // เจอข้อมูลซ้ำ
            return res.json({ 
                isDuplicate: true, 
                equipment_id: results[0].equipment_id,
                message: `มีอะไหล่ชื่อ "${equipment_name}" ขนาด/รุ่น "${model_size}" อยู่ในระบบแล้ว (รหัสอะไหล่: ${results[0].equipment_id}) คุณต้องการเปลี่ยนไปเพิ่มล็อตในรหัสอะไหล่นี้แทนใช่ไหม?`
            });
        }

        // ไม่ซ้ำ ให้บันทึกต่อได้
        res.json({ isDuplicate: false });

    } catch (error) {
        console.error("Error checking duplicate:", error);
        res.status(500).json({ error: error.message });
    }
});

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

app.post("/api/inventory/add", async (req, res) => {
    const conn = await db.getConnection(); 
    try {
        await conn.beginTransaction(); 

        const { 
            isNewSupplier, isNewType, isNewEquipment,
            lotData, supplierData, typeData, equipmentData 
        } = req.body;

        let finalSupplierId = supplierData.supplier_id;
        let finalTypeId = typeData.equipment_type_id;
        let finalEquipmentId = equipmentData.equipment_id;

        if (isNewSupplier) {
            // เช็คก่อนว่า ID ซ้ำไหม
            const [dupSup] = await conn.query("SELECT supplier_id FROM supplier WHERE supplier_id = ?", [supplierData.supplier_id]);
            if (dupSup.length > 0) throw new Error(`Supplier ID ${supplierData.supplier_id} มีอยู่แล้ว`);

            await conn.query(
                "INSERT INTO supplier (supplier_id, supplier_name, contact) VALUES (?, ?, ?)",
                [supplierData.supplier_id, supplierData.supplier_name, supplierData.contact]
            );
        }

        if (isNewType) {
            const [dupType] = await conn.query("SELECT equipment_type_id FROM equipment_type WHERE equipment_type_id = ?", [typeData.equipment_type_id]);
            if (dupType.length > 0) throw new Error(`Type ID ${typeData.equipment_type_id} มีอยู่แล้ว`);

            await conn.query(
                "INSERT INTO equipment_type (equipment_type_id, equipment_name, img, unit) VALUES (?, ?, ?, ?)",
                [typeData.equipment_type_id, typeData.equipment_name, typeData.img, typeData.unit]
            );
        }

        if (isNewEquipment) {
            const [dupEq] = await conn.query("SELECT equipment_id FROM equipment WHERE equipment_id = ?", [equipmentData.equipment_id]);
            if (dupEq.length > 0) throw new Error(`Equipment ID ${equipmentData.equipment_id} มีอยู่แล้ว`);

            await conn.query(
                "INSERT INTO equipment (equipment_id, alert_quantity, model_size, equipment_type_id) VALUES (?, ?, ?, ?)",
                [equipmentData.equipment_id, equipmentData.alert_quantity, equipmentData.model_size, finalTypeId]
            );
        }

        const [lastLot] = await conn.query("SELECT lot_id FROM lot ORDER BY lot_id DESC LIMIT 1");
        let newLotId = "lot-00001";
        if (lastLot.length > 0) {
            const lastId = lastLot[0].lot_id; 
            const numPart = parseInt(lastId.split('-')[1]); 
            newLotId = `lot-${String(numPart + 1).padStart(5, '0')}`; 
        }

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

app.put("/api/inventory/update/:lot_id", async (req, res) => {
    const lot_id = req.params.lot_id;
    const conn = await db.getConnection();
    
    try {
        await conn.beginTransaction();

        const { lotData, supplierData, typeData, equipmentData } = req.body;

        await conn.query(
            "UPDATE supplier SET supplier_name=?, contact=? WHERE supplier_id=?",
            [supplierData.supplier_name, supplierData.contact, supplierData.supplier_id]
        );

        await conn.query(
            "UPDATE equipment_type SET equipment_name=?, img=?, unit=? WHERE equipment_type_id=?",
            [typeData.equipment_name, typeData.img, typeData.unit, typeData.equipment_type_id]
        );

        await conn.query(
            "UPDATE equipment SET alert_quantity=?, model_size=? WHERE equipment_id=?",
            [equipmentData.alert_quantity, equipmentData.model_size, equipmentData.equipment_id]
        );

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

app.delete("/api/inventory/:id", async (req, res) => {
    try {
        await db.query("DELETE FROM lot WHERE lot_id = ?", [req.params.id]);
        res.json({ message: "Lot deleted successfully" });
    } catch (err) {
        res.status(500).send(err);
    }
});

app.get("/api/supplier", async (req, res) => {
    try {
        const [results] = await db.query("SELECT * FROM supplier ORDER BY supplier_id ASC");
        res.json(results);
    } catch (err) {
        console.log(err);
        res.status(500).send("Error retrieving machines");
    }
});

app.post("/api/supplier", async (req, res) => {
    const { supplier_name, contact } = req.body;
    
    if (!supplier_name) {
        return res.status(400).json({ message: "Please provide Supplier Name" });
    }

    try {
        // เช็คก่อนว่า ID ซ้ำไหม
        const sql = "INSERT INTO supplier (supplier_name, contact) VALUES (?, ?)";
        const [result] = await db.query(sql, [supplier_name, contact]);

        res.json({ message: "Supplier added successfully", id: result.insertId });
    } catch (err) {
        console.log(err);
        res.status(500).send("Error adding supplier");
    }
});

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

app.get("/api/transactions", async (req, res) => {
    const sql = `
        SELECT 
            t.transaction_id, 
            t.parent_transaction_id,  
            t.date,
            t.time, 
            t.machine_number,
            t.machine_SN,
            tt.transaction_type_name, 
            u.fullname, 
            mt.machine_type_name, 
            d.department_name,
            d.buildings,
            (SELECT COUNT(*) FROM equipment_list el WHERE el.transaction_id = t.transaction_id) as item_count 
        FROM transactions t 
        LEFT JOIN transactions_type tt ON t.transaction_type_id = tt.transaction_type_id 
        LEFT JOIN users u ON t.user_id = u.user_id 
        LEFT JOIN machine m ON t.machine_id = m.machine_id 
        LEFT JOIN machine_type mt ON m.machine_type_id = mt.machine_type_id
        LEFT JOIN department d ON d.department_id = t.department_id
        ORDER BY t.date DESC, t.transaction_id DESC;
    `;
    try {
        const [results] = await db.query(sql); 
        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).send(err);
    }
});

app.get("/api/transactions/:id/items", async (req, res) => {
    const sql = `
        SELECT el.*, et.equipment_name, et.unit, e.model_size 
        FROM equipment_list el
        JOIN lot l ON el.lot_id = l.lot_id
        JOIN equipment e ON l.equipment_id = e.equipment_id
        JOIN equipment_type et ON et.equipment_type_id = e.equipment_type_id
        WHERE el.transaction_id = ?
    `;
    try {
        const [results] = await db.query(sql, [req.params.id]);
        res.json(results);
    } catch (err) {
        console.error("Fetch Items Error:", err);
        res.status(500).send(err);
    }
});

app.get("/api/transaction-options", async (req, res) => {
    try {
        const [users] = await db.query("SELECT user_id, fullname FROM users");
        const [machines] = await db.query(`
            SELECT 
                m.machine_id, 
                mt.machine_type_name,
                m.machine_supplier, 
                m.machine_model 
            FROM machine m
            LEFT JOIN machine_type mt ON m.machine_type_id = mt.machine_type_id
        `);
        const [types] = await db.query("SELECT transaction_type_id, transaction_type_name FROM transactions_type"); 
        const [equipments] = await db.query("SELECT equipment_id, model_size FROM equipment");
        const [lots] = await db.query("SELECT l.lot_id,l.equipment_id,e.model_size,e.equipment_type_id,et.equipment_name FROM lot l JOIN equipment e ON l.equipment_id = e.equipment_id JOIN equipment_type et ON e.equipment_type_id = et.equipment_type_id");
        const [department] = await db.query("SELECT department_id,department_name,buildings FROM department;");
        const [repair_type] = await db.query("SELECT repair_type_id,repair_type_name FROM repair_type;");
        
        res.json({ users, machines, types, equipments, lots, department, repair_type });
    } catch (err) {
        console.error(err);
        res.status(500).send(err);
    }
});

async function getNextTransactionId(prefix, connection) {
    const [rows] = await connection.query(
        "SELECT transaction_id FROM transactions WHERE transaction_id LIKE ? ORDER BY transaction_id DESC LIMIT 1",
        [`${prefix}-%`]
    );

    let nextNumber = rows.length > 0
        ? parseInt(rows[0].transaction_id.split('-')[1]) + 1
        : 1;

    return `${prefix}-${nextNumber.toString().padStart(8, '0')}`;
}

async function getNextEquipmentListId(connection) {
    const [rows] = await connection.query(
        "SELECT equipment_list_id FROM equipment_list ORDER BY equipment_list_id DESC LIMIT 1"
    );

    let nextNumber = rows.length > 0
        ? parseInt(rows[0].equipment_list_id.split('-')[1]) + 1
        : 1;

    return `EL-${nextNumber.toString().padStart(8, '0')}`;
}

app.post('/api/transactions', async (req, res) => {
    const { 
        type_mode, user_id, machine_id, date, time, items,
        parent_transaction_id, machine_number, machine_SN, 
        repair_type_id, department_id, manager_acknowledged
    } = req.body;
    
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        let prefix = '';
        let typeId = '';
        let is_pending = 0;
        
        // จัดการค่าที่เป็นค่าว่าง ให้กลายเป็น null เพื่อไม่ให้ Database Error
        let finalMachineId = machine_id ? machine_id : null;
        let finalParentTxId = parent_transaction_id ? parent_transaction_id : null;
        let finalRepairTypeId = repair_type_id ? repair_type_id : null;
        let finalDeptId = department_id ? department_id : null;
        let finalMachineNumber = machine_number ? machine_number : null;
        let finalMachineSN = machine_SN ? machine_SN : null;

        if (type_mode === 'withdraw') { // เบิกปกติ
            prefix = 'WTH';
            typeId = 'T-WTH';
        } else if (type_mode === 'return') { // คืน
            prefix = 'RTN';
            typeId = 'T-RTN';

        } else if (type_mode === 'borrow') { // เบิกล่วงหน้า (Pending)
            prefix = 'PEND';
            typeId = 'T-WTH';
            is_pending = 1;
      
        }

        const transactionId = await getNextTransactionId(prefix, connection)

        const insertTxSql = `
            INSERT INTO transactions (
                transaction_id, parent_transaction_id, transaction_type_id, 
                date, time, user_id, machine_id, machine_number, machine_SN, 
                repair_type_id, department_id, is_pending, manager_acknowledged
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await connection.query(insertTxSql, [
            transactionId, finalParentTxId, typeId, date, time, user_id, 
            finalMachineId, finalMachineNumber, finalMachineSN, 
            finalRepairTypeId, finalDeptId, is_pending, (manager_acknowledged || 0)
        ]);

        for (const item of items) {
            const listId = await getNextEquipmentListId(connection);
            
            await connection.query(
                "INSERT INTO equipment_list (equipment_list_id, transaction_id,lot_id, quantity) VALUES (?, ?, ?, ?)",
                [listId, transactionId, item.lot_id, item.quantity]
            );

            // อัปเดตสต็อกในตาราง lot (เบิก/เบิกล่วงหน้า = ลบ, คืน = บวก)
            const stockChange = (type_mode === 'return') ? item.quantity : -item.quantity;
            await connection.query(
                "UPDATE lot SET current_quantity = current_quantity + ? WHERE lot_id = ?",
                [stockChange, item.lot_id]
            );
        }

        await connection.commit();
        res.status(201).json({ success: true, transactionId });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Insert Transaction Error:", error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.put('/api/transactions/:id', async (req, res) => {
    const transactionId = req.params.id;
    const { 
        type_mode, user_id, machine_id, date, time, items,
        parent_transaction_id, machine_number, machine_SN, 
        repair_type_id, department_id, manager_acknowledged
    } = req.body;
    
    let connection;

    try {
        connection = await pool.getConnection(); 
        await connection.beginTransaction();

        let typeId = '';
        let is_pending = 0;
        
        // แปลงค่าว่างเป็น null
        let finalMachineId = machine_id ? machine_id : null;
        let finalParentTxId = parent_transaction_id ? parent_transaction_id : null;
        let finalRepairTypeId = repair_type_id ? repair_type_id : null;
        let finalDeptId = department_id ? department_id : null;
        let finalMachineNumber = machine_number ? machine_number : null;
        let finalMachineSN = machine_SN ? machine_SN : null;

        // เช็คประเภท
        if (type_mode === 'withdraw') { typeId = 'T-WTH'; } 
        else if (type_mode === 'return') { typeId = 'T-RTN'; } 
        else if (type_mode === 'borrow') { typeId = 'T-WTH'; is_pending = 1; }

        const updateTxSql = `
            UPDATE transactions 
            SET parent_transaction_id = ?, transaction_type_id = ?, date = ?, time = ?, 
                user_id = ?, machine_id = ?, machine_number = ?, machine_SN = ?, 
                repair_type_id = ?, department_id = ?, is_pending = ?, manager_acknowledged = ?
            WHERE transaction_id = ?
        `;
        await connection.query(updateTxSql, [
            finalParentTxId, typeId, date, time, user_id, 
            finalMachineId, finalMachineNumber, finalMachineSN, 
            finalRepairTypeId, finalDeptId, is_pending, (manager_acknowledged || 0),
            transactionId
        ]);

        // จัดการรายการอะไหล่และสต็อก
        // คืนสต็อกเก่า -> ลบรายการเก่า -> ใส่รายการใหม่ -> อัปเดตสต็อกใหม่
        // ดึงรายการเก่ามาคืนสต็อก
        const [oldItems] = await connection.query("SELECT lot_id, quantity FROM equipment_list WHERE transaction_id = ?", [transactionId]);
        const [oldTx] = await connection.query("SELECT transaction_type_id FROM transactions WHERE transaction_id = ?", [transactionId]);
        const isOldReturn = oldTx[0]?.transaction_type_id === 'T-RTN';

        for (const oldItem of oldItems) {
            const revertStock = isOldReturn ? -oldItem.quantity : oldItem.quantity; 
            await connection.query("UPDATE lot SET current_quantity = current_quantity + ? WHERE lot_id = ?", [revertStock, oldItem.lot_id]);
        }

        await connection.query("DELETE FROM equipment_list WHERE transaction_id = ?", [transactionId]);

        for (const item of items) {
            const listId = await getNextEquipmentListId(connection); 
            
            await connection.query(
                "INSERT INTO equipment_list (equipment_list_id, transaction_id, lot_id, quantity) VALUES (?, ?, ?, ?)",
                [listId, transactionId, item.lot_id, item.quantity]
            );

            const stockChange = (type_mode === 'return') ? item.quantity : -item.quantity;
            await connection.query("UPDATE lot SET current_quantity = current_quantity + ? WHERE lot_id = ?", [stockChange, item.lot_id]);
        }

        await connection.commit();
        res.status(200).json({ success: true, message: "อัปเดตข้อมูลสำเร็จ" });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Update Transaction Error:", error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.get("/api/roles", async (req, res) => {
    try {
        const [results] = await db.query("SELECT * FROM role");
        res.json(results);
    } catch (err) {
        res.status(500).send(err);
    }
});

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

app.post("/api/users", async (req, res) => {
    const { fullname, email, password, position, phone_number, role_id, profile_img } = req.body; 
    
    try {
        const [existing] = await db.query("SELECT user_id FROM users WHERE email = ?", [email]);
        if (existing.length > 0) {
            return res.status(400).json({ message: "อีเมลนี้มีผู้ใช้งานแล้ว" });
        }

        // เข้ารหัสรหัสผ่าน
        const hashedPassword = await bcrypt.hash(password, 10);

        // สร้าง user_id
        const user_id = 'U-' + Date.now(); 

        const sql = `
            INSERT INTO users 
            (user_id, email, password_hash, fullname, position, phone_number, role_id, profile_img) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            user_id, 
            email, 
            hashedPassword, 
            fullname, 
            position, 
            phone_number, 
            role_id, 
            profile_img || null 
        ];

        await db.query(sql, params);

        res.json({ message: "สร้างผู้ใช้งานสำเร็จ" });
    } catch (err) {
        console.error("Insert User Error:", err);
        res.status(500).send(err);
    }
});

app.put("/api/users/:id", async (req, res) => {
    const { fullname, position, phone_number, role_id, password, profile_img } = req.body; 
    const user_id = req.params.id;

    try {
        let sql = `
            UPDATE users 
            SET fullname=?, position=?, phone_number=?, role_id=?, profile_img=? 
            WHERE user_id=?
        `;
        let params = [fullname, position, phone_number, role_id, profile_img || null, user_id];

        // ถ้า User มีการพิมพ์ password ใหม่มาด้วย ให้ Hash แล้วอัปเดตทับ
        if (password && password.trim() !== "") {
            const hashedPassword = await bcrypt.hash(password, 10); 
            
            sql = `
                UPDATE users 
                SET fullname=?, position=?, phone_number=?, role_id=?, profile_img=?, password_hash=? 
                WHERE user_id=?
            `;
            params = [fullname, position, phone_number, role_id, profile_img || null, hashedPassword, user_id];
        }

        await db.query(sql, params);
        res.json({ message: "แก้ไขข้อมูลสำเร็จ" });
    } catch (err) {
        console.error("Update User Error:", err);
        res.status(500).send(err);
    }
});

app.put('/api/change-passwordENG', authenticateToken, async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.userId || req.user.user_id; 
    if(!userId){
        return res.status(400).json({ message: "ไม่พบข้อมูลผู้ใช้งาน" });
    }
    try {
        const [users] = await pool.execute(
            'SELECT password_hash FROM users WHERE user_id = ?', 
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: "ไม่พบผู้ใช้งาน" });
        }

        const user = users[0];

        const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
        
        if (!isMatch) {
            return res.status(400).json({ message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedNewPassword = await bcrypt.hash(newPassword, salt);

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

app.post('/api/equipment/add', async (req, res) => {
    const { equipment_id, equipment_type_id, equipment_name, model_size, alert_quantity, unit, img } = req.body;
    let connection;
    
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [existingType] = await connection.query("SELECT * FROM equipment_type WHERE equipment_type_id = ?", [equipment_type_id]);
        
        if (existingType.length === 0) {
            await connection.query(
                "INSERT INTO equipment_type (equipment_type_id, equipment_name, unit, img) VALUES (?, ?, ?, ?)",
                [equipment_type_id, equipment_name, unit, img || null]
            );
        } else {
            await connection.query(
                "UPDATE equipment_type SET equipment_name = ?, unit = ?, img = COALESCE(?, img) WHERE equipment_type_id = ?",
                [equipment_name, unit, img || null, equipment_type_id]
            );
        }

        const [existingEq] = await connection.query("SELECT * FROM equipment WHERE equipment_id = ?", [equipment_id]);
        if (existingEq.length > 0) {
            throw new Error(`รหัสอะไหล่ ${equipment_id} มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น`);
        }

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

app.put('/api/equipment/update/:id', async (req, res) => {
    const equipment_id_param = req.params.id;
    const { equipment_type_id, equipment_name, model_size, alert_quantity, unit, img } = req.body;
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        await connection.query(
            "UPDATE equipment SET equipment_type_id = ?, model_size = ?, alert_quantity = ? WHERE equipment_id = ?",
            [equipment_type_id, model_size, alert_quantity, equipment_id_param]
        );

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

app.post('/api/inventory/add-lot', async (req, res) => {
    const { lot_id, equipment_id, supplier_id, import_date, expiry_date, current_quantity, price } = req.body;
    let connection;

    try {
        connection = await pool.getConnection();

        const [existingLot] = await connection.query("SELECT * FROM lot WHERE lot_id = ?", [lot_id]);
        if (existingLot.length > 0) {
            return res.status(400).json({ error: `รหัส Lot ${lot_id} มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น` });
        }

        if (supplier_id) {
            const [existingSupplier] = await connection.query("SELECT * FROM supplier WHERE supplier_id = ?", [supplier_id]);
            if (existingSupplier.length === 0) {
                 return res.status(400).json({ error: `ไม่พบข้อมูลบริษัทรหัส ${supplier_id} ในระบบ` });
            }
        }

        const sql = `
            INSERT INTO lot (lot_id, equipment_id, supplier_id, import_date, expiry_date, current_quantity, price) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
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

app.get('/api/report/accesslogs', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT 
                t.transaction_id, 
                t.date, 
                t.time, 
                u.fullname, 
                rt.repair_type_name, 
                d.buildings, 
                d.department_name, 
                mt.machine_type_name,
                t.machine_number, 
                t.machine_SN,
                (SELECT JSON_ARRAYAGG(
                    JSON_OBJECT('name', et.equipment_name, 'qty', el.quantity)
                 ) 
                 FROM equipment_list el 
                 INNER JOIN lot l ON el.lot_id = l.lot_id 
                 INNER JOIN equipment e ON l.equipment_id = e.equipment_id 
                 INNER JOIN equipment_type et ON e.equipment_type_id = et.equipment_type_id 
                 WHERE el.transaction_id = t.transaction_id) as items_json,
                (SELECT time FROM accesslogs WHERE transaction_id = t.transaction_id AND action_type_id = 'A-001' ORDER BY time DESC LIMIT 1) as open_time,
                (SELECT time FROM accesslogs WHERE transaction_id = t.transaction_id AND action_type_id = 'A-002' ORDER BY time DESC LIMIT 1) as close_time
            FROM transactions t
            LEFT JOIN users u ON t.user_id = u.user_id
            LEFT JOIN repair_type rt ON t.repair_type_id = rt.repair_type_id
            LEFT JOIN department d ON t.department_id = d.department_id
            LEFT JOIN machine m ON t.machine_id = m.machine_id
            LEFT JOIN machine_type mt ON m.machine_type_id = mt.machine_type_id
            ORDER BY t.date DESC, t.time DESC
            LIMIT 200
        `;
        const [rows] = await connection.query(sql);
        res.json(rows);
    } catch (error) {
        console.error("Report Access Logs Error:", error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.post('/api/departments', async (req, res) => {
    const { department_id, department_name, buildings } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = "INSERT INTO department (department_id, department_name, buildings) VALUES (?, ?, ?)";
        await connection.query(sql, [department_id, department_name, buildings]);
        res.status(201).json({ message: "เพิ่มหน่วยงานสำเร็จ" });
    } catch (error) {
        console.error("Add Department Error:", error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.put('/api/departments/:id', async (req, res) => {
    const { id } = req.params;
    const { department_name, buildings } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = "UPDATE department SET department_name = ?, buildings = ? WHERE department_id = ?";
        await connection.query(sql, [department_name, buildings, id]);
        res.json({ message: "อัปเดตข้อมูลหน่วยงานสำเร็จ" });
    } catch (error) {
        console.error("Update Department Error:", error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.delete('/api/departments/:id', async (req, res) => {
    const { id } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = "DELETE FROM department WHERE department_id = ?";
        await connection.query(sql, [id]);
        res.json({ message: "ลบหน่วยงานสำเร็จ" });
    } catch (error) {
        console.error("Delete Department Error:", error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

//app.use(express.static(path.join(__dirname, 'dist')));

//app.get(/.*/, (req, res) => {
//    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
//});

server.listen(PORT, () => {
    console.log(`🚀 Backend server is running on http://localhost:${PORT}`);
    console.log(`    (Ready to command ESP via MQTT Broker)`);
});