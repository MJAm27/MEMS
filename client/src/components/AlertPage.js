import React, { useEffect, useState } from "react";
import axios from "axios";
import { FaClock, FaBoxOpen, FaExclamationTriangle } from "react-icons/fa";
import "./AlertPage.css";

const API_BASE_URL = process.env.REACT_APP_API_URL;

function AlertPage() {
  const [activeTab, setActiveTab] = useState("expire"); // 'expire' หรือ 'stock'
  const [expireList, setExpireList] = useState([]);
  const [stockList, setStockList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const [expireRes, stockRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/alerts/expire`),
        axios.get(`${API_BASE_URL}/api/alerts/low-stock`)
      ]);
      setExpireList(expireRes.data);
      setStockList(stockRes.data);
    } catch (err) {
      console.error("Error fetching alerts:", err);
    } finally {
      setLoading(false);
    }
  };

  // ฟังก์ชันแปลงวันที่
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    return new Date(dateString).toLocaleDateString('th-TH', options);
  };

  return (
    <div className="alert-page-container">
      <h2 className="page-title">การแจ้งเตือน</h2>

      {/* ปุ่มเลือก Tab ด้านบน */}
      <div className="alert-tabs">
        <button 
          className={`alert-tab-card ${activeTab === "expire" ? "active" : ""}`}
          onClick={() => setActiveTab("expire")}
        >
          <div className="icon-circle expire-icon">
            <FaClock />
          </div>
          <div className="tab-text">
            <h3>อะไหล่ที่ใกล้หมดอายุ</h3>
            <span className="badge-count">{expireList.length} รายการ</span>
          </div>
        </button>

        <button 
          className={`alert-tab-card ${activeTab === "stock" ? "active" : ""}`}
          onClick={() => setActiveTab("stock")}
        >
          <div className="icon-circle stock-icon">
            <FaBoxOpen />
          </div>
          <div className="tab-text">
            <h3>อะไหล่คงคลังน้อย</h3>
            <span className="badge-count">{stockList.length} รายการ</span>
          </div>
        </button>
      </div>

      <div className="alert-content-header">
        <h3>แจ้งเตือนล่าสุด: {activeTab === "expire" ? "ใกล้หมดอายุ" : "คงคลังน้อย"}</h3>
      </div>

      {/* แสดงรายการ */}
      {loading ? (
        <p className="loading-text">กำลังโหลดข้อมูล...</p>
      ) : (
        <div className="alert-list">
          {activeTab === "expire" && (
            expireList.length > 0 ? (
              expireList.map((item) => (
                <div key={item.lot_id} className="alert-item-card">
                 <div className="item-image">
                    {item.img ? (
                      <img 
                        src={`${API_BASE_URL}/uploads/${item.img}`} 
                        alt={item.equipment_name} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
                      />
                    ) : (
                      <div style={{ color: '#ccc', fontSize: '0.8rem', textAlign: 'center' }}>ไม่มีรูป</div>
                    )}
                  </div>
                  <div className="item-details">
                    <h4 className="text-danger">จำนวน : {item.current_quantity} ชิ้น</h4>
                    <h3>{item.equipment_name}</h3>
                    <p><strong>Lot ID:</strong> {item.lot_id}</p>
                    <p><strong>บริษัท:</strong> {item.supplier_name || "-"}</p>
                    <p><strong>วันหมดอายุ:</strong> {formatDate(item.expiry_date)}</p>
                    <p className="warning-text">
                      <FaExclamationTriangle /> เหลืออีก {item.days_remaining} วัน
                    </p>
                  </div>
                </div>
              ))
            ) : <p className="no-data">ไม่มีรายการแจ้งเตือน</p>
          )}

          {activeTab === "stock" && (
            stockList.length > 0 ? (
              stockList.map((item) => (
                <div key={item.equipment_id} className="alert-item-card">
                  <div className="item-image">
                    {item.img ? (
                      <img 
                        src={`${API_BASE_URL}/uploads/${item.img}`} 
                        alt={item.equipment_name} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
                      />
                    ) : (
                      <div style={{ color: '#ccc', fontSize: '0.8rem', textAlign: 'center' }}>ไม่มีรูป</div>
                    )}
                  </div>
                  <div className="item-details">
                    <h4 className="text-danger">เหลือปัจจุบัน : {item.total_stock} ชิ้น</h4>
                    <h3>{item.equipment_name}</h3>
                    <p><strong>จุดสั่งซื้อ (Alert):</strong> {item.alert_quantity} ชิ้น</p>
                    <p className="warning-text">
                       กรุณาสั่งซื้อเพิ่ม
                    </p>
                  </div>
                </div>
              ))
            ) : <p className="no-data">ไม่มีรายการแจ้งเตือน</p>
          )}
        </div>
      )}
    </div>
  );
}

export default AlertPage;