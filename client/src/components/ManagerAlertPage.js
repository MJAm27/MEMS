import React, { useEffect, useState } from "react";
import axios from "axios";
import { FaClock, FaBoxOpen, FaExclamationTriangle, FaMoneyBillWave } from "react-icons/fa";
import "./ManagerAlertPage.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:3001";

function ManagerAlertPage() {
  const [activeTab, setActiveTab] = useState("expire");
  const [expireList, setExpireList] = useState([]);
  const [stockList, setStockList] = useState([]);
  const [highValueList, setHighValueList] = useState([]); 
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // ใช้การเรียก API แยกกันเพื่อป้องกันกรณี API ตัวใดตัวหนึ่ง Error แล้วตัวอื่นพังไปด้วย
      const [expireRes, stockRes, highValueRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/alerts/expire`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/api/alerts/low-stock`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/api/alerts/high-value`, { headers }).catch(() => ({ data: [] }))
      ]);

      setExpireList(expireRes.data || []);
      setStockList(stockRes.data || []);
      setHighValueList(highValueRes.data || []);
    } catch (err) {
      console.error("Error fetching alerts:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    return new Date(dateString).toLocaleDateString('th-TH', options);
  };

  return (
    <div className="alert-page-container">
      <h2 className="page-title">การแจ้งเตือน</h2>

      <div className="alert-tabs">
        <button 
          className={`alert-tab-card ${activeTab === "expire" ? "active" : ""}`}
          onClick={() => setActiveTab("expire")}
        >
          <div className="icon-circle expire-icon"><FaClock /></div>
          <div className="tab-text">
            <h3>ใกล้หมดอายุ</h3>
            <span className="badge-count">{expireList.length} รายการ</span>
          </div>
        </button>

        <button 
          className={`alert-tab-card ${activeTab === "stock" ? "active" : ""}`}
          onClick={() => setActiveTab("stock")}
        >
          <div className="icon-circle stock-icon"><FaBoxOpen /></div>
          <div className="tab-text">
            <h3>คงคลังน้อย</h3>
            <span className="badge-count">{stockList.length} รายการ</span>
          </div>
        </button>

        <button 
          className={`alert-tab-card ${activeTab === "high-value" ? "active" : ""}`}
          onClick={() => setActiveTab("high-value")}
        >
          <div className="icon-circle value-icon"> 
            <FaMoneyBillWave />
          </div>
          <div className="tab-text">
            <h3>มูลค่าสูง {">"} 1,000</h3>
            <span className="badge-count">{highValueList.length} รายการ</span>
          </div>
        </button>
      </div>

      <div className="alert-content-header">
        <h3>
            {activeTab === "expire" && "แจ้งเตือน: สินค้าใกล้หมดอายุ"}
            {activeTab === "stock" && "แจ้งเตือน: สินค้าคงคลังต่ำกว่าจุดสั่งซื้อ"}
            {activeTab === "high-value" && "แจ้งเตือน: อะไหล่มูลค่าสูงในคลัง"}
        </h3>
      </div>

      {loading ? (
        <p className="loading-text">กำลังโหลดข้อมูล...</p>
      ) : (
        <div className="alert-list">
          {/* 1. ส่วนแสดงผล High Value List */}
          {activeTab === "high-value" && (
            highValueList.length > 0 ? (
              highValueList.map((item) => (
                <div key={item.lot_id || item.equipment_id} className="alert-item-card high-value-border">
                  <div className="item-image">
                    <img 
                        src={item.img && item.img !== "NULL" ? item.img : "/default-image.png"} 
                        alt={item.equipment_name} 
                    />
                  </div>
                  <div className="item-details">
                    <h4 className="text-success">ราคาหน่วยละ : {Number(item.price).toLocaleString()} บาท</h4>
                    <h3>{item.equipment_name}</h3>
                    <p><strong>รหัสอุปกรณ์:</strong> {item.equipment_id}</p>
                    <p><strong>คงเหลือในคลัง:</strong> {item.total_quantity} {item.unit_name || "หน่วย"}</p>
                    <p className="warning-text" style={{ color: '#e67e22' }}>
                      <FaExclamationTriangle /> อะไหล่ควบคุมพิเศษเนื่องจากมีมูลค่าสูง
                    </p>
                  </div>
                </div>
              ))
            ) : <p className="no-data">ไม่มีอะไหล่มูลค่าสูงเกิน 1,000 บาท</p>
          )}

          {/* 2. ส่วนแสดงผล Expire List */}
          {activeTab === "expire" && (
             expireList.length > 0 ? (
                expireList.map((item) => (
                    <div key={item.lot_id} className="alert-item-card">
                        <div className="item-image">
                            <img src={item.img && item.img !== "NULL" ? item.img : "https://via.placeholder.com/150"} alt={item.equipment_name} />
                        </div>
                        <div className="item-details">
                            <h4 className="text-danger">จำนวน : {item.current_quantity} {item.unit || "หน่วย"}</h4>
                            <h3>{item.equipment_name}</h3>
                            <p><strong>Lot ID:</strong> {item.lot_id}</p>
                            <p><strong>วันหมดอายุ:</strong> {formatDate(item.expiry_date)}</p>
                            <p className="warning-text">
                              <FaExclamationTriangle /> {item.days_remaining <= 0 ? "หมดอายุแล้ว" : `เหลืออีก ${item.days_remaining} วัน`}
                            </p>
                        </div>
                    </div>
                ))
             ) : <p className="no-data">ไม่มีรายการแจ้งเตือนสินค้าหมดอายุ</p>
          )}

          {/* 3. ส่วนแสดงผล Low Stock List */}
          {activeTab === "stock" && (
             stockList.length > 0 ? (
                stockList.map((item) => (
                    <div key={item.equipment_id} className="alert-item-card">
                        <div className="item-image">
                            <img src={item.img && item.img !== "NULL" ? item.img : "https://via.placeholder.com/150"} alt={item.equipment_name} />
                        </div>
                        <div className="item-details">
                            <h4 className="text-danger">เหลือปัจจุบัน : {item.total_quantity} {item.unit || "หน่วย"}</h4>
                            <h3>{item.equipment_name}</h3>
                            <p><strong>จุดสั่งซื้อที่กำหนด:</strong> {item.alert_quantity} {item.unit || "หน่วย"}</p>
                            <p className="warning-text">สถานะ: ต่ำกว่าจุดสั่งซื้อที่กำหนด กรุณาสั่งซื้อเพิ่ม</p>
                        </div>
                    </div>
                ))
             ) : <p className="no-data">ไม่มีรายการสินค้าคงคลังน้อย</p>
          )}
        </div>
      )}
    </div>
  );
}

export default ManagerAlertPage;