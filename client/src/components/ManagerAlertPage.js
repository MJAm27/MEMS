import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { 
    FaClock, 
    FaBoxOpen, 
    FaExclamationTriangle, 
    FaDollarSign 
} from "react-icons/fa";
import "./AlertPage.css"; // ใช้ CSS ร่วมกับแอดมินเพื่อให้หน้าตาเหมือนกัน

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:3001";

function ManagerAlertPage() {
    // กำหนด Tab ให้ตรงกับแอดมิน (expire, stock) และเพิ่ม expensive สำหรับ manager
    const [activeTab, setActiveTab] = useState("expire"); 
    const [expireList, setExpireList] = useState([]);
    const [stockList, setStockList] = useState([]);
    const [expensiveList, setExpensiveList] = useState([]); // ข้อมูลราคาแพง
    const [loading, setLoading] = useState(true);

    // ดึงข้อมูลจาก API ชุดเดียวกับที่แอดมินใช้
    const fetchAlerts = useCallback(async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            const [expireRes, stockRes, expensiveRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/alerts/expire`, { headers }),
                axios.get(`${API_BASE_URL}/api/alerts/low-stock`, { headers }),
                axios.get(`${API_BASE_URL}/api/alerts/expensive-usage`, { headers }) // API เพิ่มเติมสำหรับ Manager
            ]);

            setExpireList(expireRes.data);
            setStockList(stockRes.data);
            setExpensiveList(expensiveRes.data);
        } catch (err) {
            console.error("Error fetching alerts:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAlerts();
    }, [fetchAlerts]);

    // ฟังก์ชันแปลงวันที่ (ใช้ logic เดียวกับ Admin)
    const formatDate = (dateString) => {
        if (!dateString) return "-";
        const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
        return new Date(dateString).toLocaleDateString('th-TH', options);
    };

    return (
        <div className="alert-page-container">
            <h2 className="page-title">ศูนย์แจ้งเตือนสำหรับผู้จัดการ</h2>

            {/* ส่วน Tab เลือกดูข้อมูล 3 อย่าง */}
            <div className="alert-tabs">
                <button 
                    className={`alert-tab-card ${activeTab === "expire" ? "active" : ""}`}
                    onClick={() => setActiveTab("expire")}
                >
                    <div className="icon-circle expire-icon"><FaClock /></div>
                    <div className="tab-text">
                        <h3>อะไหล่ใกล้หมดอายุ</h3>
                        <span className="badge-count">{expireList.length} รายการ</span>
                    </div>
                </button>

                <button 
                    className={`alert-tab-card ${activeTab === "stock" ? "active" : ""}`}
                    onClick={() => setActiveTab("stock")}
                >
                    <div className="icon-circle stock-icon"><FaBoxOpen /></div>
                    <div className="tab-text">
                        <h3>อะไหล่คงคลังน้อย</h3>
                        <span className="badge-count">{stockList.length} รายการ</span>
                    </div>
                </button>

                <button 
                    className={`alert-tab-card ${activeTab === "expensive" ? "active" : ""}`}
                    onClick={() => setActiveTab("expensive")}
                >
                    <div className="icon-circle expensive-icon" style={{backgroundColor: '#3498db'}}><FaDollarSign /></div>
                    <div className="tab-text">
                        <h3>การใช้ราคาแพง</h3>
                        <span className="badge-count">{expensiveList.length} รายการ</span>
                    </div>
                </button>
            </div>

            <div className="alert-content-header">
                <h3>แจ้งเตือน: {
                    activeTab === "expire" ? "ใกล้หมดอายุ" : 
                    activeTab === "stock" ? "คงคลังน้อย" : "รายการที่มีมูลค่าสูง"
                }</h3>
            </div>

            {loading ? (
                <p className="loading-text">กำลังโหลดข้อมูล...</p>
            ) : (
                <div className="alert-list">
                    {/* 1. อะไหล่ใกล้หมดอายุ (Logic เดียวกับ Admin) */}
                    {activeTab === "expire" && (
                        expireList.length > 0 ? expireList.map((item) => (
                            <div key={item.lot_id} className="alert-item-card">
                                <div className="item-image">
                                    <img src={item.img || "https://via.placeholder.com/150"} alt={item.equipment_name} />
                                </div>
                                <div className="item-details">
                                    <h4 className="text-danger">จำนวนใน Lot : {item.current_quantity} ชิ้น</h4>
                                    <h3>{item.equipment_name}</h3>
                                    <p><strong>Lot ID:</strong> {item.lot_id}</p>
                                    <p><strong>วันหมดอายุ:</strong> {formatDate(item.expiry_date)}</p>
                                    <p className="warning-text"><FaExclamationTriangle /> เหลืออีก {item.days_remaining} วัน</p>
                                </div>
                            </div>
                        )) : <p className="no-data">ไม่มีรายการแจ้งเตือน</p>
                    )}

                    {/* 2. อะไหล่คงคลังน้อย (Logic เดียวกับ Admin) */}
                    {activeTab === "stock" && (
                        stockList.length > 0 ? stockList.map((item) => (
                            <div key={item.equipment_id} className="alert-item-card">
                                <div className="item-image">
                                    <img src={item.img || "https://via.placeholder.com/150"} alt={item.equipment_name} />
                                </div>
                                <div className="item-details">
                                    <h4 className="text-danger">เหลือปัจจุบัน : {item.total_quantity} ชิ้น</h4>
                                    <h3>{item.equipment_name}</h3>
                                    <p><strong>จุดสั่งซื้อ (Alert):</strong> {item.alert_quantity} ชิ้น</p>
                                    <p className="warning-text">กรุณาสั่งซื้อเพิ่มเพื่อป้องกันของขาดคลัง</p>
                                </div>
                            </div>
                        )) : <p className="no-data">ไม่มีรายการแจ้งเตือน</p>
                    )}

                    {/* 3. รายการราคาแพง (ข้อมูลเฉพาะของ Manager) */}
                    {activeTab === "expensive" && (
                        expensiveList.length > 0 ? expensiveList.map((item, idx) => (
                            <div key={idx} className="alert-item-card expensive">
                                <div className="item-details">
                                    <h4 style={{color: '#3498db'}}>มูลค่ารวม : {item.total_price?.toLocaleString()} บาท</h4>
                                    <h3>{item.equipment_name}</h3>
                                    <p><strong>ผู้เบิก:</strong> {item.fullname}</p>
                                    <p><strong>จำนวน:</strong> {item.usage_qty} {item.unit}</p>
                                    <p><strong>วันที่ทำรายการ:</strong> {formatDate(item.date)}</p>
                                </div>
                            </div>
                        )) : <p className="no-data">ไม่มีรายการที่มีมูลค่าสูง</p>
                    )}
                </div>
            )}
        </div>
    );
}

export default ManagerAlertPage;