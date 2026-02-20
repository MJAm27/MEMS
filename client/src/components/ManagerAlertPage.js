import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { 
    FaClock, 
    FaBoxOpen, 
    FaExclamationTriangle, 
    FaDollarSign 
} from "react-icons/fa";
import "./AlertPage.css"; // ใช้ CSS เดียวกับ AlertPage เพื่อความสวยงามที่เหมือนกัน

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:3001";

function ManagerAlertPage() {
    // 1. เพิ่ม Tab 'expensive' สำหรับ Manager
    const [activeTab, setActiveTab] = useState("expire"); 
    const [expireList, setExpireList] = useState([]);
    const [stockList, setStockList] = useState([]);
    const [expensiveList, setExpensiveList] = useState([]); 
    const [loading, setLoading] = useState(true);

    const fetchAlerts = useCallback(async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            // เรียก API ทั้ง 3 ตัวพร้อมกัน
            const [expireRes, stockRes, expensiveRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/alerts/expire`, { headers }),
                axios.get(`${API_BASE_URL}/api/alerts/low-stock`, { headers }),
                axios.get(`${API_BASE_URL}/api/alerts/expensive-usage`, { headers }) // API เฉพาะ Manager
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

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('th-TH', {
            year: 'numeric', month: '2-digit', day: '2-digit'
        });
    };

    return (
        <div className="alert-page-container">
            <h2 className="mb-6 text-2xl font-bold">การแจ้งเตือนสำหรับผู้จัดการ</h2>
            
            {/* Tabs Navigation - ปรับให้มี 3 อัน */}
            <div className="alert-tabs">
                <div className={`alert-tab-card ${activeTab === 'expire' ? 'active' : ''}`} onClick={() => setActiveTab('expire')}>
                    <div className="icon-circle"><FaClock /></div>
                    <div className="tab-text">
                        <h3>ใกล้หมดอายุ</h3>
                        <span className="badge-count">{expireList.length} รายการ</span>
                    </div>
                </div>

                <div className={`alert-tab-card ${activeTab === 'stock' ? 'active' : ''}`} onClick={() => setActiveTab('stock')}>
                    <div className="icon-circle"><FaBoxOpen /></div>
                    <div className="tab-text">
                        <h3>สต็อกต่ำ</h3>
                        <span className="badge-count">{stockList.length} รายการ</span>
                    </div>
                </div>

                <div className={`alert-tab-card expensive ${activeTab === 'expensive' ? 'active' : ''}`} 
                     onClick={() => setActiveTab('expensive')}
                     style={{ backgroundColor: activeTab === 'expensive' ? '#3498db' : '#85c1e9' }}>
                    <div className="icon-circle"><FaDollarSign /></div>
                    <div className="tab-text">
                        <h3>มูลค่าสูง</h3>
                        <span className="badge-count">{expensiveList.length} รายการ</span>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="text-center p-10">กำลังโหลดข้อมูล...</div>
            ) : (
                <div className="alert-list">
                    {/* ส่วนของ "ใกล้หมดอายุ" (Copy จาก AlertPage) */}
                    {activeTab === "expire" && (
                        expireList.length > 0 ? expireList.map((item) => (
                            <div key={item.lot_id} className="alert-item-card">
                                <div className="item-image">
                                    <img src={item.img || "https://via.placeholder.com/150"} alt={item.equipment_name} />
                                </div>
                                <div className="item-details">
                                    <h4 className="text-warning">วันหมดอายุ : {formatDate(item.expiry_date)}</h4>
                                    <h3>{item.equipment_name} (Lot: {item.lot_id})</h3>
                                    <p><strong>คงเหลือใน Lot:</strong> {item.current_quantity}</p>
                                    <p className="warning-text"><FaExclamationTriangle /> เหลือเวลาอีก {item.days_remaining} วัน</p>
                                </div>
                            </div>
                        )) : <p className="no-data">ไม่มีรายการแจ้งเตือน</p>
                    )}

                    {/* ส่วนของ "สต็อกต่ำ" (Copy จาก AlertPage) */}
                    {activeTab === "stock" && (
                        stockList.length > 0 ? stockList.map((item) => (
                            <div key={item.equipment_id} className="alert-item-card" style={{borderLeftColor: '#e74c3c'}}>
                                <div className="item-image">
                                    <img src={item.img || "https://via.placeholder.com/150"} alt={item.equipment_name} />
                                </div>
                                <div className="item-details">
                                    <h4 style={{color: '#e74c3c'}}>คงเหลือรวม : {item.total_quantity} ชิ้น</h4>
                                    <h3>{item.equipment_name}</h3>
                                    <p><strong>จุดสั่งซื้อ:</strong> {item.alert_quantity} ชิ้น</p>
                                    <p className="warning-text">กรุณาสั่งซื้อเพิ่มเติม</p>
                                </div>
                            </div>
                        )) : <p className="no-data">ไม่มีรายการแจ้งเตือน</p>
                    )}

                    {/* ส่วนใหม่: "มูลค่าสูง" (เฉพาะ Manager) */}
                    {activeTab === "expensive" && (
                        expensiveList.length > 0 ? expensiveList.map((item, idx) => (
                            <div key={idx} className="alert-item-card" style={{borderLeftColor: '#3498db'}}>
                                <div className="item-details">
                                    <h4 style={{color: '#3498db'}}>มูลค่าการเบิก : {item.total_price?.toLocaleString()} บาท</h4>
                                    <h3>{item.equipment_name}</h3>
                                    <p><strong>ผู้เบิก:</strong> {item.fullname}</p>
                                    <p><strong>จำนวน:</strong> {item.usage_qty} {item.unit}</p>
                                    <p><strong>วันที่:</strong> {formatDate(item.date)}</p>
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