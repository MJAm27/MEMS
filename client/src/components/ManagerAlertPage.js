import React, { useEffect, useState } from "react";
import axios from "axios";
import { 
  FaClock, FaBoxOpen, FaExclamationTriangle, 
  FaMoneyBillWave, FaCheck, FaUser, FaDesktop 
} from "react-icons/fa";
import "./ManagerAlertPage.css";

const API_BASE_URL = process.env.REACT_APP_API_URL;

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

  // ฟังก์ชันสำหรับกดรับทราบรายการอะไหล่มูลค่าสูง
  const handleAcknowledge = async (transactionId) => {
    if (!window.confirm("คุณได้รับทราบการเบิกอะไหล่มูลค่าสูงรายการนี้แล้วใช่หรือไม่?")) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/alerts/acknowledge-high-value`, 
        { transaction_id: transactionId }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // รีโหลดข้อมูลเพื่อให้รายการที่รับทราบแล้วหายไป
      fetchAlerts();
    } catch (err) {
      console.error("Error acknowledging alert:", err);
      alert("ไม่สามารถบันทึกการรับทราบได้");
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
            <h3>เบิกมูลค่าสูง</h3>
            <span className="badge-count">{highValueList.length} รายการ</span>
          </div>
        </button>
      </div>

      <div className="alert-content-header">
        <h3>
          {activeTab === "expire" && "แจ้งเตือน: สินค้าใกล้หมดอายุ"}
          {activeTab === "stock" && "แจ้งเตือน: สินค้าคงคลังต่ำกว่าจุดสั่งซื้อ"}
          {activeTab === "high-value" && "แจ้งเตือน: รายการเบิกอะไหล่มูลค่าสูง (> 5000 บาท)"}
        </h3>
      </div>

      {loading ? (
        <p className="loading-text">กำลังโหลดข้อมูล...</p>
      ) : (
        <div className="alert-list">
          {/* 1. ส่วนแสดงผล High Value (รายการเบิกจริง) */}
          {activeTab === "high-value" && (
            highValueList.length > 0 ? (
              highValueList.map((item) => (
                <div key={item.transaction_id} className="alert-item-card high-value-border">
                  <div className="item-image">
                    {item.img ? (
                      <img
                        src={`${API_BASE_URL}/uploads/${item.img}`}
                        alt={item.equipment_name}
                      />
                    ) : (
                      <div className="no-img-text">ไม่มีรูป</div>
                    )}
                  </div>
                  <div className="item-details" style={{ flex: 1 }}>
                    <div className="detail-header-flex">
                      <h4 className="text-success">ราคาหน่วยละ : {Number(item.price).toLocaleString()} บาท</h4>
                      <span className="type-badge">{item.transaction_type_name}</span>
                    </div>
                    <h3>{item.equipment_name}</h3>
                    
                    <div className="info-grid-container">
                      <p><FaUser className="inline-icon" /> <strong>ผู้เบิก:</strong> {item.user_name}</p>
                      <p><FaDesktop className="inline-icon" /> <strong>ใช้กับเครื่อง:</strong> {item.machine_name || "ไม่ระบุ"} ({item.machine_id || "-"})</p>
                      <p><FaClock className="inline-icon" /> <strong>วันเวลา:</strong> {formatDate(item.date)} | {item.time.substring(0, 5)} น.</p>
                      <p><strong>จำนวน:</strong> <span className="text-danger">{item.quantity}</span> {item.unit || "หน่วย"}</p>
                    </div>

                    <p className="warning-text-box">
                      <FaExclamationTriangle /> อะไหล่ควบคุมพิเศษเนื่องจากมีมูลค่าสูง
                    </p>
                  </div>

                  <div className="acknowledge-action-zone">
                    <button 
                      className="btn-modern-check" // เปลี่ยนชื่อคลาส
                      onClick={() => handleAcknowledge(item.transaction_id)}
                      title="รับทราบและลบรายการแจ้งเตือน"
                    >
                      <div className="check-icon-wrapper">
                        <FaCheck />
                      </div>
                      <span className="btn-tooltip">รับทราบ</span>
                    </button>
                  </div>
                </div>
              ))
            ) : <p className="no-data">ไม่มีรายการเบิกอะไหล่มูลค่าสูงที่ยังไม่ได้ตรวจสอบ</p>
          )}

          {/* 2. ส่วนแสดงผล Expire List */}
          {activeTab === "expire" && (
             expireList.length > 0 ? (
                expireList.map((item) => (
                    <div key={item.lot_id} className="alert-item-card">
                        <div className="item-image">
                          {item.img ? <img src={`${API_BASE_URL}/uploads/${item.img}`} alt={item.equipment_name} /> : <div className="no-img-text">ไม่มีรูป</div>}
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
                          {item.img ? <img src={`${API_BASE_URL}/uploads/${item.img}`} alt={item.equipment_name} /> : <div className="no-img-text">ไม่มีรูป</div>}
                        </div>
                        <div className="item-details">
                            <h4 className="text-danger">เหลือปัจจุบัน : {item.total_stock} {item.unit || "หน่วย"}</h4>
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